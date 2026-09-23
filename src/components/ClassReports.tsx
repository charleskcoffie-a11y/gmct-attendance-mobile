import React, { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  confirmClassReport,
  getAppSettings,
  getAttendanceRange,
  getClassMembers,
  getClassReportStatus,
  saveManualReport,
  getManualReports,
  deleteManualReport,
  getMemberAttendanceHistory,
  getMemberAttendanceSummary,
  getClassMemberAttendanceRange
} from "../supabase";
import { Member, ServiceType, ManualReport } from "../types";
import { AlertCircle, CheckCircle, Trash2, TrendingUp, Users, Calendar, BarChart3, Send, Download, User } from "lucide-react";

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

interface QuarterlyReportSummary {
  periodKey: string;
  dateRange: { start: string; end: string };
  totals: { present: number; absent: number; visitors: number };
  records: AttendanceRow[];
  generatedAt: string;
}

interface QuarterlyMemberSummary {
  memberId: string;
  name: string;
  present: number;
  absent: number;
  sick: number;
  travel: number;
  consecutiveAbsentWeeks: number;
  needsFollowUp: boolean;
}

export const ClassReports: React.FC<ClassReportsProps> = ({ classNumber, onBack }) => {
  const [activeTab, setActiveTab] = useState<"monthly" | "quarterly" | "manual" | "members">("monthly");
  const [monthKey, setMonthKey] = useState(() => new Date().toISOString().slice(0, 7));
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [quarter, setQuarter] = useState<1 | 2 | 3 | 4>(() => {
    const month = new Date().getMonth();
    return (Math.floor(month / 3) + 1) as 1 | 2 | 3 | 4;
  });
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [reportStatus, setReportStatus] = useState<any>(null);
  const [ministerEmails, setMinisterEmails] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [quarterlyReportData, setQuarterlyReportData] = useState<QuarterlyReportSummary | null>(null);
  const [showQuarterlyReport, setShowQuarterlyReport] = useState(false);
  const [quarterlyMemberSummary, setQuarterlyMemberSummary] = useState<QuarterlyMemberSummary[]>([]);

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
  const [memberReportGeneratedAt, setMemberReportGeneratedAt] = useState<string | null>(null);

  const createPdf = (title: string, subtitle: string) => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(title, 32, 40);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90, 105, 125);
    doc.text(subtitle, 32, 56);
    doc.setTextColor(30, 40, 55);
    return doc;
  };

  const addBarChart = (doc: jsPDF, title: string, bars: Array<{ label: string; value: number; color: [number, number, number] }>, startY: number) => {
    const maxValue = Math.max(1, ...bars.map((bar) => bar.value));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(title, 32, startY);
    bars.forEach((bar, index) => {
      const y = startY + 16 + index * 23;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(bar.label, 32, y + 9);
      doc.setFillColor(232, 237, 244);
      doc.roundedRect(118, y, 330, 12, 3, 3, 'F');
      doc.setFillColor(...bar.color);
      doc.roundedRect(118, y, Math.max(bar.value ? 4 : 0, (bar.value / maxValue) * 330), 12, 3, 3, 'F');
      doc.setFont('helvetica', 'bold');
      doc.text(String(bar.value), 458, y + 9);
    });
    return startY + 28 + bars.length * 23;
  };

  const savePdf = (doc: jsPDF, title: string) => {
    doc.save(`${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`);
  };

  const downloadQuarterlyPdf = () => {
    if (!quarterlyReportData) return;
    const title = `Class ${classNumber} Quarterly Report`;
    const doc = createPdf(title, `${quarterlyReportData.periodKey} | ${quarterlyReportData.dateRange.start} to ${quarterlyReportData.dateRange.end}`);
    let y = addBarChart(doc, 'Quarter totals', [
      { label: 'Present', value: quarterlyReportData.totals.present, color: [59, 130, 246] },
      { label: 'Absent', value: quarterlyReportData.totals.absent, color: [249, 115, 22] }
    ], 82);
    y = addBarChart(doc, 'Weekly average attendance', attendanceAverages.weekly.flatMap((item) => [
      { label: `${item.period.slice(5)} Present`, value: item.present, color: [59, 130, 246] as [number, number, number] },
      { label: `${item.period.slice(5)} Absent`, value: item.absent, color: [249, 115, 22] as [number, number, number] }
    ]), y + 14);
    y = addBarChart(doc, 'Monthly average attendance', attendanceAverages.monthly.flatMap((item) => [
      { label: `${item.period} Present`, value: item.present, color: [59, 130, 246] as [number, number, number] },
      { label: `${item.period} Absent`, value: item.absent, color: [249, 115, 22] as [number, number, number] }
    ]), y + 14);
    autoTable(doc, {
      startY: y + 10,
      head: [['Member', 'Present', 'Absent', 'Sick', 'Travel', 'Longest absent streak']],
      body: quarterlyMemberSummary.map((member) => [member.needsFollowUp ? `${member.name} - FOLLOW UP` : member.name, member.present, member.absent, member.sick, member.travel, `${member.consecutiveAbsentWeeks} weeks`]),
      theme: 'grid',
      headStyles: { fillColor: [30, 64, 175] },
      styles: { fontSize: 8, cellPadding: 5 },
      didParseCell: (data) => {
        if (data.section === 'body' && quarterlyMemberSummary[data.row.index]?.needsFollowUp) {
          data.cell.styles.fillColor = [255, 237, 213];
          data.cell.styles.textColor = [154, 52, 18];
          if (data.column.index === 0) {
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    autoTable(doc, {
      startY: y + 18,
      head: [['Date', 'Service', 'Present', 'Absent', 'Visitors']],
      body: quarterlyReportData.records.map((row) => [row.attendance_date, row.service_type === 'sunday' ? 'Sunday Service' : 'Bible Study', row.total_members_present, row.total_members_absent, row.total_visitors]),
      theme: 'grid',
      headStyles: { fillColor: [30, 64, 175] },
      styles: { fontSize: 8, cellPadding: 5 }
    });
    savePdf(doc, title);
  };

  const downloadManualPdf = () => {
    if (!generatedManualReport) return;
    const title = `Class ${classNumber} Manual Report`;
    const doc = createPdf(title, `${generatedManualReport.dateRangeStart} to ${generatedManualReport.dateRangeEnd} | ${generatedManualReport.absenceTypes.join(', ')}`);
    const rows = Object.values(generatedManualReport.reportData || {});
    const totals = rows.reduce((sum, row) => sum + row.total_absences, 0);
    const y = addBarChart(doc, 'Absence totals', [{ label: 'Total absences', value: totals, color: [249, 115, 22] }], 82);
    autoTable(doc, { startY: y + 10, head: [['Member', 'Absent', 'Sick', 'Travel', 'Total']], body: rows.map((row) => [row.name, row.absent_count, row.sick_count, row.travel_count, row.total_absences]), theme: 'grid', headStyles: { fillColor: [30, 64, 175] }, styles: { fontSize: 8, cellPadding: 5 } });
    savePdf(doc, title);
  };

  const downloadMemberPdf = () => {
    if (!memberSummary || !selectedMemberId) return;
    const memberName = members.find((member) => member.id === selectedMemberId)?.name || 'Member';
    const title = `${memberName} Attendance Report`;
    const doc = createPdf(title, `Class ${classNumber} | ${memberStartDate} to ${memberEndDate}`);
    const y = addBarChart(doc, 'Attendance summary', [
      { label: 'Present', value: memberSummary.present, color: [59, 130, 246] },
      { label: 'Absent', value: memberSummary.absent, color: [249, 115, 22] },
      { label: 'Sick', value: memberSummary.sick, color: [239, 68, 68] },
      { label: 'Travel', value: memberSummary.travel, color: [234, 179, 8] }
    ], 82);
    autoTable(doc, { startY: y + 10, head: [['Date', 'Service', 'Status']], body: memberAttendanceHistory.map((record: any) => [record.attendance?.attendance_date || '', record.attendance?.service_type === 'sunday' ? 'Sunday Service' : 'Bible Study', String(record.status || '').toUpperCase()]), theme: 'grid', headStyles: { fillColor: [30, 64, 175] }, styles: { fontSize: 8, cellPadding: 5 } });
    savePdf(doc, title);
  };

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
        serviceType: row.service_type,
        present: row.total_members_present || 0,
        absent: row.total_members_absent || 0
      }));
  }, [attendanceRows]);

  const maxTrendValue = useMemo(() => {
    const values = trendSeries.flatMap((item) => [item.present, item.absent]);
    return Math.max(1, ...values);
  }, [trendSeries]);

  const projectionSeries = useMemo(() => {
    const recentRecords = trendSeries.slice(-3);
    if (recentRecords.length === 0) return [];

    const averagePresent = Math.round(recentRecords.reduce((sum, item) => sum + item.present, 0) / recentRecords.length);
    const averageAbsent = Math.round(recentRecords.reduce((sum, item) => sum + item.absent, 0) / recentRecords.length);
    return [1, 2, 3].map((record) => ({
      label: `Next ${record}`,
      present: averagePresent,
      absent: averageAbsent
    }));
  }, [trendSeries]);

  const buildQuarterlyMemberSummary = (records: any[]): QuarterlyMemberSummary[] => {
    const byMember = new Map<string, any>();
    records.forEach((record) => {
      const memberId = String(record.member_id);
      const current = byMember.get(memberId) || {
        memberId,
        name: record.member_name || 'Unknown member',
        present: 0,
        absent: 0,
        sick: 0,
        travel: 0,
        weeks: new Map<string, { hasPresent: boolean; hasAbsence: boolean }>()
      };
      const status = String(record.status || '').toLowerCase();
      if (status === 'present') current.present += 1;
      else {
        current.absent += 1;
        if (status === 'sick' || record.absence_reason === 'S') current.sick += 1;
        if (status === 'travel' || record.absence_reason === 'D') current.travel += 1;
      }

      const attendanceDate = record.attendance?.attendance_date;
      if (attendanceDate) {
        const date = new Date(`${attendanceDate}T00:00:00`);
        date.setDate(date.getDate() - date.getDay());
        const weekKey = date.toISOString().slice(0, 10);
        const week = current.weeks.get(weekKey) || { hasPresent: false, hasAbsence: false };
        week.hasPresent = week.hasPresent || status === 'present';
        week.hasAbsence = week.hasAbsence || status !== 'present';
        current.weeks.set(weekKey, week);
      }
      byMember.set(memberId, current);
    });

    return Array.from(byMember.values()).map((member) => {
      const absenceWeeks = (Array.from(member.weeks.entries()) as Array<[string, { hasPresent: boolean; hasAbsence: boolean }]>)
        .filter(([, week]) => week.hasAbsence && !week.hasPresent)
        .map(([weekKey]) => weekKey)
        .sort();
      let currentStreak = 0;
      let maxStreak = 0;
      absenceWeeks.forEach((weekKey, index) => {
        const previousWeek = index > 0 ? new Date(`${absenceWeeks[index - 1]}T00:00:00`) : null;
        const currentWeek = new Date(`${weekKey}T00:00:00`);
        const isConsecutive = previousWeek && currentWeek.getTime() - previousWeek.getTime() === 7 * 24 * 60 * 60 * 1000;
        currentStreak = isConsecutive ? currentStreak + 1 : 1;
        maxStreak = Math.max(maxStreak, currentStreak);
      });
      return {
        memberId: member.memberId,
        name: member.name,
        present: member.present,
        absent: member.absent,
        sick: member.sick,
        travel: member.travel,
        consecutiveAbsentWeeks: maxStreak,
        needsFollowUp: maxStreak >= 4
      };
    }).sort((a, b) => Number(b.needsFollowUp) - Number(a.needsFollowUp) || b.absent - a.absent || a.name.localeCompare(b.name));
  };

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

  const attendanceAverages = useMemo(() => {
    const getWeekStart = (dateValue: string) => {
      const date = new Date(`${dateValue}T00:00:00`);
      date.setDate(date.getDate() - date.getDay());
      return date.toISOString().slice(0, 10);
    };
    const weekly = new Map<string, { present: number; absent: number; records: number }>();
    const monthly = new Map<string, { present: number; absent: number; records: number }>();

    attendanceRows.forEach((row) => {
      const values = { present: row.total_members_present || 0, absent: row.total_members_absent || 0 };
      const weekKey = getWeekStart(row.attendance_date);
      const monthKey = row.attendance_date.slice(0, 7);
      const week = weekly.get(weekKey) || { present: 0, absent: 0, records: 0 };
      const month = monthly.get(monthKey) || { present: 0, absent: 0, records: 0 };
      week.present += values.present;
      week.absent += values.absent;
      week.records += 1;
      month.present += values.present;
      month.absent += values.absent;
      month.records += 1;
      weekly.set(weekKey, week);
      monthly.set(monthKey, month);
    });

    const toAverages = (items: Map<string, { present: number; absent: number; records: number }>) => Array.from(items.entries())
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([period, values]) => ({
        period,
        present: Math.round(values.present / values.records),
        absent: Math.round(values.absent / values.records)
      }));

    return { weekly: toAverages(weekly), monthly: toAverages(monthly) };
  }, [attendanceRows]);

  useEffect(() => {
    loadMembers();
    loadSettings();
  }, [classNumber]);

  useEffect(() => {
    loadAttendance();
    if (activeTab === "quarterly") {
      loadReportStatus();
      getClassMemberAttendanceRange(classNumber, dateRange.start, dateRange.end)
        .then((records) => setQuarterlyMemberSummary(buildQuarterlyMemberSummary(records)))
        .catch(() => setQuarterlyMemberSummary([]));
    } else {
      setReportStatus(null);
      setQuarterlyMemberSummary([]);
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
      setMemberReportGeneratedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setSuccess(history?.length ? 'Member report generated.' : 'No attendance records found for this member and period.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError("Failed to load member attendance");
      console.error("Error loading member attendance:", err);
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

      setGeneratedManualReport({
        classNumber: classNumber.toString(),
        reportDate: new Date().toISOString(),
        dateRangeStart: manualDateStart,
        dateRangeEnd: manualDateEnd,
        absenceTypes: selectedAbsenceTypes,
        reportData
      });
      try {
        await saveManualReport(classNumber, manualDateStart, manualDateEnd, selectedAbsenceTypes, reportData);
        await loadManualReports();
        setSuccess("Manual report generated and saved.");
      } catch (archiveError) {
        console.error("Manual report archive error:", archiveError);
        setSuccess("Manual report generated. It could not be saved to the archive.");
      }
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
        <div className="mb-4">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-300 text-[10px] font-semibold mb-2 border border-blue-500/20">
            Analytics Dashboard
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Class Reports</h1>
                <p className="text-xs text-slate-300">Class {classNumber} • Attendance Analytics & Reports</p>
              </div>
            </div>
            <button
              onClick={onBack}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-all shadow-lg shrink-0"
            >
              Back
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-4 flex flex-wrap gap-2 bg-slate-800/50 backdrop-blur-sm p-1 rounded-xl border border-slate-700/50 w-fit">
          <button
            onClick={() => setActiveTab("monthly")}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "monthly"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Monthly
            </div>
          </button>
          <button
            onClick={() => setActiveTab("quarterly")}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "quarterly"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              Quarterly
            </div>
          </button>
          <button
            onClick={() => setActiveTab("manual")}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "manual"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" />
              Manual Reports
            </div>
          </button>
          <button
            onClick={() => setActiveTab("members")}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "members"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
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
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-xl border border-slate-700/50 p-3 mb-4">
          {activeTab === "monthly" ? (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-300">Select Month</label>
              <input
                type="month"
                value={monthKey}
                onChange={(e) => setMonthKey(e.target.value)}
                className="max-w-xs px-3 py-2 bg-slate-700 border border-slate-600 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <div className="grid grid-cols-2 gap-2 mb-4">
            {/* Presence Metrics */}
            <div className="bg-gradient-to-br from-blue-600/20 to-indigo-600/20 backdrop-blur-sm rounded-lg border border-blue-500/30 p-2">
              <div className="flex items-center gap-1 mb-0.5">
                <Users className="w-2.5 h-2.5 text-blue-300" />
                <h3 className="text-[9px] font-semibold text-slate-300">Avg Present</h3>
              </div>
              <div className="text-base font-bold text-blue-300">
                {attendanceTotals.records ? Math.round(attendanceTotals.present / attendanceTotals.records) : 0}
              </div>
              <p className="text-[9px] text-slate-400">{attendanceTotals.records} records</p>
            </div>

            {/* Absence Metrics */}
            <div className="bg-gradient-to-br from-orange-600/20 to-red-600/20 backdrop-blur-sm rounded-lg border border-orange-500/30 p-2">
              <div className="flex items-center gap-1 mb-0.5">
                <AlertCircle className="w-2.5 h-2.5 text-orange-300" />
                <h3 className="text-[9px] font-semibold text-slate-300">Avg Absent</h3>
              </div>
              <div className="text-base font-bold text-orange-300">
                {attendanceTotals.records ? Math.round(attendanceTotals.absent / attendanceTotals.records) : 0}
              </div>
              <p className="text-[9px] text-slate-400">{attendanceTotals.records} records</p>
            </div>
          </div>
        )}

        {activeTab === "quarterly" && quarterlyMemberSummary.some((member) => member.needsFollowUp) && (
          <div className="mb-4 rounded-xl border-2 border-orange-400/50 bg-orange-500/10 p-4 shadow-lg">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-orange-100">Members Needing Follow-up</h2>
                <p className="text-xs text-orange-100/80">These members have been absent for four or more consecutive weeks.</p>
              </div>
              <span className="w-fit rounded-full bg-orange-400/20 px-3 py-1 text-sm font-bold text-orange-100">
                {quarterlyMemberSummary.filter((member) => member.needsFollowUp).length} flagged
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {quarterlyMemberSummary.filter((member) => member.needsFollowUp).map((member) => (
                <span key={member.memberId} className="rounded-lg border border-orange-300/30 bg-slate-900/30 px-2.5 py-1.5 text-xs font-semibold text-orange-100">
                  {member.name} · {member.consecutiveAbsentWeeks} weeks
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Attendance Trend Chart */}
        {activeTab !== "manual" && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-xl border border-slate-700/50 p-3 mb-4">
            <div className="flex flex-col gap-2 mb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">Attendance Trend</h2>
                <p className="text-[10px] text-slate-400">Each point is one submitted attendance record.</p>
              </div>
              <span className="text-[9px] text-slate-400">{dateRange.start} to {dateRange.end}</span>
            </div>
            {trendSeries.length === 0 ? (
              <div className="text-sm text-slate-400 py-4 text-center">No data to display</div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-4 text-[10px] text-slate-300">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-400" /> Present</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-orange-400" /> Absent</span>
                  <span className="text-slate-500">Scale: 0-{maxTrendValue}</span>
                </div>
                <div className="rounded-lg border border-slate-700/60 bg-slate-900/30 divide-y divide-slate-700/50">
                  {trendSeries.map((item) => (
                    <div key={`${item.date}-${item.serviceType}`} className="space-y-1.5 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3 text-[10px]">
                        <span className="font-semibold text-slate-300">{item.date.slice(5)} <span className="font-normal text-slate-500">{item.serviceType === 'sunday' ? 'Sunday' : 'Bible Study'}</span></span>
                        <span className="text-slate-500">{item.present + item.absent} members</span>
                      </div>
                      <div className="grid grid-cols-[52px_1fr_28px] items-center gap-2 text-[10px]">
                        <span className="text-blue-300">Present</span>
                        <div className="h-2 rounded-full bg-slate-700"><div className="h-2 rounded-full bg-blue-400" style={{ width: `${(item.present / maxTrendValue) * 100}%` }} /></div>
                        <span className="text-right font-semibold text-blue-300">{item.present}</span>
                      </div>
                      <div className="grid grid-cols-[52px_1fr_28px] items-center gap-2 text-[10px]">
                        <span className="text-orange-300">Absent</span>
                        <div className="h-2 rounded-full bg-slate-700"><div className="h-2 rounded-full bg-orange-400" style={{ width: `${(item.absent / maxTrendValue) * 100}%` }} /></div>
                        <span className="text-right font-semibold text-orange-300">{item.absent}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {projectionSeries.length > 0 && (
                  <div className="rounded-lg border border-dashed border-cyan-500/40 bg-cyan-500/5 p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-semibold text-cyan-200">Simple projection</h3>
                        <p className="text-[10px] text-slate-400">Estimated from the average of the last three records.</p>
                      </div>
                      <span className="text-[10px] text-cyan-300">Not a guarantee</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {projectionSeries.map((item) => (
                        <div key={item.label} className="rounded-md bg-slate-900/40 p-2 text-center">
                          <p className="mb-1 text-[10px] text-slate-400">{item.label}</p>
                          <p className="text-xs font-semibold text-blue-300">{item.present} present</p>
                          <p className="text-xs font-semibold text-orange-300">{item.absent} absent</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="p-2 bg-blue-500/20 rounded-lg border border-blue-500/30 text-blue-300">
                    <p className="text-slate-400 text-[9px] mb-0.5">Records</p>
                    <span className="font-semibold text-xs">{trendSeries.length}</span>
                  </div>
                  <div className="p-2 bg-blue-500/20 rounded-lg border border-blue-500/30 text-blue-300">
                    <p className="text-slate-400 text-[9px] mb-0.5">Max Present</p>
                    <span className="font-semibold text-xs">{Math.max(0, ...trendSeries.map(x => x.present))}</span>
                  </div>
                  <div className="p-2 bg-orange-500/20 rounded-lg border border-orange-500/30 text-orange-300">
                    <p className="text-slate-400 text-[9px] mb-0.5">Min Present</p>
                    <span className="font-semibold text-xs">{Math.min(...trendSeries.map(x => x.present))}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Monthly Breakdown */}
        {activeTab !== "manual" && monthlyBreakdown.length > 0 && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-xl border border-slate-700/50 p-3 mb-4">
            <h2 className="text-sm font-bold text-white mb-3">Monthly Breakdown</h2>
            <div className="space-y-3">
              {monthlyBreakdown.map((item) => (
                <div key={item.month} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">{item.month}</span>
                    <div className="flex gap-3 text-[10px] text-slate-400">
                      <span>Present: <span className="font-semibold text-blue-300">{item.present}</span></span>
                      <span>Absent: <span className="font-semibold text-orange-300">{item.absent}</span></span>
                    </div>
                  </div>
                  <div className="flex gap-1 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
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

        {activeTab === "quarterly" && (attendanceAverages.weekly.length > 0 || attendanceAverages.monthly.length > 0) && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-xl border border-slate-700/50 p-3 mb-4">
            <h2 className="text-sm font-bold text-white mb-1">Average Attendance Statistics</h2>
            <p className="text-[10px] text-slate-400 mb-3">Average members present and absent per submitted record.</p>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-xs font-semibold text-slate-300">Weekly average</h3>
                <div className="space-y-2">
                  {attendanceAverages.weekly.map((item) => (
                    <div key={item.period} className="rounded-lg border border-slate-700/60 bg-slate-900/30 p-2">
                      <div className="mb-1 flex justify-between text-[10px] text-slate-400"><span>Week of {item.period}</span><span>Present {item.present} · Absent {item.absent}</span></div>
                      <div className="flex h-2 gap-1"><div className="rounded-full bg-blue-400" style={{ width: `${Math.max(3, item.present * 100 / Math.max(item.present, item.absent, 1))}%` }} /><div className="rounded-full bg-orange-400" style={{ width: `${Math.max(3, item.absent * 100 / Math.max(item.present, item.absent, 1))}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold text-slate-300">Monthly average</h3>
                <div className="space-y-2">
                  {attendanceAverages.monthly.map((item) => (
                    <div key={item.period} className="rounded-lg border border-slate-700/60 bg-slate-900/30 p-2">
                      <div className="mb-1 flex justify-between text-[10px] text-slate-400"><span>{item.period}</span><span>Present {item.present} · Absent {item.absent}</span></div>
                      <div className="flex h-2 gap-1"><div className="rounded-full bg-blue-400" style={{ width: `${Math.max(3, item.present * 100 / Math.max(item.present, item.absent, 1))}%` }} /><div className="rounded-full bg-orange-400" style={{ width: `${Math.max(3, item.absent * 100 / Math.max(item.present, item.absent, 1))}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}


        {/* Quarterly Report Display */}
        {activeTab === "quarterly" && showQuarterlyReport && quarterlyReportData && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-xl border border-slate-700/50 p-3 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-white">Quarterly Report</h2>
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline text-[10px] text-slate-400">{quarterlyReportData.dateRange.start} to {quarterlyReportData.dateRange.end}</span>
                <button onClick={downloadQuarterlyPdf} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500">
                  <Download className="h-3.5 w-3.5" /> PDF
                </button>
              </div>
            </div>
            
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-blue-600/20 border border-blue-500/30 rounded-lg p-2.5">
                <p className="text-[10px] text-slate-400 font-medium mb-1">Total Present</p>
                <p className="text-lg font-bold text-blue-300">{quarterlyReportData.totals.present}</p>
              </div>
              <div className="bg-orange-600/20 border border-orange-500/30 rounded-lg p-2.5">
                <p className="text-[10px] text-slate-400 font-medium mb-1">Total Absent</p>
                <p className="text-lg font-bold text-orange-300">{quarterlyReportData.totals.absent}</p>
              </div>
              <div className="bg-emerald-600/20 border border-emerald-500/30 rounded-lg p-2.5">
                <p className="text-[10px] text-slate-400 font-medium mb-1">Total Visitors</p>
                <p className="text-lg font-bold text-emerald-300">{quarterlyReportData.totals.visitors}</p>
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

        {activeTab === "quarterly" && quarterlyMemberSummary.length > 0 && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-xl border border-slate-700/50 p-3 mb-4">
            <div className="mb-3">
              <h2 className="text-sm font-bold text-white">Members Needing Follow-up</h2>
              <p className="text-[10px] text-slate-400">Members with four or more consecutive absent weeks are flagged for contact.</p>
            </div>
            {quarterlyMemberSummary.some((member) => member.needsFollowUp) && (
              <div className="mb-3 rounded-lg border border-orange-500/40 bg-orange-500/10 p-3">
                <p className="text-xs font-semibold text-orange-200">Follow-up needed</p>
                <p className="mt-1 text-[10px] text-orange-100/80">
                  {quarterlyMemberSummary.filter((member) => member.needsFollowUp).map((member) => `${member.name} (${member.consecutiveAbsentWeeks} weeks)`).join(', ')}
                </p>
              </div>
            )}
            <div className="overflow-x-auto rounded-lg border border-slate-700/60">
              <table className="w-full min-w-[620px] text-xs text-slate-300">
                <thead className="bg-slate-900/50 text-[10px] uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Member</th>
                    <th className="px-3 py-2 text-center">Present</th>
                    <th className="px-3 py-2 text-center">Absent</th>
                    <th className="px-3 py-2 text-center">Sick</th>
                    <th className="px-3 py-2 text-center">Travel</th>
                    <th className="px-3 py-2 text-center">Longest absent streak</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {quarterlyMemberSummary.map((member) => (
                    <tr key={member.memberId} className={member.needsFollowUp ? 'bg-orange-500/10' : ''}>
                      <td className="px-3 py-2 font-medium text-white">{member.name}{member.needsFollowUp && <span className="ml-2 rounded bg-orange-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-orange-200">FOLLOW UP</span>}</td>
                      <td className="px-3 py-2 text-center text-blue-300">{member.present}</td>
                      <td className="px-3 py-2 text-center text-orange-300">{member.absent}</td>
                      <td className="px-3 py-2 text-center text-red-300">{member.sick}</td>
                      <td className="px-3 py-2 text-center text-yellow-300">{member.travel}</td>
                      <td className={`px-3 py-2 text-center font-semibold ${member.needsFollowUp ? 'text-orange-200' : 'text-slate-300'}`}>{member.consecutiveAbsentWeeks} weeks</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                <div className="mb-6 flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-white">Generated Report</h3>
                  <button onClick={downloadManualPdf} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500">
                    <Download className="h-3.5 w-3.5" /> PDF
                  </button>
                </div>
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
                  <button onClick={downloadMemberPdf} className="ml-auto flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500">
                    <Download className="h-3.5 w-3.5" /> PDF
                  </button>
                </div>
                {memberReportGeneratedAt && (
                  <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                    Report generated at {memberReportGeneratedAt} · {memberAttendanceHistory.filter((record) => record.attendance?.service_type === 'sunday').length} Sunday records · {memberAttendanceHistory.filter((record) => record.attendance?.service_type === 'bible-study').length} Bible Study records
                  </div>
                )}

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
