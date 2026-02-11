// Supabase Service for GMCT Attendance Mobile App
import { createClient } from '@supabase/supabase-js';
import { Member } from './types';

// These should match your main app's Supabase credentials
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

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

  if (data && data.length > 0) {
    return data.map((m: any) => ({
      ...m,
      id: String(m.id),
      assignedClass: m.class_number ? parseInt(m.class_number, 10) : undefined,
      phoneNumber: m.phone ?? m.phoneNumber
    }));
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from('members')
    .select('*')
    .eq('assigned_class', classNumber)
    .order('name', { ascending: true });

  if (fallbackError) {
    console.error('Error fetching class members (fallback):', fallbackError);
    return [];
  }

  return (fallbackData || []).map((m: any) => ({
    ...m,
    id: String(m.id),
    assignedClass: m.assigned_class ?? undefined,
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
        class_number: member.class_number || member.assignedClass?.toString(),
        member_number: member.member_number,
        address: member.address,
        city: member.city,
        province: member.province,
        phone: member.phone || member.phoneNumber,
        date_of_birth: member.date_of_birth,
        dob_month: member.dob_month,
        dob_day: member.dob_day
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
        class_number: member.class_number || member.assignedClass?.toString(),
        member_number: member.member_number,
        address: member.address,
        city: member.city,
        province: member.province,
        phone: member.phone || member.phoneNumber,
        date_of_birth: member.date_of_birth,
        dob_month: member.dob_month,
        dob_day: member.dob_day
      });
    
    if (error) {
      console.error('Error adding member:', error);
      throw error;
    }
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
  memberRecords: Array<{ memberId: string; status: string; memberName?: string }>,
  classLeaderName?: string
) {
  // Calculate summary stats
  const totalMembersPresent = memberRecords.filter(r => r.status === 'present').length;
  const totalMembersAbsent = memberRecords.filter(r => r.status === 'absent').length;
  
  // Upsert attendance summary record
  const { data: attendanceData, error: attendanceError } = await supabase
    .from('attendance')
    .upsert({
      class_number: classNumber.toString(),
      attendance_date: date,
      service_type: serviceType,
      class_leader_name: classLeaderName || `Class ${classNumber} Leader`,
      total_members_present: totalMembersPresent,
      total_members_absent: totalMembersAbsent,
      total_visitors: 0,
    }, { 
      onConflict: 'class_number,attendance_date,service_type' 
    })
    .select()
    .single();
  
  if (attendanceError) {
    console.error('Error saving attendance summary:', attendanceError);
    throw attendanceError;
  }

  // Save individual member attendance records
  if (attendanceData && attendanceData.id) {
    for (const record of memberRecords) {
      const { error: memberError } = await supabase
        .from('member_attendance')
        .upsert({
          attendance_id: attendanceData.id,
          member_id: record.memberId,
          member_name: record.memberName || record.memberId,
          class_number: classNumber.toString(),
          status: record.status,
        }, {
          onConflict: 'attendance_id,member_id'
        });

      if (memberError) {
        console.error('Error saving member attendance:', memberError);
      }
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
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('class_number', classNumber.toString())
    .eq('attendance_date', date)
    .eq('service_type', serviceType)
    .limit(1)
    .maybeSingle();
  
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
  // First get the attendance record
  const { data: attendanceRecord, error: attendanceError } = await supabase
    .from('attendance')
    .select('id')
    .eq('class_number', classNumber.toString())
    .eq('attendance_date', date)
    .eq('service_type', serviceType)
    .limit(1)
    .maybeSingle();
  
  if (attendanceError || !attendanceRecord) {
    return [];
  }
  
  // Then get the member records for that attendance
  const { data, error } = await supabase
    .from('member_attendance')
    .select('*, members(id, name)')
    .eq('attendance_id', attendanceRecord.id)
    .order('member_name', { ascending: true });

  if (error) {
    console.error('Error fetching member attendance records:', error);
    return [];
  }

  return (data || []).map((record: any) => ({
    member_id: record.member_id,
    member_name: record.members?.name || record.member_name,
    status: record.status,
  }));
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
  return (data || []).map(cl => ({
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
  const members = await getClassMembers(classNumber);

  // Count absences per member
  const summary: Record<string, { name: string; absent_count: number; sick_count: number; travel_count: number; total_absences: number }> = {};

  members.forEach(member => {
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
    const idsToDelete = data.slice(5).map(r => r.id);
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
