import React, { useState, useEffect } from "react";
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
  count: number;
}

interface AttendanceRow {
  attendance_date: string;
  service_type: "bible-study" | "sunday";
  class_number: string | number;
  total_members_present?: number | null;
}

export const RecentAttendanceView: React.FC<RecentAttendanceViewProps> = ({ classNumber }) => {
  const [recentAttendanceFilter, setRecentAttendanceFilter] = useState<"bible-study" | "sunday" | "total">("bible-study");
  const [recentAttendanceDates, setRecentAttendanceDates] = useState<string[]>([]);
  const [recentAttendanceCount, setRecentAttendanceCount] = useState<number>(0);
  const [recentSelectedClass, setRecentSelectedClass] = useState<string | null>(null);
  const [recentAvailableClasses, setRecentAvailableClasses] = useState<string[]>([]);
  const [recentSelectedYear, setRecentSelectedYear] = useState<string>("");
  const [recentAvailableYears, setRecentAvailableYears] = useState<string[]>([]);
  const [recentSelectedMonth, setRecentSelectedMonth] = useState<string>("");
  const [recentAvailableMonths, setRecentAvailableMonths] = useState<string[]>([]);
  const [recentSelectedWeek, setRecentSelectedWeek] = useState<number | null>(null);
  const [recentAvailableWeeks, setRecentAvailableWeeks] = useState<Week[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [classAttendanceSummary, setClassAttendanceSummary] = useState<ClassAttendanceSummary[]>([]);
  const isAdminView = classNumber === 0;


  // Helper function to get week number from date
  const getWeekNumber = (dateStr: string): number => {
    const date = new Date(dateStr + "T00:00:00Z");
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  // Helper function to get week range (start and end date)
  const getWeekRange = (year: number, week: number): { start: string; end: string } => {
    const jan1 = new Date(year, 0, 1);
    const dayOfWeek = jan1.getDay();
    const daysToFirstMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const firstMonday = new Date(year, 0, 1 + daysToFirstMonday);
    const startDate = new Date(firstMonday);
    startDate.setDate(startDate.getDate() + (week - 1) * 7);
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    
    return {
      start: startDate.toISOString().split("T")[0],
      end: endDate.toISOString().split("T")[0]
    };
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

  // Reload whenever filter or class selection changes (but NOT on initial mount)
  useEffect(() => {
    if (isInitialized) {
      console.log("Filter or class changed - reloading");
      loadRecentAttendanceDates();
    }
  }, [recentAttendanceFilter, recentSelectedClass, isInitialized]);

  useEffect(() => {
    if (recentSelectedMonth) {
      generateWeeksForMonth();
    }
  }, [recentSelectedMonth, recentAttendanceDates]);

  useEffect(() => {
    if (recentSelectedWeek !== null) loadRecentAttendanceForWeek();
  }, [recentSelectedWeek, recentAttendanceFilter, classNumber, recentSelectedClass]);

  const loadRecentAttendanceDates = async () => {
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
        if (!recentSelectedYear && allYears.length > 0) {
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
        if (!recentSelectedMonth && allMonths.length > 0) {
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

        if (filteredDates.length > 0 && recentSelectedWeek === null) {
          const firstWeek = getWeekNumber(filteredDates[0]);
          console.log("Setting initial week to:", firstWeek);
          setRecentSelectedWeek(firstWeek);
        }
        
        // Generate weeks synchronously to avoid timing issues with effects
        if (monthToUse && filteredDates.length > 0) {
          console.log("Generating weeks for month:", monthToUse);
          const [year, month] = monthToUse.split("-").map(Number);
          const weeksMap = new Map<number, Week>();
          
          filteredDates.forEach(dateStr => {
            const [dateYear, dateMonth] = dateStr.split("-").map(Number);
            if (dateYear === year && dateMonth === month) {
              const weekNum = getWeekNumber(dateStr);
              
              if (!weeksMap.has(weekNum)) {
                const range = getWeekRange(year, weekNum);
                weeksMap.set(weekNum, {
                  weekNumber: weekNum,
                  label: `Week ${weekNum}: ${new Date(range.start + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${new Date(range.end + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
                  startDate: range.start,
                  endDate: range.end,
                  dates: []
                });
              }
              
              weeksMap.get(weekNum)!.dates.push(dateStr);
            }
          });
          
          const weeks = Array.from(weeksMap.values()).sort((a, b) => a.weekNumber - b.weekNumber);
          console.log("Generated weeks synchronously:", weeks.length);
          setRecentAvailableWeeks(weeks);
        }
      } else {
        console.log("No attendance data found in database");
        setRecentAttendanceDates([]);
        setRecentAvailableClasses([]);
        setRecentAvailableYears([]);
      }
    } catch (err) {
      console.error("Error loading attendance dates:", err);
    }
  };

  const generateWeeksForMonth = () => {
    console.log("generateWeeksForMonth called with month:", recentSelectedMonth, "dates available:", recentAttendanceDates.length);
    if (!recentSelectedMonth || recentAttendanceDates.length === 0) {
      console.log("Skipping week generation - month not selected or no dates available");
      return;
    }

    const [year, month] = recentSelectedMonth.split("-").map(Number);
    
    // Get all weeks that contain dates from this month
    const weeksMap = new Map<number, Week>();
    
    recentAttendanceDates.forEach(dateStr => {
      const [dateYear, dateMonth] = dateStr.split("-").map(Number);
      if (dateYear === year && dateMonth === month) {
        const weekNum = getWeekNumber(dateStr);
        
        if (!weeksMap.has(weekNum)) {
          const range = getWeekRange(year, weekNum);
          weeksMap.set(weekNum, {
            weekNumber: weekNum,
            label: `Week ${weekNum}: ${new Date(range.start + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${new Date(range.end + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
            startDate: range.start,
            endDate: range.end,
            dates: []
          });
        }
        
        weeksMap.get(weekNum)!.dates.push(dateStr);
      }
    });

    const weeks = Array.from(weeksMap.values()).sort((a, b) => a.weekNumber - b.weekNumber);
    console.log("Generated weeks:", weeks.length, weeks.map(w => w.label));
    setRecentAvailableWeeks(weeks);
    
    if (weeks.length > 0 && recentSelectedWeek === null) {
      setRecentSelectedWeek(weeks[0].weekNumber);
    }
  };

  const loadRecentAttendanceForWeek = async () => {
    try {
      if (recentSelectedWeek === null) {
        console.log("No week selected");
        if (isAdminView) {
          setClassAttendanceSummary([]);
        } else {
          setRecentAttendanceCount(0);
        }
        return;
      }

      const selectedWeekObj = recentAvailableWeeks.find(w => w.weekNumber === recentSelectedWeek);
      console.log("Loading attendance for week:", recentSelectedWeek, selectedWeekObj);
      if (!selectedWeekObj) {
        console.log("Week not found in available weeks");
        if (isAdminView) {
          setClassAttendanceSummary([]);
        } else {
          setRecentAttendanceCount(0);
        }
        return;
      }

      let query = supabase
        .from("attendance")
        .select("*");

      // Filter by dates in the week
      if (selectedWeekObj.dates.length > 0) {
        console.log("Querying dates:", selectedWeekObj.dates);
        query = query.in("attendance_date", selectedWeekObj.dates);
      } else {
        console.log("No dates in week object");
        if (isAdminView) {
          setClassAttendanceSummary([]);
        } else {
          setRecentAttendanceCount(0);
        }
        return;
      }

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

      const rows = (data || []) as AttendanceRow[];

      console.log("Week data query result:", rows);

      if (isAdminView) {
        // Admin view: show summary for all classes
        if (rows.length > 0) {
          const summaryMap = new Map<number, number>();
          rows.forEach(record => {
            const classNum = record.class_number;
            const classNumber = typeof classNum === "string" ? parseInt(classNum, 10) : classNum;
            const currentCount = summaryMap.get(classNumber) || 0;
            summaryMap.set(classNumber, currentCount + (Number(record.total_members_present) || 0));
          });
          const summary = Array.from(summaryMap.entries())
            .map(([classNumber, count]) => ({ classNumber, count }))
            .sort((a, b) => a.classNumber - b.classNumber);
          console.log("Class attendance summary:", summary);
          setClassAttendanceSummary(summary);
        } else {
          setClassAttendanceSummary([]);
        }
      } else {
        // Regular view: show single count for selected class
        if (rows.length > 0) {
          const totalPresent = rows.reduce((sum, record) => sum + (Number(record.total_members_present) || 0), 0);
          console.log("Total members present:", totalPresent);
          setRecentAttendanceCount(totalPresent);
        } else {
          console.log("No records found for selected week");
          setRecentAttendanceCount(0);
        }
      }
    } catch (err) {
      console.error("Error loading attendance count:", err);
      if (isAdminView) {
        setClassAttendanceSummary([]);
      } else {
        setRecentAttendanceCount(0);
      }
    }
  };

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
              onChange={(e) => setRecentSelectedWeek(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 text-sm border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-900/60 text-white cursor-pointer hover:border-slate-600"
              disabled={recentAvailableWeeks.length === 0}
            >
              {recentAvailableWeeks.length === 0 ? (
                <option value="">No weeks available</option>
              ) : (
                recentAvailableWeeks.map((week) => (
                  <option key={`week-${week.weekNumber}`} value={week.weekNumber} className="bg-slate-900 text-white">
                    {week.label}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
        
        {/* Display attendance count or class summary */}
        {isAdminView ? (
          <div className="mt-4">
            <h3 className="text-sm font-bold text-white mb-2">All Classes Attendance</h3>
            <div className="bg-slate-900/70 rounded-lg border border-slate-700 overflow-hidden">
              {classAttendanceSummary.length > 0 ? (
                <div className="space-y-1">
                  {classAttendanceSummary.map((item) => (
                    <div key={`class-${item.classNumber}`} className="flex items-center justify-between px-3 py-2 hover:bg-slate-800/50 transition">
                      <span className="text-sm text-slate-300">Class {item.classNumber}</span>
                      <span className="bg-gradient-to-r from-cyan-600 to-blue-600 px-3 py-1 rounded-lg text-white font-bold text-sm">
                        {item.count}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-slate-700 px-3 py-2 bg-slate-800/30 flex items-center justify-between">
                    <span className="text-sm font-bold text-white">Total</span>
                    <span className="bg-gradient-to-r from-purple-600 to-indigo-600 px-3 py-1 rounded-lg text-white font-black text-sm">
                      {classAttendanceSummary.reduce((sum, item) => sum + item.count, 0)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="px-4 py-3 text-slate-400 text-sm">No attendance data for selected week</div>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4 flex gap-2 items-end">
            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-xl px-4 py-2.5 text-white min-w-[120px]">
              <p className="text-[10px] uppercase tracking-wide text-purple-100">Attendance Count</p>
              <p className="text-2xl font-black">{recentAttendanceCount}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentAttendanceView;
