import React, { useState, useEffect } from "react";
import { getClassMembers, saveMember, deleteMember, saveAttendance, getAttendanceByDateAndService } from "../supabase";
import { Member, ServiceType } from "../types";
import { Calendar, Plus, Edit2, Trash2, Wifi, WifiOff, CheckCircle, AlertCircle } from "lucide-react";

interface AttendanceMarkingProps {
  classNumber: number;
  onLogout: () => void;
}

interface MemberWithStatus extends Member {
  attendanceStatus?: "present" | "absent" | "sick" | "travel";
}

interface EditingMember {
  id?: string;
  name: string;
  phoneNumber?: string;
}

export const AttendanceMarking: React.FC<AttendanceMarkingProps> = ({
  classNumber,
  onLogout,
}) => {
  const [serviceType, setServiceType] = useState<ServiceType>("sunday");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [members, setMembers] = useState<MemberWithStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [editingMember, setEditingMember] = useState<EditingMember | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberFormData, setMemberFormData] = useState<EditingMember>({
    name: "",
  });
  const [existingAttendance, setExistingAttendance] = useState<any>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  useEffect(() => {
    loadMembers();
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [classNumber]);

  // Load attendance for the selected date and service type
  useEffect(() => {
    loadAttendanceRecord();
  }, [selectedDate, serviceType]);

  const loadMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const loadedMembers = await getClassMembers(classNumber);
      const membersWithStatus: MemberWithStatus[] = (loadedMembers as Member[]).map((m) => ({
        ...m,
        attendanceStatus: "absent" as const,
      }));
      setMembers(membersWithStatus);
    } catch (err) {
      setError(
        "Failed to load members: " +
          (err instanceof Error ? err.message : "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  };

  const loadAttendanceRecord = async () => {
    setAttendanceLoading(true);
    try {
      const record = await getAttendanceByDateAndService(classNumber, selectedDate, serviceType);
      setExistingAttendance(record);
      
      if (record) {
        // Update member statuses based on existing attendance
        setMembers(members =>
          members.map(m => ({
            ...m,
            attendanceStatus: "absent" as const, // Default to absent since we don't track individual statuses
          }))
        );
      }
    } catch (err) {
      console.error('Error loading attendance:', err);
    } finally {
      setAttendanceLoading(false);
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

  const handleAddMember = () => {
    setEditingMember(null);
    setMemberFormData({ name: "" });
    setShowMemberForm(true);
  };

  const handleEditMember = (member: MemberWithStatus) => {
    setEditingMember({
      id: member.id?.toString(),
      name: member.name,
      phoneNumber: member.phone || member.phoneNumber
    });
    setMemberFormData({
      id: member.id?.toString(),
      name: member.name,
      phoneNumber: member.phone || member.phoneNumber
    });
    setShowMemberForm(true);
  };

  const handleSaveMember = async () => {
    if (!memberFormData.name.trim()) {
      setError("Member name is required");
      return;
    }

    setLoading(true);
    try {
      const newMember: Member = {
        id: editingMember?.id || "",
        name: memberFormData.name,
        class_number: classNumber.toString(),
        phoneNumber: memberFormData.phoneNumber,
      };

      await saveMember(newMember);
      setSuccess(
        editingMember ? "Member updated successfully" : "Member added successfully"
      );
      setShowMemberForm(false);
      setMemberFormData({ name: "" });
      await loadMembers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(
        "Failed to save member: " +
          (err instanceof Error ? err.message : "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this member?")) return;

    setLoading(true);
    try {
      await deleteMember(id);
      setSuccess("Member deleted successfully");
      await loadMembers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(
        "Failed to delete member: " +
          (err instanceof Error ? err.message : "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAttendance = async () => {
    if (members.length === 0) {
      setError("No members to submit");
      return;
    }

    setLoading(true);
    try {
      const memberRecords = members
        .filter((m) => m.attendanceStatus)
        .map((m) => ({
          memberId: m.id?.toString() || "",
          status: m.attendanceStatus || "absent",
        }));

      if (memberRecords.length === 0) {
        setError("Mark at least one member's attendance");
        setLoading(false);
        return;
      }

      await saveAttendance(
        classNumber,
        selectedDate,
        serviceType,
        memberRecords,
        `Class ${classNumber} Leader`
      );

      setSuccess(
        `Attendance submitted for ${memberRecords.length} members on ${selectedDate}`
      );
      // Reset statuses after successful submission
      setMembers(
        members.map((m) => ({ ...m, attendanceStatus: "absent" as const }))
      );
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

  const presentCount = members.filter(
    (m) => m.attendanceStatus === "present"
  ).length;
  const absentCount = members.filter(
    (m) => m.attendanceStatus === "absent"
  ).length;
  const sickCount = members.filter(
    (m) => m.attendanceStatus === "sick"
  ).length;
  const travelCount = members.filter(
    (m) => m.attendanceStatus === "travel"
  ).length;

  const normalizedSearch = memberSearch.trim().toLowerCase();
  const sortedMembers = [...members].sort((a, b) => {
    const classA = a.class_number || (a.assignedClass ? String(a.assignedClass) : "");
    const classB = b.class_number || (b.assignedClass ? String(b.assignedClass) : "");
    if (classA !== classB) return classA.localeCompare(classB, undefined, { numeric: true });
    return (a.name || "").localeCompare(b.name || "");
  });

  const filteredMembers = sortedMembers.filter((m) => {
    if (!normalizedSearch) {
      return true;
    }

    const name = m.name?.toLowerCase() || "";
    const phone = (m.phone || m.phoneNumber || "").toLowerCase();
    const memberNumber = (m.member_number || "").toLowerCase();
    return (
      name.includes(normalizedSearch) ||
      phone.includes(normalizedSearch) ||
      memberNumber.includes(normalizedSearch)
    );
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 sticky top-0 z-20 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold">Class {classNumber}</h1>
            <p className="text-blue-100">Attendance Marking</p>
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

        {/* Existing Attendance Status */}
        {existingAttendance && !attendanceLoading && (
          <div className="p-3 bg-blue-50 border border-blue-300 rounded-lg text-blue-800 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <div>
              <strong>Attendance Already Marked</strong> for {selectedDate} ({serviceType === 'sunday' ? 'Sunday Service' : 'Bible Study'})
              <br />
              Present: {existingAttendance.total_members_present}, Absent: {existingAttendance.total_members_absent}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
          <div className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-blue-500">
            <p className="text-xs text-gray-600">Total</p>
            <p className="text-2xl font-bold text-blue-600">{members.length}</p>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-green-500">
            <p className="text-xs text-gray-600">Present</p>
            <p className="text-2xl font-bold text-green-600">{presentCount}</p>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-red-500">
            <p className="text-xs text-gray-600">Absent</p>
            <p className="text-2xl font-bold text-red-600">{absentCount}</p>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-orange-500">
            <p className="text-xs text-gray-600">Sick</p>
            <p className="text-2xl font-bold text-orange-600">{sickCount}</p>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-purple-500">
            <p className="text-xs text-gray-600">Travel</p>
            <p className="text-2xl font-bold text-purple-600">{travelCount}</p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            placeholder="Search by name, phone, or member number"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Member Editor Modal */}
        {showMemberForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-30 p-4">
            <div className="bg-white rounded-lg max-w-sm w-full shadow-xl">
              <div className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  {editingMember ? "Edit Member" : "Add New Member"}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={memberFormData.name}
                      onChange={(e) =>
                        setMemberFormData({ ...memberFormData, name: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Member name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={memberFormData.phoneNumber || ""}
                      onChange={(e) =>
                        setMemberFormData({
                          ...memberFormData,
                          phoneNumber: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Phone number"
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleSaveMember}
                      disabled={loading}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50"
                    >
                      {loading ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => {
                        setShowMemberForm(false);
                        setMemberFormData({ name: "" });
                        setEditingMember(null);
                      }}
                      className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-900 rounded-lg font-medium transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Members List */}
        {loading && members.length === 0 ? (
          <div className="text-center py-8 text-gray-600">Loading members...</div>
        ) : filteredMembers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">
              {members.length === 0 ? "No members in this class yet" : "No members match your search"}
            </p>
            <button
              onClick={handleAddMember}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
            >
              <Plus className="w-5 h-5" />
              Add First Member
            </button>
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {filteredMembers.map((member) => (
              <div
                key={member.id}
                className="bg-white rounded-lg p-4 shadow-sm border border-gray-200"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">
                      {member.name}
                    </h4>
                    {(member.phone || member.phoneNumber) && (
                      <p className="text-sm text-gray-600">{member.phone || member.phoneNumber}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditMember(member)}
                      className="p-2 hover:bg-blue-50 rounded-lg transition"
                    >
                      <Edit2 className="w-4 h-4 text-blue-600" />
                    </button>
                    <button
                      onClick={() => handleDeleteMember(member.id!)}
                      className="p-2 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => updateMemberStatus(member.id!, "present")}
                    className={`py-2 px-2 rounded-lg font-medium text-sm transition ${
                      member.attendanceStatus === "present"
                        ? "bg-green-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-green-100"
                    }`}
                  >
                    Present
                  </button>
                  <button
                    onClick={() => updateMemberStatus(member.id!, "absent")}
                    className={`py-2 px-2 rounded-lg font-medium text-sm transition ${
                      member.attendanceStatus === "absent"
                        ? "bg-red-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-red-100"
                    }`}
                  >
                    Absent
                  </button>
                  <button
                    onClick={() => updateMemberStatus(member.id!, "sick")}
                    className={`py-2 px-2 rounded-lg font-medium text-sm transition ${
                      member.attendanceStatus === "sick"
                        ? "bg-orange-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-orange-100"
                    }`}
                  >
                    Sick
                  </button>
                  <button
                    onClick={() => updateMemberStatus(member.id!, "travel")}
                    className={`py-2 px-2 rounded-lg font-medium text-sm transition ${
                      member.attendanceStatus === "travel"
                        ? "bg-purple-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-purple-100"
                    }`}
                  >
                    Travel
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        {members.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
            <div className="max-w-2xl mx-auto flex gap-3">
              <button
                onClick={handleAddMember}
                className="flex items-center gap-2 flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg font-medium transition"
              >
                <Plus className="w-5 h-5" />
                Add Member
              </button>
              <button
                onClick={handleSubmitAttendance}
                disabled={loading}
                className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50"
              >
                {loading ? "Submitting..." : "Submit Attendance"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceMarking;



