import React, { useState, useEffect } from "react";
import { supabase } from "../supabase";

interface RecentAttendanceViewProps {
  classNumber: number;
}

export const RecentAttendanceView: React.FC<RecentAttendanceViewProps> = ({ classNumber }) => {
  const [recentAttendanceFilter, setRecentAttendanceFilter] = useState<"bible-study" | "sunday" | "total">("bible-study");
  const [recentDate, setRecentDate] = useState<string>("");
  const [recentAttendanceDates, setRecentAttendanceDates] = useState<string[]>([]);
  const [recentAttendanceCount, setRecentAttendanceCount] = useState<number>(0);
  const [recentSelectedClass, setRecentSelectedClass] = useState<string | null>(null);
  const [recentAvailableClasses, setRecentAvailableClasses] = useState<string[]>([]);
  const [recentSelectedYear, setRecentSelectedYear] = useState<string>("");
  const [recentAvailableYears, setRecentAvailableYears] = useState<string[]>([]);

  useEffect(() => {
    loadRecentAttendanceDates();
  }, [classNumber, recentSelectedClass, recentAttendanceFilter, recentSelectedYear]);

  useEffect(() => {
    if (recentDate) loadRecentAttendance();
  }, [recentDate, recentAttendanceFilter, classNumber, recentSelectedClass]);

  const loadRecentAttendanceDates = async () => {
    try {
      let query = supabase
        .from("attendance")
        .select("attendance_date, service_type, class_number")
        .order("attendance_date", { ascending: false });

      const { data, error: dbError } = await query;

      if (dbError) throw dbError;

      if (data && data.length > 0) {
        // Get available classes
        const availableClasses = [...new Set(data.map(r => String(r.class_number)))].sort();
        setRecentAvailableClasses(availableClasses);

        // Filter by selected class or all classes
        let filteredData = data;
        if (recentSelectedClass) {
          filteredData = data.filter(r => String(r.class_number) === recentSelectedClass);
        }

        // Extract available years and sort descending (newest first)
        const allYears = [...new Set(
          filteredData.map(r => r.attendance_date.split("-")[0])
        )].sort().reverse();
        setRecentAvailableYears(allYears);

        // Set initial year to the latest year if not already set
        if (!recentSelectedYear && allYears.length > 0) {
          setRecentSelectedYear(allYears[0]);
          return; // Exit and let the next effect handle it
        }

        // Filter data by service type and class
        let filteredByServiceType = filteredData;
        switch (recentAttendanceFilter) {
          case "bible-study":
            filteredByServiceType = filteredData.filter(r => r.service_type === "bible-study");
            break;
          case "sunday":
            filteredByServiceType = filteredData.filter(r => r.service_type === "sunday");
            break;
          // "total" doesn't need filtering
        }

        // Filter by selected year
        let filteredByYear = filteredByServiceType;
        if (recentSelectedYear) {
          filteredByYear = filteredByServiceType.filter(r => 
            r.attendance_date.startsWith(recentSelectedYear)
          );
        }

        // Extract unique dates
        const filteredDates = [...new Set(filteredByYear.map(r => r.attendance_date))];

        setRecentAttendanceDates(filteredDates);
        if (filteredDates.length > 0 && !recentDate) {
          setRecentDate(filteredDates[0]);
        }
      } else {
        setRecentAttendanceDates([]);
        setRecentAvailableClasses([]);
        setRecentAvailableYears([]);
      }
    } catch (err) {
      console.error("Error loading attendance dates:", err);
    }
  };

  const loadRecentAttendance = async () => {
    try {
      if (!recentDate) return;

      let query = supabase
        .from("attendance")
        .select("*")
        .eq("attendance_date", recentDate);

      if (recentSelectedClass) {
        query = query.eq("class_number", parseInt(recentSelectedClass));
      } else {
        query = query.eq("class_number", classNumber);
      }

      if (recentAttendanceFilter !== "total") {
        query = query.eq("service_type", recentAttendanceFilter);
      }

      const { data, error: dbError } = await query;

      if (dbError) throw dbError;

      setRecentAttendanceCount(data ? data.length : 0);
    } catch (err) {
      console.error("Error loading attendance count:", err);
      setRecentAttendanceCount(0);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-4 md:p-8 pb-24">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Recent Attendance</h1>
        <p className="text-slate-400 text-sm mt-2">Track your class attendance trends</p>
      </div>

      {/* Recent Attendance Card */}
      <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl shadow-lg border border-slate-700 p-6 md:p-8 hover:shadow-xl transition-shadow">
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-bold text-white">View Attendance</h2>
            <p className="text-sm text-slate-300 mt-1">Select service type and date to view attendance count.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setRecentAttendanceFilter("bible-study")}
              className={`px-5 py-2.5 rounded-xl font-semibold transition-all transform hover:scale-105 ${
                recentAttendanceFilter === "bible-study"
                  ? "bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-lg shadow-emerald-500/40"
                  : "bg-white/10 text-slate-200 border border-white/20 hover:bg-white/15"
              }`}
              aria-pressed={recentAttendanceFilter === "bible-study"}
            >
              📖 Bible Study
            </button>
            <button
              onClick={() => setRecentAttendanceFilter("sunday")}
              className={`px-5 py-2.5 rounded-xl font-semibold transition-all transform hover:scale-105 ${
                recentAttendanceFilter === "sunday"
                  ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/40"
                  : "bg-white/10 text-slate-200 border border-white/20 hover:bg-white/15"
              }`}
              aria-pressed={recentAttendanceFilter === "sunday"}
            >
              🙏 Sunday Service
            </button>
            <button
              onClick={() => setRecentAttendanceFilter("total")}
              className={`px-5 py-2.5 rounded-xl font-semibold transition-all transform hover:scale-105 ${
                recentAttendanceFilter === "total"
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/40"
                  : "bg-white/10 text-slate-200 border border-white/20 hover:bg-white/15"
              }`}
              aria-pressed={recentAttendanceFilter === "total"}
            >
              📊 Total
            </button>
          </div>
        </div>
        <div className="mt-5 mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wide">Filter by Class</label>
            <select
              value={recentSelectedClass || ""}
              onChange={(e) => setRecentSelectedClass(e.target.value || null)}
              className="w-full px-4 py-3 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-900/60 text-white cursor-pointer hover:border-slate-600"
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
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wide">Filter by Year</label>
            <select
              value={recentSelectedYear}
              onChange={(e) => {
                setRecentSelectedYear(e.target.value);
                setRecentDate("");
              }}
              className="w-full px-4 py-3 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-900/60 text-white cursor-pointer hover:border-slate-600"
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
        <div className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-4 mt-5">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wide">Attendance Date</label>
            <select
              value={recentDate}
              onChange={(e) => setRecentDate(e.target.value)}
              className="w-full px-4 py-3 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-900/60 text-white"
              disabled={recentAttendanceDates.length === 0}
            >
              {recentAttendanceDates.length === 0 ? (
                <option value="">No marked dates</option>
              ) : (
                recentAttendanceDates.map((date) => (
                  <option key={`date-${date}`} value={date} className="text-slate-900">
                    {date}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="flex items-end">
            <div className="w-full md:w-auto bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl shadow-xl px-6 py-4 text-white">
              <p className="text-xs uppercase tracking-wide text-purple-100">Attendance Count</p>
              <p className="text-3xl font-black mt-1">{recentAttendanceCount}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecentAttendanceView;
