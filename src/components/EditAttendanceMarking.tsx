import React, { useState, useEffect } from "react";
import { saveAttendance, getClassMembers } from "../supabase";
import { Member } from "../types";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { MemberAttendanceRow } from "./MemberAttendanceRow";

interface EditAttendanceMarkingProps {
  classNumber: number;
  date: string;
  serviceType: 'sunday' | 'bible-study';
  initialMemberStatuses: Array<{ member_id: string; member_name: string; status: string }>;
  onBack: () => void;
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
    day: 'numeric'
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
      {/* Success Overlay */}
      {success && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-emerald-600/95 border-2 border-emerald-400 rounded-2xl p-8 text-center max-w-md mx-4 shadow-2xl animate-bounce">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-3xl font-bold text-white mb-2">Success!</h2>
            <p className="text-emerald-100 text-lg mb-4">{success}</p>
            <p className="text-emerald-200 text-sm">Returning to records...</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-2.5">
          <div className="flex items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-2">
              <button onClick={onBack} className="inline-flex items-center gap-1 text-white hover:text-blue-100 transition text-sm">
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <span className="text-blue-300">|</span>
              <h1 className="text-lg font-bold">📝 Edit Attendance</h1>
            </div>
            <div className="bg-blue-500/30 px-2 py-0.5 rounded text-xs font-medium">
              Class {classNumber}
            </div>
          </div>
          <p className="text-xs text-blue-100">{dateDisplay} • {serviceLabel}</p>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-w-6xl mx-auto pb-32">
        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-700/20 border border-emerald-500/30 rounded-lg p-2.5">
            <p className="text-emerald-300 text-xs font-medium">Present</p>
            <p className="text-xl font-bold text-emerald-400">{presentCount}</p>
          </div>
          <div className="bg-gradient-to-br from-red-600/20 to-red-700/20 border border-red-500/30 rounded-lg p-2.5">
            <p className="text-red-300 text-xs font-medium">Absent</p>
            <p className="text-xl font-bold text-red-400">{absentCount}</p>
          </div>
          <div className="bg-gradient-to-br from-orange-600/20 to-orange-700/20 border border-orange-500/30 rounded-lg p-2.5">
            <p className="text-orange-300 text-xs font-medium">Sick</p>
            <p className="text-xl font-bold text-orange-400">{sickCount}</p>
          </div>
          <div className="bg-gradient-to-br from-purple-600/20 to-purple-700/20 border border-purple-500/30 rounded-lg p-2.5">
            <p className="text-purple-300 text-xs font-medium">Travel</p>
            <p className="text-xl font-bold text-purple-400">{travelCount}</p>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-900/30 border border-red-500/50 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-300">{error}</p>
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
            <MemberAttendanceRow
              key={member.id}
              id={member.id!}
              name={member.name}
              phone={member.phone}
              phoneNumber={member.phoneNumber}
              attendanceStatus={member.attendanceStatus}
              onStatusChange={updateMemberStatus}
              onEdit={() => {}}
              showDeleteButton={false}
            />
          ))}
        </div>

        {/* Action Buttons */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-slate-900 to-slate-900/80 border-t border-slate-700 p-4">
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
