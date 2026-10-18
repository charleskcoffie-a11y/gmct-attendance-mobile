import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const migration = await readFile(new URL('../sql/2026-09-28_add_member_self_attendance.sql', import.meta.url), 'utf8');
// Fix the server clock so Sunday/location rules are exercised on every test day.
const sundayMigration = migration.replaceAll('CURRENT_TIMESTAMP', "TIMESTAMPTZ '2026-10-18 16:00:00+00'");
const source = await readFile(new URL('../src/attendanceStatus.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { applyAttendanceStatuses } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

async function createDatabase(statusColumns = 'active BOOLEAN DEFAULT true') {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE SQL AS
      $$ SELECT '00000000-0000-0000-0000-000000000001'::UUID $$;
    CREATE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE SQL AS
      $$ SELECT jsonb_build_object('email', current_setting('test.email', true)) $$;
    CREATE TABLE public.members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT, name TEXT,
      class_number TEXT, ${statusColumns}
    );
    CREATE TABLE public.app_settings (id TEXT PRIMARY KEY);
    INSERT INTO public.app_settings VALUES ('app_settings');
    CREATE TABLE public.attendance (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), class_number TEXT,
      attendance_date DATE, service_type TEXT, class_leader_name TEXT,
      total_members_present INTEGER DEFAULT 0, total_members_absent INTEGER DEFAULT 0,
      total_visitors INTEGER DEFAULT 0
    );
    CREATE TABLE public.member_attendance (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      attendance_id UUID REFERENCES public.attendance(id),
      member_id UUID REFERENCES public.members(id),
      member_name TEXT, class_number TEXT, status TEXT,
      absence_reason TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (attendance_id, member_id)
    );
    INSERT INTO public.members(email, name, class_number)
    VALUES ('self@example.test', 'Self member', '1'), ('leader@example.test', 'Other member', '1');
    SELECT set_config('test.email', 'self@example.test', false);
  `);
  await db.exec(sundayMigration);
  return db;
}

async function markSelf(db) {
  const { rows } = await db.query(`
    SELECT public.mark_member_self_attendance(43.754830, -79.556720, 10) AS result
  `);
  return rows[0].result;
}

async function totals(db, id) {
  const { rows } = await db.query(`
    SELECT total_members_present AS present, total_members_absent AS absent,
           total_members_sick AS sick, total_members_travel AS travel
    FROM public.attendance WHERE id = $1
  `, [id]);
  return rows[0];
}

for (const statusColumns of ['active BOOLEAN DEFAULT true', 'is_active BOOLEAN DEFAULT true', 'active BOOLEAN DEFAULT true, is_active BOOLEAN DEFAULT false']) {
  test(`self-first, stale leader upsert, totals and retries: ${statusColumns}`, async () => {
    const db = await createDatabase(statusColumns);
    try {
      const first = await markSelf(db);
      assert.equal(first.already_marked, false);
      assert.equal(first.attendance_date, '2026-10-18');
      // A leader opened the list before the self mark and submits it as absent.
      await db.exec(`
        UPDATE public.attendance SET total_members_present = 0, total_members_absent = 2,
          class_leader_name = 'Class 1 Leader';
        INSERT INTO public.member_attendance(attendance_id, member_id, member_name, class_number, status, absence_reason)
        SELECT '${first.attendance_id}', id, name, class_number, 'absent', 'S' FROM public.members
        ON CONFLICT (attendance_id, member_id) DO UPDATE
        SET status = EXCLUDED.status, absence_reason = EXCLUDED.absence_reason;
      `);
      const { rows } = await db.query(`
        SELECT ma.* FROM public.member_attendance ma
        JOIN public.members m ON m.id = ma.member_id WHERE m.email = 'self@example.test'
      `);
      assert.equal(rows[0].status, 'present');
      assert.equal(rows[0].absence_reason, null);
      assert.ok(rows[0].self_marked_at);
      assert.deepEqual(await totals(db, first.attendance_id), { present: 1, absent: 1, sick: 1, travel: 0 });
      // Even explicitly clearing the protection timestamp cannot demote this member.
      await db.exec(`UPDATE public.member_attendance SET status = 'travel', absence_reason = 'D', self_marked_at = NULL`);
      assert.deepEqual(await totals(db, first.attendance_id), { present: 1, absent: 1, sick: 0, travel: 1 });
      const retry = await markSelf(db);
      assert.equal(retry.already_marked, true);
      assert.equal(retry.attendance_id, first.attendance_id);
      assert.equal((await db.query('SELECT COUNT(*)::INT AS count FROM public.attendance')).rows[0].count, 1);
      // An update/rerun must preserve protected attendance.
      await db.exec(sundayMigration);
      assert.deepEqual(await totals(db, first.attendance_id), { present: 1, absent: 1, sick: 0, travel: 1 });
    } finally {
      await db.close();
    }
  });
}

test('leader-first: self marking replaces sickness in the same class record and updates all totals', async () => {
  const db = await createDatabase();
  try {
    await db.exec(`
      INSERT INTO public.attendance(class_number, attendance_date, service_type, class_leader_name,
        total_members_absent, total_members_sick)
      VALUES ('1', '2026-10-18', 'sunday', 'Class 1 Leader', 2, 2);
      INSERT INTO public.member_attendance(attendance_id, member_id, member_name, class_number, status, absence_reason)
      SELECT a.id, m.id, m.name, m.class_number, 'sick', 'S'
      FROM public.attendance a CROSS JOIN public.members m;
    `);
    const id = (await db.query('SELECT id FROM public.attendance')).rows[0].id;
    assert.equal((await markSelf(db)).attendance_id, id);
    assert.deepEqual(await totals(db, id), { present: 1, absent: 1, sick: 1, travel: 0 });
    await db.exec(`UPDATE public.attendance SET total_members_present = 0, total_members_absent = 99`);
    assert.deepEqual(await totals(db, id), { present: 1, absent: 1, sick: 1, travel: 0 });
    await assert.rejects(db.exec(`UPDATE public.member_attendance SET member_id = gen_random_uuid()
      WHERE self_marked_at IS NOT NULL`), /cannot be moved/);
  } finally {
    await db.close();
  }
});

test('existing leader-marked Present becomes protected after location-verified confirmation', async () => {
  const db = await createDatabase();
  try {
    const first = await markSelf(db);
    await db.exec('ALTER TABLE public.member_attendance DISABLE TRIGGER protect_self_marked_attendance');
    await db.exec('UPDATE public.member_attendance SET self_marked_at = NULL');
    await db.exec('ALTER TABLE public.member_attendance ENABLE TRIGGER protect_self_marked_attendance');
    assert.equal((await markSelf(db)).already_marked, true);
    await db.exec("UPDATE public.member_attendance SET status = 'absent'");
    assert.deepEqual(await totals(db, first.attendance_id), { present: 1, absent: 0, sick: 0, travel: 0 });
  } finally {
    await db.close();
  }
});

test('inactive members and out-of-area requests are rejected; active takes precedence over alias', async () => {
  const db = await createDatabase('active BOOLEAN DEFAULT true, is_active BOOLEAN DEFAULT true');
  try {
    await db.exec("UPDATE public.members SET active = false WHERE email = 'self@example.test'");
    await assert.rejects(markSelf(db), /Active member profile not found/);
    await db.exec("UPDATE public.members SET active = NULL, is_active = false WHERE email = 'self@example.test'");
    await assert.rejects(markSelf(db), /Active member profile not found/);
    await db.exec("UPDATE public.members SET active = true WHERE email = 'self@example.test'");
    await assert.rejects(db.query('SELECT public.mark_member_self_attendance(0, 0, 10)'), /outside the church/);
    await assert.rejects(db.query('SELECT public.mark_member_self_attendance(43.754830, -79.556720, 1000)'), /accuracy is too low/);
    assert.equal((await markSelf(db)).already_marked, false);
  } finally {
    await db.close();
  }
});

test('leader-only/Bible Study attendance remains editable without self-attendance protection', async () => {
  const db = await createDatabase();
  try {
    await db.exec(`
      INSERT INTO public.attendance(class_number, attendance_date, service_type) VALUES ('1', '2026-10-18', 'bible-study');
      INSERT INTO public.member_attendance(attendance_id, member_id, status)
      SELECT a.id, m.id, 'present' FROM public.attendance a CROSS JOIN public.members m;
      UPDATE public.member_attendance SET status = 'absent', absence_reason = 'B';
      UPDATE public.attendance SET total_members_present = 0, total_members_absent = 2;
    `);
    const { rows } = await db.query('SELECT status, self_marked_at FROM public.member_attendance');
    assert.ok(rows.every(row => row.status === 'absent' && row.self_marked_at === null));
  } finally {
    await db.close();
  }
});

test('multiple members self-mark into the same Sunday class record', async () => {
  const db = await createDatabase();
  try {
    const first = await markSelf(db);
    await db.exec("SELECT set_config('test.email', 'leader@example.test', false)");
    const second = await markSelf(db);
    assert.equal(first.attendance_id, second.attendance_id);
    assert.deepEqual(await totals(db, first.attendance_id), { present: 2, absent: 0, sick: 0, travel: 0 });
  } finally {
    await db.close();
  }
});

test('migration protects identifiable legacy self-attendance without labelling leader-only entries', async () => {
  const db = await createDatabase();
  try {
    const first = await markSelf(db);
    await db.exec(`
      ALTER TABLE public.member_attendance DISABLE TRIGGER protect_self_marked_attendance;
      UPDATE public.member_attendance SET self_marked_at = NULL;
      ALTER TABLE public.member_attendance ENABLE TRIGGER protect_self_marked_attendance;
    `);
    await db.exec(sundayMigration);
    await db.exec("UPDATE public.member_attendance SET status = 'absent'");
    assert.deepEqual(await totals(db, first.attendance_id), { present: 1, absent: 0, sick: 0, travel: 0 });
  } finally {
    await db.close();
  }
});

test('leader list maps saved statuses by member ID, protects self marks, and preserves absence reasons', () => {
  const members = ['self', 'sick', 'travel', 'business', 'unmarked'].map(id => ({ id, name: 'Same name' }));
  const statuses = [
    { member_id: 'self', member_name: 'Old name', status: 'present', self_marked_at: '2026-10-18T16:00:00Z', absence_reason: 'S' },
    { member_id: 'sick', member_name: 'Same name', status: 'sick' },
    { member_id: 'travel', member_name: 'Same name', status: 'travel' },
    { member_id: 'business', member_name: 'Same name', status: 'absent', absence_reason: 'b' },
  ];
  const result = applyAttendanceStatuses(members, statuses);
  assert.deepEqual(result.map(m => [m.attendanceStatus, m.absenceReason, m.selfMarked]), [
    ['present', '', true], ['absent', 'S', false], ['absent', 'D', false],
    ['absent', 'B', false], ['absent', '', false],
  ]);
  assert.ok(applyAttendanceStatuses(members, []).every(m => m.attendanceStatus === 'absent' && !m.selfMarked));
});

test('attendance row labels and disables protected self marks, while ordinary members remain editable', async () => {
  const rowSource = await readFile(new URL('../src/components/MemberAttendanceRow.tsx', import.meta.url), 'utf8');
  const rowCode = ts.transpileModule(rowSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  new Function('require', 'exports', rowCode)(createRequire(import.meta.url), exports);
  const props = {
    id: 'self', name: 'Self member', attendanceStatus: 'present',
    onStatusChange() {}, onAbsenceReasonChange() {}, onEdit() {},
  };
  const protectedRow = renderToStaticMarkup(React.createElement(exports.MemberAttendanceRow, { ...props, selfMarked: true }));
  assert.match(protectedRow, /Self-marked Present \(protected\)/);
  assert.equal((protectedRow.match(/disabled=""/g) || []).length, 2);
  assert.doesNotMatch(protectedRow, /<select/);
  const ordinaryRow = renderToStaticMarkup(React.createElement(exports.MemberAttendanceRow, { ...props, attendanceStatus: 'absent' }));
  assert.doesNotMatch(ordinaryRow, /disabled=""/);
  assert.match(ordinaryRow, /<select/);
});
