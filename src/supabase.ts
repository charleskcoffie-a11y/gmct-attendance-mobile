// Supabase Service for GMCT Attendance Mobile App
import { createClient } from '@supabase/supabase-js';
import { Member, MemberContribution, MemberContributionInput } from './types';

// These should match your main app's Supabase credentials
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabaseConfigError =
  !SUPABASE_URL || !SUPABASE_ANON_KEY
    ? 'Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env or .env.local.'
    : null;

const createSupabaseStub = () =>
  new Proxy(
    {},
    {
      get() {
        throw new Error(supabaseConfigError || 'Supabase is not configured.');
      }
    }
  ) as any;

export const supabase = supabaseConfigError
  ? createSupabaseStub()
  : createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Fetch app settings including class access codes
export async function getAppSettings(): Promise<any> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .eq('id', 'app_settings')
    .single();
  
  if (error) {
    console.error('Error fetching app settings:', error);
    return null;
  }
  
  return data;
}

// Validate class leader access code
export async function validateClassAccessCode(accessCode: string): Promise<number | null> {
  const settings = await getAppSettings();
  
  if (!settings?.class_access_codes) {
    return null;
  }
  
  try {
    const codes = JSON.parse(settings.class_access_codes);
    
    // Find which class this code belongs to
    for (const [classNum, code] of Object.entries(codes)) {
      if (code === accessCode) {
        return parseInt(classNum);
      }
    }
    
    // Also check for simple "class1", "class2", etc.
    const match = accessCode.match(/class\s*(\d+)/i);
    if (match) {
      return parseInt(match[1]);
    }
  } catch (error) {
    console.error('Error parsing class access codes:', error);
  }
  
  return null;
}

// Get members for a specific class
export async function getClassMembers(classNumber: number) {
  const classNumberText = classNumber.toString();
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('class_number', classNumberText)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching class members:', error);
    return [];
  }

  return (data || []).map((m: any) => ({
    ...m,
    id: String(m.id),
    assignedClass: m.class_number ? parseInt(m.class_number, 10) : undefined,
    phoneNumber: m.phone ?? m.phoneNumber
  }));
}

// Save/update member
export async function saveMember(member: Member) {
  const memberId = String(member.id);
  if (memberId && !memberId.startsWith('member_')) {
    // Update existing member
    const { error } = await supabase
      .from('members')
      .update({
        name: member.name,
        class_number: member.class_number,
        member_number: member.member_number,
        address: member.address,
        city: member.city,
        province: member.province,
        postal_code: member.postal_code,
        phone: member.phone || member.phoneNumber,
        date_of_birth: member.date_of_birth,
        dob_month: member.dob_month,
        dob_day: member.dob_day,
        day_born: member.day_born,
        active: member.is_active
      })
      .eq('id', memberId);
    
    if (error) {
      console.error('Error updating member:', error);
      throw error;
    }
  } else {
    // Insert new member
    const { error } = await supabase
      .from('members')
      .insert({
        name: member.name,
        class_number: member.class_number,
        member_number: member.member_number,
        address: member.address,
        city: member.city,
        province: member.province,
        postal_code: member.postal_code,
        phone: member.phone || member.phoneNumber,
        date_of_birth: member.date_of_birth,
        dob_month: member.dob_month,
        dob_day: member.dob_day,
        day_born: member.day_born,
        active: member.is_active ?? true
      });
    
    if (error) {
      console.error('Error adding member:', error);
      throw error;
    }
  }
}

// Member self-service profile update
export async function updateMemberProfile(
  memberId: string,
  updates: Partial<Pick<Member, 'name' | 'phone' | 'address' | 'city' | 'province' | 'postal_code' | 'date_of_birth' | 'dob_month' | 'dob_day' | 'day_born'>>
) {
  const payload = {
    name: updates.name?.trim(),
    phone: updates.phone?.trim() || null,
    address: updates.address?.trim() || null,
    city: updates.city?.trim() || null,
    province: updates.province?.trim() || null,
    postal_code: updates.postal_code?.trim() || null,
    date_of_birth: updates.date_of_birth?.trim() || null,
    dob_month: updates.dob_month ?? null,
    dob_day: updates.dob_day ?? null,
    day_born: updates.day_born?.trim() || null,
  };

  const { data, error } = await supabase
    .from('members')
    .update(payload)
    .eq('id', memberId)
    .select('*')
    .single();

  if (error) {
    console.error('Error updating member profile:', error);
    throw error;
  }

  return data;
}

// Admin utility: reset a member's auth password to the default.
export async function resetMemberPasswordToDefault(memberId: string, adminCode: string) {
  const { data, error } = await supabase.functions.invoke('reset-member-password', {
    body: {
      memberId: memberId,
      adminCode: adminCode,
    },
  });

  if (error) {
    console.error('Error resetting member password:', error);
    throw error;
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

// Admin utility: bulk create auth accounts for all members who don't have them
export async function bulkCreateMemberAuth(adminCode: string) {
  const { data, error } = await supabase.functions.invoke('Bulk-Create-member-auth', {
    body: {
      adminCode: adminCode,
    },
  });

  if (error) {
    console.error('Error bulk creating member auth:', error);
    throw error;
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

function normalizeContributionCategory(value: string | null | undefined): MemberContribution['category'] {
  // Keep category values aligned with entries.type in the database.
  // This prevents synthetic categories that don't exist in source data.
  return (value || '').toString().trim().toLowerCase();
}

function toEntryType(category: MemberContributionInput['category']): string {
  switch (category) {
    case 'thanksgiving':
    case 'thanksgiving-offering':
      return 'thanksgiving-offering';
    case 'building_fund':
    case 'development-fund':
      return 'development-fund';
    default:
      return category;
  }
}

function isDeletedEntry(value: unknown): boolean {
  if (value === true || value === 1) {
    return true;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === 't' || normalized === '1' || normalized === 'yes';
  }

  return false;
}

function mapEntryRowToContribution(row: any): MemberContribution {
  return {
    id: row.id,
    memberId: row.member_id,
    contributionDate: row.date,
    category: normalizeContributionCategory(row.type),
    amount: Number(row.amount || 0),
    note: row.note || undefined,
    created_at: row.created_at,
    updated_at: row.last_updated || undefined,
  };
}

async function getContributionEntryMemberContext(memberId: string): Promise<{ name: string | null; classNumber: string | null }> {
  const { data, error } = await supabase
    .from('members')
    .select('name, class_number')
    .eq('id', memberId)
    .single();

  if (error) {
    console.warn('Could not load member context for entries write:', error);
    return { name: null, classNumber: null };
  }

  return {
    name: data?.name || null,
    classNumber: data?.class_number || null,
  };
}

async function getMemberContributionsFromLegacyTable(memberId: string): Promise<MemberContribution[]> {
  const { data, error } = await supabase
    .from('member_contributions')
    .select('*')
    .eq('member_id', memberId)
    .order('contribution_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching contributions from fallback table:', error);
    throw error;
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    memberId: row.member_id,
    contributionDate: row.contribution_date,
    category: normalizeContributionCategory(row.category),
    amount: Number(row.amount || 0),
    note: row.note || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function getAllContributionCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from('entries')
    .select('type')
    .not('deleted', 'eq', true);

  if (error) {
    console.warn('Failed to fetch all contribution categories:', error);
    return [];
  }

  const uniqueCategories = new Set<string>();
  (data || []).forEach((row: any) => {
    if (row.type) {
      const normalized = normalizeContributionCategory(row.type);
      if (normalized) {
        uniqueCategories.add(normalized);
      }
    }
  });

  return Array.from(uniqueCategories).sort();
}

export async function getMemberContributions(memberId: string): Promise<MemberContribution[]> {
  const { data, error } = await supabase
    .from('entries')
    .select('id, member_id, date, type, amount, note, created_at, last_updated, deleted')
    .eq('member_id', memberId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Falling back to member_contributions table after entries query failure:', error);
    return getMemberContributionsFromLegacyTable(memberId);
  }

  return (data || [])
    .filter((row: any) => !isDeletedEntry(row.deleted))
    .map((row: any) => mapEntryRowToContribution(row));
}

export async function addMemberContribution(
  memberId: string,
  input: MemberContributionInput
): Promise<MemberContribution> {
  const memberContext = await getContributionEntryMemberContext(memberId);
  const entryType = toEntryType(input.category);
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from('entries')
    .insert({
      id: crypto.randomUUID(),
      date: input.contributionDate,
      member_id: memberId,
      member_name: memberContext.name || 'Member',
      type: entryType,
      fund: entryType === 'development-fund' ? 'development-fund' : 'General',
      method: 'cash',
      amount: input.amount,
      note: input.note?.trim() || '',
      class_number: memberContext.classNumber || '',
      created_by: memberContext.name || 'Member',
      updated_by: memberContext.name || 'Member',
      last_updated: nowIso,
      deleted: false,
      created_at: nowIso,
    })
    .select('id, member_id, date, type, amount, note, created_at, last_updated, deleted')
    .single();

  if (error) {
    console.error('Error adding contribution to entries table:', error);
    throw error;
  }

  return mapEntryRowToContribution(data);
}

export async function updateMemberContribution(
  contributionId: string,
  memberId: string,
  input: MemberContributionInput
): Promise<MemberContribution> {
  const memberContext = await getContributionEntryMemberContext(memberId);
  const entryType = toEntryType(input.category);
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from('entries')
    .update({
      date: input.contributionDate,
      type: entryType,
      fund: entryType === 'development-fund' ? 'development-fund' : 'General',
      amount: input.amount,
      note: input.note?.trim() || '',
      updated_by: memberContext.name || 'Member',
      last_updated: nowIso,
    })
    .eq('id', contributionId)
    .eq('member_id', memberId)
    .select('id, member_id, date, type, amount, note, created_at, last_updated, deleted')
    .single();

  if (error) {
    console.error('Error updating contribution in entries table:', error);
    throw error;
  }

  return mapEntryRowToContribution(data);
}

export async function deleteMemberContribution(contributionId: string, memberId: string) {
  const memberContext = await getContributionEntryMemberContext(memberId);
  const nowIso = new Date().toISOString();

  const { error } = await supabase
    .from('entries')
    .update({
      deleted: true,
      deleted_by: memberContext.name || 'Member',
      deleted_reason: 'Deleted by member in contributions dashboard',
      deleted_at: nowIso,
      updated_by: memberContext.name || 'Member',
      last_updated: nowIso,
    })
    .eq('id', contributionId)
    .eq('member_id', memberId);

  if (error) {
    console.error('Error soft-deleting contribution in entries table:', error);
    throw error;
  }
}

// Delete member
export async function deleteMember(memberId: string) {
  const { error } = await supabase
    .from('members')
    .delete()
    .eq('id', memberId);
  
  if (error) {
    console.error('Error deleting member:', error);
    throw error;
  }
}

// Save attendance records (matches main app structure)
export async function saveAttendance(
  classNumber: number,
  date: string,
  serviceType: 'sunday' | 'bible-study',
  memberRecords: Array<{ memberId: string; status: string; memberName?: string; absenceReason?: string }>,
  classLeaderName?: string
) {
  const normalizedDate = (date || '').slice(0, 10);

  const normalizeAbsenceReason = (value?: string): 'S' | 'D' | 'B' | null => {
    const normalized = (value || '').toString().trim().toUpperCase();
    return normalized === 'S' || normalized === 'D' || normalized === 'B' ? normalized : null;
  };

  const findAttendanceRecord = async (selectClause = 'id') => {
    const dayStart = `${normalizedDate}T00:00:00`;
    const dayEnd = `${normalizedDate}T23:59:59`;

    let result = await supabase
      .from('attendance')
      .select(selectClause)
      .eq('class_number', classNumber.toString())
      .eq('service_type', serviceType)
      .gte('attendance_date', dayStart)
      .lte('attendance_date', dayEnd)
      .order('attendance_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!result.data && !result.error) {
      result = await supabase
        .from('attendance')
        .select(selectClause)
        .eq('class_number', classNumber.toString())
        .eq('attendance_date', normalizedDate)
        .eq('service_type', serviceType)
        .limit(1)
        .maybeSingle();
    }

    return result;
  };

  const normalizedRecords = memberRecords.map((record) => ({
    ...record,
    status: (record.status || '').toString().trim().toLowerCase() || 'absent',
    absenceReason: normalizeAbsenceReason(record.absenceReason),
  }));

  // Calculate summary stats
  const totalMembersPresent = normalizedRecords.filter(r => r.status === 'present').length;
  const totalMembersAbsent = normalizedRecords.filter(r => r.status !== 'present').length;
  const totalMembersSick = normalizedRecords.filter(r => r.status === 'sick' || (r.status !== 'present' && r.absenceReason === 'S')).length;
  const totalMembersTravel = normalizedRecords.filter(r => r.status === 'travel' || (r.status !== 'present' && r.absenceReason === 'D')).length;

  const summaryPayload = {
    class_number: classNumber.toString(),
    attendance_date: normalizedDate,
    service_type: serviceType,
    class_leader_name: classLeaderName || `Class ${classNumber} Leader`,
    total_members_present: totalMembersPresent,
    total_members_absent: totalMembersAbsent,
    total_members_sick: totalMembersSick,
    total_members_travel: totalMembersTravel,
    total_visitors: 0,
  };

  const { data: existingAttendance, error: existingAttendanceError } = await findAttendanceRecord('id');

  if (existingAttendanceError) {
    console.error('Error checking existing attendance summary:', existingAttendanceError);
    throw existingAttendanceError;
  }

  let attendanceData: any = null;
  let attendanceError: any = null;

  if (existingAttendance?.id) {
    const updateResult = await supabase
      .from('attendance')
      .update(summaryPayload)
      .eq('id', existingAttendance.id)
      .select()
      .single();
    attendanceData = updateResult.data;
    attendanceError = updateResult.error;
  } else {
    const insertResult = await supabase
      .from('attendance')
      .insert(summaryPayload)
      .select()
      .single();
    attendanceData = insertResult.data;
    attendanceError = insertResult.error;
  }
  
  if (attendanceError) {
    console.error('Error saving attendance summary:', attendanceError);
    throw attendanceError;
  }

  // Save individual member attendance records in bulk
  if (attendanceData && attendanceData.id) {
    const memberAttendanceRecords = normalizedRecords.map((record) => ({
      attendance_id: attendanceData.id,
      member_id: record.memberId,
      member_name: (record.memberName || record.memberId || '').toString().trim(),
      class_number: classNumber.toString(),
      status:
        record.status === 'present'
          ? 'present'
          : record.absenceReason === 'S'
          ? 'sick'
          : record.absenceReason === 'D'
          ? 'travel'
          : 'absent',
      absence_reason: record.status === 'present' ? null : record.absenceReason,
    }));

    let { error: memberError } = await supabase
      .from('member_attendance')
      .upsert(memberAttendanceRecords, {
        onConflict: 'attendance_id,member_id'
      });

    // Backward compatibility: older databases may not have absence_reason yet.
    if (memberError && (memberError.message || '').toLowerCase().includes('absence_reason')) {
      const fallbackRecords = memberAttendanceRecords.map(({ absence_reason, ...rest }) => rest);
      const { error: fallbackError } = await supabase
        .from('member_attendance')
        .upsert(fallbackRecords, {
          onConflict: 'attendance_id,member_id'
        });
      memberError = fallbackError;
    }

    if (memberError) {
      console.error('Error saving member attendance:', memberError);
      throw memberError;
    }
  }
  
  return attendanceData;
}

// Get attendance for a specific class on a specific date and service type
export async function getAttendanceByDateAndService(
  classNumber: number,
  date: string,
  serviceType: 'sunday' | 'bible-study'
) {
  const normalizedDate = (date || '').slice(0, 10);
  const dayStart = `${normalizedDate}T00:00:00`;
  const dayEnd = `${normalizedDate}T23:59:59`;

  let { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('class_number', classNumber.toString())
    .eq('service_type', serviceType)
    .gte('attendance_date', dayStart)
    .lte('attendance_date', dayEnd)
    .order('attendance_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data && !error) {
    const exactMatch = await supabase
      .from('attendance')
      .select('*')
      .eq('class_number', classNumber.toString())
      .eq('attendance_date', normalizedDate)
      .eq('service_type', serviceType)
      .limit(1)
      .maybeSingle();
    data = exactMatch.data;
    error = exactMatch.error;
  }
  
  if (error) {
    console.error('Error fetching attendance record:', error);
    return null;
  }
  
  return data;
}

// Get existing member attendance records for editing
export async function getMemberAttendanceForDateAndService(
  classNumber: number,
  date: string,
  serviceType: 'sunday' | 'bible-study'
) {
  // Always use plain YYYY-MM-DD to match what Supabase stores
  const normalizedDate = (date || '').slice(0, 10);

  const dayStart = `${normalizedDate}T00:00:00`;
  const dayEnd = `${normalizedDate}T23:59:59`;

  // Try a day-range lookup first so editing works whether attendance_date is
  // stored as a date or a timestamp.
  let { data: attendanceRecord, error: attendanceError } = await supabase
    .from('attendance')
    .select('id')
    .eq('class_number', classNumber.toString())
    .gte('attendance_date', dayStart)
    .lte('attendance_date', dayEnd)
    .eq('service_type', serviceType)
    .order('attendance_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!attendanceRecord && !attendanceError) {
    const exactMatch = await supabase
      .from('attendance')
      .select('id')
      .eq('class_number', classNumber.toString())
      .eq('attendance_date', normalizedDate)
      .eq('service_type', serviceType)
      .limit(1)
      .maybeSingle();

    attendanceRecord = exactMatch.data;
    attendanceError = exactMatch.error;
  }
  
  console.log('📋 Attendance record:', attendanceRecord);
  
  if (attendanceError || !attendanceRecord) {
    console.error('❌ No attendance record found:', attendanceError);
    return [];
  }
  
  // Get member_attendance records WITHOUT the join - just the raw attendance data
  let { data: memberAttendanceData, error: memberError } = await supabase
    .from('member_attendance')
    .select('member_id, member_name, status, absence_reason')
    .eq('attendance_id', attendanceRecord.id)
    .order('member_name', { ascending: true });

  // Backward compatibility: older databases may not have absence_reason yet.
  if (memberError && (memberError.message || '').toLowerCase().includes('absence_reason')) {
    const fallbackQuery = await supabase
      .from('member_attendance')
      .select('member_id, member_name, status')
      .eq('attendance_id', attendanceRecord.id)
      .order('member_name', { ascending: true });

    memberAttendanceData = fallbackQuery.data as any;
    memberError = fallbackQuery.error;
  }

  // Older schemas may also be missing member_name.
  if (memberError && (memberError.message || '').toLowerCase().includes('member_name')) {
    const fallbackWithoutName = await supabase
      .from('member_attendance')
      .select('member_id, status, absence_reason')
      .eq('attendance_id', attendanceRecord.id)
      .order('member_id', { ascending: true });

    memberAttendanceData = fallbackWithoutName.data as any;
    memberError = fallbackWithoutName.error;
  }

  if (memberError && (memberError.message || '').toLowerCase().includes('absence_reason')) {
    const fallbackMinimal = await supabase
      .from('member_attendance')
      .select('member_id, status')
      .eq('attendance_id', attendanceRecord.id)
      .order('member_id', { ascending: true });

    memberAttendanceData = fallbackMinimal.data as any;
    memberError = fallbackMinimal.error;
  }

  console.log('👥 Raw member attendance records from DB:', memberAttendanceData);
  
  if (memberError) {
    console.error('❌ Error fetching member attendance records:', memberError);
    return [];
  }

  const result = (memberAttendanceData || []).map((record: any) => ({
    member_id: record.member_id,
    member_name: (record.member_name || '').trim().replace(/\s+/g, ' '),
    status: (record.status || '').toString().trim().toLowerCase(),
    absence_reason: (record.absence_reason || '').toString().trim().toUpperCase(),
  }));
  
  console.log('📤 Mapped result:', result);
  
  return result;
}

// Get attendance history for a class
export async function getClassAttendanceHistory(classNumber: number, limit = 10) {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('class_number', classNumber.toString())
    .order('attendance_date', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('Error fetching attendance history:', error);
    return [];
  }
  
  return data || [];
}

// Get attendance records for a date range
export async function getAttendanceRange(
  classNumber: number,
  startDate: string,
  endDate: string
) {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('class_number', classNumber.toString())
    .gte('attendance_date', startDate)
    .lte('attendance_date', endDate)
    .order('attendance_date', { ascending: true });

  if (error) {
    console.error('Error fetching attendance range:', error);
    return [];
  }

  return data || [];
}

// Check for existing attendance in the same week for a service type
export async function checkWeeklyAttendance(
  classNumber: number,
  date: string,
  serviceType: 'sunday' | 'bible-study'
) {
  // Calculate week boundaries (Sunday to Saturday)
  const currentDate = new Date(date);
  const dayOfWeek = currentDate.getDay();
  const startOfWeek = new Date(currentDate);
  startOfWeek.setDate(currentDate.getDate() - dayOfWeek); // Set to Sunday
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6); // Set to Saturday
  
  const startDate = startOfWeek.toISOString().split('T')[0];
  const endDate = endOfWeek.toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('class_number', classNumber.toString())
    .eq('service_type', serviceType)
    .gte('attendance_date', startDate)
    .lte('attendance_date', endDate)
    .order('attendance_date', { ascending: false });
  
  if (error) {
    console.error('Error checking weekly attendance:', error);
    return null;
  }
  
  // Return the most recent attendance record for that week and service type
  return data && data.length > 0 ? data[0] : null;
}

// Update attendance totals
export async function updateAttendanceTotals(
  attendanceId: string,
  totals: { present: number; absent: number; visitors?: number }
) {
  const { data, error } = await supabase
    .from('attendance')
    .update({
      total_members_present: totals.present,
      total_members_absent: totals.absent,
      total_visitors: totals.visitors ?? 0,
      last_updated: new Date().toISOString()
    })
    .eq('id', attendanceId)
    .select()
    .single();

  if (error) {
    console.error('Error updating attendance totals:', error);
    throw error;
  }

  return data;
}

// Get member attendance records for a specific attendance event
export async function getMemberAttendanceRecords(attendanceId: string) {
  const { data, error } = await supabase
    .from('member_attendance')
    .select('*, members(id, name)')
    .eq('attendance_id', attendanceId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching member attendance records:', error);
    return [];
  }

  return (data || []).map((record: any) => ({
    member_id: record.member_id,
    member_name: record.members?.name || record.member_id,
    status: record.status,
    attendance_id: record.attendance_id
  }));
}

// Update a member's attendance status
export async function updateMemberAttendanceStatus(
  attendanceId: string,
  memberId: string,
  status: 'present' | 'absent' | 'sick' | 'travel',
  memberName?: string,
  classNumber?: string | number
) {
  const { data, error } = await supabase
    .from('member_attendance')
    .upsert({
      attendance_id: attendanceId,
      member_id: memberId,
      member_name: memberName || memberId,
      class_number: classNumber?.toString() || '',
      status: status,
    }, {
      onConflict: 'attendance_id,member_id'
    })
    .select()
    .single();

  if (error) {
    console.error('Error updating member attendance:', error);
    throw error;
  }

  return data;
}

// Get report notes for members
export async function getReportMemberNotes(
  classNumber: number,
  reportType: 'monthly' | 'quarterly',
  periodKey: string
) {
  const { data, error } = await supabase
    .from('report_member_notes')
    .select('*')
    .eq('class_number', classNumber.toString())
    .eq('report_type', reportType)
    .eq('period_key', periodKey);

  if (error) {
    console.error('Error fetching report notes:', error);
    return [];
  }

  return data || [];
}

// Save report notes for members
export async function saveReportMemberNotes(
  classNumber: number,
  reportType: 'monthly' | 'quarterly',
  periodKey: string,
  notes: Array<{ memberId: string; note: string }>
) {
  const payload = notes.map((note) => ({
    class_number: classNumber.toString(),
    member_id: note.memberId,
    report_type: reportType,
    period_key: periodKey,
    note: note.note,
    updated_at: new Date().toISOString()
  }));

  const { error } = await supabase
    .from('report_member_notes')
    .upsert(payload, { onConflict: 'class_number,member_id,report_type,period_key' });

  if (error) {
    console.error('Error saving report notes:', error);
    throw error;
  }
}

// Get report status (quarterly confirmation)
export async function getClassReportStatus(
  classNumber: number,
  reportType: 'quarterly',
  periodKey: string
) {
  const { data, error } = await supabase
    .from('class_reports')
    .select('*')
    .eq('class_number', classNumber.toString())
    .eq('report_type', reportType)
    .eq('period_key', periodKey)
    .maybeSingle();

  if (error) {
    console.error('Error fetching report status:', error);
    return null;
  }

  return data;
}

// Confirm quarterly report
export async function confirmClassReport(
  classNumber: number,
  reportType: 'quarterly',
  periodKey: string
) {
  const { data, error } = await supabase
    .from('class_reports')
    .upsert({
      class_number: classNumber.toString(),
      report_type: reportType,
      period_key: periodKey,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'class_number,report_type,period_key' })
    .select()
    .single();

  if (error) {
    console.error('Error confirming report:', error);
    throw error;
  }

  return data;
}

// Get all class leaders
export async function getClassLeaders() {
  const { data, error } = await supabase
    .from('class_leaders')
    .select('*')
    .order('username', { ascending: true });
  
  if (error) {
    console.error('Error fetching class leaders:', error);
    return [];
  }
  
  // Map from snake_case DB fields to camelCase
  return (data || []).map((cl: any) => ({
    id: cl.id,
    username: cl.username,
    password: cl.password,
    classNumber: cl.class_number,
    accessCode: cl.access_code,
    fullName: cl.full_name,
    phone: cl.phone,
    email: cl.email,
    active: cl.active,
    createdBy: cl.created_by,
    updatedBy: cl.updated_by,
    lastUpdated: cl.last_updated,
    created_at: cl.created_at
  }));
}

// Add new class leader
export async function addClassLeader(leaderData: {
  username: string;
  password: string;
  classNumber?: string;
  accessCode?: string;
  fullName?: string;
  phone?: string;
  email?: string;
}) {
  const { data, error } = await supabase
    .from('class_leaders')
    .insert({
      username: leaderData.username,
      password: leaderData.password,
      class_number: leaderData.classNumber,
      access_code: leaderData.accessCode,
      full_name: leaderData.fullName,
      phone: leaderData.phone,
      email: leaderData.email,
      active: true
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error adding class leader:', error);
    throw error;
  }
  
  return data;
}

// Update class leader
export async function updateClassLeader(id: string, leaderData: {
  username?: string;
  password?: string;
  classNumber?: string;
  accessCode?: string;
  fullName?: string;
  phone?: string;
  email?: string;
}) {
  const updateData: any = {};
  if (leaderData.username) updateData.username = leaderData.username;
  if (leaderData.password) updateData.password = leaderData.password;
  if (leaderData.classNumber) updateData.class_number = leaderData.classNumber;
  if (leaderData.accessCode) updateData.access_code = leaderData.accessCode;
  if (leaderData.fullName) updateData.full_name = leaderData.fullName;
  if (leaderData.phone) updateData.phone = leaderData.phone;
  if (leaderData.email) updateData.email = leaderData.email;

  const { data, error } = await supabase
    .from('class_leaders')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating class leader:', error);
    throw error;
  }
  
  return data;
}

// Delete class leader
export async function deleteClassLeader(id: string) {
  const { error } = await supabase
    .from('class_leaders')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting class leader:', error);
    throw error;
  }
}

// Get absence summary for a date range and absence types
export async function getAbsenceSummary(
  classNumber: number,
  startDate: string,
  endDate: string
) {
  const { error } = await supabase
    .from('attendance')
    .select('*')
    .eq('class_number', classNumber.toString())
    .gte('attendance_date', startDate)
    .lte('attendance_date', endDate);

  if (error) {
    console.error('Error fetching attendance for absence summary:', error);
    return {};
  }

  // Get all members for this class
  const members = (await getClassMembers(classNumber)) as Member[];

  // Count absences per member
  const summary: Record<string, { name: string; absent_count: number; sick_count: number; travel_count: number; total_absences: number }> = {};

  members.forEach((member: Member) => {
    summary[member.id] = {
      name: member.name,
      absent_count: 0,
      sick_count: 0,
      travel_count: 0,
      total_absences: 0
    };
  });

  // Note: This is a simplified implementation
  // In a real scenario, you'd need individual member absence records
  
  return summary;
}

// Save manual report
export async function saveManualReport(
  classNumber: number,
  dateRangeStart: string,
  dateRangeEnd: string,
  absenceTypes: ('absent' | 'sick' | 'travel')[],
  reportData: Record<string, any>
) {
  const { data, error } = await supabase
    .from('manual_reports')
    .insert({
      class_number: classNumber.toString(),
      date_range_start: dateRangeStart,
      date_range_end: dateRangeEnd,
      absence_types: JSON.stringify(absenceTypes),
      report_data: reportData,
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving manual report:', error);
    throw error;
  }

  // Clean up old reports - keep only the 5 most recent
  await cleanupOldManualReports(classNumber);

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    classNumber: data.class_number,
    reportDate: data.report_date,
    dateRangeStart: data.date_range_start,
    dateRangeEnd: data.date_range_end,
    absenceTypes: JSON.parse(data.absence_types || '[]'),
    reportData: data.report_data,
    created_at: data.created_at
  };
}

// Get manual reports for a class (archive)
export async function getManualReports(classNumber: number) {
  const { data, error } = await supabase
    .from('manual_reports')
    .select('*')
    .eq('class_number', classNumber.toString())
    .order('report_date', { ascending: false });

  if (error) {
    console.error('Error fetching manual reports:', error);
    return [];
  }

  return (data || []).map((r: any) => ({
    id: r.id,
    classNumber: r.class_number,
    reportDate: r.report_date,
    dateRangeStart: r.date_range_start,
    dateRangeEnd: r.date_range_end,
    absenceTypes: JSON.parse(r.absence_types || '[]'),
    reportData: r.report_data,
    created_at: r.created_at
  }));
}

// Delete manual report
export async function deleteManualReport(reportId: string) {
  const { error } = await supabase
    .from('manual_reports')
    .delete()
    .eq('id', reportId);

  if (error) {
    console.error('Error deleting manual report:', error);
    throw error;
  }
}

// Clean up old manual reports (keep only the 5 most recent)
async function cleanupOldManualReports(classNumber: number) {
  const { data, error } = await supabase
    .from('manual_reports')
    .select('id')
    .eq('class_number', classNumber.toString())
    .order('report_date', { ascending: false });

  if (error || !data) {
    console.error('Error fetching reports for cleanup:', error);
    return;
  }

  // Delete all reports after the 5th most recent
  if (data.length > 5) {
    const idsToDelete = data.slice(5).map((r: { id: string }) => r.id);
    const { error: deleteError } = await supabase
      .from('manual_reports')
      .delete()
      .in('id', idsToDelete);

    if (deleteError) {
      console.error('Error cleaning up old reports:', deleteError);
    }
  }
}

// Get member attendance history for a specific date range and optional service type filter
export async function getMemberAttendanceHistory(
  classNumber: number,
  memberId: string,
  startDate: string,
  endDate: string,
  serviceType?: 'sunday' | 'bible-study'
) {
  let query = supabase
    .from('member_attendance')
    .select(`
      id,
      status,
      attendance_id,
      created_at,
      attendance:attendance_id(
        attendance_date,
        service_type
      )
    `)
    .eq('member_id', memberId)
    .eq('class_number', classNumber.toString())
    .gte('created_at', `${startDate}T00:00:00`)
    .lte('created_at', `${endDate}T23:59:59`)
    .order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching member attendance history:', error);
    return [];
  }

  // Filter by service type if specified
  if (serviceType && data) {
    return data.filter((record: any) => 
      record.attendance?.service_type === serviceType
    );
  }

  return data || [];
}

// Get member attendance summary statistics
export async function getMemberAttendanceSummary(
  classNumber: number,
  memberId: string,
  startDate: string,
  endDate: string,
  serviceType?: 'sunday' | 'bible-study'
) {
  const records = await getMemberAttendanceHistory(classNumber, memberId, startDate, endDate, serviceType);
  
  const summary = {
    total: records.length,
    present: 0,
    absent: 0,
    sick: 0,
    travel: 0
  };

  records.forEach((record: any) => {
    switch (record.status) {
      case 'present':
        summary.present++;
        break;
      case 'absent':
        summary.absent++;
        break;
      case 'sick':
        summary.sick++;
        break;
      case 'travel':
        summary.travel++;
        break;
    }
  });

  return summary;
}
