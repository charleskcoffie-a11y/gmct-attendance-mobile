import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";

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
  const [graphMetric, setGraphMetric] = useState<GraphMetric>("sessions");
  const loadDatesRequestIdRef = useRef(0);
  const loadWeekRequestIdRef = useRef(0);
  const isAdminView = classNumber === 0;

  const getGraphColor = (index: number, total: number) => {
    const hue = Math.round((index * 360) / Math.max(total, 1));
    return `hsl(${hue} 78% 56%)`;
  };


  // Helper function to get week number from date
  const getWeekNumber = (dateStr: string): number => {
    const normalized = normalizeAttendanceDate(dateStr);
    const [y, m, d] = normalized.split("-").map(Number);

    if (!y || !m || !d) {
      return 1;
    }

    const date = new Date(y, m - 1, d);
    const day = date.getDay();
    const mondayDiff = day === 0 ? -6 : 1 - day;
    const monday = new Date(date);
    monday.setDate(date.getDate() + mondayDiff);

    const jan1 = new Date(monday.getFullYear(), 0, 1);
    const jan1Day = jan1.getDay();
    const firstMondayDiff = jan1Day === 0 ? 1 : jan1Day === 1 ? 0 : 8 - jan1Day;
    const firstMonday = new Date(jan1);
    firstMonday.setDate(jan1.getDate() + firstMondayDiff);

    if (monday < firstMonday) {
      return 1;
    }

    const diffMs = monday.getTime() - firstMonday.getTime();
    return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
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
    while (cursor <= monthEnd) {
      const weekStart = toLocalYmd(cursor);
      const weekEndDate = new Date(cursor);
      weekEndDate.setDate(weekEndDate.getDate() + 6);
      const weekEnd = toLocalYmd(weekEndDate);
      const weekNumber = getWeekNumber(weekStart);
      const datesInWeek = normalizedDates.filter((d) => d >= weekStart && d <= weekEnd);

      weeks.push({
        weekNumber,
        label: `Week ${weekNumber}: ${new Date(weekStart + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${new Date(weekEnd + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
        startDate: weekStart,
        endDate: weekEnd,
        dates: datesInWeek,
      });

      cursor.setDate(cursor.getDate() + 7);
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
  }, [recentSelectedWeek, recentAttendanceFilter, classNumber, recentSelectedClass, recentAvailableWeeks]);

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

        // Extract available years and sort descending (newest first)
        const allYears = [...new Set(
          filteredData.map(r => r.attendance_date.split("-")[0])
        )].sort().reverse();
        console.log("Available years:", allYears);
        setRecentAvailableYears(allYears);

        // Set initial year if not already set - but continue processing
        let yearToUse = recentSelectedYear;
        if ((!recentSelectedYear || !allYears.includes(recentSelectedYear)) && allYears.length > 0) {
          yearToUse = allYears[0];
          setRecentSelectedYear(allYears[0]);
        }

        // Filter by selected year (or the year we just set)
        // NOTE: We do NOT filter by service type here - service type filtering happens in loadRecentAttendanceForWeek()
        // This ensures years/months/weeks are always available regardless of current filter
        let filteredByYear = filteredData;
        if (yearToUse) {
          filteredByYear = filteredData.filter(r => 
            r.attendance_date.startsWith(yearToUse)
          );
        }
        console.log("After year filter:", filteredByYear.length, "records");

        // Extract available months in the selected year
        const allMonths = [...new Set(
          filteredByYear.map(r => r.attendance_date.substring(0, 7))
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
          filteredByMonth = filteredByYear.filter(r => 
            r.attendance_date.startsWith(monthToUse)
          );
        }

        const filteredDates = [...new Set(filteredByMonth.map(r => r.attendance_date))].sort();
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
      const rangeStart = selectedWeekObj.startDate < monthStart ? monthStart : selectedWeekObj.startDate;
      const rangeEnd = selectedWeekObj.endDate > monthEnd ? monthEnd : selectedWeekObj.endDate;

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
            <div className="overflow-x-auto">
              {(() => {
                const width = Math.max(720, monthlyComparisonGraph.labels.length * 70);
                const height = 260;
                const left = 42;
                const right = 16;
                const top = 16;
                const bottom = 34;
                const plotWidth = width - left - right;
                const plotHeight = height - top - bottom;
                const maxY = monthlyComparisonGraph.maxValue;
                const xStep = monthlyComparisonGraph.labels.length > 1 ? plotWidth / (monthlyComparisonGraph.labels.length - 1) : 0;
                const yFor = (value: number) => top + plotHeight - (value / maxY) * plotHeight;

                return (
                  <svg width={width} height={height} className="min-w-full">
                    {[0, 1, 2, 3, 4].map((tick) => {
                      const value = Math.round((maxY / 4) * (4 - tick));
                      const y = top + (plotHeight / 4) * tick;
                      return (
                        <g key={`grid-${tick}`}>
                          <line x1={left} y1={y} x2={left + plotWidth} y2={y} stroke="#334155" strokeWidth="1" />
                          <text x={left - 6} y={y + 4} fill="#94a3b8" fontSize="10" textAnchor="end">
                            {value}
                          </text>
                        </g>
                      );
                    })}

                    {monthlyComparisonGraph.series.map((series, seriesIndex) => {
                      const lineOffsetX = ((seriesIndex % 7) - 3) * 0.6;
                      const points = series.points.map((value, idx) => `${left + idx * xStep + lineOffsetX},${yFor(value)}`).join(" ");
                      return (
                        <g key={`series-${series.classNumber}`}>
                          <polyline fill="none" stroke={series.color} strokeOpacity="0.9" strokeWidth="2" points={points} />
                          {series.points.map((value, idx) => (
                            <circle
                              key={`pt-${series.classNumber}-${idx}`}
                              cx={left + idx * xStep + lineOffsetX}
                              cy={yFor(value)}
                              r="2.5"
                              fill={series.color}
                            />
                          ))}
                        </g>
                      );
                    })}

                    {monthlyComparisonGraph.labels.map((label, idx) => {
                      const day = label.split("-")[2] || label;
                      return (
                        <text
                          key={`x-${label}`}
                          x={left + idx * xStep}
                          y={height - 10}
                          fill="#94a3b8"
                          fontSize="10"
                          textAnchor="middle"
                        >
                          {day}
                        </text>
                      );
                    })}
                  </svg>
                );
              })()}
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
            <h3 className="text-sm font-bold text-white mb-2">All Classes Attendance (Selected Period)</h3>
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
