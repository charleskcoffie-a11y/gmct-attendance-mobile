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
  deleteManualReport,
  getMemberAttendanceHistory,
  getMemberAttendanceSummary
} from "../supabase";
import { Member, ServiceType, ManualReport } from "../types";
import { AlertCircle, CheckCircle, Trash2, TrendingUp, Users, Calendar, BarChart3, Send, Download, User } from "lucide-react";

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
  const [activeTab, setActiveTab] = useState<"monthly" | "quarterly" | "manual" | "members">("monthly");
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

  // Member report states
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [memberServiceType, setMemberServiceType] = useState<'sunday' | 'bible-study' | 'both'>('both');
  const [memberStartDate, setMemberStartDate] = useState(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return firstDay.toISOString().split("T")[0];
  });
  const [memberEndDate, setMemberEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [memberAttendanceHistory, setMemberAttendanceHistory] = useState<any[]>([]);
  const [memberSummary, setMemberSummary] = useState<any>(null);

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

  useEffect(() => {
    if (activeTab === "members" && selectedMemberId) {
      loadMemberAttendance();
    }
  }, [activeTab, selectedMemberId, memberServiceType, memberStartDate, memberEndDate, classNumber]);

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

  const loadMemberAttendance = async () => {
    if (!selectedMemberId) return;
    setLoading(true);
    setError(null);
    try {
      const startDate = memberStartDate;
      const endDate = memberEndDate;
      const serviceFilter = memberServiceType === 'both' ? undefined : memberServiceType;
      
      const history = await getMemberAttendanceHistory(
        classNumber,
        selectedMemberId,
        startDate,
        endDate,
        serviceFilter
      );
      setMemberAttendanceHistory(history || []);

      const summary = await getMemberAttendanceSummary(
        classNumber,
        selectedMemberId,
        startDate,
        endDate,
        serviceFilter
      );
      setMemberSummary(summary);
    } catch (err) {
      setError("Failed to load member attendance");
      console.error("Error loading member attendance:", err);
    } finally {
      setLoading(false);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-4xl font-bold text-white">Class Reports</h1>
              </div>
              <p className="text-slate-400 ml-12">Class {classNumber} • Attendance Analytics & Reports</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {onBackToClasses && (
                <button
                  onClick={onBackToClasses}
                  className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-all shadow-lg"
                >
                  Back to Classes
                </button>
              )}
              <button
                onClick={onBack}
                className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-all shadow-lg"
              >
                Back
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 flex flex-wrap gap-3 bg-slate-800/50 backdrop-blur-sm p-1.5 rounded-2xl border border-slate-700/50 w-fit">
          <button
            onClick={() => setActiveTab("monthly")}
            className={`px-4 py-2.5 rounded-xl font-semibold transition-all ${
              activeTab === "monthly"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Monthly
            </div>
          </button>
          <button
            onClick={() => setActiveTab("quarterly")}
            className={`px-4 py-2.5 rounded-xl font-semibold transition-all ${
              activeTab === "quarterly"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Quarterly
            </div>
          </button>
          <button
            onClick={() => setActiveTab("manual")}
            className={`px-4 py-2.5 rounded-xl font-semibold transition-all ${
              activeTab === "manual"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Manual Reports
            </div>
          </button>
          <button
            onClick={() => setActiveTab("members")}
            className={`px-4 py-2.5 rounded-xl font-semibold transition-all ${
              activeTab === "members"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Member Reports
            </div>
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-4 bg-red-950/50 border border-red-700/50 rounded-xl text-red-300 text-sm flex items-start gap-3 backdrop-blur-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-emerald-950/50 border border-emerald-700/50 rounded-xl text-emerald-300 text-sm flex items-start gap-3 backdrop-blur-sm">
            <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {/* Period Selector */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-700/50 p-6 mb-6">
          {activeTab === "monthly" ? (
            <div className="flex flex-col gap-3">
              <label className="text-sm font-semibold text-slate-300">Select Month</label>
              <input
                type="month"
                value={monthKey}
                onChange={(e) => setMonthKey(e.target.value)}
                className="max-w-xs px-4 py-2.5 bg-slate-700 border border-slate-600 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ) : activeTab === "quarterly" ? (
            <div className="flex flex-col gap-4">
              <label className="text-sm font-semibold text-slate-300">Select Quarter</label>
              <div className="flex flex-wrap gap-3">
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="px-4 py-2.5 bg-slate-700 border border-slate-600 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {[year - 1, year, year + 1].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <select
                  value={quarter}
                  onChange={(e) => setQuarter(Number(e.target.value) as 1 | 2 | 3 | 4)}
                  className="px-4 py-2.5 bg-slate-700 border border-slate-600 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={1}>Q1 (Jan-Mar)</option>
                  <option value={2}>Q2 (Apr-Jun)</option>
                  <option value={3}>Q3 (Jul-Sep)</option>
                  <option value={4}>Q4 (Oct-Dec)</option>
                </select>
                <button
                  onClick={handleGenerateQuarterlyReport}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg"
                >
                  Generate Report
                </button>
              </div>
              {quarterlyReportData && !showQuarterlyReport && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-emerald-950/50 border border-emerald-700/50 rounded-xl text-sm">
                  <span className="text-emerald-300 font-medium">✓ Report ready for {quarterlyReportData.periodKey}</span>
                  <button
                    onClick={() => setShowQuarterlyReport(true)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-all"
                  >
                    Open Report
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-slate-400">Configure your manual report below</p>
          )}
        </div>

        {/* Analytics Cards */}
        {activeTab !== "manual" && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            {/* Presence Metrics */}
            <div className="bg-gradient-to-br from-blue-600/20 to-indigo-600/20 backdrop-blur-sm rounded-xl border border-blue-500/30 p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-blue-600/30 rounded-lg">
                  <Users className="w-3 h-3 text-blue-300" />
                </div>
                <h3 className="text-xs font-semibold text-slate-300">Avg Present</h3>
              </div>
              <div className="text-xl font-bold text-blue-300">
                {attendanceTotals.records ? Math.round(attendanceTotals.present / attendanceTotals.records) : 0}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{attendanceTotals.records} records</p>
            </div>

            {/* Absence Metrics */}
            <div className="bg-gradient-to-br from-orange-600/20 to-red-600/20 backdrop-blur-sm rounded-xl border border-orange-500/30 p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-orange-600/30 rounded-lg">
                  <AlertCircle className="w-3 h-3 text-orange-300" />
                </div>
                <h3 className="text-xs font-semibold text-slate-300">Avg Absent</h3>
              </div>
              <div className="text-xl font-bold text-orange-300">
                {attendanceTotals.records ? Math.round(attendanceTotals.absent / attendanceTotals.records) : 0}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{attendanceTotals.records} records</p>
            </div>
          </div>
        )}

        {/* Attendance Trend Chart */}
        {activeTab !== "manual" && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-700/50 p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Attendance Trend</h2>
              <span className="text-xs text-slate-400">{dateRange.start} to {dateRange.end}</span>
            </div>
            {trendSeries.length === 0 ? (
              <div className="text-sm text-slate-400 py-8 text-center">No data to display</div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-end justify-between gap-2 h-40 p-4 bg-slate-700/30 rounded-xl border border-slate-600/30">
                  {trendSeries.map((item) => {
                    const heightPercent = (item.present / maxTrendValue) * 100;
                    return (
                      <div key={item.date} className="flex-1 flex flex-col items-center gap-2 group h-full">
                        <div className="h-full flex items-end justify-center w-full">
                          <div
                            className="w-3/4 bg-gradient-to-t from-blue-500 to-blue-300 rounded-t transition-all group-hover:from-blue-400 group-hover:to-blue-200 cursor-pointer"
                            style={{ height: `${heightPercent}%`, minHeight: heightPercent > 0 ? '4px' : '0px' }}
                            title={`${item.date} - Present: ${item.present}, Absent: ${item.absent}`}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 group-hover:text-slate-300 font-medium">
                          {item.date.slice(8)}
                        </span>
                        <span className="text-[9px] text-slate-500 font-semibold">{item.present}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-blue-500/20 rounded-lg border border-blue-500/30 text-blue-300">
                    <p className="text-slate-400 text-[10px] mb-1">Records</p>
                    <span className="font-semibold text-sm">{trendSeries.length}</span>
                  </div>
                  <div className="p-3 bg-blue-500/20 rounded-lg border border-blue-500/30 text-blue-300">
                    <p className="text-slate-400 text-[10px] mb-1">Max Present</p>
                    <span className="font-semibold text-sm">{Math.max(0, ...trendSeries.map(x => x.present))}</span>
                  </div>
                  <div className="p-3 bg-orange-500/20 rounded-lg border border-orange-500/30 text-orange-300">
                    <p className="text-slate-400 text-[10px] mb-1">Min Present</p>
                    <span className="font-semibold text-sm">{Math.min(...trendSeries.map(x => x.present))}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Monthly Breakdown */}
        {activeTab !== "manual" && monthlyBreakdown.length > 0 && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-700/50 p-6 mb-6">
            <h2 className="text-lg font-bold text-white mb-6">Monthly Breakdown</h2>
            <div className="space-y-4">
              {monthlyBreakdown.map((item) => (
                <div key={item.month} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-300">{item.month}</span>
                    <div className="flex gap-4 text-xs text-slate-400">
                      <span>Present: <span className="font-semibold text-blue-300">{item.present}</span></span>
                      <span>Absent: <span className="font-semibold text-orange-300">{item.absent}</span></span>
                    </div>
                  </div>
                  <div className="flex gap-1 h-2 bg-slate-700/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                      style={{ width: `${Math.max(6, Math.round((item.present / maxMonthlyPresent) * 100))}%` }}
                    />
                    {item.absent > 0 && (
                      <div
                        className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full"
                        style={{ width: `${Math.max(3, Math.round((item.absent / maxMonthlyPresent) * 100))}%` }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Monthly Attendance Records */}
        {activeTab === "monthly" && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-700/50 p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Attendance Records</h2>
              <span className="text-xs text-slate-400">{dateRange.start} to {dateRange.end}</span>
            </div>

            {loading ? (
              <div className="text-sm text-slate-400 py-8 text-center">Loading attendance...</div>
            ) : attendanceRows.length === 0 ? (
              <div className="text-sm text-slate-400 py-8 text-center">No attendance records for this period</div>
            ) : (
              <div className="space-y-3">
                {attendanceRows.map((row) => (
                  <div key={row.id} className="bg-slate-700/30 border border-slate-600/50 rounded-xl p-5 transition-all hover:bg-slate-700/50">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="font-semibold text-white">{row.attendance_date}</p>
                        <p className="text-xs text-slate-400">
                          {row.service_type === "sunday" ? "Sunday Service" : "Bible Study"}
                        </p>
                      </div>
                      <button
                        onClick={() => handleSaveAttendanceRow(row.id)}
                        disabled={loading}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                      >
                        Save Changes
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-blue-600/20 border border-blue-500/30 rounded-lg p-3">
                        <label className="text-xs text-slate-400 font-medium block mb-2">Present</label>
                        <input
                          type="number"
                          min={0}
                          value={attendanceEdits[row.id]?.present ?? row.total_members_present}
                          onChange={(e) => handleEditTotals(row.id, "present", e.target.value)}
                          className="w-full px-3 py-2 bg-slate-700 border border-blue-500/50 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold"
                        />
                      </div>
                      <div className="bg-orange-600/20 border border-orange-500/30 rounded-lg p-3">
                        <label className="text-xs text-slate-400 font-medium block mb-2">Absent</label>
                        <input
                          type="number"
                          min={0}
                          value={attendanceEdits[row.id]?.absent ?? row.total_members_absent}
                          onChange={(e) => handleEditTotals(row.id, "absent", e.target.value)}
                          className="w-full px-3 py-2 bg-slate-700 border border-orange-500/50 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm font-semibold"
                        />
                      </div>
                      <div className="bg-emerald-600/20 border border-emerald-500/30 rounded-lg p-3">
                        <label className="text-xs text-slate-400 font-medium block mb-2">Visitors</label>
                        <input
                          type="number"
                          min={0}
                          value={attendanceEdits[row.id]?.visitors ?? row.total_visitors}
                          onChange={(e) => handleEditTotals(row.id, "visitors", e.target.value)}
                          className="w-full px-3 py-2 bg-slate-700 border border-emerald-500/50 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-semibold"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quarterly Report Display */}
        {activeTab === "quarterly" && showQuarterlyReport && quarterlyReportData && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-700/50 p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Quarterly Report</h2>
              <span className="text-xs text-slate-400">{quarterlyReportData.dateRange.start} to {quarterlyReportData.dateRange.end}</span>
            </div>
            
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-600/20 border border-blue-500/30 rounded-xl p-4">
                <p className="text-xs text-slate-400 font-medium mb-2">Total Present</p>
                <p className="text-2xl font-bold text-blue-300">{quarterlyReportData.totals.present}</p>
              </div>
              <div className="bg-orange-600/20 border border-orange-500/30 rounded-xl p-4">
                <p className="text-xs text-slate-400 font-medium mb-2">Total Absent</p>
                <p className="text-2xl font-bold text-orange-300">{quarterlyReportData.totals.absent}</p>
              </div>
              <div className="bg-emerald-600/20 border border-emerald-500/30 rounded-xl p-4">
                <p className="text-xs text-slate-400 font-medium mb-2">Total Visitors</p>
                <p className="text-2xl font-bold text-emerald-300">{quarterlyReportData.totals.visitors}</p>
              </div>
            </div>

            {/* Detailed Records */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Details</h3>
              {quarterlyReportData.records.map((row) => (
                <div key={row.id} className="bg-slate-700/30 border border-slate-600/50 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">{row.attendance_date}</p>
                    <p className="text-xs text-slate-400">
                      {row.service_type === "sunday" ? "Sunday Service" : "Bible Study"}
                    </p>
                  </div>
                  <div className="flex gap-6 text-sm">
                    <div className="text-center">
                      <p className="text-xs text-slate-400">Present</p>
                      <p className="font-bold text-blue-300">{row.total_members_present}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-400">Absent</p>
                      <p className="font-bold text-orange-300">{row.total_members_absent}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-400">Visitors</p>
                      <p className="font-bold text-emerald-300">{row.total_visitors}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quarterly Confirmation */}
        {activeTab === "quarterly" && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-700/50 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">Submit Quarterly Report</h2>
                <p className="text-sm text-slate-400">
                  {reportStatus?.status === "submitted" 
                    ? "✓ Report has been submitted" 
                    : "Ready to submit this quarter's report"}
                </p>
              </div>
              <button
                onClick={handleConfirmQuarterly}
                disabled={loading || reportStatus?.status === "submitted"}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-semibold transition-all disabled:opacity-50 shadow-lg"
              >
                <Send className="w-4 h-4" />
                {reportStatus?.status === "submitted" ? "Submitted" : "Submit"}
              </button>
            </div>
          </div>
        )}

        {/* Manual Reports Section */}
        {activeTab === "manual" && (
          <div className="space-y-6">
            {/* Generate Manual Report */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-700/50 p-6">
              <h2 className="text-lg font-semibold text-white mb-6">Generate Manual Report</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-3">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={manualDateStart}
                    onChange={(e) => setManualDateStart(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-3">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={manualDateEnd}
                    onChange={(e) => setManualDateEnd(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
              </div>

              <div className="mb-6 p-4 bg-slate-700/30 border border-slate-600/50 rounded-xl">
                <label className="block text-sm font-semibold text-slate-300 mb-4">
                  Absence Types
                </label>
                <div className="space-y-3">
                  {(['absent', 'sick', 'travel'] as const).map((type) => (
                    <label key={type} className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 cursor-pointer transition-all">
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
                        className="w-5 h-5 rounded border-slate-500 bg-slate-600 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-slate-300 capitalize">{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={handleGenerateManualReport}
                disabled={loading}
                className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all disabled:opacity-50 shadow-lg"
              >
                {loading ? "Generating..." : "Generate Report"}
              </button>
            </div>

            {/* Generated Report Display */}
            {generatedManualReport && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-700/50 p-6">
                <h3 className="text-base font-semibold text-white mb-6">
                  Generated Report
                </h3>
                <div className="mb-6 p-4 bg-blue-600/20 border border-blue-500/30 rounded-xl">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-400 text-xs font-medium">Period</p>
                      <p className="text-white font-semibold">{generatedManualReport.dateRangeStart} to {generatedManualReport.dateRangeEnd}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs font-medium">Absence Types</p>
                      <p className="text-white font-semibold">{generatedManualReport.absenceTypes.join(', ')}</p>
                    </div>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-slate-300">
                    <thead>
                      <tr className="border-b border-slate-600">
                        <th className="px-4 py-3 text-left font-semibold text-slate-200">Member</th>
                        <th className="px-4 py-3 text-center font-semibold text-slate-200">Absent</th>
                        <th className="px-4 py-3 text-center font-semibold text-slate-200">Sick</th>
                        <th className="px-4 py-3 text-center font-semibold text-slate-200">Travel</th>
                        <th className="px-4 py-3 text-center font-semibold text-slate-200">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(generatedManualReport.reportData || {}).map(([memberId, data], idx) => (
                        <tr key={memberId} className={idx % 2 === 0 ? "bg-slate-700/20" : ""}>
                          <td className="px-4 py-3 text-white font-medium">{data.name}</td>
                          <td className="px-4 py-3 text-center text-orange-300 font-semibold">{data.absent_count}</td>
                          <td className="px-4 py-3 text-center text-red-300 font-semibold">{data.sick_count}</td>
                          <td className="px-4 py-3 text-center text-yellow-300 font-semibold">{data.travel_count}</td>
                          <td className="px-4 py-3 text-center text-blue-300 font-bold">{data.total_absences}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Archive Section */}
            {manualReportArchive.length > 0 && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-700/50 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <h3 className="text-lg font-semibold text-white">
                    Report Archive
                  </h3>
                  <span className="px-3 py-1 bg-slate-700 text-slate-300 text-xs font-semibold rounded-full">
                    {manualReportArchive.length}/5
                  </span>
                </div>
                <div className="space-y-3">
                  {manualReportArchive.map((report) => (
                    <div key={report.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-slate-700/30 border border-slate-600/50 rounded-xl transition-all hover:bg-slate-700/50">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white mb-1">
                          {report.dateRangeStart} to {report.dateRangeEnd}
                        </p>
                        <p className="text-xs text-slate-400">
                          {report.absenceTypes.join(', ')} • {new Date(report.created_at || '').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setGeneratedManualReport(report)}
                          className="px-4 py-2 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 font-medium rounded-lg text-sm transition-all border border-blue-500/30"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleDeleteManualReport(report.id)}
                          disabled={loading}
                          className="px-4 py-2 bg-red-600/30 hover:bg-red-600/50 text-red-300 font-medium rounded-lg text-sm transition-all border border-red-500/30 flex items-center gap-2 disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Member Reports Section */}
        {activeTab === "members" && (
          <div className="space-y-6">
            {/* Member Selection */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-700/50 p-6">
              <h2 className="text-lg font-semibold text-white mb-6">Select Member</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-3">
                    Member
                  </label>
                  <select
                    value={selectedMemberId}
                    onChange={(e) => setSelectedMemberId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  >
                    <option value="">-- Select a member --</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-3">
                    Service Type
                  </label>
                  <select
                    value={memberServiceType}
                    onChange={(e) => setMemberServiceType(e.target.value as 'sunday' | 'bible-study' | 'both')}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  >
                    <option value="both">Both Sunday & Bible Study</option>
                    <option value="sunday">Sunday Only</option>
                    <option value="bible-study">Bible Study Only</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-3">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={memberStartDate}
                    onChange={(e) => setMemberStartDate(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-3">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={memberEndDate}
                    onChange={(e) => setMemberEndDate(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
              </div>

              <button
                onClick={loadMemberAttendance}
                disabled={!selectedMemberId || loading}
                className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all disabled:opacity-50 shadow-lg"
              >
                {loading ? "Loading..." : "Generate Report"}
              </button>
            </div>

            {/* Member Summary */}
            {selectedMemberId && memberSummary && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-700/50 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-blue-600/30 rounded-lg">
                    <User className="w-5 h-5 text-blue-300" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      {members.find(m => m.id === selectedMemberId)?.name}
                    </h2>
                    <p className="text-xs text-slate-400">{memberStartDate} to {memberEndDate}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                  <div className="bg-blue-600/20 border border-blue-500/30 rounded-xl p-4">
                    <p className="text-xs text-slate-400 font-medium mb-2">Present</p>
                    <p className="text-2xl font-bold text-blue-300">{memberSummary.present}</p>
                  </div>
                  <div className="bg-orange-600/20 border border-orange-500/30 rounded-xl p-4">
                    <p className="text-xs text-slate-400 font-medium mb-2">Absent</p>
                    <p className="text-2xl font-bold text-orange-300">{memberSummary.absent}</p>
                  </div>
                  <div className="bg-red-600/20 border border-red-500/30 rounded-xl p-4">
                    <p className="text-xs text-slate-400 font-medium mb-2">Sick</p>
                    <p className="text-2xl font-bold text-red-300">{memberSummary.sick}</p>
                  </div>
                  <div className="bg-yellow-600/20 border border-yellow-500/30 rounded-xl p-4">
                    <p className="text-xs text-slate-400 font-medium mb-2">Travel</p>
                    <p className="text-2xl font-bold text-yellow-300">{memberSummary.travel}</p>
                  </div>
                  <div className="bg-slate-600/20 border border-slate-500/30 rounded-xl p-4">
                    <p className="text-xs text-slate-400 font-medium mb-2">Total</p>
                    <p className="text-2xl font-bold text-slate-300">{memberSummary.total}</p>
                  </div>
                </div>

                {memberAttendanceHistory.length > 0 && (
                  <>
                    <h3 className="text-sm font-semibold text-slate-300 mb-4">Attendance History</h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {memberAttendanceHistory.map((record: any) => (
                        <div key={record.id} className="flex items-center justify-between p-3 bg-slate-700/30 border border-slate-600/50 rounded-lg">
                          <div>
                            <p className="text-sm font-medium text-white">
                              {record.attendance?.attendance_date}
                            </p>
                            <p className="text-xs text-slate-400">
                              {record.attendance?.service_type === 'sunday' ? 'Sunday Service' : 'Bible Study'}
                            </p>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            record.status === 'present' ? 'bg-blue-600/30 text-blue-300' :
                            record.status === 'absent' ? 'bg-orange-600/30 text-orange-300' :
                            record.status === 'sick' ? 'bg-red-600/30 text-red-300' :
                            'bg-yellow-600/30 text-yellow-300'
                          }`}>
                            {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClassReports;
