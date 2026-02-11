import React, { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { ClassLeader } from "../types";
import { AlertCircle, CheckCircle, Trash2, Edit2, Plus, ChevronDown } from "lucide-react";

interface AdminSettingsProps {
  onBack: () => void;
}

interface AppStats {
  memberCount: number;
  classCount: number;
}

interface EditingLeader extends ClassLeader {
  editing?: boolean;
}


export const AdminSettings: React.FC<AdminSettingsProps> = ({ onBack }) => {
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [stats, setStats] = useState<AppStats | null>(null);
  const [classLeaders, setClassLeaders] = useState<EditingLeader[]>([]);
  const [appSettings, setAppSettings] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<ClassLeader>>({});
  const [adminPasswordChange, setAdminPasswordChange] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [ministerEmails, setMinisterEmails] = useState("");
  const [monthlyAbsenceThreshold, setMonthlyAbsenceThreshold] = useState(4);
  const [quarterlyAbsenceThreshold, setQuarterlyAbsenceThreshold] = useState(10);
  const [recentAttendanceFilter, setRecentAttendanceFilter] = useState<"bible-study" | "sunday" | "total">("bible-study");
  const [recentAttendanceCount, setRecentAttendanceCount] = useState(0);
  const [recentDate, setRecentDate] = useState("");
  const [recentAttendanceDates, setRecentAttendanceDates] = useState<string[]>([]);
  const [recentSelectedClass, setRecentSelectedClass] = useState<string | null>(null);
  const [recentAvailableClasses, setRecentAvailableClasses] = useState<string[]>([]);
  const [openSections, setOpenSections] = useState({
    statsTotals: false,
    appConfig: false,
    classLeaders: false,
    ministerEmails: false,
    absenceThresholds: false,
    adminPassword: false,
    environmentCache: false,
    databaseConnection: false,
  });
  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadRecentAttendanceDates();
  }, [recentAttendanceFilter, recentSelectedClass]);

  useEffect(() => {
    if (!recentDate) {
      setRecentAttendanceCount(0);
      return;
    }
    loadRecentAttendance();
  }, [recentDate, recentAttendanceFilter, recentSelectedClass]);

  const toggleSection = (key: keyof typeof openSections) => {
    if (key === "classLeaders" && editingId !== null) return;
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const loadInitialData = async () => {
    setLoading(true);
    setError(null);
    await Promise.all([testConnection(), loadStats(), loadClassLeaders(), loadAppSettings()]);
    setLoading(false);
  };

  const loadRecentAttendanceDates = async () => {
    try {
      // Load available classes
      let classQuery = supabase
        .from("attendance")
        .select("class_number")
        .order("class_number", { ascending: true });

      if (recentAttendanceFilter !== "total") {
        classQuery = classQuery.eq("service_type", recentAttendanceFilter);
      }

      const { data: classData, error: classError } = await classQuery;
      if (!classError && classData) {
        const uniqueClasses = Array.from(
          new Set(classData.map((row: any) => row.class_number).filter(Boolean))
        ).sort((a, b) => Number(a) - Number(b));
        setRecentAvailableClasses(uniqueClasses);
      }

      // Load dates filtered by service type and class
      let query = supabase
        .from("attendance")
        .select("attendance_date")
        .order("attendance_date", { ascending: true });

      if (recentAttendanceFilter !== "total") {
        query = query.eq("service_type", recentAttendanceFilter);
      }

      if (recentSelectedClass) {
        query = query.eq("class_number", recentSelectedClass);
      }

      const { data, error } = await query;
      if (error) throw error;

      const uniqueDates = Array.from(
        new Set((data || []).map((row: any) => row.attendance_date).filter(Boolean))
      );

      setRecentAttendanceDates(uniqueDates);
      setRecentDate(uniqueDates[uniqueDates.length - 1] || "");
    } catch (err) {
      console.error("Error loading attendance dates:", err);
      setRecentAttendanceDates([]);
      setRecentDate("");
      setRecentAvailableClasses([]);
    }
  };

  const testConnection = async () => {
    try {
      const { error } = await supabase
        .from("members")
        .select("count", { count: "exact" })
        .limit(1);

      if (error) {
        setDbConnected(false);
        setError("Database connection failed");
      } else {
        setDbConnected(true);
        setError(null);
      }
    } catch (err) {
      setDbConnected(false);
      setError(
        "Connection test error: " +
          (err instanceof Error ? err.message : "Unknown error")
      );
    }
  };

  const loadStats = async () => {
    try {
      let memberCount = 0;
      let classCount = 0;

      // Get member count
      try {
        const { count, error } = await supabase
          .from("members")
          .select("*", { count: "exact", head: true });

        if (!error && count !== null) {
          memberCount = count;
        }
      } catch (err) {
        console.error("Error loading member count:", err);
      }

      // Get class count (distinct class_number values)
      try {
        const { data, error } = await supabase
          .from("members")
          .select("class_number");

        if (!error && data) {
          const classSet = new Set(data.map((m: any) => m.class_number).filter(Boolean));
          classCount = classSet.size;
        }
      } catch (err) {
        console.error("Error loading class count:", err);
      }

      setStats({
        memberCount,
        classCount,
      });
    } catch (err) {
      console.error("Error loading stats:", err);
      // Don't set error here, just log it - show partial stats instead
    }
  };

  const loadRecentAttendance = async () => {
    try {
      let query = supabase
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("attendance_date", recentDate);

      if (recentAttendanceFilter !== "total") {
        query = query.eq("service_type", recentAttendanceFilter);
      }

      if (recentSelectedClass) {
        query = query.eq("class_number", recentSelectedClass);
      }

      const { count, error } = await query;
      if (error) throw error;
      setRecentAttendanceCount(count || 0);
    } catch (err) {
      console.error("Error loading recent attendance:", err);
    }
  };

  const loadClassLeaders = async () => {
    try {
      // Fetch real class leaders from database
      const { data, error } = await supabase
        .from("class_leaders")
        .select("*")
        .order("username", { ascending: true });

      if (error) {
        throw error;
      }

      // Map from snake_case DB fields to camelCase for the component
      const leadersList: EditingLeader[] = (data || []).map((cl: any) => ({
        id: cl.id,
        username: cl.username,
        password: cl.password,
        classNumber: cl.class_number,
        accessCode: cl.access_code,
        fullName: cl.full_name,
        phone: cl.phone,
        email: cl.email,
        active: cl.active,
        createdBy: cl.created_by,
        updatedBy: cl.updated_by,
        lastUpdated: cl.last_updated,
        created_at: cl.created_at,
      }));

      setClassLeaders(leadersList);
    } catch (err) {
      console.error("Error loading class leaders:", err);
      setError("Failed to load class leaders");
    }
  };

  const loadAppSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .eq("id", "app_settings")
        .single();

      if (error) throw error;
      setAppSettings(data);
      setMinisterEmails(data?.minister_emails || "");
      setMonthlyAbsenceThreshold(data?.monthly_absence_threshold || 4);
      setQuarterlyAbsenceThreshold(data?.quarterly_absence_threshold || 10);
    } catch (err) {
      console.error("Error loading app settings:", err);
    }
  };

  const handleAddLeader = () => {
    setEditingId("new");
    setFormData({
      username: "",
      fullName: "",
      classNumber: "",
      email: "",
      active: true,
    });
  };

  const handleEditLeader = (leader: EditingLeader) => {
    setEditingId(leader.id);
    setFormData(leader);
  };

  const handleSaveLeader = async () => {
    if (!formData.username || !formData.password || !formData.fullName) {
      setError("Username, password, and full name are required");
      return;
    }

    setLoading(true);
    try {
      if (editingId === "new") {
        // Add new leader to database
        const { error } = await supabase
          .from("class_leaders")
          .insert({
            username: formData.username,
            password: formData.password,
            full_name: formData.fullName,
            class_number: formData.classNumber,
            access_code: formData.accessCode,
            email: formData.email,
            phone: formData.phone,
            active: true,
          });

        if (error) throw error;
        setSuccess("Class leader added successfully");
      } else if (editingId) {
        // Update existing leader in database
        const { error } = await supabase
          .from("class_leaders")
          .update({
            username: formData.username,
            password: formData.password,
            full_name: formData.fullName,
            class_number: formData.classNumber,
            access_code: formData.accessCode,
            email: formData.email,
            phone: formData.phone,
          })
          .eq("id", editingId);

        if (error) throw error;
        setSuccess("Class leader updated successfully");
      }

      // Reload class leaders
      await loadClassLeaders();
      setEditingId(null);
      setFormData({});
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(
        "Failed to save leader: " +
          (err instanceof Error ? err.message : "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLeader = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this class leader?"))
      return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("class_leaders")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setSuccess("Class leader deleted successfully");
      await loadClassLeaders();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(
        "Failed to delete leader: " +
          (err instanceof Error ? err.message : "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClearCache = async () => {
    try {
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
        setSuccess("Cache cleared successfully");
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      setError(
        "Failed to clear cache: " +
          (err instanceof Error ? err.message : "Unknown error")
      );
    }
  };

  const handleChangeAdminPassword = async () => {
    if (!adminPasswordChange.newPassword || !adminPasswordChange.confirmPassword) {
      setError("Both password fields are required");
      return;
    }

    if (adminPasswordChange.newPassword !== adminPasswordChange.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (adminPasswordChange.newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .update({ admin_password: adminPasswordChange.newPassword })
        .eq("id", "app_settings");

      if (error) throw error;

      setSuccess("Admin password changed successfully");
      setAdminPasswordChange({ newPassword: "", confirmPassword: "" });
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(
        "Failed to change password: " +
          (err instanceof Error ? err.message : "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMinisterEmails = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .update({ minister_emails: ministerEmails })
        .eq("id", "app_settings");

      if (error) throw error;

      setSuccess("Minister emails updated successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(
        "Failed to update minister emails: " +
          (err instanceof Error ? err.message : "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAbsenceThresholds = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .update({
          monthly_absence_threshold: monthlyAbsenceThreshold,
          quarterly_absence_threshold: quarterlyAbsenceThreshold
        })
        .eq("id", "app_settings");

      if (error) throw error;

      setSuccess("Absence thresholds updated successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(
        "Failed to update absence thresholds: " +
          (err instanceof Error ? err.message : "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  };

  const classLeadersOpen = editingId !== null ? true : openSections.classLeaders;
  const isLeadersScrollable = classLeaders.length > 3;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-4 md:p-8 text-slate-100">
      {/* Header with gradient */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/15 text-blue-200 text-xs font-semibold mb-3 border border-blue-400/30">
            System Control
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white">
            Admin Settings
          </h1>
          <p className="text-sm md:text-base text-slate-300 mt-1">Manage your attendance system configuration</p>
        </div>
        <button
          onClick={onBack}
          className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition-all shadow-md hover:shadow-lg border border-white/20"
        >
          Back
        </button>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-700/40 rounded-xl shadow-lg flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-300 flex-shrink-0 mt-0.5" />
          <p className="text-red-200 font-medium">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-emerald-900/30 border border-emerald-700/40 rounded-xl shadow-lg flex items-start gap-3">
          <CheckCircle className="w-6 h-6 text-emerald-300 flex-shrink-0 mt-0.5" />
          <p className="text-emerald-200 font-medium">{success}</p>
        </div>
      )}

      {/* Totals */}
      {stats && (
        <div className="bg-slate-900/70 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-700/60 p-6 mb-6">
          <button
            type="button"
            onClick={() => toggleSection("statsTotals")}
            className="w-full flex items-center justify-between text-left"
            aria-expanded={openSections.statsTotals}
          >
            <h2 className="text-xl font-bold text-white">Totals</h2>
            <ChevronDown
              className={`w-5 h-5 text-slate-300 transition-transform ${openSections.statsTotals ? "rotate-180" : ""}`}
            />
          </button>
          {openSections.statsTotals && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div className="relative overflow-hidden bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-all duration-300">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full"></div>
                <p className="text-sm font-medium text-blue-100 mb-2 relative z-10">Total Members</p>
                <p className="text-4xl font-black relative z-10">
                  {stats.memberCount}
                </p>
              </div>
              <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-all duration-300">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full"></div>
                <p className="text-sm font-medium text-emerald-100 mb-2 relative z-10">Active Classes</p>
                <p className="text-4xl font-black relative z-10">
                  {stats.classCount}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Attendance */}
      <div className="bg-slate-900/70 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-700/60 p-6 mb-6">
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-bold text-white">Recent Attendance</h2>
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
        <div className="mt-5 mb-4">
          <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wide">Filter by Class</label>
          <select
            value={recentSelectedClass || ""}
            onChange={(e) => setRecentSelectedClass(e.target.value || null)}
            className="w-full px-4 py-3 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-900/60 text-white"
            disabled={recentAvailableClasses.length === 0}
          >
            <option value="">All Classes</option>
            {recentAvailableClasses.map((classNum) => (
              <option key={`class-${classNum}`} value={classNum} className="text-slate-900">
                Class {classNum}
              </option>
            ))}
          </select>
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

      {/* App Settings from Database */}
      {appSettings && (
        <div className="bg-slate-900/70 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-700/60 p-6 mb-6">
          <button
            type="button"
            onClick={() => toggleSection("appConfig")}
            className="w-full flex items-center justify-between text-left"
            aria-expanded={openSections.appConfig}
          >
            <h2 className="text-xl font-bold text-white">App Configuration</h2>
            <ChevronDown
              className={`w-5 h-5 text-slate-300 transition-transform ${openSections.appConfig ? "rotate-180" : ""}`}
            />
          </button>
          {openSections.appConfig && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div className="group border-l-4 border-blue-500 pl-4 py-2 hover:bg-blue-500/10 rounded-r-lg transition-all duration-200">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1.5">Organization Name</p>
                <p className="text-base font-bold text-white group-hover:text-blue-300 transition-colors">{appSettings.org_name || 'Not set'}</p>
              </div>
              <div className="group border-l-4 border-emerald-500 pl-4 py-2 hover:bg-emerald-500/10 rounded-r-lg transition-all duration-200">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1.5">Max Classes</p>
                <p className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors">{appSettings.max_classes || 'Not set'}</p>
              </div>
              <div className="group border-l-4 border-purple-500 pl-4 py-2 hover:bg-purple-500/10 rounded-r-lg transition-all duration-200">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1.5">Logo URL</p>
                <p className="text-base font-bold text-white group-hover:text-purple-300 transition-colors truncate">{appSettings.logo_url || 'Not set'}</p>
              </div>
              <div className="group border-l-4 border-orange-500 pl-4 py-2 hover:bg-orange-500/10 rounded-r-lg transition-all duration-200">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1.5">Class Access Codes</p>
                <p className="text-base font-bold text-white group-hover:text-orange-300 transition-colors">{appSettings.class_access_codes ? '✓ Configured' : 'Not set'}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Minister Emails */}
      <div className="bg-slate-900/70 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-700/60 p-6 mb-6">
        <button
          type="button"
          onClick={() => toggleSection("ministerEmails")}
          className="w-full flex items-center justify-between text-left"
          aria-expanded={openSections.ministerEmails}
        >
          <h2 className="text-xl font-bold text-white">Minister Emails</h2>
          <ChevronDown
            className={`w-5 h-5 text-slate-300 transition-transform ${openSections.ministerEmails ? "rotate-180" : ""}`}
          />
        </button>
        {openSections.ministerEmails && (
          <>
            <p className="text-sm text-slate-300 mt-2 mb-5">
              Add one or more emails separated by commas. Quarterly reports will use these addresses.
            </p>
            <div className="flex flex-col gap-4">
              <input
                type="text"
                value={ministerEmails}
                onChange={(e) => setMinisterEmails(e.target.value)}
                placeholder="minister1@example.com, minister2@example.com"
                className="w-full px-4 py-3 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-900/60 text-white"
              />
              <button
                onClick={handleSaveMinisterEmails}
                disabled={loading}
                className="self-start px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:transform-none"
              >
                {loading ? "Saving..." : "Save Emails"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Absence Thresholds */}
      <div className="bg-slate-900/70 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-700/60 p-6 mb-6">
        <button
          type="button"
          onClick={() => toggleSection("absenceThresholds")}
          className="w-full flex items-center justify-between text-left"
          aria-expanded={openSections.absenceThresholds}
        >
          <h2 className="text-xl font-bold text-white">Absence Thresholds</h2>
          <ChevronDown
            className={`w-5 h-5 text-slate-300 transition-transform ${openSections.absenceThresholds ? "rotate-180" : ""}`}
          />
        </button>
        {openSections.absenceThresholds && (
          <div>
            <p className="text-sm text-slate-300 mt-2 mb-6">
              Set the maximum number of absences (absent, sick, travel combined) allowed before flagging in reports.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/20 p-5 rounded-xl border border-blue-500/30">
                <label className="block text-sm font-bold text-slate-100 mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                  Monthly Absence Threshold
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={monthlyAbsenceThreshold}
                    onChange={(e) => setMonthlyAbsenceThreshold(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    max="100"
                    className="w-24 px-4 py-3 border border-blue-500/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-900/60 font-bold text-lg text-center text-white"
                  />
                  <span className="text-sm font-medium text-slate-300">absences per month</span>
                </div>
              </div>
              <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/20 p-5 rounded-xl border border-purple-500/30">
                <label className="block text-sm font-bold text-slate-100 mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                  Quarterly Absence Threshold
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={quarterlyAbsenceThreshold}
                    onChange={(e) => setQuarterlyAbsenceThreshold(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    max="100"
                    className="w-24 px-4 py-3 border border-purple-500/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-slate-900/60 font-bold text-lg text-center text-white"
                  />
                  <span className="text-sm font-medium text-slate-300">absences per quarter</span>
                </div>
              </div>
            </div>
            <button
              onClick={handleSaveAbsenceThresholds}
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:transform-none"
            >
              {loading ? "Saving..." : "Save Thresholds"}
            </button>
          </div>
        )}
      </div>

      {/* Class Leaders Management */}
      <div className="bg-slate-900/70 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-700/60 p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={() => toggleSection("classLeaders")}
            className="flex items-center gap-3 text-left"
            aria-expanded={classLeadersOpen}
          >
            <h2 className="text-xl font-bold text-white">Class Leaders</h2>
            <ChevronDown
              className={`w-5 h-5 text-slate-300 transition-transform ${classLeadersOpen ? "rotate-180" : ""}`}
            />
          </button>
          {classLeadersOpen && editingId === null && (
            <button
              onClick={handleAddLeader}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all transform hover:scale-105 shadow-lg"
            >
              <Plus className="w-4 h-4" />
              Add Leader
            </button>
          )}
        </div>

        {classLeadersOpen && (
          <>

        {/* Add/Edit Form */}
        {editingId !== null && (
          <div className="mb-6 p-6 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-2xl border border-blue-500/30 shadow-inner">
            <h3 className="font-bold text-lg text-white mb-5">
              {editingId === "new" ? "➕ Add New Class Leader" : "✏️ Edit Class Leader"}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={formData.username || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-900/60 text-white"
                  placeholder="Enter username"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={formData.password || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-900/60 text-white"
                  placeholder="Enter password"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.fullName || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-900/60 text-white"
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  Access Code
                </label>
                <input
                  type="text"
                  value={formData.accessCode || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, accessCode: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-900/60 text-white"
                  placeholder="e.g., class1, class2"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  Class Number
                </label>
                <input
                  type="text"
                  value={formData.classNumber || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      classNumber: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-900/60 text-white"
                  placeholder="e.g., 1, 2, 3"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-900/60 text-white"
                  placeholder="Enter email"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSaveLeader}
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:transform-none"
              >
                {loading ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => {
                  setEditingId(null);
                  setFormData({});
                }}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition-all border border-white/20"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Leaders List */}
        <div className={`space-y-3 ${isLeadersScrollable ? "max-h-[360px] overflow-y-auto pr-1" : ""}`}>
          {classLeaders.length === 0 ? (
            <p className="text-slate-400 text-center py-8 bg-slate-900/40 rounded-xl border border-dashed border-slate-700">
              No class leaders added yet
            </p>
          ) : (
            classLeaders.map((leader) => (
              <div
                key={leader.id}
                className="flex items-center justify-between p-5 bg-gradient-to-r from-slate-900/80 to-slate-800/80 rounded-xl border border-slate-700 hover:border-blue-500/40 hover:shadow-lg transition-all duration-200"
              >
                <div className="flex-1">
                  <p className="font-bold text-lg text-white">
                    {leader.fullName || leader.username}
                  </p>
                  <p className="text-sm text-slate-300 mt-1">
                    🏫 Class {leader.classNumber} • {leader.email || "No email"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditLeader(leader)}
                    disabled={editingId !== null}
                    className="p-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 rounded-xl transition-all transform hover:scale-110 disabled:opacity-50 disabled:transform-none shadow-md"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDeleteLeader(leader.id)}
                    disabled={editingId !== null}
                    className="p-3 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-xl transition-all transform hover:scale-110 disabled:opacity-50 disabled:transform-none shadow-md"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
          </>
        )}
      </div>

      {/* Admin Password Change */}
      <div className="bg-slate-900/70 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-700/60 p-6 mb-6">
        <button
          type="button"
          onClick={() => toggleSection("adminPassword")}
          className="w-full flex items-center justify-between text-left"
          aria-expanded={openSections.adminPassword}
        >
          <h2 className="text-xl font-bold text-white">
            🔐 Change Admin Password
          </h2>
          <ChevronDown
            className={`w-5 h-5 text-slate-300 transition-transform ${openSections.adminPassword ? "rotate-180" : ""}`}
          />
        </button>
        {openSections.adminPassword && (
          <div className="space-y-5 mt-5">
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">
                New Password
              </label>
              <input
                type="password"
                value={adminPasswordChange.newPassword}
                onChange={(e) =>
                  setAdminPasswordChange({
                    ...adminPasswordChange,
                    newPassword: e.target.value,
                  })
                }
                className="w-full px-4 py-3 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-900/60 text-white"
                placeholder="Enter new password (min 6 characters)"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={adminPasswordChange.confirmPassword}
                onChange={(e) =>
                  setAdminPasswordChange({
                    ...adminPasswordChange,
                    confirmPassword: e.target.value,
                  })
                }
                className="w-full px-4 py-3 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-900/60 text-white"
                placeholder="Re-enter new password"
              />
            </div>
            <button
              onClick={handleChangeAdminPassword}
              disabled={loading || !adminPasswordChange.newPassword}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:transform-none"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </div>
        )}
      </div>

      {/* Environment & Cache */}
      <div className="bg-slate-900/70 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-700/60 p-6 mb-6">
        <button
          type="button"
          onClick={() => toggleSection("environmentCache")}
          className="w-full flex items-center justify-between text-left"
          aria-expanded={openSections.environmentCache}
        >
          <h2 className="text-xl font-bold text-white">⚙️ Environment & Cache</h2>
          <ChevronDown
            className={`w-5 h-5 text-slate-300 transition-transform ${openSections.environmentCache ? "rotate-180" : ""}`}
          />
        </button>
        {openSections.environmentCache && (
          <>
            <div className="mb-6 mt-5 p-5 bg-gradient-to-br from-slate-800/60 to-slate-900/60 rounded-xl border border-slate-700">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                App Information
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between p-3 bg-slate-900/60 rounded-lg border border-slate-700">
                  <span className="font-semibold text-slate-300">Supabase URL:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${import.meta.env.VITE_SUPABASE_URL ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {import.meta.env.VITE_SUPABASE_URL ? "✓ Configured" : "✗ Not configured"}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-900/60 rounded-lg border border-slate-700">
                  <span className="font-semibold text-slate-300">Service Worker:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${"serviceWorker" in navigator ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {"serviceWorker" in navigator ? "✓ Supported" : "✗ Not supported"}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-900/60 rounded-lg border border-slate-700">
                  <span className="font-semibold text-slate-300">Offline Storage:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${"indexedDB" in window ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {"indexedDB" in window ? "✓ Available" : "✗ Not available"}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={handleClearCache}
              className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white rounded-xl font-semibold transition-all transform hover:scale-105 shadow-lg"
            >
              🗑️ Clear Cache
            </button>
          </>
        )}
      </div>

      {/* Database Connection Status */}
      <div className="bg-slate-900/70 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-700/60 p-6 hover:shadow-2xl transition-all duration-300">
        <button
          type="button"
          onClick={() => toggleSection("databaseConnection")}
          className="w-full flex items-center justify-between text-left"
          aria-expanded={openSections.databaseConnection}
        >
          <h2 className="text-xl font-bold text-white">
            Database Connection
          </h2>
          <ChevronDown
            className={`w-5 h-5 text-slate-300 transition-transform ${openSections.databaseConnection ? "rotate-180" : ""}`}
          />
        </button>
        {openSections.databaseConnection && (
          <div className="flex items-center justify-between mt-5">
            <div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${dbConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <p className="text-sm font-medium text-slate-300">
                  {dbConnected === null
                    ? "Testing..."
                    : dbConnected
                    ? "Connected & Active"
                    : "Disconnected"}
                </p>
              </div>
            </div>
            <button
              onClick={testConnection}
              disabled={loading}
              className={`px-6 py-3 rounded-xl font-semibold transition-all transform hover:scale-105 shadow-lg ${
                dbConnected
                  ? "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                  : "bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white"
              } disabled:opacity-50 disabled:transform-none`}
            >
              {loading ? "Testing..." : "Test Connection"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSettings;
