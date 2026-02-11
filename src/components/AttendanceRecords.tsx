import React, { useState, useEffect, useMemo } from "react";
import { supabase, getMemberAttendanceRecords, updateMemberAttendanceStatus, updateAttendanceTotals, getClassMembers } from "../supabase";
import { AttendanceRecord } from "../types";
import { Calendar, Users, AlertCircle, Edit2, Check, X, ChevronRight } from "lucide-react";

interface AttendanceRecordsProps {
  classNumber: number;
}

interface MemberStatus {
  member_id: string;
  member_name?: string;
  status: 'present' | 'absent' | 'sick' | 'travel';
}

interface GroupedRecords {
  [year: number]: {
    [month: number]: AttendanceRecord[];
  };
}

export const AttendanceRecords: React.FC<AttendanceRecordsProps> = ({
  classNumber,
}) => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberDetails, setMemberDetails] = useState<Record<string, MemberStatus[]>>({});
  const [editingAttendanceId, setEditingAttendanceId] = useState<string | null>(null);
  const [editingStatuses, setEditingStatuses] = useState<Record<string, 'present' | 'absent' | 'sick' | 'travel'>>({});
  const [allClassMembers, setAllClassMembers] = useState<any[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAttendanceRecords();
    loadAllClassMembers();
  }, [classNumber]);

  const loadAllClassMembers = async () => {
    try {
      const members = await getClassMembers(classNumber);
      setAllClassMembers(members || []);
    } catch (err) {
      console.error('Error loading class members:', err);
    }
  }

  const loadAttendanceRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from("attendance")
        .select("*")
        .eq("class_number", classNumber.toString())
        .order("attendance_date", { ascending: false });

      if (dbError) {
        setError("Failed to load attendance records");
        console.error("Error loading records:", dbError);
      } else if (data) {
        setRecords(data);
      }
    } catch (err) {
      setError(
        "Connection error: " + (err instanceof Error ? err.message : "Unknown error")
      );
      console.error("Records load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const groupedRecords = useMemo(() => {
    const grouped: GroupedRecords = {};
    
    records.forEach(record => {
      const date = new Date(record.attendance_date || "");
      const year = date.getFullYear();
      const month = date.getMonth();
      
      if (!grouped[year]) {
        grouped[year] = {};
      }
      if (!grouped[year][month]) {
        grouped[year][month] = [];
      }
      grouped[year][month].push(record);
    });
    
    return grouped;
  }, [records]);

  const toggleYear = (year: number) => {
    const newSet = new Set(expandedYears);
    if (newSet.has(year)) {
      newSet.delete(year);
    } else {
      newSet.add(year);
    }
    setExpandedYears(newSet);
  };

  const toggleMonth = (year: number, month: number) => {
    const key = `${year}-${month}`;
    const newSet = new Set(expandedMonths);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setExpandedMonths(newSet);
  };

  const getMonthName = (month: number) => {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    return monthNames[month];
  };

  const getServiceTypeLabel = (serviceType: string) => {
    return serviceType === "sunday" ? "🙏 Sunday Service" : "📖 Bible Study";
  };

  const startEditing = async (attendanceId: string) => {
    try {
      setEditingAttendanceId(attendanceId);
      
      // Load member details directly
      let records = memberDetails[attendanceId];
      if (!records) {
        console.log(`Loading member details for ${attendanceId}...`);
        records = await getMemberAttendanceRecords(attendanceId);
        console.log('Raw records from db:', records);
        // Store in memberDetails
        setMemberDetails(prev => ({
          ...prev,
          [attendanceId]: records as MemberStatus[]
        }));
      } else {
        console.log('Using cached member details:', records);
      }
      
      // Initialize statuses from loaded records (even if empty)
      const statuses = (records || []).reduce((acc: Record<string, any>, m: MemberStatus) => {
        acc[String(m.member_id)] = m.status;
        return acc;
      }, {});
      
      console.log(`Edit mode for ${attendanceId}:`);
      console.log(`  - Members loaded: ${records?.length || 0}`);
      console.log(`  - Member IDs:`, records?.map((r: any) => r.member_id) || []);
      console.log(`  - Statuses:`, statuses);
      
      setEditingStatuses(statuses);
    } catch (err) {
      console.error('Error in startEditing:', err);
      alert('Failed to load member records for editing');
    }
  };

  const cancelEditing = () => {
    setEditingAttendanceId(null);
    setEditingStatuses({});
  };

  const saveEdits = async () => {
    if (!editingAttendanceId) return;
    
    // Check if there are any edits to save
    if (Object.keys(editingStatuses).length === 0) {
      alert('No members marked. Please mark at least one member before saving.');
      return;
    }
    
    setSavingEdit(true);
    setSuccessMessage(null);
    
    // Safeguard: force disable saving after 30 seconds
    const timeout = setTimeout(() => {
      console.error('Save operation timed out');
      setSavingEdit(false);
      setSuccessMessage('❌ Save operation timed out');
      setTimeout(() => setSuccessMessage(null), 4000);
    }, 30000);
    
    try {
      const record = records.find(r => r.id === editingAttendanceId);
      if (!record) {
        throw new Error('Attendance record not found');
      }

      let presentCount = 0;
      let absentCount = 0;

      console.log(`Saving edits for ${editingAttendanceId}:`, editingStatuses);

      // Update each member's status
      for (const [memberId, status] of Object.entries(editingStatuses)) {
        const member = allClassMembers.find(m => String(m.id) === String(memberId));
        const memberName = member?.name || memberId;
        console.log(`  Updating ${memberName} (${memberId}): ${status}`);
        await updateMemberAttendanceStatus(editingAttendanceId, memberId, status as any, memberName, record.class_number);
        if (status === 'present') presentCount++;
        else if (status === 'absent') absentCount++;
      }

      // Update the summary totals
      if (record.id) {
        await updateAttendanceTotals(record.id, {
          present: presentCount,
          absent: absentCount,
          visitors: record.total_visitors || 0
        });
        
        // Update local state with new totals (much faster than reloading from DB)
        setRecords(prevRecords =>
          prevRecords.map(r =>
            r.id === record.id
              ? {
                  ...r,
                  total_members_present: presentCount,
                  total_members_absent: absentCount
                }
              : r
          )
        );
      }

      console.log('✅ Edits saved successfully');
      clearTimeout(timeout);
      
      // Close edit mode and clear state
      setEditingAttendanceId(null);
      setEditingStatuses({});
      
      // Show success message briefly
      setSuccessMessage('✅ Changes saved successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
      
    } catch (err) {
      console.error('Error saving edits:', err);
      clearTimeout(timeout);
      setSuccessMessage(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } finally {
      clearTimeout(timeout);
      setSavingEdit(false);
    }
  };

  const updateEditingStatus = (memberId: string, status: 'present' | 'absent' | 'sick' | 'travel') => {
    setEditingStatuses(prev => ({
      ...prev,
      [String(memberId)]: status
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-4 md:p-8 flex items-center justify-center pb-24">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500/30 border-t-blue-500"></div>
          <p className="mt-4 text-slate-300 font-semibold">Loading attendance records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-4 md:p-8 pb-24">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
          Attendance Records
        </h1>
        <p className="text-slate-400 text-sm mt-2 flex items-center gap-2">
          <span>📋</span> View and edit all attendance records for Class {classNumber}
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border-l-4 border-red-500 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-300">Error</p>
            <p className="text-sm text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-top fade-in duration-300">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-full shadow-2xl px-6 py-3 flex items-center gap-3 backdrop-blur-md border border-emerald-400/30">
            <Check className="w-5 h-5 text-white flex-shrink-0" />
            <p className="font-semibold text-white text-sm">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl shadow-lg border border-slate-600 p-5 hover:border-blue-500 transition-all hover:shadow-xl">
          <p className="text-xs font-bold text-slate-400 mb-2 uppercase">Total Records</p>
          <p className="text-4xl font-bold text-blue-400">{records.length}</p>
        </div>

        <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl shadow-lg border border-slate-600 p-5 hover:border-purple-500 transition-all hover:shadow-xl">
          <p className="text-xs font-bold text-slate-400 mb-2 uppercase">🙏 Sunday Services</p>
          <p className="text-4xl font-bold text-purple-400">
            {records.filter((r) => r.service_type === "sunday").length}
          </p>
        </div>

        <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl shadow-lg border border-slate-600 p-5 hover:border-green-500 transition-all hover:shadow-xl">
          <p className="text-xs font-bold text-slate-400 mb-2 uppercase">📖 Bible Studies</p>
          <p className="text-4xl font-bold text-green-400">
            {records.filter((r) => r.service_type === "bible-study").length}
          </p>
        </div>

        <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl shadow-lg border border-slate-600 p-5 hover:border-emerald-500 transition-all hover:shadow-xl">
          <p className="text-xs font-bold text-slate-400 mb-2 uppercase">✅ Total Present</p>
          <p className="text-4xl font-bold text-emerald-400">
            {records.reduce((sum, r) => sum + (r.total_members_present || 0), 0)}
          </p>
        </div>
      </div>

      {/* Records List Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
          <Calendar className="w-7 h-7 text-blue-400" />
          📊 All Records
        </h2>
        <p className="text-slate-400 text-sm ml-10">💡 Click any record to expand, edit members, and update their attendance status</p>
      </div>

      {/* Records List */}
      {records.length > 0 ? (
        <div className="space-y-3">
          {/* Years Folders */}
          {Object.keys(groupedRecords)
            .map(Number)
            .sort((a, b) => b - a)
            .map((year) => (
            <div key={`year-${year}`} className="border border-slate-600 rounded-xl overflow-hidden bg-gradient-to-br from-slate-700/50 to-slate-800/50">
              {/* Year Folder Header */}
              <button
                onClick={() => toggleYear(year)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-600/30 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <ChevronRight
                    className={`w-5 h-5 text-blue-400 transition-transform duration-300 ${
                      expandedYears.has(year) ? 'rotate-90' : ''
                    }`}
                  />
                  <div className="text-left">
                    <p className="text-xl font-bold text-white">📁 {year}</p>
                    <p className="text-sm text-slate-400">
                      {Object.values(groupedRecords[year]).reduce((sum, records) => sum + records.length, 0)} records
                    </p>
                  </div>
                </div>
              </button>

              {/* Year Content - Months */}
              {expandedYears.has(year) && (
                <div className="border-t border-slate-600 bg-gradient-to-br from-slate-800 to-slate-900 p-3 space-y-2">
                  {Object.keys(groupedRecords[year])
                    .map(Number)
                    .sort((a, b) => b - a)
                    .map((month) => {
                      const monthKey = `${year}-${month}`;
                      const monthRecords = groupedRecords[year][month];
                      return (
                        <div key={`month-${monthKey}`} className="border border-slate-600 rounded-lg overflow-hidden bg-slate-700/30">
                          {/* Month Folder Header */}
                          <button
                            onClick={() => toggleMonth(year, month)}
                            className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-600/30 transition-colors"
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <ChevronRight
                                className={`w-4 h-4 text-indigo-400 transition-transform duration-300 ${
                                  expandedMonths.has(monthKey) ? 'rotate-90' : ''
                                }`}
                              />
                              <div className="text-left">
                                <p className="font-semibold text-white">📂 {getMonthName(month)}</p>
                                <p className="text-xs text-slate-400">{monthRecords.length} record{monthRecords.length !== 1 ? 's' : ''}</p>
                              </div>
                            </div>
                          </button>

                          {/* Month Content - Records */}
                          {expandedMonths.has(monthKey) && (
                            <div className="border-t border-slate-600 bg-slate-800/50 p-3 space-y-3">
                              {monthRecords
                                .sort((a, b) => new Date(b.attendance_date || '') .getTime() - new Date(a.attendance_date || '').getTime())
                                .map((record) => (
                                <div
                                  key={record.id}
                                  className="bg-gradient-to-br from-slate-700 to-slate-800 border-2 border-slate-600 rounded-xl overflow-hidden shadow-lg transition-all duration-300"
                                >
                                  {/* Record Item */}
                                  <div className="p-4 md:p-5">
                                    <div className="flex items-start justify-between gap-4 mb-3">
                                      <div className="flex-1 min-w-0">
                                        {/* Date */}
                                        <div className="flex items-center gap-2 mb-2">
                                          <Calendar className="w-5 h-5 text-blue-400 flex-shrink-0" />
                                          <div>
                                            <span className="font-bold text-white text-lg">
                                              {new Date(record.attendance_date || "").toLocaleDateString(
                                                "en-US",
                                                {
                                                  weekday: "short",
                                                  month: "short",
                                                  day: "numeric",
                                                }
                                              )}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Service Type */}
                                        <div className="flex items-center gap-2 ml-7 mb-3">
                                          <span className="inline-block px-3 py-1.5 bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-xs font-bold rounded-full">
                                            {getServiceTypeLabel(record.service_type || "sunday")}
                                          </span>
                                        </div>

                                        {/* Quick Stats */}
                                        <div className="grid grid-cols-3 gap-2 ml-7 mb-3">
                                          <div className="bg-slate-800/50 rounded-lg p-2 text-center border border-green-500/30">
                                            <p className="text-xs text-slate-400 font-medium">Present</p>
                                            <p className="text-lg font-bold text-green-400">
                                              {record.total_members_present || 0}
                                            </p>
                                          </div>
                                          <div className="bg-slate-800/50 rounded-lg p-2 text-center border border-red-500/30">
                                            <p className="text-xs text-slate-400 font-medium">Absent</p>
                                            <p className="text-lg font-bold text-red-400">
                                              {record.total_members_absent || 0}
                                            </p>
                                          </div>
                                          <div className="bg-slate-800/50 rounded-lg p-2 text-center border border-amber-500/30">
                                            <p className="text-xs text-slate-400 font-medium">Visitors</p>
                                            <p className="text-lg font-bold text-amber-400">
                                              {record.total_visitors || 0}
                                            </p>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Edit Button */}
                                      {editingAttendanceId !== record.id && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            startEditing(record.id!);
                                          }}
                                          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-bold rounded-lg transition-all shadow-lg whitespace-nowrap"
                                        >
                                          <Edit2 className="inline w-4 h-4 mr-2" />
                                          Edit
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Expanded Details Section - Only show when editing this record */}
                                  {editingAttendanceId === record.id && (
                                    <div 
                                      onClick={(e) => e.stopPropagation()}
                                      className="border-t-2 border-slate-600 bg-gradient-to-b from-slate-800 to-slate-900 p-5 space-y-4 animate-in fade-in">
                                      {/* Title - Only show heading when editing */}
                                      <p className="text-base font-bold text-white flex items-center gap-2 mb-3">
                                        <span>👥 </span> 
                                        Edit Members
                                      </p>

                                      {/* Member List - Only show in edit mode */}
                                      {editingAttendanceId === record.id && (
                                        <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600 space-y-2">
                                          <div className="space-y-2 max-h-80 overflow-y-auto">
                                            {allClassMembers.map((member) => (
                                              <div
                                                key={member.id}
                                                className="flex items-center justify-between p-2 bg-slate-700 rounded border border-slate-600 hover:border-slate-500 transition text-sm"
                                              >
                                                <p className="font-medium text-white flex-1 truncate">{member.name}</p>
                                                <div className="flex gap-1.5">
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      updateEditingStatus(member.id, 'present');
                                                    }}
                                                    className={`px-2 py-1 rounded text-xs font-bold transition ${
                                                      editingStatuses[String(member.id)] === 'present'
                                                        ? 'bg-green-600 text-white shadow-lg'
                                                        : 'bg-slate-600 text-slate-300 hover:bg-green-600/50'
                                                    }`}
                                                  >
                                                    ✓
                                                  </button>
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      updateEditingStatus(member.id, 'absent');
                                                    }}
                                                    className={`px-2 py-1 rounded text-xs font-bold transition ${
                                                      editingStatuses[String(member.id)] === 'absent'
                                                        ? 'bg-red-600 text-white shadow-lg'
                                                        : 'bg-slate-600 text-slate-300 hover:bg-red-600/50'
                                                    }`}
                                                  >
                                                    ✗
                                                  </button>
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      updateEditingStatus(member.id, 'sick');
                                                    }}
                                                    className={`px-2 py-1 rounded text-xs font-bold transition ${
                                                      editingStatuses[String(member.id)] === 'sick'
                                                        ? 'bg-orange-600 text-white shadow-lg'
                                                        : 'bg-slate-600 text-slate-300 hover:bg-orange-600/50'
                                                    }`}
                                                  >
                                                    🤒
                                                  </button>
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      updateEditingStatus(member.id, 'travel');
                                                    }}
                                                    className={`px-2 py-1 rounded text-xs font-bold transition ${
                                                      editingStatuses[String(member.id)] === 'travel'
                                                        ? 'bg-purple-600 text-white shadow-lg'
                                                        : 'bg-slate-600 text-slate-300 hover:bg-purple-600/50'
                                                    }`}
                                                  >
                                                    🚗
                                                  </button>
                                                </div>
                                              </div>
                                            ))}
                                          </div>

                                          {/* Save/Cancel Buttons */}
                                          <div className="flex gap-2 pt-3 border-t border-slate-600">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                saveEdits();
                                              }}
                                              disabled={savingEdit}
                                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-slate-600 disabled:to-slate-700 text-white font-bold text-sm rounded-lg transition-all shadow-lg"
                                            >
                                              <Check className="w-4 h-4" />
                                              {savingEdit ? 'Saving...' : 'Save'}
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                cancelEditing();
                                              }}
                                              disabled={savingEdit}
                                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 text-white font-bold text-sm rounded-lg transition-all"
                                            >
                                              <X className="w-4 h-4" />
                                              Cancel
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
          <div className="text-center py-16 px-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-700/50 border border-slate-600 mb-4">
              <Users className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-200 text-lg font-semibold">No attendance records yet</p>
            <p className="text-slate-400 text-sm mt-3">
              📌 Start marking attendance in the "Mark" tab to see records here
            </p>
          </div>
        )}
    </div>
  );
};

export default AttendanceRecords;
