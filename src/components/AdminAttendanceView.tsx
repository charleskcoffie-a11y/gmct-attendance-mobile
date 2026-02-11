import React, { useState, useEffect } from "react";
import { getAppSettings, getClassMembers, saveAttendance } from "../supabase";
import { Member, ServiceType } from "../types";
import { Calendar, Wifi, WifiOff, CheckCircle } from "lucide-react";

interface AdminAttendanceViewProps {
  onLogout: () => void;
}

interface MemberWithStatus extends Member {
  attendanceStatus?: "present" | "absent" | "sick" | "travel";
}

interface ClassAttendance {
  classNumber: number;
  members: MemberWithStatus[];
}

export const AdminAttendanceView: React.FC<AdminAttendanceViewProps> = ({
  onLogout,
}) => {
  const [serviceType, setServiceType] = useState<ServiceType>("sunday");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [classesData, setClassesData] = useState<ClassAttendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [expandedClass, setExpandedClass] = useState<number | null>(null);

  useEffect(() => {
    loadAllClasses();
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const loadAllClasses = async () => {
    setLoading(true);
    setError(null);
    try {
      const settings = await getAppSettings();
      const max = typeof settings?.max_classes === "number" ? settings.max_classes : 10;

      const classes: ClassAttendance[] = [];
      for (let i = 1; i <= max; i++) {
        const members = await getClassMembers(i);
        if (members && members.length > 0) {
          classes.push({
            classNumber: i,
            members: (members as Member[]).map((m) => ({
              ...m,
              attendanceStatus: "absent" as const,
            })),
          });
        }
      }
      setClassesData(classes);
      if (classes.length > 0) {
        setExpandedClass(classes[0].classNumber);
      }
    } catch (err) {
      setError(
        "Failed to load classes: " +
          (err instanceof Error ? err.message : "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  };

  const updateMemberStatus = (classNumber: number, memberId: string, status: string) => {
    setClassesData(
      classesData.map((classData) =>
        classData.classNumber === classNumber
          ? {
              ...classData,
              members: classData.members.map((m) =>
                m.id === memberId
                  ? { ...m, attendanceStatus: status as any }
                  : m
              ),
            }
          : classData
      )
    );
  };

  const handleSubmitAttendance = async () => {
    if (classesData.length === 0) {
      setError("No classes to submit");
      return;
    }

    setLoading(true);
    try {
      let totalSubmitted = 0;
      for (const classData of classesData) {
        const memberRecords = classData.members
          .filter((m) => m.attendanceStatus)
          .map((m) => ({
            memberId: m.id?.toString() || "",
            status: m.attendanceStatus || "absent",
          }));

        if (memberRecords.length > 0) {
          await saveAttendance(
            classData.classNumber,
            selectedDate,
            serviceType,
            memberRecords,
            "Admin"
          );
          totalSubmitted += memberRecords.length;
        }
      }

      setSuccess(`Attendance submitted for ${totalSubmitted} members across all classes`);
      await loadAllClasses();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(
        "Failed to submit attendance: " +
          (err instanceof Error ? err.message : "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  };

  const getTotalStats = () => {
    const stats = {
      present: 0,
      absent: 0,
      sick: 0,
      travel: 0,
      total: 0,
    };
    classesData.forEach((classData) => {
      classData.members.forEach((m) => {
        stats.total++;
        if (m.attendanceStatus === "present") stats.present++;
        else if (m.attendanceStatus === "absent") stats.absent++;
        else if (m.attendanceStatus === "sick") stats.sick++;
        else if (m.attendanceStatus === "travel") stats.travel++;
        else stats.absent++;
      });
    });
    return stats;
  };

  const stats = getTotalStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-gradient-to-r from-slate-900 via-blue-700 to-emerald-700 text-white shadow-xl">
        <div className="px-5 py-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">All Classes</h1>
              <p className="text-sm md:text-base text-blue-100/90 font-medium">Admin Attendance</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold border ${
                isOnline
                  ? "bg-emerald-500/15 text-emerald-200 border-emerald-400/40"
                  : "bg-amber-500/15 text-amber-200 border-amber-400/40"
              }`}>
                {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                {isOnline ? "Online" : "Offline"}
              </span>
              <button
                onClick={onLogout}
                className="px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white rounded-xl font-semibold transition text-sm backdrop-blur-sm border border-white/20"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Service Type & Date Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm md:text-base text-blue-100/90 mb-1.5 block font-medium">Service Type</label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value as ServiceType)}
                className="w-full px-3 py-2.5 rounded-lg bg-blue-700/80 text-white text-sm md:text-base font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300 border border-white/10"
              >
                <option value="sunday">Sunday Service</option>
                <option value="bible-study">Bible Study</option>
              </select>
            </div>
            <div>
              <label className="text-sm md:text-base text-blue-100/90 mb-1.5 block font-medium">Date</label>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-lg bg-blue-700/80 text-white text-sm md:text-base font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300 border border-white/10"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Messages */}
      <div className="p-4 space-y-2">
        {error && (
          <div className="p-3 bg-red-900/30 border border-red-700/40 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 bg-emerald-900/30 border border-emerald-700/40 rounded-lg text-emerald-200 text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {success}
          </div>
        )}

        {/* Offline Notice */}
        {!isOnline && (
          <div className="p-3 bg-amber-900/30 border border-amber-700/40 rounded-lg text-amber-200 text-sm">
            You are currently offline. Data will be synced when connection is restored.
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
          <div className="bg-slate-900/70 rounded-xl p-3 shadow-sm border border-slate-700/60">
            <p className="text-xs text-slate-400">Total</p>
            <p className="text-2xl font-bold text-blue-300">{stats.total}</p>
          </div>
          <div className="bg-slate-900/70 rounded-xl p-3 shadow-sm border border-slate-700/60">
            <p className="text-xs text-slate-400">Present</p>
            <p className="text-2xl font-bold text-emerald-300">{stats.present}</p>
          </div>
          <div className="bg-slate-900/70 rounded-xl p-3 shadow-sm border border-slate-700/60">
            <p className="text-xs text-slate-400">Absent</p>
            <p className="text-2xl font-bold text-red-300">{stats.absent}</p>
          </div>
          <div className="bg-slate-900/70 rounded-xl p-3 shadow-sm border border-slate-700/60">
            <p className="text-xs text-slate-400">Sick</p>
            <p className="text-2xl font-bold text-orange-300">{stats.sick}</p>
          </div>
          <div className="bg-slate-900/70 rounded-xl p-3 shadow-sm border border-slate-700/60">
            <p className="text-xs text-slate-400">Travel</p>
            <p className="text-2xl font-bold text-purple-300">{stats.travel}</p>
          </div>
        </div>

        {/* Classes List */}
        {loading && classesData.length === 0 ? (
          <div className="text-center py-8 text-slate-400">Loading all classes...</div>
        ) : classesData.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            No members found in any class
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {classesData.map((classData) => (
              <div
                key={classData.classNumber}
                className="bg-slate-900/70 rounded-xl shadow-sm border border-slate-700/60 overflow-hidden"
              >
                {/* Class Header */}
                <button
                  onClick={() =>
                    setExpandedClass(
                      expandedClass === classData.classNumber
                        ? null
                        : classData.classNumber
                    )
                  }
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800/60 transition"
                >
                  <div className="text-left">
                    <h3 className="font-semibold text-white">
                      Class {classData.classNumber}
                    </h3>
                    <p className="text-sm text-slate-400">
                      {classData.members.length} members
                    </p>
                  </div>
                  <svg
                    className={`w-5 h-5 text-slate-400 transition transform ${
                      expandedClass === classData.classNumber ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                    />
                  </svg>
                </button>

                {/* Expanded Members List */}
                {expandedClass === classData.classNumber && (
                  <div className="border-t border-slate-700 px-4 py-3 space-y-2">
                    {classData.members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 bg-slate-800/60 rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">
                            {member.name}
                          </p>
                          {(member.phone || member.phoneNumber) && (
                            <p className="text-xs text-slate-400">
                              {member.phone || member.phoneNumber}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1 ml-2">
                          <button
                            onClick={() =>
                              updateMemberStatus(
                                classData.classNumber,
                                member.id!,
                                "present"
                              )
                            }
                            className={`py-1 px-2 rounded text-xs font-medium transition ${
                              member.attendanceStatus === "present"
                                ? "bg-emerald-600 text-white"
                                : "bg-slate-700 text-slate-200 hover:bg-emerald-600/30"
                            }`}
                          >
                            ✓
                          </button>
                          <button
                            onClick={() =>
                              updateMemberStatus(
                                classData.classNumber,
                                member.id!,
                                "absent"
                              )
                            }
                            className={`py-1 px-2 rounded text-xs font-medium transition ${
                              member.attendanceStatus === "absent"
                                ? "bg-red-600 text-white"
                                : "bg-slate-700 text-slate-200 hover:bg-red-600/30"
                            }`}
                          >
                            ✗
                          </button>
                          <button
                            onClick={() =>
                              updateMemberStatus(
                                classData.classNumber,
                                member.id!,
                                "sick"
                              )
                            }
                            className={`py-1 px-2 rounded text-xs font-medium transition ${
                              member.attendanceStatus === "sick"
                                ? "bg-orange-600 text-white"
                                : "bg-slate-700 text-slate-200 hover:bg-orange-600/30"
                            }`}
                          >
                            🤒
                          </button>
                          <button
                            onClick={() =>
                              updateMemberStatus(
                                classData.classNumber,
                                member.id!,
                                "travel"
                              )
                            }
                            className={`py-1 px-2 rounded text-xs font-medium transition ${
                              member.attendanceStatus === "travel"
                                ? "bg-purple-600 text-white"
                                : "bg-slate-700 text-slate-200 hover:bg-purple-600/30"
                            }`}
                          >
                            ✈️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Submit Button */}
        {classesData.length > 0 && (
          <div className="sticky bottom-0 left-0 right-0 p-4 bg-slate-900/80 border-t border-slate-700/60 backdrop-blur flex gap-3">
            <button
              onClick={handleSubmitAttendance}
              disabled={loading || classesData.length === 0}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-white rounded-lg font-semibold transition disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit All Attendance"}
            </button>
            <button
              onClick={loadAllClasses}
              disabled={loading}
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAttendanceView;
