import React, { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { ClassLeader } from "../types";
import { AlertCircle, CheckCircle, Save, Lock, Mail, Phone, User, Key } from "lucide-react";

interface ClassLeaderProfileProps {
  classNumber: number;
}

export const ClassLeaderProfile: React.FC<ClassLeaderProfileProps> = ({
  classNumber,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<ClassLeader>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  useEffect(() => {
    loadClassLeaderProfile();
  }, [classNumber]);

  const loadClassLeaderProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from("class_leaders")
        .select("*")
        .eq("class_number", classNumber)
        .limit(1)
        .single();

      if (dbError) {
        setError("Failed to load profile information");
        console.error("Error loading profile:", dbError);
      } else if (data) {
        setFormData({
          id: data.id,
          username: data.username,
          fullName: data.full_name,
          email: data.email,
          phone: data.phone,
          classNumber: data.class_number,
        });
        setHasChanges(false);
      }
    } catch (err) {
      setError(
        "Connection error: " + (err instanceof Error ? err.message : "Unknown error")
      );
      console.error("Profile load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!formData.fullName) {
      setError("Full name is required");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { error: dbError } = await supabase
        .from("class_leaders")
        .update({
          full_name: formData.fullName,
          email: formData.email,
          phone: formData.phone,
        })
        .eq("id", formData.id);

      if (dbError) throw dbError;

      setSuccess("Profile updated successfully");
      localStorage.setItem("classLeaderName", formData.fullName);
      setHasChanges(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(
        "Failed to update profile: " +
          (err instanceof Error ? err.message : "Unknown error")
      );
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (
      !passwordData.currentPassword ||
      !passwordData.newPassword ||
      !passwordData.confirmPassword
    ) {
      setError("All password fields are required");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError("New password must be at least 6 characters");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { error: dbError } = await supabase
        .from("class_leaders")
        .update({
          password: passwordData.newPassword,
        })
        .eq("id", formData.id);

      if (dbError) throw dbError;

      setSuccess("Password changed successfully");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setShowPasswordForm(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(
        "Failed to change password: " +
          (err instanceof Error ? err.message : "Unknown error")
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-4 md:p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
          <p className="mt-4 text-slate-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-4 md:p-8 pb-24">
      {/* Header with Avatar */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-2xl border-2 border-blue-400/50">
            <User className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">
              {formData.fullName || "Class Leader"}
            </h1>
            <p className="text-slate-400 text-sm mt-1">Class {formData.classNumber}</p>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border-l-4 border-red-500 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-300">Error</p>
            <p className="text-sm text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Success Alert */}
      {success && (
        <div className="mb-6 p-4 bg-emerald-900/20 border-l-4 border-emerald-500 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top">
          <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-emerald-300">Success</p>
            <p className="text-sm text-emerald-400">{success}</p>
          </div>
        </div>
      )}

      {/* Profile Information Card */}
      <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl shadow-lg border border-slate-700 p-6 md:p-8 mb-6 hover:shadow-xl transition-shadow">
        <h2 className="text-xl md:text-2xl font-bold text-white mb-8 flex items-center gap-3">
          <User className="w-6 h-6 text-blue-400" />
          Personal Information
        </h2>

        <div className="space-y-6">
          {/* Class Number & Username - Read Only Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-3">
                Class Number
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-500 pointer-events-none" />
                <input
                  type="number"
                  value={formData.classNumber || ""}
                  disabled
                  className="w-full pl-12 pr-4 py-3 border-2 border-slate-600 rounded-xl bg-slate-700/50 text-slate-400 cursor-not-allowed transition-all"
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">System assigned</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-3">
                Username
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={formData.username || ""}
                  disabled
                  className="w-full pl-12 pr-4 py-3 border-2 border-slate-600 rounded-xl bg-slate-700/50 text-slate-400 cursor-not-allowed transition-all"
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">Cannot be changed</p>
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-3">
              Full Name
            </label>
            <div className="relative group">
              <User className="absolute left-4 top-3.5 w-5 h-5 text-blue-400 pointer-events-none transition-colors group-focus-within:text-blue-300" />
              <input
                type="text"
                value={formData.fullName || ""}
                onChange={(e) => {
                  setFormData({ ...formData, fullName: e.target.value });
                  setHasChanges(true);
                }}
                className="w-full pl-12 pr-4 py-3 border-2 border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-700/50 hover:border-slate-500 text-white placeholder-slate-500"
                placeholder="Enter your full name"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-3">
              Email Address
            </label>
            <div className="relative group">
              <Mail className="absolute left-4 top-3.5 w-5 h-5 text-blue-400 pointer-events-none transition-colors group-focus-within:text-blue-300" />
              <input
                type="email"
                value={formData.email || ""}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  setHasChanges(true);
                }}
                className="w-full pl-12 pr-4 py-3 border-2 border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-700/50 hover:border-slate-500 text-white placeholder-slate-500"
                placeholder="your.email@example.com"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-3">
              Phone Number
            </label>
            <div className="relative group">
              <Phone className="absolute left-4 top-3.5 w-5 h-5 text-blue-400 pointer-events-none transition-colors group-focus-within:text-blue-300" />
              <input
                type="tel"
                value={formData.phone || ""}
                onChange={(e) => {
                  setFormData({ ...formData, phone: e.target.value });
                  setHasChanges(true);
                }}
                className="w-full pl-12 pr-4 py-3 border-2 border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-700/50 hover:border-slate-500 text-white placeholder-slate-500"
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleSaveProfile}
          disabled={saving || !hasChanges}
          className="mt-8 w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-600 disabled:to-slate-600 text-white rounded-xl font-semibold transition-all transform hover:scale-105 disabled:scale-100 shadow-lg disabled:shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Save className="w-5 h-5" />
          {saving ? "Saving..." : hasChanges ? "Save Changes" : "No Changes"}
        </button>
      </div>

      {/* Security Card */}
      <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl shadow-lg border border-slate-700 p-6 md:p-8 hover:shadow-xl transition-shadow">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-3">
            <Key className="w-6 h-6 text-blue-400" />
            Security
          </h2>
          {!showPasswordForm && (
            <button
              onClick={() => setShowPasswordForm(true)}
              className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded-lg font-medium transition-all text-sm transform hover:scale-105 border border-blue-500/30"
            >
              Change Password
            </button>
          )}
        </div>

        {showPasswordForm && (
          <div className="bg-slate-700/50 rounded-2xl p-6 border-2 border-slate-600 animate-in fade-in">
            <h3 className="font-bold text-lg text-white mb-6">
              Update Your Password
            </h3>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-3">
                  Current Password
                </label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      currentPassword: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 border-2 border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-700/50 hover:border-slate-500 text-white placeholder-slate-500"
                  placeholder="Enter your current password"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-3">
                  New Password
                </label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      newPassword: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 border-2 border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-700/50 hover:border-slate-500 text-white placeholder-slate-500"
                  placeholder="Enter new password (min 6 characters)"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-3">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      confirmPassword: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 border-2 border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-700/50 hover:border-slate-500 text-white placeholder-slate-500"
                  placeholder="Confirm your new password"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-7">
              <button
                onClick={handleChangePassword}
                disabled={saving}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-600 disabled:to-slate-600 text-white rounded-xl font-semibold transition-all transform hover:scale-105 disabled:scale-100 shadow-lg"
              >
                {saving ? "Updating..." : "Update Password"}
              </button>
              <button
                onClick={() => {
                  setShowPasswordForm(false);
                  setPasswordData({
                    currentPassword: "",
                    newPassword: "",
                    confirmPassword: "",
                  });
                  setError(null);
                }}
                disabled={saving}
                className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700 text-slate-300 rounded-xl font-semibold transition-all transform hover:scale-105 disabled:scale-100 border border-slate-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClassLeaderProfile;
