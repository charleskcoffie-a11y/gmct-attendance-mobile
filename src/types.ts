// Type definitions for GMCT Attendance Mobile App

export interface Member {
  id: number;
  name: string;
  assignedClass: number;
  active?: boolean;
  phoneNumber?: string;
  email?: string;
  created_at?: string;
}

export type ServiceType = 'sunday' | 'bible-study';

export interface AttendanceRecord {
  id?: string;
  classNumber: string;
  attendanceDate: string;
  serviceType: ServiceType;
  classLeaderId?: string;
  classLeaderName?: string;
  totalMembersPresent?: number;
  totalMembersAbsent?: number;
  totalVisitors?: number;
  created_at?: string;
}

export interface MemberAttendance {
  id?: string;
  attendanceId: string;
  memberId: string;
  memberName?: string;
  classNumber: string;
  status: 'present' | 'absent' | 'sick' | 'travel';
  created_at?: string;
}

export interface AppSettings {
  id: string;
  class_access_codes?: string;
  org_name?: string;
  logo_url?: string;
  max_classes?: number;
}

export interface ClassSession {
  classNumber: number;
  accessCode: string;
  loginTime: string;
}

export interface ClassLeader {
  id: string;
  username: string;
  password?: string;
  classNumber?: string;
  accessCode?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  active?: boolean;
  createdBy?: string;
  updatedBy?: string;
  lastUpdated?: string;
  created_at?: string;
}

// Offline sync queue item
export interface SyncQueueItem {
  id?: number;
  type: 'attendance';
  data: {
    classNumber: number;
    date: string;
    serviceType: ServiceType;
    memberRecords: Array<{ memberId: string; status: string }>;
    classLeaderName?: string;
  };
  timestamp: string;
  synced: boolean;
}

// Database schema type for Supabase
export interface Database {
  public: {
    Tables: {
      members: {
        Row: {
          id: string;
          name: string;
          assignedClass: number;
          active?: boolean;
          phoneNumber?: string;
          email?: string;
          created_at?: string;
        };
        Insert: any;
        Update: any;
      };
      attendance: {
        Row: {
          id: string;
          class_number: string;
          attendance_date: string;
          service_type: ServiceType;
          class_leader_name?: string;
          total_members_present?: number;
          total_members_absent?: number;
          total_visitors?: number;
          created_at?: string;
        };
        Insert: any;
        Update: any;
      };
      member_attendance: {
        Row: {
          id: string;
          attendance_id: string;
          member_id: string;
          class_number: string;
          status: string;
          created_at?: string;
        };
        Insert: any;
        Update: any;
      };
      app_settings: {
        Row: AppSettings;
        Insert: AppSettings;
        Update: Partial<AppSettings>;
      };
      class_leaders: {
        Row: {
          id: string;
          username: string;
          password?: string;
          class_number?: string;
          access_code?: string;
          full_name?: string;
          phone?: string;
          email?: string;
          active?: boolean;
          created_by?: string;
          updated_by?: string;
          last_updated?: string;
          created_at?: string;
        };
        Insert: any;
        Update: any;
      };
    };
  };
}
