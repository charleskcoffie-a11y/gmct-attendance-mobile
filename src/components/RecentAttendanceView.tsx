import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import { Download, FileText } from "lucide-react";

interface RecentAttendanceViewProps {
  classNumber: number;
}

interface Week {
  weekNumber: number;
  label: string;
  startDate: string;
  endDate: string;
  dates: string[];
}

interface ClassAttendanceSummary {
  classNumber: number;
  presentCount: number;
  absentCount: number;
  sessionsCount: number;
}

interface AttendanceRow {
  id?: string;
  attendance_date: string;
  service_type: "bible-study" | "sunday";
  class_number: string | number;
  total_members_present?: number | null;
  total_members_absent?: number | null;
  total_members_sick?: number | null;
  total_members_travel?: number | null;
}

interface MemberAttendanceAgg {
  present: number;
  absent: number;
}

interface MonthlyGraphSeries {
  classNumber: string;
  points: number[];
  total: number;
  color: string;
}

interface MonthlyComparisonGraph {
  labels: string[];
  series: MonthlyGraphSeries[];
  maxValue: number;
}

type GraphMode = "monthly" | "ytd";
type GraphMetric = "sessions" | "present";


export const RecentAttendanceView: React.FC<RecentAttendanceViewProps> = ({ classNumber }) => {
  const normalizeAttendanceDate = (value: string): string => (value || "").slice(0, 10);

  const getNormalizedAbsent = (record: AttendanceRow) =>
    (Number(record.total_members_absent) || 0) +
    (Number(record.total_members_sick) || 0) +
    (Number(record.total_members_travel) || 0);

  const getSummaryCounts = (record: AttendanceRow): MemberAttendanceAgg => ({
    present: Number(record.total_members_present) || 0,
    absent: getNormalizedAbsent(record),
  });

  const [recentAttendanceFilter, setRecentAttendanceFilter] = useState<"bible-study" | "sunday" | "total">("total");
  const [recentAttendanceDates, setRecentAttendanceDates] = useState<string[]>([]);
  const [recentAttendanceCount, setRecentAttendanceCount] = useState<number>(0);
  const [recentAbsentCount, setRecentAbsentCount] = useState<number>(0);
  const [recentSessionCount, setRecentSessionCount] = useState<number>(0);
  const [recentSelectedClass, setRecentSelectedClass] = useState<string | null>(null);
  const [recentAvailableClasses, setRecentAvailableClasses] = useState<string[]>([]);
  const [recentSelectedYear, setRecentSelectedYear] = useState<string>("");
  const [recentAvailableYears, setRecentAvailableYears] = useState<string[]>([]);
  const [recentSelectedMonth, setRecentSelectedMonth] = useState<string>("");
  const [recentAvailableMonths, setRecentAvailableMonths] = useState<string[]>([]);
  const [recentSelectedWeek, setRecentSelectedWeek] = useState<string | null>(null);
  const [recentAvailableWeeks, setRecentAvailableWeeks] = useState<Week[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [classAttendanceSummary, setClassAttendanceSummary] = useState<ClassAttendanceSummary[]>([]);
  const [monthlyComparisonGraph, setMonthlyComparisonGraph] = useState<MonthlyComparisonGraph>({
    labels: [],
    series: [],
    maxValue: 0,
  });
  const [graphMode, setGraphMode] = useState<GraphMode>("monthly");
  const [graphMetric, setGraphMetric] = useState<GraphMetric>("present");
  const loadDatesRequestIdRef = useRef(0);
  const loadWeekRequestIdRef = useRef(0);
  const isAdminView = classNumber === 0;

  const getGraphColor = (index: number, total: number) => {
    const hue = Math.round((index * 360) / Math.max(total, 1));
    return `hsl(${hue} 78% 56%)`;
  };
  const toLocalYmd = (dt: Date) => {
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const buildWeeksForMonth = (yearMonth: string, rawDates: string[]): Week[] => {
    if (!yearMonth) return [];

    const [year, month] = yearMonth.split("-").map(Number);
    if (!year || !month) return [];

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    const normalizedDates = [...new Set(rawDates.map(normalizeAttendanceDate))].filter((d) => d.startsWith(yearMonth));

    const startDay = monthStart.getDay();
    const mondayDiff = startDay === 0 ? -6 : 1 - startDay;
    const cursor = new Date(monthStart);
    cursor.setDate(monthStart.getDate() + mondayDiff);

    const weeks: Week[] = [];
    let monthWeekIndex = 1;
    while (cursor <= monthEnd) {
      const weekStart = toLocalYmd(cursor);
      const weekEndDate = new Date(cursor);
      weekEndDate.setDate(weekEndDate.getDate() + 6);
      const weekEnd = toLocalYmd(weekEndDate);
      const weekNumber = monthWeekIndex;
      const datesInWeek = normalizedDates.filter((d) => d >= weekStart && d <= weekEnd);

      weeks.push({
        weekNumber,
        label: `Week ${weekNumber}: ${new Date(weekStart + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${new Date(weekEnd + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
        startDate: weekStart,
        endDate: weekEnd,
        dates: datesInWeek,
      });

      cursor.setDate(cursor.getDate() + 7);
      monthWeekIndex += 1;
    }

    return weeks;
  };

  // Helper function to format month
  const formatMonth = (yearMonth: string): string => {
    const [year, month] = yearMonth.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  // Initial load on mount - this ensures data is loaded before any filter changes
  useEffect(() => {
    console.log("Component mounted - initial load");
    const initializeData = async () => {
      await loadRecentAttendanceDates();
      setIsInitialized(true);
    };
    initializeData();
  }, []);

  // Reload whenever filters change (but NOT on initial mount)
  useEffect(() => {
    if (isInitialized) {
      console.log("Recent filters changed - reloading");
      loadRecentAttendanceDates();
    }
  }, [recentAttendanceFilter, recentSelectedClass, recentSelectedYear, recentSelectedMonth, isInitialized]);

  useEffect(() => {
    if (recentSelectedMonth) {
      generateWeeksForMonth();
    }
  }, [recentSelectedMonth, recentAttendanceDates]);

  useEffect(() => {
    if (recentSelectedWeek) loadRecentAttendanceForWeek();
  }, [recentSelectedWeek, recentAttendanceFilter, classNumber, recentSelectedClass, recentAvailableWeeks, graphMode, recentSelectedMonth, recentSelectedYear]);

  useEffect(() => {
    if (graphMode === "ytd") {
      void loadYtdComparisonGraph();
    } else {
      void loadMonthlyComparisonGraph();
    }
  }, [graphMode, graphMetric, recentSelectedYear, recentSelectedMonth, recentSelectedWeek, recentAttendanceFilter, recentSelectedClass]);

  const getGraphValue = (row: AttendanceRow) =>
    graphMetric === "sessions" ? 1 : (Number(row.total_members_present) || 0);

  const loadMonthlyComparisonGraph = async () => {
    if (!recentSelectedMonth) {
      setMonthlyComparisonGraph({ labels: [], series: [], maxValue: 0 });
      return;
    }

    try {
      const [year, month] = recentSelectedMonth.split("-").map(Number);
      const monthStart = `${recentSelectedMonth}-01`;
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const monthEnd = `${recentSelectedMonth}-${String(lastDay).padStart(2, "0")}`;
      const selectedWeekObj = recentSelectedWeek
        ? recentAvailableWeeks.find((w) => w.startDate === recentSelectedWeek)
        : null;

      const rangeStart = selectedWeekObj
        ? (selectedWeekObj.startDate < monthStart ? monthStart : selectedWeekObj.startDate)
        : monthStart;
      const rangeEnd = selectedWeekObj
        ? (selectedWeekObj.endDate > monthEnd ? monthEnd : selectedWeekObj.endDate)
        : monthEnd;

      let query = supabase
        .from("attendance")
        .select("attendance_date, class_number, total_members_present, service_type")
        .gte("attendance_date", rangeStart)
        .lte("attendance_date", rangeEnd)
        .order("attendance_date", { ascending: true });

      if (recentAttendanceFilter !== "total") {
        query = query.eq("service_type", recentAttendanceFilter);
      }

      if (recentSelectedClass) {
        query = query.eq("class_number", recentSelectedClass);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error loading monthly comparison graph:", error);
        setMonthlyComparisonGraph({ labels: [], series: [], maxValue: 0 });
        return;
      }

      const rows = (data || []) as AttendanceRow[];
      const labels = [...new Set(rows.map((r) => r.attendance_date))].sort();

      if (labels.length === 0) {
        setMonthlyComparisonGraph({ labels: [], series: [], maxValue: 0 });
        return;
      }

      const byClass = new Map<string, Map<string, number>>();
      rows.forEach((row) => {
        const classKey = String(row.class_number);
        const dateKey = row.attendance_date;
        const present = getGraphValue(row);

        const classMap = byClass.get(classKey) || new Map<string, number>();
        classMap.set(dateKey, (classMap.get(dateKey) || 0) + present);
        byClass.set(classKey, classMap);
      });

      const classKeys = recentSelectedClass
        ? [recentSelectedClass]
        : (recentAvailableClasses.length > 0
            ? [...recentAvailableClasses]
            : Array.from(byClass.keys()));

      const sortedClasses = classKeys.sort((a, b) => Number(a) - Number(b));
      const series: MonthlyGraphSeries[] = sortedClasses.map((classNumber, idx) => {
        const classData = byClass.get(classNumber) || new Map<string, number>();
        const points = labels.map((label) => classData.get(label) || 0);
        return {
          classNumber,
          points,
          total: points.reduce((sum, value) => sum + value, 0),
          color: getGraphColor(idx, sortedClasses.length),
        };
      });

      const topSeries = [...series].sort((a, b) => Number(a.classNumber) - Number(b.classNumber));

      const maxValue = Math.max(1, ...topSeries.flatMap((s) => s.points));

      setMonthlyComparisonGraph({ labels, series: topSeries, maxValue });
    } catch (err) {
      console.error("Error in loadMonthlyComparisonGraph:", err);
      setMonthlyComparisonGraph({ labels: [], series: [], maxValue: 0 });
    }
  };

  const loadYtdComparisonGraph = async () => {
    if (!recentSelectedMonth) {
      setMonthlyComparisonGraph({ labels: [], series: [], maxValue: 0 });
      return;
    }

    const [monthYear, monthValue] = recentSelectedMonth.split("-");
    const selectedYear = recentSelectedYear || monthYear;
    const endMonth = Number(monthValue);

    if (!selectedYear || !Number.isFinite(endMonth) || endMonth < 1) {
      setMonthlyComparisonGraph({ labels: [], series: [], maxValue: 0 });
      return;
    }

    try {
      const startDate = `${selectedYear}-01-01`;
      const monthEnd = new Date(Date.UTC(Number(selectedYear), endMonth, 0)).getUTCDate();
      const endDate = `${selectedYear}-${String(endMonth).padStart(2, "0")}-${String(monthEnd).padStart(2, "0")}`;

      let query = supabase
        .from("attendance")
        .select("attendance_date, class_number, total_members_present, service_type")
        .gte("attendance_date", startDate)
        .lte("attendance_date", endDate)
        .order("attendance_date", { ascending: true });

      if (recentAttendanceFilter !== "total") {
        query = query.eq("service_type", recentAttendanceFilter);
      }

      if (recentSelectedClass) {
        query = query.eq("class_number", recentSelectedClass);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error loading YTD comparison graph:", error);
        setMonthlyComparisonGraph({ labels: [], series: [], maxValue: 0 });
        return;
      }

      const rows = (data || []) as AttendanceRow[];
      const labels = Array.from({ length: endMonth }, (_, i) =>
        new Date(Number(selectedYear), i, 1).toLocaleDateString("en-US", { month: "short" })
      );

      if (labels.length === 0) {
        setMonthlyComparisonGraph({ labels: [], series: [], maxValue: 0 });
        return;
      }

      const byClass = new Map<string, number[]>();
      rows.forEach((row) => {
        const classKey = String(row.class_number);
        const monthIdx = Math.max(0, Math.min(endMonth - 1, Number(row.attendance_date.split("-")[1]) - 1));
        const present = getGraphValue(row);
        const points = byClass.get(classKey) || Array.from({ length: endMonth }, () => 0);
        points[monthIdx] += present;
        byClass.set(classKey, points);
      });

      const classKeys = recentSelectedClass
        ? [recentSelectedClass]
        : (recentAvailableClasses.length > 0
            ? [...recentAvailableClasses]
            : Array.from(byClass.keys()));

      const sortedClasses = classKeys.sort((a, b) => Number(a) - Number(b));
      const series: MonthlyGraphSeries[] = sortedClasses.map((classNumber, idx) => {
        const points = byClass.get(classNumber) || Array.from({ length: endMonth }, () => 0);
        return {
          classNumber,
          points,
          total: points.reduce((sum, value) => sum + value, 0),
          color: getGraphColor(idx, sortedClasses.length),
        };
      });

      const topSeries = [...series].sort((a, b) => Number(a.classNumber) - Number(b.classNumber));

      const maxValue = Math.max(1, ...topSeries.flatMap((s) => s.points));

      setMonthlyComparisonGraph({ labels, series: topSeries, maxValue });
    } catch (err) {
      console.error("Error in loadYtdComparisonGraph:", err);
      setMonthlyComparisonGraph({ labels: [], series: [], maxValue: 0 });
    }
  };

  const handleGenerateMonthlyReport = () => {
    if (!recentSelectedMonth || monthlyComparisonGraph.series.length === 0) {
      return;
    }

    const escapeCsvValue = (value: string | number) => {
      const text = String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    const headers = [
      "Month",
      "Class",
      "Service Type",
      "Week",
      "Metric",
      ...monthlyComparisonGraph.labels,
      "Total",
      "Average"
    ];
    const rows = monthlyComparisonGraph.series.map((series) => {
      const activePoints = series.points.filter((value) => value > 0);
      const average = activePoints.length > 0 ? series.total / activePoints.length : 0;
      return [
        formatMonth(recentSelectedMonth),
        `Class ${series.classNumber}`,
        recentAttendanceFilter === "total" ? "Total" : recentAttendanceFilter,
        activeWeek?.label || "All weeks",
        graphMetric === "sessions" ? "Records Submitted" : "Present",
        ...series.points,
        series.total,
        average.toFixed(graphMetric === "sessions" ? 0 : 1)
      ];
    });
    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-report-${recentSelectedMonth}-${graphMode}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handlePrintMonthlyReport = () => {
    if (!recentSelectedMonth || monthlyComparisonGraph.series.length === 0) {
      return;
    }

    const escapeHtml = (value: string | number) =>
      String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    const reportWindow = window.open("", "_blank");

    if (!reportWindow) {
      return;
    }

    const filterSummary = [
      `Month: ${formatMonth(recentSelectedMonth)}`,
      `Service: ${recentAttendanceFilter === "total" ? "Total" : recentAttendanceFilter}`,
      `Class: ${recentSelectedClass ? `Class ${recentSelectedClass}` : "All classes"}`,
      `Week: ${activeWeek?.label || "All weeks"}`,
      `Metric: ${graphMetric === "sessions" ? "Records submitted" : "Members present"}`
    ];
    const maxBarValue = Math.max(...monthlyComparisonGraph.series.map((series) => series.total), 1);
    const graphRows = monthlyComparisonGraph.series
      .map((series) => {
        const width = Math.max(series.total > 0 ? 3 : 0, (series.total / maxBarValue) * 100);
        return `<div class="graph-row"><strong>Class ${escapeHtml(series.classNumber)}</strong><div class="bar-track"><div class="bar" style="width:${width}%;background:${escapeHtml(series.color)}">${series.total > 0 ? escapeHtml(series.total) : ""}</div></div><span>${escapeHtml(series.total)}</span></div>`;
      })
      .join("");
    const attendanceRows = isAdminView
      ? classAttendanceSummary
          .map((item) => `<tr><td>Class ${escapeHtml(item.classNumber)}</td><td>${item.sessionsCount}</td><td>${item.presentCount}</td><td>${item.absentCount}</td><td>${(item.presentCount / Math.max(item.sessionsCount, 1)).toFixed(1)}</td></tr>`)
          .join("")
      : `<tr><td>${recentSelectedClass ? `Class ${escapeHtml(recentSelectedClass)}` : "Selected class"}</td><td>${recentSessionCount}</td><td>${recentAttendanceCount}</td><td>${recentAbsentCount}</td><td>${(recentAttendanceCount / Math.max(recentSessionCount, 1)).toFixed(1)}</td></tr>`;

    reportWindow.document.write(`<!doctype html><html><head><title>Attendance Report - ${escapeHtml(formatMonth(recentSelectedMonth))}</title><style>
      body{font-family:Arial,sans-serif;color:#172033;margin:36px;line-height:1.4}h1{margin:0 0 6px;font-size:24px}h2{margin:26px 0 10px;font-size:16px;border-bottom:2px solid #dbe3ef;padding-bottom:6px}.meta{color:#526174;font-size:12px;margin-bottom:18px}.meta span{display:inline-block;margin:0 18px 6px 0}.graph{border:1px solid #dbe3ef;border-radius:8px;padding:14px}.graph-row{display:grid;grid-template-columns:70px 1fr 42px;align-items:center;gap:10px;margin:9px 0;font-size:12px}.bar-track{height:22px;background:#edf1f6;border:1px solid #b8c5d6;border-radius:4px;overflow:hidden}.bar{height:100%;border:1px solid #172033;border-radius:4px;padding-left:7px;box-sizing:border-box;font-weight:bold;line-height:20px;color:#172033}table{width:100%;border-collapse:collapse;font-size:12px}th,td{text-align:left;border-bottom:1px solid #dbe3ef;padding:8px}th{background:#f3f6fa}@media print{body{margin:18mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}.graph{break-inside:avoid}h2{break-after:avoid}}
    </style></head><body><h1>Attendance Report</h1><div class="meta">${filterSummary.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div><h2>Attendance Graph</h2><div class="graph">${graphRows}</div><h2>Attendance Summary</h2><table><thead><tr><th>Class</th><th>Records Submitted</th><th>Present</th><th>Absent</th><th>Average Present</th></tr></thead><tbody>${attendanceRows}</tbody></table></body></html>`);
    reportWindow.document.close();
    setTimeout(() => {
      reportWindow.focus();
      reportWindow.print();
    }, 300);
  };


  const loadRecentAttendanceDates = async () => {
    const requestId = ++loadDatesRequestIdRef.current;
    try {
      let query = supabase
        .from("attendance")
        .select("attendance_date, service_type, class_number")
        .order("attendance_date", { ascending: false });

      const { data, error: dbError } = await query;

      if (dbError) {
        console.error("Database error:", dbError);
        throw dbError;
      }

      if (requestId !== loadDatesRequestIdRef.current) {
        return;
      }

      console.log("Raw attendance data from DB:", data);

      const rows = (data || []) as AttendanceRow[];

      if (rows.length > 0) {
        // Get available classes
        const availableClasses = [...new Set(rows.map(r => String(r.class_number)))].sort();
        console.log("Available classes:", availableClasses);
        setRecentAvailableClasses(availableClasses);

        // Filter by selected class or all classes
        let filteredData = rows;
        if (recentSelectedClass) {
          filteredData = rows.filter(r => String(r.class_number) === recentSelectedClass);
        }
        console.log("After class filter:", filteredData.length, "records");

        const withNormalizedDate = filteredData.map((r) => ({
          ...r,
          normalizedDate: normalizeAttendanceDate(r.attendance_date),
        }));

        // Extract available years and sort descending (newest first)
        const allYears = [...new Set(
          withNormalizedDate
            .map((r) => r.normalizedDate.split("-")[0])
            .filter(Boolean)
        )].sort().reverse();
        console.log("Available years:", allYears);
        setRecentAvailableYears(allYears);

        // Keep year optional. Empty year means "All Years".
        let yearToUse = recentSelectedYear;
        if (recentSelectedYear && !allYears.includes(recentSelectedYear)) {
          yearToUse = "";
          setRecentSelectedYear("");
        }

        // Filter by selected year when provided, else keep all years
        // NOTE: We do NOT filter by service type here - service type filtering happens in loadRecentAttendanceForWeek()
        // This ensures years/months/weeks are always available regardless of current filter
        let filteredByYear = withNormalizedDate;
        if (yearToUse) {
          filteredByYear = withNormalizedDate.filter((r) =>
            r.normalizedDate.startsWith(`${yearToUse}-`)
          );
        }
        console.log("After year filter:", filteredByYear.length, "records");

        // Extract available months in the selected year
        const allMonths = [...new Set(
          filteredByYear
            .map((r) => r.normalizedDate.substring(0, 7))
            .filter((value) => value.length === 7)
        )].sort().reverse();
        console.log("Available months:", allMonths);
        setRecentAvailableMonths(allMonths);

        // Set initial month if not already set - but continue processing
        let monthToUse = recentSelectedMonth;
        if ((!recentSelectedMonth || !allMonths.includes(recentSelectedMonth)) && allMonths.length > 0) {
          monthToUse = allMonths[0];
          setRecentSelectedMonth(allMonths[0]);
        }

        // Extract unique dates for the selected month (or the month we just set)
        let filteredByMonth = filteredByYear;
        if (monthToUse) {
          filteredByMonth = filteredByYear.filter((r) =>
            r.normalizedDate.startsWith(`${monthToUse}-`)
          );
        }

        const filteredDates = [...new Set(filteredByMonth.map((r) => r.normalizedDate))].sort();
        console.log("Final filtered dates for selected month:", filteredDates);
        setRecentAttendanceDates(filteredDates);

        // Generate weeks synchronously to avoid timing issues with effects
        if (monthToUse) {
          console.log("Generating weeks for month:", monthToUse);
          const weeks = buildWeeksForMonth(monthToUse, filteredDates);
          console.log("Generated weeks synchronously:", weeks.length);
          setRecentAvailableWeeks(weeks);

          const isCurrentWeekValid = !!recentSelectedWeek && weeks.some((w) => w.startDate === recentSelectedWeek);
          if (!isCurrentWeekValid) {
            const weekWithData = weeks.find((w) => w.dates.length > 0);
            setRecentSelectedWeek((weekWithData || weeks[0])?.startDate ?? null);
          }
        } else {
          setRecentAvailableWeeks([]);
          setRecentSelectedWeek(null);
        }
      } else {
        console.log("No attendance data found in database");
        setRecentAttendanceDates([]);
        setRecentAvailableClasses([]);
        setRecentAvailableYears([]);
        setRecentAvailableMonths([]);
        setRecentAvailableWeeks([]);
        setRecentSelectedWeek(null);
      }
    } catch (err) {
      console.error("Error loading attendance dates:", err);
    }
  };

  const generateWeeksForMonth = () => {
    console.log("generateWeeksForMonth called with month:", recentSelectedMonth, "dates available:", recentAttendanceDates.length);
    if (!recentSelectedMonth) {
      console.log("Skipping week generation - month not selected");
      return;
    }

    const weeks = buildWeeksForMonth(recentSelectedMonth, recentAttendanceDates);
    console.log("Generated weeks:", weeks.length, weeks.map(w => w.label));
    setRecentAvailableWeeks(weeks);
    
    if (weeks.length > 0 && !recentSelectedWeek) {
      const weekWithData = weeks.find((w) => w.dates.length > 0);
      setRecentSelectedWeek((weekWithData || weeks[0]).startDate);
    }
  };

  const loadRecentAttendanceForWeek = async () => {
    const requestId = ++loadWeekRequestIdRef.current;
    try {
      if (!recentSelectedWeek) {
        console.log("No week selected");
        if (isAdminView) {
          setClassAttendanceSummary([]);
        } else {
          setRecentAttendanceCount(0);
          setRecentAbsentCount(0);
          setRecentSessionCount(0);
        }
        return;
      }

      const selectedWeekObj = recentAvailableWeeks.find(w => w.startDate === recentSelectedWeek);
      console.log("Loading attendance for week:", recentSelectedWeek, selectedWeekObj);
      if (!selectedWeekObj) {
        console.log("Week not found in available weeks");
        if (isAdminView) {
          setClassAttendanceSummary([]);
        } else {
          setRecentAttendanceCount(0);
          setRecentAbsentCount(0);
          setRecentSessionCount(0);
        }
        return;
      }

      let query = supabase
        .from("attendance")
        .select("*");

      const monthStart = recentSelectedMonth ? `${recentSelectedMonth}-01` : selectedWeekObj.startDate;
      const monthEnd = recentSelectedMonth
        ? `${recentSelectedMonth}-${String(new Date(Date.UTC(Number(recentSelectedMonth.split("-")[0]), Number(recentSelectedMonth.split("-")[1]), 0)).getUTCDate()).padStart(2, "0")}`
        : selectedWeekObj.endDate;
      const ytdYear = recentSelectedYear || recentSelectedMonth?.split("-")[0];
      const rangeStart = graphMode === "ytd" && ytdYear ? `${ytdYear}-01-01` : (selectedWeekObj.startDate < monthStart ? monthStart : selectedWeekObj.startDate);
      const rangeEnd = graphMode === "ytd" && ytdYear ? monthEnd : (selectedWeekObj.endDate > monthEnd ? monthEnd : selectedWeekObj.endDate);

      console.log("Querying week range:", rangeStart, rangeEnd);
      query = query
        .gte("attendance_date", rangeStart)
        .lte("attendance_date", rangeEnd);

      // For non-admin view, filter by specific class if selected
      if (!isAdminView && recentSelectedClass) {
        query = query.eq("class_number", parseInt(recentSelectedClass));
      }

      if (recentAttendanceFilter !== "total") {
        query = query.eq("service_type", recentAttendanceFilter);
      }

      const { data, error: dbError } = await query;

      if (dbError) {
        console.error("Database error fetching week data:", dbError);
        throw dbError;
      }

      if (requestId !== loadWeekRequestIdRef.current) {
        return;
      }

      const rows = (data || []) as AttendanceRow[];

      console.log("Week data query result:", rows);

      const attendanceIds = rows.map((r) => r.id).filter(Boolean) as string[];
      let memberAggByAttendanceId = new Map<string, MemberAttendanceAgg>();

      if (attendanceIds.length > 0) {
        const { data: memberRows, error: memberError } = await supabase
          .from("member_attendance")
          .select("attendance_id, status")
          .in("attendance_id", attendanceIds);

        if (memberError) {
          console.error("Error loading member_attendance fallback data:", memberError);
        } else {
          (memberRows || []).forEach((mr: any) => {
            const attendanceId = String(mr.attendance_id || "");
            const status = (mr.status || "").toString().trim().toLowerCase();
            if (!attendanceId) return;

            const current = memberAggByAttendanceId.get(attendanceId) || { present: 0, absent: 0 };
            if (status === "present") {
              current.present += 1;
            } else if (status === "absent" || status === "sick" || status === "travel") {
              current.absent += 1;
            }
            memberAggByAttendanceId.set(attendanceId, current);
          });
        }
      }

      const getRecordCounts = (record: AttendanceRow): MemberAttendanceAgg => {
        const fallback = record.id ? memberAggByAttendanceId.get(record.id) : undefined;
        if (fallback && (fallback.present > 0 || fallback.absent > 0)) {
          return fallback;
        }
        return getSummaryCounts(record);
      };

      if (isAdminView) {
        // Admin view: show summary for all classes
        if (rows.length > 0) {
          const summaryMap = new Map<number, { presentCount: number; absentCount: number; sessionsCount: number }>();
          rows.forEach(record => {
            const classNum = record.class_number;
            const classNumber = typeof classNum === "string" ? parseInt(classNum, 10) : classNum;
            const currentSummary = summaryMap.get(classNumber) || { presentCount: 0, absentCount: 0, sessionsCount: 0 };
            const counts = getRecordCounts(record);
            summaryMap.set(classNumber, {
              presentCount: currentSummary.presentCount + counts.present,
              absentCount: currentSummary.absentCount + counts.absent,
              sessionsCount: currentSummary.sessionsCount + 1,
            });
          });
          const summary = Array.from(summaryMap.entries())
            .map(([classNumber, value]) => ({ classNumber, presentCount: value.presentCount, absentCount: value.absentCount, sessionsCount: value.sessionsCount }))
            .sort((a, b) => a.classNumber - b.classNumber);
          console.log("Class attendance summary:", summary);
          setClassAttendanceSummary(summary);
        } else {
          setClassAttendanceSummary([]);
        }
      } else {
        // Regular view: show single count for selected class
        if (rows.length > 0) {
          const totalPresent = rows.reduce((sum, record) => sum + getRecordCounts(record).present, 0);
          const totalAbsent = rows.reduce((sum, record) => sum + getRecordCounts(record).absent, 0);
          console.log("Total members present:", totalPresent);
          setRecentAttendanceCount(totalPresent);
          setRecentAbsentCount(totalAbsent);
          setRecentSessionCount(rows.length);
        } else {
          console.log("No records found for selected week");
          setRecentAttendanceCount(0);
          setRecentAbsentCount(0);
          setRecentSessionCount(0);
        }
      }
    } catch (err) {
      console.error("Error loading attendance count:", err);
      if (isAdminView) {
        setClassAttendanceSummary([]);
      } else {
        setRecentAttendanceCount(0);
        setRecentAbsentCount(0);
        setRecentSessionCount(0);
      }
    }
  };

  const activeWeek = recentSelectedWeek
    ? recentAvailableWeeks.find((w) => w.startDate === recentSelectedWeek)
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-4 md:p-8 pb-24">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-white">View Attendance</h1>
        <p className="text-slate-400 text-xs mt-1">Select service type and date to view attendance count.</p>
      </div>

      {/* Recent Attendance Card */}
      <div className="bg-slate-800/50 backdrop-blur-md rounded-xl shadow-lg border border-slate-700 p-4 hover:shadow-xl transition-shadow">
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setRecentAttendanceFilter("bible-study")}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                recentAttendanceFilter === "bible-study"
                  ? "bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-lg"
                  : "bg-white/10 text-slate-200 border border-white/20 hover:bg-white/15"
              }`}
              aria-pressed={recentAttendanceFilter === "bible-study"}
            >
              📖 Bible Study
            </button>
            <button
              onClick={() => setRecentAttendanceFilter("sunday")}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                recentAttendanceFilter === "sunday"
                  ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg"
                  : "bg-white/10 text-slate-200 border border-white/20 hover:bg-white/15"
              }`}
              aria-pressed={recentAttendanceFilter === "sunday"}
            >
              🙏 Sunday Service
            </button>
            <button
              onClick={() => setRecentAttendanceFilter("total")}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                recentAttendanceFilter === "total"
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg"
                  : "bg-white/10 text-slate-200 border border-white/20 hover:bg-white/15"
              }`}
              aria-pressed={recentAttendanceFilter === "total"}
            >
              📊 Total
            </button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {!isAdminView && (
            <div>
              <label className="block text-[10px] font-bold text-slate-300 mb-1.5 uppercase tracking-wide">Filter by Class</label>
              <select
                value={recentSelectedClass || ""}
                onChange={(e) => setRecentSelectedClass(e.target.value || null)}
                className="w-full px-3 py-2 text-sm border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-900/60 text-white cursor-pointer hover:border-slate-600"
            >
              <option value="" className="bg-slate-900 text-white">All Classes</option>
              {recentAvailableClasses.length > 0 ? (
                recentAvailableClasses.map((classNum) => (
                  <option key={`class-${classNum}`} value={classNum} className="bg-slate-900 text-white">
                    Class {classNum}
                  </option>
                ))
              ) : (
                <option value="" disabled className="bg-slate-900 text-gray-500">No classes available</option>
              )}
            </select>
            </div>
          )}
          <div>
            <label className="block text-[10px] font-bold text-slate-300 mb-1.5 uppercase tracking-wide">Filter by Year</label>
            <select
              value={recentSelectedYear}
              onChange={(e) => {
                setRecentSelectedYear(e.target.value);
                setRecentSelectedMonth("");
                setRecentSelectedWeek(null);
              }}
              className="w-full px-3 py-2 text-sm border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-900/60 text-white cursor-pointer hover:border-slate-600"
            >
              <option value="" className="bg-slate-900 text-white">All Years</option>
              {recentAvailableYears.length > 0 ? (
                recentAvailableYears.map((year) => (
                  <option key={`year-${year}`} value={year} className="bg-slate-900 text-white">
                    {year}
                  </option>
                ))
              ) : (
                <option value="" className="bg-slate-900 text-white">No years available</option>
              )}
            </select>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-bold text-slate-300 mb-1.5 uppercase tracking-wide">Filter by Month</label>
            <select
              value={recentSelectedMonth}
              onChange={(e) => {
                setRecentSelectedMonth(e.target.value);
                setRecentSelectedWeek(null);
              }}
              className="w-full px-3 py-2 text-sm border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-900/60 text-white cursor-pointer hover:border-slate-600"
            >
              {recentAvailableMonths.length > 0 ? (
                recentAvailableMonths.map((month) => (
                  <option key={`month-${month}`} value={month} className="bg-slate-900 text-white">
                    {formatMonth(month)}
                  </option>
                ))
              ) : (
                <option value="" className="bg-slate-900 text-white">No months available</option>
              )}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-300 mb-1.5 uppercase tracking-wide">Filter by Week</label>
            <select
              value={recentSelectedWeek || ""}
              onChange={(e) => setRecentSelectedWeek(e.target.value || null)}
              className="w-full px-3 py-2 text-sm border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-900/60 text-white cursor-pointer hover:border-slate-600"
              disabled={recentAvailableWeeks.length === 0}
            >
              {recentAvailableWeeks.length === 0 ? (
                <option value="">No weeks available</option>
              ) : (
                recentAvailableWeeks.map((week) => (
                  <option key={`week-${week.startDate}`} value={week.startDate} className="bg-slate-900 text-white">
                    {week.label}
                  </option>
                ))
              )}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">
              Active week: {activeWeek ? `${activeWeek.label}` : "None selected"}
            </p>
          </div>
        </div>

        <div className="mt-4 bg-slate-900/70 rounded-lg border border-slate-700 p-3">
          <div className="flex flex-col gap-2 mb-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="text-sm font-bold text-white">
                {graphMode === "ytd" ? "YTD Month-to-Month Comparison" : "Monthly Daily Comparison"}
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex rounded-lg overflow-hidden border border-slate-700">
                  <button
                    onClick={() => setGraphMode("monthly")}
                    className={`px-3 py-1.5 text-xs font-semibold transition ${
                      graphMode === "monthly"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setGraphMode("ytd")}
                    className={`px-3 py-1.5 text-xs font-semibold transition ${
                      graphMode === "ytd"
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    YTD
                  </button>
                </div>
                <div className="inline-flex rounded-lg overflow-hidden border border-slate-700">
                  <button
                    onClick={() => setGraphMetric("sessions")}
                    className={`px-3 py-1.5 text-xs font-semibold transition ${
                      graphMetric === "sessions"
                        ? "bg-purple-600 text-white"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    Records Submitted
                  </button>
                  <button
                    onClick={() => setGraphMetric("present")}
                    className={`px-3 py-1.5 text-xs font-semibold transition ${
                      graphMetric === "present"
                        ? "bg-cyan-600 text-white"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    Present
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateMonthlyReport}
                  disabled={!recentSelectedMonth || monthlyComparisonGraph.series.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Download the current dashboard data as a CSV report"
                >
                  <Download size={14} aria-hidden="true" />
                  Generate Monthly Report
                </button>
                <button
                  type="button"
                  onClick={handlePrintMonthlyReport}
                  disabled={!recentSelectedMonth || monthlyComparisonGraph.series.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Open a print-ready report that can be saved as a PDF"
                >
                  <FileText size={14} aria-hidden="true" />
                  Print / Save PDF
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              {graphMode === "ytd"
                ? "Compares each class month-by-month from January up to the selected month in the selected year."
                : "Compares each class day-by-day inside the selected month."}
            </p>
            <p className="text-[11px] text-slate-500">
              Showing {monthlyComparisonGraph.series.length} class(es) for current filters. Metric: {graphMetric === "sessions" ? "records submitted" : "members present"}.
            </p>
          </div>
          {monthlyComparisonGraph.labels.length > 0 && monthlyComparisonGraph.series.length > 0 ? (
            <div className="space-y-2" role="list" aria-label="Attendance comparison by class">
              {[...monthlyComparisonGraph.series]
                .sort((a, b) => b.total - a.total || Number(a.classNumber) - Number(b.classNumber))
                .map((series) => {
                  const activePoints = series.points.filter((value) => value > 0);
                  const average = activePoints.length > 0 ? series.total / activePoints.length : 0;
                  const width = monthlyComparisonGraph.maxValue > 0
                    ? (series.total / (monthlyComparisonGraph.maxValue * monthlyComparisonGraph.labels.length)) * 100
                    : 0;

                  return (
                    <div key={`bar-${series.classNumber}`} role="listitem" className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-2 text-xs">
                      <span className="font-semibold text-slate-200">Class {series.classNumber}</span>
                      <div className="h-7 overflow-hidden rounded-md bg-slate-800" title={`${series.total} total`}>
                        <div
                          className="flex h-full min-w-1 items-center rounded-md px-2 font-bold text-slate-950 transition-all"
                          style={{ width: `${Math.max(series.total > 0 ? 3 : 0, width)}%`, backgroundColor: series.color }}
                        >
                          {series.total > 0 && <span>{series.total}</span>}
                        </div>
                      </div>
                      <span className="whitespace-nowrap text-right text-slate-400">
                        Avg {average.toFixed(graphMetric === "sessions" ? 0 : 1)}
                      </span>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-xs text-slate-400">No monthly graph data for selected year/month/filter.</p>
          )}

          {monthlyComparisonGraph.series.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {monthlyComparisonGraph.series.map((series) => (
                <span
                  key={`legend-${series.classNumber}`}
                  className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-slate-800 text-xs text-slate-200"
                >
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: series.color }} />
                  Class {series.classNumber} (Total: {series.total})
                </span>
              ))}
            </div>
          )}
        </div>
        
        {/* Display attendance count or class summary */}
        {isAdminView ? (
          <div className="mt-4">
            <h3 className="text-sm font-bold text-white mb-2">
              {graphMode === "ytd" ? "All Classes Attendance (Year to Date)" : "All Classes Attendance (Selected Week)"}
            </h3>
            <div className="bg-slate-900/70 rounded-lg border border-slate-700 overflow-hidden">
              {classAttendanceSummary.length > 0 ? (
                <div className="space-y-1">
                  {classAttendanceSummary.map((item) => (
                    <div key={`class-${item.classNumber}`} className="flex items-center justify-between px-3 py-2 hover:bg-slate-800/50 transition">
                      <span className="text-sm text-slate-300">Class {item.classNumber}</span>
                      <div className="flex items-center gap-2">
                        <span className="bg-slate-700 px-2 py-1 rounded-lg text-slate-200 font-semibold text-xs">
                          Records Submitted: {item.sessionsCount}
                        </span>
                        <span className="bg-gradient-to-r from-cyan-600 to-blue-600 px-3 py-1 rounded-lg text-white font-bold text-sm">
                          Present: {item.presentCount}
                        </span>
                        <span className="bg-gradient-to-r from-rose-600 to-red-600 px-3 py-1 rounded-lg text-white font-bold text-sm">
                          Absent: {item.absentCount}
                        </span>
                        <span className="bg-gradient-to-r from-emerald-600 to-green-600 px-3 py-1 rounded-lg text-white font-bold text-sm">
                          Avg Attendance: {item.sessionsCount > 0 ? (item.presentCount / item.sessionsCount).toFixed(1) : "0.0"}
                        </span>
                        {item.presentCount === 0 && item.absentCount === 0 && (
                          <span className="bg-amber-700/70 px-2 py-1 rounded-lg text-amber-100 font-semibold text-xs">
                            Counts Missing
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-slate-700 px-3 py-2 bg-slate-800/30 flex items-center justify-between">
                    <span className="text-sm font-bold text-white">Total</span>
                    <div className="flex items-center gap-2">
                      <span className="bg-slate-700 px-2 py-1 rounded-lg text-slate-200 font-semibold text-xs">
                        Records Submitted: {classAttendanceSummary.reduce((sum, item) => sum + item.sessionsCount, 0)}
                      </span>
                      <span className="bg-gradient-to-r from-purple-600 to-indigo-600 px-3 py-1 rounded-lg text-white font-black text-sm">
                        Present: {classAttendanceSummary.reduce((sum, item) => sum + item.presentCount, 0)}
                      </span>
                      <span className="bg-gradient-to-r from-rose-600 to-red-600 px-3 py-1 rounded-lg text-white font-black text-sm">
                        Absent: {classAttendanceSummary.reduce((sum, item) => sum + item.absentCount, 0)}
                      </span>
                      <span className="bg-gradient-to-r from-emerald-600 to-green-600 px-3 py-1 rounded-lg text-white font-black text-sm">
                        Avg Attendance: {(classAttendanceSummary.reduce((sum, item) => sum + item.sessionsCount, 0) > 0
                          ? classAttendanceSummary.reduce((sum, item) => sum + item.presentCount, 0) /
                            classAttendanceSummary.reduce((sum, item) => sum + item.sessionsCount, 0)
                          : 0
                        ).toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="px-4 py-3 text-slate-400 text-sm">No attendance data for selected week</div>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4 flex gap-2 items-end flex-wrap">
            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-xl px-4 py-2.5 text-white min-w-[120px]">
              <p className="text-[10px] uppercase tracking-wide text-purple-100">Present Count</p>
              <p className="text-2xl font-black">{recentAttendanceCount}</p>
            </div>
            <div className="bg-gradient-to-br from-rose-500 to-red-600 rounded-xl shadow-xl px-4 py-2.5 text-white min-w-[120px]">
              <p className="text-[10px] uppercase tracking-wide text-rose-100">Absent Count</p>
              <p className="text-2xl font-black">{recentAbsentCount}</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl shadow-xl px-4 py-2.5 text-white min-w-[120px]">
              <p className="text-[10px] uppercase tracking-wide text-emerald-100">Avg Attendance</p>
              <p className="text-2xl font-black">{recentSessionCount > 0 ? (recentAttendanceCount / recentSessionCount).toFixed(1) : "0.0"}</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default RecentAttendanceView;
