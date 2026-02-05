import React, { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { ClassLeader } from "../types";
import { AlertCircle, CheckCircle, Trash2, Edit2, Plus } from "lucide-react";

interface AdminSettingsProps {
  onBack: () => void;
}

interface AppStats {
  memberCount: number;
  classCount: number;
  recentAttendance: number;
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
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    setError(null);
    await Promise.all([testConnection(), loadStats(), loadClassLeaders(), loadAppSettings()]);
    setLoading(false);
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
      let recentCount = 0;

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

      // Get recent attendance count (last 7 days)
      try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const dateStr = sevenDaysAgo.toISOString().split('T')[0];

        const { count, error } = await supabase
          .from("attendance")
          .select("*", { count: "exact", head: true })
          .gte("attendance_date", dateStr);

        if (!error && count !== null) {
          recentCount = count;
        }
      } catch (err) {
        console.error("Error loading attendance count:", err);
      }

      setStats({
        memberCount,
        classCount,
        recentAttendance: recentCount,
      });
    } catch (err) {
      console.error("Error loading stats:", err);
      // Don't set error here, just log it - show partial stats instead
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 md:p-8">
      {/* Header with gradient */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Admin Settings
          </h1>
          <p className="text-sm text-gray-600 mt-1">Manage your attendance system configuration</p>
        </div>
        <button
          onClick={onBack}
          className="px-6 py-3 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-medium transition-all shadow-md hover:shadow-lg border border-gray-200"
        >
          Back
        </button>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="mb-6 p-4 bg-gradient-to-r from-red-50 to-red-100 border-l-4 border-red-500 rounded-xl shadow-lg animate-pulse flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-900 font-medium">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-100 border-l-4 border-green-500 rounded-xl shadow-lg flex items-start gap-3">
          <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-green-900 font-medium">{success}</p>
        </div>
      )}

      {/* Database Connection Status */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-6 mb-6 hover:shadow-2xl transition-all duration-300">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">
              Database Connection
            </h2>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${dbConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <p className="text-sm font-medium text-gray-700">
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
      </div>

      {/* App Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
          <div className="relative overflow-hidden bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-all duration-300">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full"></div>
            <p className="text-sm font-medium text-purple-100 mb-2 relative z-10">Recent Attendance</p>
            <p className="text-4xl font-black relative z-10">
              {stats.recentAttendance}
            </p>
            <p className="text-xs text-purple-200 mt-1 relative z-10">Last 7 days</p>
          </div>
        </div>
      )}

      {/* App Settings from Database */}
      {appSettings && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-6 mb-6">
          <h2 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-6">App Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="group border-l-4 border-blue-500 pl-4 py-2 hover:bg-blue-50/50 rounded-r-lg transition-all duration-200">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1.5">Organization Name</p>
              <p className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{appSettings.org_name || 'Not set'}</p>
            </div>
            <div className="group border-l-4 border-emerald-500 pl-4 py-2 hover:bg-emerald-50/50 rounded-r-lg transition-all duration-200">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1.5">Max Classes</p>
              <p className="text-base font-bold text-gray-900 group-hover:text-emerald-600 transition-colors">{appSettings.max_classes || 'Not set'}</p>
            </div>
            <div className="group border-l-4 border-purple-500 pl-4 py-2 hover:bg-purple-50/50 rounded-r-lg transition-all duration-200">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1.5">Logo URL</p>
              <p className="text-base font-bold text-gray-900 group-hover:text-purple-600 transition-colors truncate">{appSettings.logo_url || 'Not set'}</p>
            </div>
            <div className="group border-l-4 border-orange-500 pl-4 py-2 hover:bg-orange-50/50 rounded-r-lg transition-all duration-200">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1.5">Class Access Codes</p>
              <p className="text-base font-bold text-gray-900 group-hover:text-orange-600 transition-colors">{appSettings.class_access_codes ? '✓ Configured' : 'Not set'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Minister Emails */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-6 mb-6">
        <h2 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">Minister Emails</h2>
        <p className="text-sm text-gray-600 mb-5">
          Add one or more emails separated by commas. Quarterly reports will use these addresses.
        </p>
        <div className="flex flex-col gap-4">
          <input
            type="text"
            value={ministerEmails}
            onChange={(e) => setMinisterEmails(e.target.value)}
            placeholder="minister1@example.com, minister2@example.com"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white/50"
          />
          <button
            onClick={handleSaveMinisterEmails}
            disabled={loading}
            className="self-start px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:transform-none"
          >
            {loading ? "Saving..." : "Save Emails"}
          </button>
        </div>
      </div>

      {/* Absence Thresholds */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-6 mb-6">
        <h2 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">Absence Thresholds</h2>
        <p className="text-sm text-gray-600 mb-6">
          Set the maximum number of absences (absent, sick, travel combined) allowed before flagging in reports.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-xl border border-blue-200">
            <label className="block text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-600"></div>
              Monthly Absence Threshold
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={monthlyAbsenceThreshold}
                onChange={(e) => setMonthlyAbsenceThreshold(Math.max(1, parseInt(e.target.value) || 1))}
                min="1"
                max="100"
                className="w-24 px-4 py-3 border-2 border-blue-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white font-bold text-lg text-center"
              />
              <span className="text-sm font-medium text-gray-700">absences per month</span>
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-5 rounded-xl border border-purple-200">
            <label className="block text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-600"></div>
              Quarterly Absence Threshold
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={quarterlyAbsenceThreshold}
                onChange={(e) => setQuarterlyAbsenceThreshold(Math.max(1, parseInt(e.target.value) || 1))}
                min="1"
                max="100"
                className="w-24 px-4 py-3 border-2 border-purple-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white font-bold text-lg text-center"
              />
              <span className="text-sm font-medium text-gray-700">absences per quarter</span>
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

      {/* Class Leaders Management */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Class Leaders</h2>
          {editingId === null && (
            <button
              onClick={handleAddLeader}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all transform hover:scale-105 shadow-lg"
            >
              <Plus className="w-4 h-4" />
              Add Leader
            </button>
          )}
        </div>

        {/* Add/Edit Form */}
        {editingId !== null && (
          <div className="mb-6 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-300 shadow-inner">
            <h3 className="font-bold text-lg text-gray-900 mb-5">
              {editingId === "new" ? "➕ Add New Class Leader" : "✏️ Edit Class Leader"}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={formData.username || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                  placeholder="Enter username"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={formData.password || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                  placeholder="Enter password"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.fullName || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Access Code
                </label>
                <input
                  type="text"
                  value={formData.accessCode || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, accessCode: e.target.value })
                  }
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                  placeholder="e.g., class1, class2"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
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
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                  placeholder="e.g., 1, 2, 3"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
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
                className="px-6 py-3 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-semibold transition-all border-2 border-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Leaders List */}
        <div className="space-y-3">
          {classLeaders.length === 0 ? (
            <p className="text-gray-500 text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
              No class leaders added yet
            </p>
          ) : (
            classLeaders.map((leader) => (
              <div
                key={leader.id}
                className="flex items-center justify-between p-5 bg-gradient-to-r from-white to-gray-50 rounded-xl border-2 border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200"
              >
                <div className="flex-1">
                  <p className="font-bold text-lg text-gray-900">
                    {leader.fullName || leader.username}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    🏫 Class {leader.classNumber} • {leader.email || "No email"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditLeader(leader)}
                    disabled={editingId !== null}
                    className="p-3 bg-gradient-to-br from-blue-100 to-blue-200 hover:from-blue-200 hover:to-blue-300 text-blue-700 rounded-xl transition-all transform hover:scale-110 disabled:opacity-50 disabled:transform-none shadow-md"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDeleteLeader(leader.id)}
                    disabled={editingId !== null}
                    className="p-3 bg-gradient-to-br from-red-100 to-red-200 hover:from-red-200 hover:to-red-300 text-red-700 rounded-xl transition-all transform hover:scale-110 disabled:opacity-50 disabled:transform-none shadow-md"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Admin Password Change */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-6 mb-6">
        <h2 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-5">
          🔐 Change Admin Password
        </h2>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
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
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
              placeholder="Enter new password (min 6 characters)"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
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
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
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
      </div>

      {/* Environment & Cache */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-6">
        <h2 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-5">
          ⚙️ Environment & Cache
        </h2>
        <div className="mb-6 p-5 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gray-600"></div>
            App Information
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between p-3 bg-white rounded-lg">
              <span className="font-semibold text-gray-700">Supabase URL:</span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${import.meta.env.VITE_SUPABASE_URL ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {import.meta.env.VITE_SUPABASE_URL ? "✓ Configured" : "✗ Not configured"}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-white rounded-lg">
              <span className="font-semibold text-gray-700">Service Worker:</span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${"serviceWorker" in navigator ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {"serviceWorker" in navigator ? "✓ Supported" : "✗ Not supported"}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-white rounded-lg">
              <span className="font-semibold text-gray-700">Offline Storage:</span>
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
      </div>
    </div>
  );
};

export default AdminSettings;
