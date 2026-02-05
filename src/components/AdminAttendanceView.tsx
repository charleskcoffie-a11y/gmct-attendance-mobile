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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 sticky top-0 z-20 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold">All Classes</h1>
            <p className="text-blue-100">Admin Attendance</p>
          </div>
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className="w-5 h-5 text-green-300" />
            ) : (
              <WifiOff className="w-5 h-5 text-yellow-300" />
            )}
            <button
              onClick={onLogout}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 rounded-lg text-sm font-medium transition"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Service Type & Date Selector */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-blue-100 mb-1 block">Service Type</label>
            <select
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value as ServiceType)}
              className="w-full px-3 py-2 rounded-lg bg-blue-700 text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="sunday">Sunday Service</option>
              <option value="bible-study">Bible Study</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-blue-100 mb-1 block">Date</label>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-blue-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Alert Messages */}
      <div className="p-4 space-y-2">
        {error && (
          <div className="p-3 bg-red-100 border border-red-400 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 bg-green-100 border border-green-400 rounded-lg text-green-700 text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {success}
          </div>
        )}

        {/* Offline Notice */}
        {!isOnline && (
          <div className="p-3 bg-yellow-100 border border-yellow-400 rounded-lg text-yellow-800 text-sm">
            You are currently offline. Data will be synced when connection is restored.
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
          <div className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-blue-500">
            <p className="text-xs text-gray-600">Total</p>
            <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-green-500">
            <p className="text-xs text-gray-600">Present</p>
            <p className="text-2xl font-bold text-green-600">{stats.present}</p>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-red-500">
            <p className="text-xs text-gray-600">Absent</p>
            <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-orange-500">
            <p className="text-xs text-gray-600">Sick</p>
            <p className="text-2xl font-bold text-orange-600">{stats.sick}</p>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-purple-500">
            <p className="text-xs text-gray-600">Travel</p>
            <p className="text-2xl font-bold text-purple-600">{stats.travel}</p>
          </div>
        </div>

        {/* Classes List */}
        {loading && classesData.length === 0 ? (
          <div className="text-center py-8 text-gray-600">Loading all classes...</div>
        ) : classesData.length === 0 ? (
          <div className="text-center py-8 text-gray-600">
            No members found in any class
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {classesData.map((classData) => (
              <div
                key={classData.classNumber}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
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
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition"
                >
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900">
                      Class {classData.classNumber}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {classData.members.length} members
                    </p>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-500 transition transform ${
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
                  <div className="border-t border-gray-200 px-4 py-3 space-y-2">
                    {classData.members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {member.name}
                          </p>
                          {(member.phone || member.phoneNumber) && (
                            <p className="text-xs text-gray-600">
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
                                ? "bg-green-600 text-white"
                                : "bg-gray-200 text-gray-700 hover:bg-green-100"
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
                                : "bg-gray-200 text-gray-700 hover:bg-red-100"
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
                                : "bg-gray-200 text-gray-700 hover:bg-orange-100"
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
                                : "bg-gray-200 text-gray-700 hover:bg-purple-100"
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
          <div className="sticky bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 flex gap-3">
            <button
              onClick={handleSubmitAttendance}
              disabled={loading || classesData.length === 0}
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit All Attendance"}
            </button>
            <button
              onClick={loadAllClasses}
              disabled={loading}
              className="px-6 py-3 bg-gray-300 hover:bg-gray-400 text-gray-900 rounded-lg font-semibold transition disabled:opacity-50"
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
