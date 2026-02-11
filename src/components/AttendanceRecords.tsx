import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { AttendanceRecord } from "../types";
import { AlertCircle, Calendar, ChevronRight, Users, Edit } from "lucide-react";

interface AttendanceRecordsProps {
  classNumber: number;
  onEditRecord?: (date: string, serviceType: string) => void;
}

interface GroupedRecords {
  [year: number]: {
    [month: number]: AttendanceRecord[];
  };
}

export const AttendanceRecords: React.FC<AttendanceRecordsProps> = ({
  classNumber,
  onEditRecord,
}) => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAttendanceRecords();
  }, [classNumber]);

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

    records.forEach((record) => {
      const date = new Date((record.attendance_date || "") + "T00:00:00");
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
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return monthNames[month];
  };

  const getServiceTypeLabel = (serviceType: string) => {
    return serviceType === "sunday" ? "🙏 Sunday Service" : "📖 Bible Study";
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
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
          Attendance Records
        </h1>
        <p className="text-slate-400 text-sm mt-2 flex items-center gap-2">
          <span>📋</span> View all attendance records for Class {classNumber}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border-l-4 border-red-500 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-300">Error</p>
            <p className="text-sm text-red-400">{error}</p>
          </div>
        </div>
      )}

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

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
          <Calendar className="w-7 h-7 text-blue-400" />
          📊 All Records
        </h2>
        <p className="text-slate-400 text-sm ml-10">💡 Click any record to expand and view details</p>
      </div>

      {records.length > 0 ? (
        <div className="space-y-3">
          {Object.keys(groupedRecords)
            .map(Number)
            .sort((a, b) => b - a)
            .map((year) => (
              <div key={`year-${year}`} className="border border-slate-600 rounded-xl overflow-hidden bg-gradient-to-br from-slate-700/50 to-slate-800/50">
                <button
                  onClick={() => toggleYear(year)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-600/30 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <ChevronRight
                      className={`w-5 h-5 text-blue-400 transition-transform duration-300 ${
                        expandedYears.has(year) ? "rotate-90" : ""
                      }`}
                    />
                    <div className="text-left">
                      <p className="text-xl font-bold text-white">📁 {year}</p>
                      <p className="text-sm text-slate-400">
                        {Object.values(groupedRecords[year]).reduce((sum, list) => sum + list.length, 0)} records
                      </p>
                    </div>
                  </div>
                </button>

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
                            <button
                              onClick={() => toggleMonth(year, month)}
                              className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-600/30 transition-colors"
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <ChevronRight
                                  className={`w-4 h-4 text-indigo-400 transition-transform duration-300 ${
                                    expandedMonths.has(monthKey) ? "rotate-90" : ""
                                  }`}
                                />
                                <div className="text-left">
                                  <p className="font-semibold text-white">📂 {getMonthName(month)}</p>
                                  <p className="text-xs text-slate-400">
                                    {monthRecords.length} record{monthRecords.length !== 1 ? "s" : ""}
                                  </p>
                                </div>
                              </div>
                            </button>

                            {expandedMonths.has(monthKey) && (
                              <div className="border-t border-slate-600 bg-slate-800/50 p-3 space-y-3">
                                {monthRecords
                                  .sort((a, b) => new Date((b.attendance_date || "") + "T00:00:00").getTime() - new Date((a.attendance_date || "") + "T00:00:00").getTime())
                                  .map((record) => (
                                    <div
                                      key={record.id}
                                      className="bg-gradient-to-br from-slate-700 to-slate-800 border-2 border-slate-600 rounded-xl overflow-hidden shadow-lg transition-all duration-300"
                                    >
                                      <div className="p-4 md:p-5">
                                        <div className="flex items-start justify-between gap-4 mb-3">
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2">
                                              <Calendar className="w-5 h-5 text-blue-400 flex-shrink-0" />
                                              <div>
                                                <span className="font-bold text-white text-lg">
                                                  {new Date((record.attendance_date || "") + "T00:00:00").toLocaleDateString(
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

                                            <div className="flex items-center gap-2 ml-7 mb-3">
                                              <span className="inline-block px-3 py-1.5 bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-xs font-bold rounded-full">
                                                {getServiceTypeLabel(record.service_type || "sunday")}
                                              </span>
                                            </div>

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
                                          <button
                                            onClick={() => onEditRecord?.(record.attendance_date, record.service_type || "sunday")}
                                            className="p-2 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/50 active:scale-90 hover:bg-blue-500/30 transition shrink-0"
                                            title="Edit attendance"
                                          >
                                            <Edit className="w-5 h-5" />
                                          </button>
                                        </div>
                                      </div>
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
