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

const supabaseSource = await readFile(new URL('../src/supabase.ts', import.meta.url), 'utf8');
const supabaseCode = ts.transpileModule(supabaseSource.replaceAll('import.meta.env', 'testEnv'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function classMemberService(members, leaders, failTable) {
  const client = {
    from(table) {
      assert.ok(['members', 'class_leaders'].includes(table));
      const filters = [];
      const query = {
        select(columns) {
          if (table === 'class_leaders') assert.equal(columns, 'id, email, class_number, full_name, username');
          return query;
        },
        eq(column, value) {
          filters.push(row => row[column] === value);
          return query;
        },
        in(column, values) {
          filters.push(row => values.includes(row[column]));
          return query;
        },
        ilike(column, pattern) {
          const literal = pattern.replace(/\\([\\%_])/g, '$1');
          filters.push(row => row[column]?.toLowerCase() === literal.toLowerCase());
          return query;
        },
        order() { return query; },
        then(resolve, reject) {
          const data = (table === 'members' ? members : leaders).filter(row => filters.every(filter => filter(row)));
          return Promise.resolve({
            data: table === failTable ? null : data,
            error: table === failTable ? new Error(`Cannot read ${table}`) : null,
          }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  const exports = {};
  new Function('require', 'exports', 'testEnv', supabaseCode)(
    name => {
      assert.equal(name, '@supabase/supabase-js');
      return { createClient: () => client };
    },
    exports,
    { VITE_SUPABASE_URL: 'https://example.test', VITE_SUPABASE_ANON_KEY: 'test-key' },
  );
  return Object.assign(exports.getClassMembers, { getActiveLeaderAssignments: exports.getActiveLeaderAssignments });
}

const rosterMembers = [
  { id: '938', member_number: '938', name: 'James Baah', class_number: '9', email: '938@gmct.member', active: true, phone: '123' },
  { id: '611', member_number: '611', name: 'Class 2 Leader', class_number: '6', email: '611@gmct.member', active: true },
  { id: '101', name: 'Regular member', class_number: '1', email: '101@gmct.member', active: true },
  { id: 'inactive', name: 'Inactive member', class_number: '9', email: 'inactive@gmct.member', active: false },
];
const rosterLeaders = [
  { email: ' 938@GMCT.MEMBER ', class_number: 1, active: true },
  { email: '611@gmct.member', class_number: '2', active: true },
  { email: 'inactive@gmct.member', class_number: 1, active: true },
];

test('member 938 appears once in assigned Class 1 for admins, leaders, and edit/report callers', async () => {
  const getClassMembers = classMemberService(rosterMembers, rosterLeaders);
  for (const includeEmail of [undefined, '101@gmct.member', '938@gmct.member']) {
    const members = await getClassMembers(1, includeEmail);
    assert.deepEqual(members.map(m => m.id), ['938', '101']);
    assert.equal(members[0].assignedClass, 1);
    assert.equal(members[0].class_number, '9');
    assert.equal(members[0].member_number, '938');
    assert.equal(members[0].phoneNumber, '123');
  }
  assert.deepEqual(await getClassMembers(9), []);
  assert.deepEqual(await getClassMembers(9, '938@gmct.member'), []);
  assert.deepEqual((await getClassMembers(2)).map(m => m.id), ['611']);
  assert.deepEqual(await getClassMembers(6), []);
});

test('inactive assignments restore the normal class and admin mappings do not move members', async () => {
  const getClassMembers = classMemberService(rosterMembers, [
    { email: '938@gmct.member', class_number: 1, active: false },
    { email: '611@gmct.member', class_number: -1, active: true },
  ]);
  assert.deepEqual((await getClassMembers(9)).map(m => m.id), ['938']);
  assert.deepEqual((await getClassMembers(6)).map(m => m.id), ['611']);
  assert.deepEqual((await getClassMembers(1)).map(m => m.id), ['101']);
});

test('same-class leaders are not duplicated and legacy include-email remains supported', async () => {
  const getClassMembers = classMemberService(rosterMembers, [
    { email: '101@gmct.member', class_number: 1, active: true },
  ]);
  assert.deepEqual((await getClassMembers(1)).map(m => m.id), ['101']);
  assert.deepEqual((await getClassMembers(1, '938@gmct.member')).map(m => m.id), ['938', '101']);
});

test('leader member email queries escape wildcard characters', async () => {
  const getClassMembers = classMemberService([
    { id: 'leader', name: 'Leader', class_number: '9', email: 'class_leader@gmct.member', active: true },
  ], [{ email: 'class_leader@gmct.member', class_number: 1, active: true }]);
  assert.deepEqual((await getClassMembers(1)).map(m => m.id), ['leader']);
});

test('existing admin assignments resolve changed emails and do not move other members sharing the email', async () => {
  const members = [
    { ...rosterMembers[0], email: 'james@example.test' },
    { id: '201', member_number: '201', name: 'Okyere Samuel', email: '201@gmct.member', class_number: '2', active: true },
    { id: '2009', member_number: '2009', name: 'Other member', email: '201@gmct.member', class_number: '20', active: true },
  ];
  const getClassMembers = classMemberService(members, [
    { email: '938@gmct.member', class_number: 1, active: true },
    { email: '201@gmct.member', class_number: 14, active: true },
  ]);
  assert.deepEqual((await getClassMembers(1)).map(m => m.id), ['938']);
  assert.deepEqual(await getClassMembers(9), []);
  assert.deepEqual((await getClassMembers(14, '201@gmct.member')).map(m => m.id), ['201']);
  assert.deepEqual(await getClassMembers(2), []);
  assert.deepEqual((await getClassMembers(20)).map(m => m.id), ['2009']);
  assert.deepEqual(await getClassMembers(20, '201@gmct.member'), [members[2]].map(m => ({
    ...m, assignedClass: 20, phoneNumber: undefined,
  })));
});

test('ambiguous member numbers and non-number emails are rejected instead of guessing', async () => {
  for (const members of [
    [rosterMembers[0], { ...rosterMembers[0], id: 'duplicate' }],
    [
      { ...rosterMembers[0], email: 'shared@example.test' },
      { ...rosterMembers[1], email: 'shared@example.test' },
    ],
  ]) {
    const getClassMembers = classMemberService(members, [{
      email: members[0].email, class_number: 1, active: true,
    }]);
    await assert.rejects(getClassMembers(1), /Ambiguous member link/);
  }
});

test('member-number resolution preserves unique email fallback for older leader records', async () => {
  const getClassMembers = classMemberService([{
    ...rosterMembers[0], member_number: '999',
  }], [rosterLeaders[0]]);
  assert.deepEqual((await getClassMembers(1)).map(m => m.id), ['938']);
});

test('leader login mapping uses the same resolved member identity as attendance', async () => {
  const members = [
    { ...rosterMembers[0], email: 'james@example.test' },
    { id: '201', member_number: '201', name: 'Samuel', email: '201@gmct.member', active: true },
    { id: '2009', member_number: '2009', name: 'Other member', email: '201@gmct.member', active: true },
  ];
  const getClassMembers = classMemberService(members, [
    { id: 'james-leader', email: '938@gmct.member', class_number: 1, active: true },
    { id: 'samuel-leader', email: '201@gmct.member', class_number: 14, active: true },
  ]);
  const source = await readFile(new URL('../src/services/authService.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source.replaceAll('import.meta.env', 'testEnv'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  new Function('require', 'exports', code)(name =>
    name === '../supabase' ? getClassMembers : createRequire(import.meta.url)(name), exports);
  const service = new exports.AuthService();
  assert.equal((await service.resolveClassLeaderMapping('938', 'james@example.test')).classNumber, 1);
  assert.equal((await service.resolveClassLeaderMapping('201', '201@gmct.member')).classNumber, 14);
  assert.deepEqual(await service.resolveClassLeaderMapping('2009', '201@gmct.member'), {});
});

test('roster query failures and conflicting assignments reject instead of returning incomplete attendance', async () => {
  for (const table of ['members', 'class_leaders']) {
    const getClassMembers = classMemberService(rosterMembers, rosterLeaders, table);
    await assert.rejects(getClassMembers(1), new RegExp(`Cannot read ${table}`));
  }
  const getClassMembers = classMemberService(rosterMembers, [
    ...rosterLeaders, { email: '938@gmct.member', class_number: 2, active: true },
  ]);
  await assert.rejects(getClassMembers(1), /Conflicting class leader assignments/);
});

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
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT, name TEXT, member_number TEXT,
      class_number TEXT, ${statusColumns}
    );
    CREATE TABLE public.app_settings (id TEXT PRIMARY KEY);
    CREATE TABLE public.class_leaders (email TEXT, class_number INTEGER, active BOOLEAN DEFAULT true);
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

test('self-attendance uses the active leader assignment without changing the member profile', async () => {
  const db = await createDatabase();
  try {
    await db.exec(`
      UPDATE public.members SET class_number = '9' WHERE email = 'self@example.test';
      INSERT INTO public.class_leaders(email, class_number) VALUES (' SELF@example.test ', 1);
    `);
    const first = await markSelf(db);
    assert.equal((await db.query('SELECT class_number FROM public.attendance WHERE id = $1', [first.attendance_id])).rows[0].class_number, '1');
    assert.equal((await db.query('SELECT class_number FROM public.member_attendance')).rows[0].class_number, '1');
    assert.equal((await db.query("SELECT class_number FROM public.members WHERE email = 'self@example.test'")).rows[0].class_number, '9');
    await db.exec("SELECT set_config('test.email', 'leader@example.test', false)");
    assert.equal((await markSelf(db)).attendance_id, first.attendance_id);
  } finally {
    await db.close();
  }
});

test('inactive and admin assignments do not override the normal self-attendance class', async () => {
  const db = await createDatabase();
  try {
    await db.exec(`
      INSERT INTO public.class_leaders(email, class_number, active)
      VALUES ('self@example.test', 2, false), ('self@example.test', -1, true);
    `);
    const first = await markSelf(db);
    assert.equal((await db.query('SELECT class_number FROM public.attendance WHERE id = $1', [first.attendance_id])).rows[0].class_number, '1');
  } finally {
    await db.close();
  }
});

test('self-attendance follows member-number assignments when profile emails have changed', async () => {
  const db = await createDatabase();
  try {
    await db.exec(`
      UPDATE public.members SET member_number = '938', class_number = '9' WHERE email = 'self@example.test';
      INSERT INTO public.class_leaders(email, class_number) VALUES ('938@gmct.member', 1);
    `);
    const first = await markSelf(db);
    assert.equal((await db.query('SELECT class_number FROM public.attendance WHERE id = $1', [first.attendance_id])).rows[0].class_number, '1');
  } finally {
    await db.close();
  }
});

test('shared profile emails cannot assign a different member to the class leader role', async () => {
  const db = await createDatabase();
  try {
    await db.exec(`
      UPDATE public.members SET member_number = '201', class_number = '2' WHERE email = 'leader@example.test';
      UPDATE public.members SET email = '201@gmct.member' WHERE member_number = '201';
      UPDATE public.members SET member_number = '2009', email = '201@gmct.member', class_number = '20'
        WHERE email = 'self@example.test';
      INSERT INTO public.class_leaders(email, class_number) VALUES ('201@gmct.member', 14);
      SELECT set_config('test.email', '201@gmct.member', false);
    `);
    // Give each profile the authenticated ID in turn to select the intended account.
    const rows = (await db.query("SELECT id, member_number FROM public.members ORDER BY member_number")).rows;
    for (const member of rows) {
      await db.exec(`CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE SQL AS $$ SELECT '${member.id}'::UUID $$`);
      const first = await markSelf(db);
      const savedClass = (await db.query('SELECT class_number FROM public.attendance WHERE id = $1', [first.attendance_id])).rows[0].class_number;
      assert.equal(savedClass, member.member_number === '201' ? '14' : '20');
    }
  } finally {
    await db.close();
  }
});

test('self-attendance rejects conflicting leader assignments', async () => {
  const db = await createDatabase();
  try {
    await db.exec(`
      INSERT INTO public.class_leaders(email, class_number)
      VALUES ('self@example.test', 1), ('self@example.test', 2);
    `);
    await assert.rejects(markSelf(db), /Conflicting class leader assignments/);
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
