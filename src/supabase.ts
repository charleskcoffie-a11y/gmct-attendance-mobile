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
  memberRecords: Array<{ memberId: string; status: string }>,
  classLeaderName?: string
) {
  // Calculate summary stats
  const totalMembersPresent = memberRecords.filter(r => r.status === 'present').length;
  const totalMembersAbsent = memberRecords.filter(r => r.status === 'absent').length;
  
  // Step 1: Upsert attendance summary record
  const { data: attendanceData, error: attendanceError } = await supabase
    .from('attendance')
    .upsert({
      class_number: classNumber.toString(),
      attendance_date: date,
      service_type: serviceType,
      class_leader_name: classLeaderName,
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
  
  // Step 2: Upsert member attendance records
  const memberAttendanceRecords = memberRecords.map(r => ({
    attendance_id: attendanceData.id,
    member_id: r.memberId.toString(),
    class_number: classNumber.toString(),
    status: r.status,
  }));
  
  const { error: memberError } = await supabase
    .from('member_attendance')
    .upsert(memberAttendanceRecords, { 
      onConflict: 'attendance_id,member_id' 
    });
  
  if (memberError) {
    console.error('Error saving member attendance:', memberError);
    throw memberError;
  }
  
  return attendanceData;
}

// Get attendance history for a class
export async function getClassAttendanceHistory(classNumber: number, limit = 10) {
  const { data, error } = await supabase
    .from('attendance')
    .select(`
      *,
      members!inner(name, class_number)
    `)
    .eq('members.class_number', classNumber.toString())
    .order('date', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('Error fetching attendance history:', error);
    return [];
  }
  
  return data || [];
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
