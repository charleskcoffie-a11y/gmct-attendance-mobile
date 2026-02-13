import React, { useState, useEffect } from "react";
import { saveAttendance, getClassMembers } from "../supabase";
import { Member } from "../types";
import { LogOut, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";

interface EditAttendanceMarkingProps {
  classNumber: number;
  date: string;
  serviceType: 'sunday' | 'bible-study';
  initialMemberStatuses: Array<{ member_id: string; member_name: string; status: string }>;
  onBack: () => void;
  onLogout: () => void;
}

interface MemberWithStatus extends Member {
  attendanceStatus?: "present" | "absent" | "sick" | "travel";
}

const normalizeStatus = (value?: string) =>
  (value || "").toString().trim().toLowerCase();

export const EditAttendanceMarking: React.FC<EditAttendanceMarkingProps> = ({
  classNumber,
  date,
  serviceType,
  initialMemberStatuses,
  onBack,
  onLogout,
}) => {
  const [members, setMembers] = useState<MemberWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

  useEffect(() => {
    loadMembers();
  }, [classNumber]);

  const loadMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const loadedMembers = await getClassMembers(classNumber);
      
      // Apply the initial statuses to the loaded members
      const membersWithStatuses: MemberWithStatus[] = loadedMembers.map((member) => {
        const existingStatus = initialMemberStatuses.find(
          (s) => {
            const idMatch = String(s.member_id) === String(member.id);
            const normalizedStoredName = s.member_name?.toLowerCase().trim().replace(/\s+/g, ' ') || '';
            const normalizedMemberName = member.name?.toLowerCase().trim().replace(/\s+/g, ' ') || '';
            const nameMatch = normalizedStoredName === normalizedMemberName;
            return idMatch || nameMatch;
          }
        );
        
        return {
          ...member,
          attendanceStatus: (normalizeStatus(existingStatus?.status) || "absent") as any,
        };
      });
      
      setMembers(membersWithStatuses);
    } catch (err) {
      setError("Failed to load members: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const updateMemberStatus = (memberId: string, status: string) => {
    setMembers(
      members.map((m) =>
        m.id === memberId
          ? { ...m, attendanceStatus: status as any }
          : m
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await saveAttendance(
        classNumber,
        date,
        serviceType,
        members.map(m => ({
          memberId: m.id!,
          memberName: m.name || '',
          status: normalizeStatus(m.attendanceStatus) || 'absent'
        }))
      );

      setSuccess('✅ Attendance updated successfully!');
      setTimeout(() => {
        onBack();
      }, 1500);
    } catch (err) {
      setError('Failed to save: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const presentCount = members.filter(m => normalizeStatus(m.attendanceStatus) === 'present').length;
  const absentCount = members.filter(m => normalizeStatus(m.attendanceStatus) === 'absent').length;
  const sickCount = members.filter(m => normalizeStatus(m.attendanceStatus) === 'sick').length;
  const travelCount = members.filter(m => normalizeStatus(m.attendanceStatus) === 'travel').length;

  const normalizedSearch = memberSearch.trim().toLowerCase();
  const filteredMembers = members.filter((m) => {
    if (!normalizedSearch) return true;
    const name = m.name?.toLowerCase() || '';
    const phone = (m.phone || '').toLowerCase();
    const memberNumber = (m.member_number || '').toLowerCase();
    return name.includes(normalizedSearch) || phone.includes(normalizedSearch) || memberNumber.includes(normalizedSearch);
  });

  const dateDisplay = new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const serviceLabel = serviceType === 'sunday' ? '🙏 Sunday Service' : '📖 Bible Study';

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading members...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex-1">
            <button onClick={onBack} className="inline-flex items-center gap-2 text-white hover:text-blue-100 transition mb-2">
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <h1 className="text-2xl font-bold">📝 Edit Attendance</h1>
            <p className="text-sm text-blue-100 mt-1">{dateDisplay} • {serviceLabel}</p>
          </div>
          <button onClick={onLogout} className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium transition text-sm backdrop-blur-sm">
            <LogOut className="w-4 h-4 inline mr-2" />
            Logout
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-w-6xl mx-auto">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-700/20 border border-emerald-500/30 rounded-lg p-4">
            <p className="text-emerald-300 text-sm font-medium">Present</p>
            <p className="text-2xl font-bold text-emerald-400">{presentCount}</p>
          </div>
          <div className="bg-gradient-to-br from-red-600/20 to-red-700/20 border border-red-500/30 rounded-lg p-4">
            <p className="text-red-300 text-sm font-medium">Absent</p>
            <p className="text-2xl font-bold text-red-400">{absentCount}</p>
          </div>
          <div className="bg-gradient-to-br from-orange-600/20 to-orange-700/20 border border-orange-500/30 rounded-lg p-4">
            <p className="text-orange-300 text-sm font-medium">Sick</p>
            <p className="text-2xl font-bold text-orange-400">{sickCount}</p>
          </div>
          <div className="bg-gradient-to-br from-purple-600/20 to-purple-700/20 border border-purple-500/30 rounded-lg p-4">
            <p className="text-purple-300 text-sm font-medium">Travel</p>
            <p className="text-2xl font-bold text-purple-400">{travelCount}</p>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-900/30 border border-red-500/50 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-900/30 border border-green-500/50 rounded-lg flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-green-300">{success}</p>
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search by name, phone, or member number..."
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 text-white placeholder-slate-400 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Members List */}
        <div className="space-y-3">
          {filteredMembers.map((member) => (
            <div key={member.id} className="bg-slate-700/40 border border-slate-600 rounded-lg p-4 hover:bg-slate-700/60 transition">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-white">{member.name}</h4>
                  {(member.phone || member.phoneNumber) && (
                    <p className="text-sm text-slate-400">{member.phone || member.phoneNumber}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => updateMemberStatus(member.id!, 'present')}
                  className={`py-2 px-2 rounded-lg font-medium text-sm transition border ${
                    normalizeStatus(member.attendanceStatus) === 'present'
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-slate-700 text-slate-300 hover:bg-green-600/30 hover:text-green-300 border border-slate-600'
                  }`}
                >
                  {normalizeStatus(member.attendanceStatus) === 'present' ? '✓' : 'Present'}
                </button>
                <button
                  onClick={() => updateMemberStatus(member.id!, 'absent')}
                  className={`py-2 px-2 rounded-lg font-medium text-sm transition border ${
                    normalizeStatus(member.attendanceStatus) === 'absent'
                      ? 'bg-red-600 text-white border-red-500'
                      : 'bg-slate-700 text-slate-300 hover:bg-red-600/30 hover:text-red-300 border border-slate-600'
                  }`}
                >
                  {normalizeStatus(member.attendanceStatus) === 'absent' ? '✗' : 'Absent'}
                </button>
                <button
                  onClick={() => updateMemberStatus(member.id!, 'sick')}
                  className={`py-2 px-2 rounded-lg font-medium text-sm transition border ${
                    normalizeStatus(member.attendanceStatus) === 'sick'
                      ? 'bg-orange-600 text-white border-orange-500'
                      : 'bg-slate-700 text-slate-300 hover:bg-orange-600/30 hover:text-orange-300 border border-slate-600'
                  }`}
                >
                  {normalizeStatus(member.attendanceStatus) === 'sick' ? '🤒' : 'Sick'}
                </button>
                <button
                  onClick={() => updateMemberStatus(member.id!, 'travel')}
                  className={`py-2 px-2 rounded-lg font-medium text-sm transition border ${
                    normalizeStatus(member.attendanceStatus) === 'travel'
                      ? 'bg-purple-600 text-white border-purple-500'
                      : 'bg-slate-700 text-slate-300 hover:bg-purple-600/30 hover:text-purple-300 border border-slate-600'
                  }`}
                >
                  {normalizeStatus(member.attendanceStatus) === 'travel' ? '✈️' : 'Travel'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 to-slate-900/80 border-t border-slate-700 p-4">
          <div className="max-w-6xl mx-auto flex gap-3">
            <button
              onClick={onBack}
              className="flex-1 py-3 px-4 bg-slate-700 text-white rounded-lg font-semibold hover:bg-slate-600 transition border border-slate-600"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed border border-blue-500"
            >
              {saving ? 'Saving...' : '💾 Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditAttendanceMarking;
