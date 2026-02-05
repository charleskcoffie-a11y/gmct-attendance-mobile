// Type definitions for GMCT Attendance Mobile App

export interface Member {
  id: string;
  name: string;
  assignedClass?: number;  // For internal use, maps to class_number
  class_number?: string;
  member_number?: string;
  address?: string;
  city?: string;
  province?: string;
  phone?: string;
  phoneNumber?: string;    // For internal use, maps to phone
  date_of_birth?: string;  // ISO date format (YYYY-MM-DD)
  dob_month?: number;      // Month (1-12)
  dob_day?: number;        // Day (1-31)
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
  minister_emails?: string;
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

export type ReportType = 'monthly' | 'quarterly';

export interface ReportMemberNote {
  id?: string;
  classNumber: string;
  memberId: string;
  reportType: ReportType;
  periodKey: string;
  note?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ClassReportStatus {
  id?: string;
  classNumber: string;
  reportType: ReportType;
  periodKey: string;
  status: 'draft' | 'submitted';
  submittedAt?: string;
  created_at?: string;
  updated_at?: string;
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
      report_member_notes: {
        Row: {
          id: string;
          class_number: string;
          member_id: string;
          report_type: ReportType;
          period_key: string;
          note?: string;
          created_at?: string;
          updated_at?: string;
        };
        Insert: any;
        Update: any;
      };
      class_reports: {
        Row: {
          id: string;
          class_number: string;
          report_type: 'quarterly';
          period_key: string;
          status: 'draft' | 'submitted';
          submitted_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Insert: any;
        Update: any;
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
