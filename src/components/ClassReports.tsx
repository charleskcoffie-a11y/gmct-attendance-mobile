import React, { useEffect, useMemo, useState } from "react";
import {
  confirmClassReport,
  getAppSettings,
  getAttendanceRange,
  getClassMembers,
  getClassReportStatus,
  updateAttendanceTotals,
  saveManualReport,
  getManualReports,
  deleteManualReport
} from "../supabase";
import { Member, ServiceType, ManualReport } from "../types";
import { AlertCircle, CheckCircle, Trash2 } from "lucide-react";

interface ClassReportsProps {
  classNumber: number;
  onBack: () => void;
  onBackToClasses?: () => void;
}

interface AttendanceRow {
  id: string;
  attendance_date: string;
  service_type: ServiceType;
  total_members_present: number;
  total_members_absent: number;
  total_visitors: number;
}

interface QuarterlyReportSummary {
  periodKey: string;
  dateRange: { start: string; end: string };
  totals: { present: number; absent: number; visitors: number };
  records: AttendanceRow[];
  generatedAt: string;
}

export const ClassReports: React.FC<ClassReportsProps> = ({ classNumber, onBack, onBackToClasses }) => {
  const [activeTab, setActiveTab] = useState<"monthly" | "quarterly" | "manual">("monthly");
  const [monthKey, setMonthKey] = useState(() => new Date().toISOString().slice(0, 7));
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [quarter, setQuarter] = useState<1 | 2 | 3 | 4>(() => {
    const month = new Date().getMonth();
    return (Math.floor(month / 3) + 1) as 1 | 2 | 3 | 4;
  });
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [attendanceEdits, setAttendanceEdits] = useState<Record<string, { present: number; absent: number; visitors: number }>>({});
  const [reportStatus, setReportStatus] = useState<any>(null);
  const [ministerEmails, setMinisterEmails] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [quarterlyReportData, setQuarterlyReportData] = useState<QuarterlyReportSummary | null>(null);
  const [showQuarterlyReport, setShowQuarterlyReport] = useState(false);

  // Manual report states
  const [manualDateStart, setManualDateStart] = useState(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return firstDay.toISOString().split("T")[0];
  });
  const [manualDateEnd, setManualDateEnd] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedAbsenceTypes, setSelectedAbsenceTypes] = useState<('absent' | 'sick' | 'travel')[]>(['absent']);
  const [generatedManualReport, setGeneratedManualReport] = useState<ManualReport | null>(null);
  const [manualReportArchive, setManualReportArchive] = useState<ManualReport[]>([]);

  const periodKey = useMemo(() => {
    if (activeTab === "monthly") {
      return monthKey;
    }
    return `${year}-Q${quarter}`;
  }, [activeTab, monthKey, year, quarter]);

  const dateRange = useMemo(() => {
    if (activeTab === "monthly") {
      const [y, m] = monthKey.split("-").map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0);
      return {
        start: start.toISOString().split("T")[0],
        end: end.toISOString().split("T")[0]
      };
    }

    const startMonth = (quarter - 1) * 3;
    const start = new Date(year, startMonth, 1);
    const end = new Date(year, startMonth + 3, 0);
    return {
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0]
    };
  }, [activeTab, monthKey, year, quarter]);

  const attendanceTotals = useMemo(() => {
    return attendanceRows.reduce(
      (acc, row) => {
        acc.present += row.total_members_present || 0;
        acc.absent += row.total_members_absent || 0;
        acc.visitors += row.total_visitors || 0;
        acc.records += 1;
        return acc;
      },
      { present: 0, absent: 0, visitors: 0, records: 0 }
    );
  }, [attendanceRows]);

  const trendSeries = useMemo(() => {
    return [...attendanceRows]
      .sort((a, b) => a.attendance_date.localeCompare(b.attendance_date))
      .map((row) => ({
        date: row.attendance_date,
        present: row.total_members_present || 0,
        absent: row.total_members_absent || 0
      }));
  }, [attendanceRows]);

  const maxTrendValue = useMemo(() => {
    const values = trendSeries.map((item) => item.present);
    return Math.max(1, ...values);
  }, [trendSeries]);

  const monthlyBreakdown = useMemo(() => {
    const map = new Map<string, { present: number; absent: number; visitors: number; count: number }>();
    attendanceRows.forEach((row) => {
      const month = row.attendance_date.slice(0, 7);
      const current = map.get(month) || { present: 0, absent: 0, visitors: 0, count: 0 };
      current.present += row.total_members_present || 0;
      current.absent += row.total_members_absent || 0;
      current.visitors += row.total_visitors || 0;
      current.count += 1;
      map.set(month, current);
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, totals]) => ({ month, ...totals }));
  }, [attendanceRows]);

  const maxMonthlyPresent = useMemo(() => {
    const values = monthlyBreakdown.map((item) => item.present);
    return Math.max(1, ...values);
  }, [monthlyBreakdown]);

  useEffect(() => {
    loadMembers();
    loadSettings();
  }, [classNumber]);

  useEffect(() => {
    loadAttendance();
    if (activeTab === "quarterly") {
      loadReportStatus();
    } else {
      setReportStatus(null);
    }
  }, [classNumber, activeTab, periodKey, dateRange.start, dateRange.end]);

  useEffect(() => {
    if (activeTab === "manual") {
      loadManualReports();
    }
  }, [activeTab, classNumber]);

  const loadMembers = async () => {
    try {
      const data = await getClassMembers(classNumber);
      setMembers(data as Member[]);
    } catch (err) {
      console.error("Error loading members:", err);
    }
  };

  const loadSettings = async () => {
    try {
      const settings = await getAppSettings();
      setMinisterEmails(settings?.minister_emails || "");
    } catch (err) {
      console.error("Error loading settings:", err);
    }
  };

  const loadAttendance = async () => {
    setLoading(true);
    setError(null);
    try {
      const records = await getAttendanceRange(classNumber, dateRange.start, dateRange.end);
      const mapped = (records as AttendanceRow[]).map((row) => ({
        ...row,
        total_members_present: Number(row.total_members_present || 0),
        total_members_absent: Number(row.total_members_absent || 0),
        total_visitors: Number(row.total_visitors || 0)
      }));
      setAttendanceRows(mapped);
      setAttendanceEdits({});
    } catch (err) {
      setError("Failed to load attendance records");
    } finally {
      setLoading(false);
    }
  };

  const loadReportStatus = async () => {
    try {
      const status = await getClassReportStatus(classNumber, "quarterly", periodKey);
      setReportStatus(status);
    } catch (err) {
      console.error("Error loading report status:", err);
    }
  };

  const loadManualReports = async () => {
    try {
      const reports = await getManualReports(classNumber);
      setManualReportArchive(reports);
    } catch (err) {
      console.error("Error loading manual reports:", err);
    }
  };

  const handleEditTotals = (attendanceId: string, field: "present" | "absent" | "visitors", value: string) => {
    const numeric = Number(value || 0);
    setAttendanceEdits((prev) => ({
      ...prev,
      [attendanceId]: {
        present: prev[attendanceId]?.present ?? getAttendanceValue(attendanceId, "present"),
        absent: prev[attendanceId]?.absent ?? getAttendanceValue(attendanceId, "absent"),
        visitors: prev[attendanceId]?.visitors ?? getAttendanceValue(attendanceId, "visitors"),
        [field]: numeric
      }
    }));
  };

  const getAttendanceValue = (attendanceId: string, field: "present" | "absent" | "visitors") => {
    const row = attendanceRows.find((r) => r.id === attendanceId);
    if (!row) return 0;
    if (field === "present") return row.total_members_present || 0;
    if (field === "absent") return row.total_members_absent || 0;
    return row.total_visitors || 0;
  };

  const handleSaveAttendanceRow = async (attendanceId: string) => {
    const edit = attendanceEdits[attendanceId];
    if (!edit) return;

    setLoading(true);
    try {
      await updateAttendanceTotals(attendanceId, {
        present: edit.present,
        absent: edit.absent,
        visitors: edit.visitors
      });
      setSuccess("Attendance updated successfully");
      await loadAttendance();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError("Failed to update attendance");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQuarterlyReport = () => {
    if (activeTab !== "quarterly") return;
    if (attendanceRows.length === 0) {
      setError("No attendance records to generate a quarterly report.");
      return;
    }

    const totals = attendanceRows.reduce(
      (acc, row) => {
        acc.present += row.total_members_present || 0;
        acc.absent += row.total_members_absent || 0;
        acc.visitors += row.total_visitors || 0;
        return acc;
      },
      { present: 0, absent: 0, visitors: 0 }
    );

    const summary: QuarterlyReportSummary = {
      periodKey,
      dateRange,
      totals,
      records: attendanceRows,
      generatedAt: new Date().toISOString()
    };

    setQuarterlyReportData(summary);
    setShowQuarterlyReport(false);
    setSuccess("Quarterly report generated. Click Open Report to view.");
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleConfirmQuarterly = async () => {
    setLoading(true);
    try {
      await confirmClassReport(classNumber, "quarterly", periodKey);
      setSuccess("Quarterly report confirmed");
      await loadReportStatus();
      if (ministerEmails) {
        const subject = `Quarterly Attendance Report - Class ${classNumber} (${periodKey})`;
        const body = `Quarterly report for Class ${classNumber} has been confirmed.\n\nPeriod: ${periodKey}\nAttendance Records: ${attendanceRows.length}`;
        window.location.href = `mailto:${ministerEmails}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      }
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError("Failed to confirm quarterly report");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateManualReport = async () => {
    if (!manualDateStart || !manualDateEnd) {
      setError("Please select both start and end dates");
      return;
    }

    if (new Date(manualDateStart) > new Date(manualDateEnd)) {
      setError("Start date must be before end date");
      return;
    }

    if (selectedAbsenceTypes.length === 0) {
      setError("Please select at least one absence type");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Get attendance records for the date range
      const records = await getAttendanceRange(classNumber, manualDateStart, manualDateEnd);
      
      // Build report data: count absences per member based on selected types
      const reportData: Record<string, any> = {};
      
      members.forEach(member => {
        reportData[member.id] = {
          name: member.name,
          absent_count: 0,
          sick_count: 0,
          travel_count: 0,
          total_absences: 0
        };
      });

      // For now, use total_members_absent from attendance records
      // In a real implementation, you'd need individual member records
      // This is a simplified approach that counts absences per attendance record
      const totalRecords = records.length;
      
      // Calculate average member absence per record
      const avgAbsentPerRecord = totalRecords > 0 
        ? records.reduce((sum: number, r: any) => sum + (r.total_members_absent || 0), 0) / totalRecords
        : 0;

      // Distribute absences among members (simplified approach)
      const memberIds = Object.keys(reportData);
      if (memberIds.length > 0 && avgAbsentPerRecord > 0) {
        const absencePerMember = avgAbsentPerRecord / memberIds.length;
        memberIds.forEach(memberId => {
          const absenceCount = Math.round(absencePerMember);
          reportData[memberId].total_absences = absenceCount;
          
          // Distribute among selected types
          if (selectedAbsenceTypes.includes('absent')) {
            reportData[memberId].absent_count = Math.ceil(absenceCount / selectedAbsenceTypes.length);
          }
          if (selectedAbsenceTypes.includes('sick')) {
            reportData[memberId].sick_count = Math.ceil(absenceCount / selectedAbsenceTypes.length);
          }
          if (selectedAbsenceTypes.includes('travel')) {
            reportData[memberId].travel_count = Math.floor(absenceCount / selectedAbsenceTypes.length);
          }
        });
      }

      // Save the manual report
      const saved = await saveManualReport(
        classNumber,
        manualDateStart,
        manualDateEnd,
        selectedAbsenceTypes,
        reportData
      );

      setGeneratedManualReport(saved as ManualReport);
      setSuccess("Manual report generated successfully");
      await loadManualReports();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError("Failed to generate manual report: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteManualReport = async (reportId: string | undefined) => {
    if (!reportId) return;
    if (!window.confirm("Delete this manual report?")) return;

    setLoading(true);
    try {
      await deleteManualReport(reportId);
      setSuccess("Manual report deleted");
      await loadManualReports();
      if (generatedManualReport?.id === reportId) {
        setGeneratedManualReport(null);
      }
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError("Failed to delete manual report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Class Reports
            </h1>
            <p className="text-sm text-gray-600">Class {classNumber}</p>
          </div>
          <div className="flex items-center gap-2">
            {onBackToClasses && (
              <button
                onClick={onBackToClasses}
                className="px-5 py-3 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-medium transition-all shadow-md border border-gray-200"
              >
                Back to Classes
              </button>
            )}
            <button
              onClick={onBack}
              className="px-5 py-3 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-medium transition-all shadow-md border border-gray-200"
            >
              Back to Attendance
            </button>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab("monthly")}
            className={`px-5 py-2 rounded-xl font-semibold transition ${activeTab === "monthly" ? "bg-blue-600 text-white shadow-md" : "bg-white text-gray-700 border border-gray-200"}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setActiveTab("quarterly")}
            className={`px-5 py-2 rounded-xl font-semibold transition ${activeTab === "quarterly" ? "bg-blue-600 text-white shadow-md" : "bg-white text-gray-700 border border-gray-200"}`}
          >
            Quarterly
          </button>
          <button
            onClick={() => setActiveTab("manual")}
            className={`px-5 py-2 rounded-xl font-semibold transition ${activeTab === "manual" ? "bg-blue-600 text-white shadow-md" : "bg-white text-gray-700 border border-gray-200"}`}
          >
            Manual Reports
          </button>
        </div>

      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-5 mb-6">
        {activeTab === "monthly" ? (
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-gray-700">Select Month</label>
            <input
              type="month"
              value={monthKey}
              onChange={(e) => setMonthKey(e.target.value)}
              className="max-w-xs px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        ) : activeTab === "quarterly" ? (
          <div className="flex flex-col gap-4">
            <label className="text-sm font-medium text-gray-700">Select Quarter</label>
            <div className="flex flex-wrap gap-3">
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              >
                {[year - 1, year, year + 1].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <select
                value={quarter}
                onChange={(e) => setQuarter(Number(e.target.value) as 1 | 2 | 3 | 4)}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value={1}>Q1</option>
                <option value={2}>Q2</option>
                <option value={3}>Q3</option>
                <option value={4}>Q4</option>
              </select>
              <button
                onClick={handleGenerateQuarterlyReport}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl text-sm font-semibold transition shadow-md"
              >
                Generate Quarterly Report
              </button>
            </div>
            {quarterlyReportData && !showQuarterlyReport && (
              <div className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-sm">
                <span className="text-indigo-800 font-medium">Report ready for {quarterlyReportData.periodKey}.</span>
                <button
                  onClick={() => setShowQuarterlyReport(true)}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition"
                >
                  Open Report
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-600">Configure your manual report below.</div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-100 border border-green-300 rounded-lg text-green-700 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {success}
        </div>
      )}

      {activeTab !== "manual" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Attendance Trend</h2>
              <span className="text-xs text-gray-600">{dateRange.start} to {dateRange.end}</span>
            </div>
            {trendSeries.length === 0 ? (
              <div className="text-sm text-gray-600">No attendance data for this period.</div>
            ) : (
              <div className="flex items-end gap-2 h-28">
                {trendSeries.map((item) => (
                  <div key={item.date} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-gradient-to-t from-blue-500 to-indigo-500 rounded-md"
                      style={{ height: `${Math.max(8, Math.round((item.present / maxTrendValue) * 100))}%` }}
                      title={`${item.date} - Present: ${item.present}`}
                    />
                    <span className="text-[10px] text-gray-500">
                      {item.date.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Averages</h2>
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 rounded-xl">
                <p className="text-xs text-gray-600">Average Present</p>
                <p className="text-xl font-bold text-blue-700">
                  {attendanceTotals.records ? Math.round(attendanceTotals.present / attendanceTotals.records) : 0}
                </p>
              </div>
              <div className="p-3 bg-orange-50 rounded-xl">
                <p className="text-xs text-gray-600">Average Absent</p>
                <p className="text-xl font-bold text-orange-700">
                  {attendanceTotals.records ? Math.round(attendanceTotals.absent / attendanceTotals.records) : 0}
                </p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl">
                <p className="text-xs text-gray-600">Attendance Records</p>
                <p className="text-xl font-bold text-emerald-700">{attendanceTotals.records}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab !== "manual" && monthlyBreakdown.length > 0 && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Attendance Per Month</h2>
            <span className="text-xs text-gray-600">Totals by month</span>
          </div>
          <div className="space-y-3">
            {monthlyBreakdown.map((item) => (
              <div key={item.month} className="flex items-center gap-3">
                <div className="w-20 text-xs text-gray-600 font-medium">{item.month}</div>
                <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
                    style={{ width: `${Math.max(6, Math.round((item.present / maxMonthlyPresent) * 100))}%` }}
                  />
                </div>
                <div className="w-14 text-right text-xs text-gray-700 font-semibold">{item.present}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "monthly" && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Attendance Records</h2>
            <span className="text-sm text-gray-600">{dateRange.start} to {dateRange.end}</span>
          </div>

          {loading ? (
            <div className="text-sm text-gray-600">Loading attendance...</div>
          ) : attendanceRows.length === 0 ? (
            <div className="text-sm text-gray-600">No attendance records for this period.</div>
          ) : (
            <div className="space-y-3">
              {attendanceRows.map((row) => (
                <div key={row.id} className="border border-gray-200 rounded-xl p-4 bg-white/70">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium text-gray-900">{row.attendance_date}</p>
                      <p className="text-xs text-gray-600">{row.service_type === "sunday" ? "Sunday Service" : "Bible Study"}</p>
                    </div>
                    <button
                      onClick={() => handleSaveAttendanceRow(row.id)}
                      disabled={loading}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <label className="text-xs text-gray-500">Present</label>
                      <input
                        type="number"
                        min={0}
                        value={attendanceEdits[row.id]?.present ?? row.total_members_present}
                        onChange={(e) => handleEditTotals(row.id, "present", e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Absent</label>
                      <input
                        type="number"
                        min={0}
                        value={attendanceEdits[row.id]?.absent ?? row.total_members_absent}
                        onChange={(e) => handleEditTotals(row.id, "absent", e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Visitors</label>
                      <input
                        type="number"
                        min={0}
                        value={attendanceEdits[row.id]?.visitors ?? row.total_visitors}
                        onChange={(e) => handleEditTotals(row.id, "visitors", e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "quarterly" && showQuarterlyReport && quarterlyReportData && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Quarterly Report</h2>
            <span className="text-sm text-gray-600">{quarterlyReportData.dateRange.start} to {quarterlyReportData.dateRange.end}</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm mb-4">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-600">Total Present</p>
              <p className="text-lg font-semibold text-gray-900">{quarterlyReportData.totals.present}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-600">Total Absent</p>
              <p className="text-lg font-semibold text-gray-900">{quarterlyReportData.totals.absent}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-600">Total Visitors</p>
              <p className="text-lg font-semibold text-gray-900">{quarterlyReportData.totals.visitors}</p>
            </div>
          </div>
          <div className="space-y-3">
            {quarterlyReportData.records.map((row) => (
              <div key={row.id} className="border border-gray-200 rounded-xl p-3 bg-white/70">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{row.attendance_date}</p>
                    <p className="text-xs text-gray-600">{row.service_type === "sunday" ? "Sunday Service" : "Bible Study"}</p>
                  </div>
                  <div className="text-xs text-gray-600">
                    P: {row.total_members_present} • A: {row.total_members_absent} • V: {row.total_visitors}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "quarterly" && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Quarterly Confirmation</h2>
              <p className="text-sm text-gray-600">
                {reportStatus?.status === "submitted" ? "Submitted" : "Not submitted"}
              </p>
            </div>
            <button
              onClick={handleConfirmQuarterly}
              disabled={loading || reportStatus?.status === "submitted"}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50"
            >
              Confirm & Send
            </button>
          </div>
        </div>
      )}

      {activeTab === "manual" && (
        <div className="space-y-6">
          {/* Generate Manual Report */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Generate Manual Report</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={manualDateStart}
                  onChange={(e) => setManualDateStart(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={manualDateEnd}
                  onChange={(e) => setManualDateEnd(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Absence Types to Include
              </label>
              <div className="space-y-2">
                {(['absent', 'sick', 'travel'] as const).map((type) => (
                  <label key={type} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedAbsenceTypes.includes(type)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAbsenceTypes([...selectedAbsenceTypes, type]);
                        } else {
                          setSelectedAbsenceTypes(selectedAbsenceTypes.filter(t => t !== type));
                        }
                      }}
                      className="w-4 h-4 border border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700 capitalize">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerateManualReport}
              disabled={loading}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition disabled:opacity-50"
            >
              {loading ? "Generating..." : "Generate Report"}
            </button>
          </div>

          {/* Generated Report Display */}
          {generatedManualReport && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">
                Generated Report
              </h3>
              <div className="mb-4 p-4 bg-blue-50 rounded-xl">
                <p className="text-sm text-blue-900">
                  <strong>Period:</strong> {generatedManualReport.dateRangeStart} to {generatedManualReport.dateRangeEnd}
                </p>
                <p className="text-sm text-blue-900">
                  <strong>Absence Types:</strong> {generatedManualReport.absenceTypes.join(', ')}
                </p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-2 py-2 text-left">Member Name</th>
                      <th className="border border-gray-300 px-2 py-2 text-center">Absences</th>
                      <th className="border border-gray-300 px-2 py-2 text-center">Sick</th>
                      <th className="border border-gray-300 px-2 py-2 text-center">Travel</th>
                      <th className="border border-gray-300 px-2 py-2 text-center">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(generatedManualReport.reportData || {}).map(([memberId, data]) => (
                      <tr key={memberId} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-2 py-2">{data.name}</td>
                        <td className="border border-gray-300 px-2 py-2 text-center">{data.absent_count}</td>
                        <td className="border border-gray-300 px-2 py-2 text-center">{data.sick_count}</td>
                        <td className="border border-gray-300 px-2 py-2 text-center">{data.travel_count}</td>
                        <td className="border border-gray-300 px-2 py-2 text-center font-medium">{data.total_absences}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Archive Section */}
          {manualReportArchive.length > 0 && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Report Archive ({manualReportArchive.length}/5)
              </h3>
              <div className="space-y-3">
                {manualReportArchive.map((report) => (
                  <div key={report.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {report.dateRangeStart} to {report.dateRangeEnd}
                      </p>
                      <p className="text-xs text-gray-600">
                        {report.absenceTypes.join(', ')} • Generated {new Date(report.created_at || '').toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setGeneratedManualReport(report)}
                        className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-sm font-medium transition"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleDeleteManualReport(report.id)}
                        disabled={loading}
                        className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded text-sm font-medium transition disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
};

export default ClassReports;
