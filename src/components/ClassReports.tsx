import React, { useEffect, useMemo, useState } from "react";
import {
  confirmClassReport,
  getAppSettings,
  getAttendanceRange,
  getClassMembers,
  getClassReportStatus,
  getReportMemberNotes,
  saveReportMemberNotes,
  updateAttendanceTotals
} from "../supabase";
import { Member, ServiceType } from "../types";
import { AlertCircle, CheckCircle } from "lucide-react";

interface ClassReportsProps {
  classNumber: number;
  onBack: () => void;
}

interface AttendanceRow {
  id: string;
  attendance_date: string;
  service_type: ServiceType;
  total_members_present: number;
  total_members_absent: number;
  total_visitors: number;
}

export const ClassReports: React.FC<ClassReportsProps> = ({ classNumber, onBack }) => {
  const [activeTab, setActiveTab] = useState<"monthly" | "quarterly">("monthly");
  const [monthKey, setMonthKey] = useState(() => new Date().toISOString().slice(0, 7));
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [quarter, setQuarter] = useState<1 | 2 | 3 | 4>(() => {
    const month = new Date().getMonth();
    return (Math.floor(month / 3) + 1) as 1 | 2 | 3 | 4;
  });
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [notesByMember, setNotesByMember] = useState<Record<string, string>>({});
  const [attendanceEdits, setAttendanceEdits] = useState<Record<string, { present: number; absent: number; visitors: number }>>({});
  const [reportStatus, setReportStatus] = useState<any>(null);
  const [ministerEmails, setMinisterEmails] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  useEffect(() => {
    loadMembers();
    loadSettings();
  }, [classNumber]);

  useEffect(() => {
    loadAttendance();
    loadNotes();
    if (activeTab === "quarterly") {
      loadReportStatus();
    } else {
      setReportStatus(null);
    }
  }, [classNumber, activeTab, periodKey, dateRange.start, dateRange.end]);

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

  const loadNotes = async () => {
    try {
      const noteRows = await getReportMemberNotes(classNumber, activeTab, periodKey);
      const noteMap: Record<string, string> = {};
      (noteRows || []).forEach((row: any) => {
        noteMap[row.member_id] = row.note || "";
      });
      setNotesByMember(noteMap);
    } catch (err) {
      console.error("Error loading notes:", err);
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

  const handleSaveNotes = async () => {
    setLoading(true);
    try {
      const payload = Object.entries(notesByMember).map(([memberId, note]) => ({
        memberId,
        note
      }));
      await saveReportMemberNotes(classNumber, activeTab, periodKey, payload);
      setSuccess("Notes saved successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError("Failed to save notes");
    } finally {
      setLoading(false);
    }
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

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Class Reports</h1>
          <p className="text-sm text-gray-600">Class {classNumber}</p>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg font-medium transition"
        >
          Back to Attendance
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setActiveTab("monthly")}
          className={`px-4 py-2 rounded-lg font-medium transition ${activeTab === "monthly" ? "bg-blue-600 text-white" : "bg-white text-gray-700 border border-gray-200"}`}
        >
          Monthly
        </button>
        <button
          onClick={() => setActiveTab("quarterly")}
          className={`px-4 py-2 rounded-lg font-medium transition ${activeTab === "quarterly" ? "bg-blue-600 text-white" : "bg-white text-gray-700 border border-gray-200"}`}
        >
          Quarterly
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
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
        ) : (
          <div className="flex flex-col gap-3">
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
            </div>
          </div>
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
              <div key={row.id} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium text-gray-900">{row.attendance_date}</p>
                    <p className="text-xs text-gray-600">{row.service_type === "sunday" ? "Sunday Service" : "Bible Study"}</p>
                  </div>
                  {activeTab === "monthly" && (
                    <button
                      onClick={() => handleSaveAttendanceRow(row.id)}
                      disabled={loading}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition disabled:opacity-50"
                    >
                      Save
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <label className="text-xs text-gray-500">Present</label>
                    {activeTab === "monthly" ? (
                      <input
                        type="number"
                        min={0}
                        value={attendanceEdits[row.id]?.present ?? row.total_members_present}
                        onChange={(e) => handleEditTotals(row.id, "present", e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      />
                    ) : (
                      <p className="font-semibold text-gray-900">{row.total_members_present}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Absent</label>
                    {activeTab === "monthly" ? (
                      <input
                        type="number"
                        min={0}
                        value={attendanceEdits[row.id]?.absent ?? row.total_members_absent}
                        onChange={(e) => handleEditTotals(row.id, "absent", e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      />
                    ) : (
                      <p className="font-semibold text-gray-900">{row.total_members_absent}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Visitors</label>
                    {activeTab === "monthly" ? (
                      <input
                        type="number"
                        min={0}
                        value={attendanceEdits[row.id]?.visitors ?? row.total_visitors}
                        onChange={(e) => handleEditTotals(row.id, "visitors", e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      />
                    ) : (
                      <p className="font-semibold text-gray-900">{row.total_visitors}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Notes for Minister</h2>
          <button
            onClick={handleSaveNotes}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            Save Notes
          </button>
        </div>
        {members.length === 0 ? (
          <div className="text-sm text-gray-600">No members found.</div>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <div key={member.id} className="border border-gray-200 rounded-lg p-3">
                <p className="font-medium text-gray-900 mb-2">{member.name}</p>
                <textarea
                  value={notesByMember[member.id] || ""}
                  onChange={(e) =>
                    setNotesByMember((prev) => ({
                      ...prev,
                      [member.id]: e.target.value
                    }))
                  }
                  rows={2}
                  className="w-full px-2 py-2 border border-gray-300 rounded"
                  placeholder="Add note for minister"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {activeTab === "quarterly" && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
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
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              Confirm & Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassReports;
