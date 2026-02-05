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
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Settings</h1>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-900 rounded-lg font-medium transition"
        >
          Back
        </button>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-green-800">{success}</p>
        </div>
      )}

      {/* Database Connection Status */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Database Connection
            </h2>
            <p className="text-sm text-gray-600">
              Status:{" "}
              {dbConnected === null
                ? "Testing..."
                : dbConnected
                ? "Connected "
                : "Disconnected "}
            </p>
          </div>
          <button
            onClick={testConnection}
            disabled={loading}
            className={`px-6 py-2 rounded-lg font-medium transition ${
              dbConnected
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-red-600 hover:bg-red-700 text-white"
            } disabled:opacity-50`}
          >
            {loading ? "Testing..." : "Test Connection"}
          </button>
        </div>
      </div>

      {/* App Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-600 mb-2">Total Members</p>
            <p className="text-3xl font-bold text-blue-600">
              {stats.memberCount}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-600 mb-2">Active Classes</p>
            <p className="text-3xl font-bold text-green-600">
              {stats.classCount}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-600 mb-2">Recent Attendance (7 days)</p>
            <p className="text-3xl font-bold text-purple-600">
              {stats.recentAttendance}
            </p>
          </div>
        </div>
      )}

      {/* App Settings from Database */}
      {appSettings && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">App Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Organization Name</p>
              <p className="text-base font-medium text-gray-900">{appSettings.org_name || 'Not set'}</p>
            </div>
            <div className="border-l-4 border-green-500 pl-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Max Classes</p>
              <p className="text-base font-medium text-gray-900">{appSettings.max_classes || 'Not set'}</p>
            </div>
            <div className="border-l-4 border-purple-500 pl-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Logo URL</p>
              <p className="text-base font-medium text-gray-900 truncate">{appSettings.logo_url || 'Not set'}</p>
            </div>
            <div className="border-l-4 border-orange-500 pl-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Class Access Codes</p>
              <p className="text-base font-medium text-gray-900">{appSettings.class_access_codes ? 'Configured' : 'Not set'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Minister Emails */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Minister Emails</h2>
        <p className="text-sm text-gray-600 mb-4">
          Add one or more emails separated by commas. Quarterly reports will use these addresses.
        </p>
        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={ministerEmails}
            onChange={(e) => setMinisterEmails(e.target.value)}
            placeholder="minister1@example.com, minister2@example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSaveMinisterEmails}
            disabled={loading}
            className="self-start px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save Emails"}
          </button>
        </div>
      </div>

      {/* Absence Thresholds */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Absence Thresholds</h2>
        <p className="text-sm text-gray-600 mb-6">
          Set the maximum number of absences (absent, sick, travel combined) allowed before flagging in reports.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Monthly Absence Threshold
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={monthlyAbsenceThreshold}
                onChange={(e) => setMonthlyAbsenceThreshold(Math.max(1, parseInt(e.target.value) || 1))}
                min="1"
                max="100"
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">absences per month</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quarterly Absence Threshold
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={quarterlyAbsenceThreshold}
                onChange={(e) => setQuarterlyAbsenceThreshold(Math.max(1, parseInt(e.target.value) || 1))}
                min="1"
                max="100"
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">absences per quarter</span>
            </div>
          </div>
        </div>
        <button
          onClick={handleSaveAbsenceThresholds}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save Thresholds"}
        </button>
      </div>

      {/* Class Leaders Management */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Class Leaders</h2>
          {editingId === null && (
            <button
              onClick={handleAddLeader}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
            >
              <Plus className="w-4 h-4" />
              Add Leader
            </button>
          )}
        </div>

        {/* Add/Edit Form */}
        {editingId !== null && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border-2 border-blue-200">
            <h3 className="font-semibold text-gray-900 mb-4">
              {editingId === "new" ? "Add New Class Leader" : "Edit Class Leader"}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={formData.username || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={formData.password || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.fullName || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Access Code
                </label>
                <input
                  type="text"
                  value={formData.accessCode || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, accessCode: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., class1, class2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 1, 2, 3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter email"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSaveLeader}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => {
                  setEditingId(null);
                  setFormData({});
                }}
                className="px-6 py-2 bg-gray-300 hover:bg-gray-400 text-gray-900 rounded-lg font-medium transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Leaders List */}
        <div className="space-y-3">
          {classLeaders.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              No class leaders added yet
            </p>
          ) : (
            classLeaders.map((leader) => (
              <div
                key={leader.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">
                    {leader.fullName || leader.username}
                  </p>
                  <p className="text-sm text-gray-600">
                    Class {leader.classNumber}  {leader.email || "No email"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditLeader(leader)}
                    disabled={editingId !== null}
                    className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition disabled:opacity-50"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteLeader(leader.id)}
                    disabled={editingId !== null}
                    className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Admin Password Change */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Change Admin Password
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter new password (min 6 characters)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Re-enter new password"
            />
          </div>
          <button
            onClick={handleChangeAdminPassword}
            disabled={loading || !adminPasswordChange.newPassword}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50"
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </div>
      </div>

      {/* Environment & Cache */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Environment & Cache
        </h2>
        <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="font-medium text-gray-900 mb-3">App Information</h3>
          <div className="space-y-2 text-sm text-gray-700">
            <p>
              <span className="font-semibold">Supabase URL:</span>{" "}
              {import.meta.env.VITE_SUPABASE_URL ? " Configured" : " Not configured"}
            </p>
            <p>
              <span className="font-semibold">Service Worker:</span>{" "}
              {"serviceWorker" in navigator ? " Supported" : " Not supported"}
            </p>
            <p>
              <span className="font-semibold">Offline Storage:</span>{" "}
              {"indexedDB" in window ? " Available" : " Not available"}
            </p>
          </div>
        </div>
        <button
          onClick={handleClearCache}
          className="px-6 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition"
        >
          Clear Cache
        </button>
      </div>
    </div>
  );
};

export default AdminSettings;
