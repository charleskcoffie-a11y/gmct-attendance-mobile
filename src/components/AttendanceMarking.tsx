import React, { useState, useEffect } from "react";
import { getClassMembers, saveMember, deleteMember, saveAttendance, getAttendanceByDateAndService } from "../supabase";
import { Member, ServiceType } from "../types";
import { Calendar, Plus, Edit2, Trash2, Wifi, WifiOff, CheckCircle, AlertCircle, LogOut, BarChart3, Users } from "lucide-react";

interface AttendanceMarkingProps {
  classNumber: number;
  onLogout: () => void;
  onShowReports?: () => void;
  onBackToClasses?: () => void;
  isAdminView?: boolean;
}

interface MemberWithStatus extends Member {
  attendanceStatus?: "present" | "absent" | "sick" | "travel";
}

interface MemberFormData {
  id?: string;
  name: string;
  member_number?: string;
  address?: string;
  city?: string;
  province?: string;
  phoneNumber?: string;
  date_of_birth?: string;
  dob_day?: string;
  dob_month?: string;
  dob_year?: string;
}

export const AttendanceMarking: React.FC<AttendanceMarkingProps> = ({
  classNumber,
  onLogout,
  onShowReports,
  onBackToClasses,
  isAdminView,
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
  const [editingMember, setEditingMember] = useState<MemberFormData | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberFormData, setMemberFormData] = useState<MemberFormData>({
    name: "",
    member_number: "",
    address: "",
    city: "",
    province: "",
    phoneNumber: "",
    date_of_birth: "",
    dob_day: "",
    dob_month: "",
    dob_year: ""
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

  const parseDateParts = (dateStr?: string) => {
    if (!dateStr) {
      return { year: "", month: "", day: "" };
    }
    const [year, month, day] = dateStr.split("-");
    return {
      year: year || "",
      month: month || "",
      day: day || ""
    };
  };

  const pad2 = (value: number) => String(value).padStart(2, "0");

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
    setMemberFormData({
      name: "",
      member_number: "",
      address: "",
      city: "",
      province: "",
      phoneNumber: "",
      date_of_birth: "",
      dob_day: "",
      dob_month: "",
      dob_year: ""
    });
    setShowMemberForm(true);
  };

  const handleEditMember = (member: MemberWithStatus) => {
    const dateParts = parseDateParts(member.date_of_birth);
    setEditingMember({
      id: member.id?.toString(),
      name: member.name,
      member_number: member.member_number || "",
      address: member.address || "",
      city: member.city || "",
      province: member.province || "",
      phoneNumber: member.phone || member.phoneNumber || "",
      date_of_birth: member.date_of_birth || "",
      dob_day: member.dob_day ? String(member.dob_day) : (dateParts.day || ""),
      dob_month: member.dob_month ? String(member.dob_month) : (dateParts.month || ""),
      dob_year: dateParts.year || ""
    });
    setMemberFormData({
      id: member.id?.toString(),
      name: member.name,
      member_number: member.member_number || "",
      address: member.address || "",
      city: member.city || "",
      province: member.province || "",
      phoneNumber: member.phone || member.phoneNumber || "",
      date_of_birth: member.date_of_birth || "",
      dob_day: member.dob_day ? String(member.dob_day) : (dateParts.day || ""),
      dob_month: member.dob_month ? String(member.dob_month) : (dateParts.month || ""),
      dob_year: dateParts.year || ""
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
      const isEditing = Boolean(editingMember?.id);
      const currentMember = isEditing
        ? members.find((m) => m.id?.toString() === editingMember?.id)
        : undefined;

      const existingDateParts = parseDateParts(currentMember?.date_of_birth);
      const dobMonth = isAdminView
        ? (memberFormData.dob_month || existingDateParts.month || "")
        : (existingDateParts.month || memberFormData.dob_month || "");
      const dobDay = memberFormData.dob_day || existingDateParts.day || "";
      const dobYear = memberFormData.dob_year || existingDateParts.year || "";

      const hasDob = dobYear && dobMonth && dobDay;
      const composedDob = hasDob
        ? `${dobYear}-${pad2(Number(dobMonth))}-${pad2(Number(dobDay))}`
        : memberFormData.date_of_birth || currentMember?.date_of_birth;

      const newMember: Member = {
        id: editingMember?.id || "",
        name: isAdminView || !isEditing ? memberFormData.name : (currentMember?.name || memberFormData.name),
        class_number: classNumber.toString(),
        member_number: isAdminView || !isEditing ? memberFormData.member_number : currentMember?.member_number,
        address: memberFormData.address || currentMember?.address,
        city: isAdminView || !isEditing ? memberFormData.city : currentMember?.city,
        province: isAdminView || !isEditing ? memberFormData.province : currentMember?.province,
        phoneNumber: isAdminView || !isEditing ? memberFormData.phoneNumber : (currentMember?.phone || currentMember?.phoneNumber),
        date_of_birth: composedDob,
        dob_month: dobMonth ? Number(dobMonth) : currentMember?.dob_month,
        dob_day: dobDay ? Number(dobDay) : currentMember?.dob_day
      };

      await saveMember(newMember);
      setSuccess(
        editingMember ? "Member updated successfully" : "Member added successfully"
      );
      setShowMemberForm(false);
      setMemberFormData({
        name: "",
        member_number: "",
        address: "",
        city: "",
        province: "",
        phoneNumber: "",
        date_of_birth: "",
        dob_day: "",
        dob_month: "",
        dob_year: ""
      });
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
    if (serviceDateWarning) {
      setError(serviceDateWarning);
      return;
    }

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

  const selectedDay = selectedDate
    ? new Date(`${selectedDate}T00:00:00`).getDay()
    : null;
  const serviceDateWarning = selectedDay === null
    ? null
    : serviceType === "sunday"
    ? (selectedDay !== 0 ? "Sunday Service must be recorded on a Sunday." : null)
    : (selectedDay !== 2 ? "Bible Study must be recorded on a Tuesday." : null);

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

  const isEditing = Boolean(editingMember?.id);
  const restrictFields = !isAdminView && isEditing;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700/50 backdrop-blur-sm">
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          {/* Top Row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">Class {classNumber}</h1>
                <p className="text-xs md:text-sm text-slate-400">Mark Attendance</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isOnline ? (
                <div className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600/20 border border-emerald-500/30 rounded-lg">
                  <Wifi className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-emerald-300 font-medium">Online</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 px-3 py-1.5 bg-yellow-600/20 border border-yellow-500/30 rounded-lg">
                  <WifiOff className="w-4 h-4 text-yellow-400" />
                  <span className="text-xs text-yellow-300 font-medium">Offline</span>
                </div>
              )}
            </div>
          </div>

          {/* Service Type & Date Selector */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-2 block">Service Type</label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value as ServiceType)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-700 border border-slate-600 text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              >
                <option value="sunday">Sunday Service</option>
                <option value="bible-study">Bible Study</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-2 block">Date</label>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-700 border border-slate-600 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
                <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="flex-1 bg-transparent text-white text-sm focus:outline-none"
                />
              </div>
            </div>
            <div className="flex items-end gap-2">
              {onShowReports && (
                <button
                  onClick={onShowReports}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl font-semibold transition-all shadow-lg"
                >
                  <BarChart3 className="w-4 h-4" />
                  <span className="hidden sm:inline">Reports</span>
                </button>
              )}
              {onBackToClasses && (
                <button
                  onClick={onBackToClasses}
                  className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-semibold transition-all"
                >
                  <span className="hidden sm:inline">Back</span>
                  <span className="sm:hidden">←</span>
                </button>
              )}
            </div>
            <div className="flex items-end">
              <button
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 rounded-xl font-semibold transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Messages */}
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-3">
        {error && (
          <div className="p-4 bg-red-950/50 border border-red-700/50 rounded-xl text-red-300 text-sm flex items-start gap-3 backdrop-blur-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 bg-emerald-950/50 border border-emerald-700/50 rounded-xl text-emerald-300 text-sm flex items-start gap-3 backdrop-blur-sm">
            <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            {success}
          </div>
        )}

        {/* Offline Notice */}
        {!isOnline && (
          <div className="p-4 bg-yellow-950/50 border border-yellow-700/50 rounded-xl text-yellow-300 text-sm flex items-start gap-3 backdrop-blur-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            Offline mode active. Data will sync when connected.
          </div>
        )}

        {serviceDateWarning && (
          <div className="p-4 bg-orange-950/50 border border-orange-700/50 rounded-xl text-orange-300 text-sm flex items-start gap-3 backdrop-blur-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            {serviceDateWarning}
          </div>
        )}

        {/* Existing Attendance Status */}
        {existingAttendance && !attendanceLoading && (
          <div className="p-4 bg-blue-950/50 border border-blue-700/50 rounded-xl text-blue-300 text-sm flex items-start gap-3 backdrop-blur-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Attendance Already Marked</strong> for {selectedDate} ({serviceType === 'sunday' ? 'Sunday Service' : 'Bible Study'})
              <br className="mt-1" />
              Present: {existingAttendance.total_members_present} | Absent: {existingAttendance.total_members_absent}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {/* Compact Stats Dashboard */}
        <div className="bg-gradient-to-r from-slate-700/50 to-slate-800/50 border border-slate-600/50 rounded-2xl p-4 mb-6 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Total Members - Main Stat */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-600/50 to-blue-500/50 border border-blue-400/50 flex items-center justify-center">
                <span className="text-xl font-bold text-white">{members.length}</span>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Total Members</p>
              </div>
            </div>

            {/* Status Breakdown - Mini Stats */}
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-center px-3 py-1.5 rounded-lg bg-green-600/20 border border-green-500/30">
                <p className="font-bold text-green-300">{presentCount}</p>
                <p className="text-xs text-green-300 opacity-75">Present</p>
              </div>
              <div className="flex flex-col items-center px-3 py-1.5 rounded-lg bg-red-600/20 border border-red-500/30">
                <p className="font-bold text-red-300">{absentCount}</p>
                <p className="text-xs text-red-300 opacity-75">Absent</p>
              </div>
              <div className="flex flex-col items-center px-3 py-1.5 rounded-lg bg-orange-600/20 border border-orange-500/30">
                <p className="font-bold text-orange-300">{sickCount}</p>
                <p className="text-xs text-orange-300 opacity-75">Sick</p>
              </div>
              <div className="flex flex-col items-center px-3 py-1.5 rounded-lg bg-purple-600/20 border border-purple-500/30">
                <p className="font-bold text-purple-300">{travelCount}</p>
                <p className="text-xs text-purple-300 opacity-75">Travel</p>
              </div>
            </div>

            {/* Attendance Rate */}
            {members.length > 0 && (
              <div className="text-right">
                <p className="text-2xl font-bold text-white">
                  {Math.round((presentCount / members.length) * 100)}%
                </p>
                <p className="text-xs text-slate-400 font-medium">Attendance Rate</p>
              </div>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            placeholder="Search by name, phone, or member #"
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-xl placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Member Editor Modal */}
        {showMemberForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-sm w-full shadow-xl">
              <div className="p-6">
                <h3 className="text-lg font-bold text-white mb-6">
                  {editingMember ? "Edit Member" : "Add New Member"}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={memberFormData.name}
                      onChange={(e) =>
                        setMemberFormData({ ...memberFormData, name: e.target.value })
                      }
                      disabled={restrictFields}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-700/50"
                      placeholder="Member name"
                    />
                  </div>
                  {isAdminView && (
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">
                        Member Number
                      </label>
                      <input
                        type="text"
                        value={memberFormData.member_number || ""}
                        onChange={(e) =>
                          setMemberFormData({ ...memberFormData, member_number: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Member number"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
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
                      disabled={restrictFields}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      placeholder="Phone number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address
                    </label>
                    <input
                      type="text"
                      value={memberFormData.address || ""}
                      onChange={(e) =>
                        setMemberFormData({ ...memberFormData, address: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Address"
                    />
                  </div>
                  {isAdminView && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          City
                        </label>
                        <input
                          type="text"
                          value={memberFormData.city || ""}
                          onChange={(e) =>
                            setMemberFormData({ ...memberFormData, city: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="City"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Province
                        </label>
                        <input
                          type="text"
                          value={memberFormData.province || ""}
                          onChange={(e) =>
                            setMemberFormData({ ...memberFormData, province: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Province"
                        />
                      </div>
                    </div>
                  )}
                  {isAdminView ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date of Birth
                      </label>
                      <input
                        type="date"
                        value={memberFormData.date_of_birth || ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          const parts = parseDateParts(value);
                          setMemberFormData({
                            ...memberFormData,
                            date_of_birth: value,
                            dob_year: parts.year,
                            dob_month: parts.month,
                            dob_day: parts.day
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Birth Day
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={memberFormData.dob_day || ""}
                          onChange={(e) =>
                            setMemberFormData({ ...memberFormData, dob_day: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Day"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Birth Year
                        </label>
                        <input
                          type="number"
                          min={1900}
                          max={new Date().getFullYear()}
                          value={memberFormData.dob_year || ""}
                          onChange={(e) =>
                            setMemberFormData({ ...memberFormData, dob_year: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Year"
                        />
                      </div>
                    </div>
                  )}
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
                        setMemberFormData({
                          name: "",
                          member_number: "",
                          address: "",
                          city: "",
                          province: "",
                          phoneNumber: "",
                          date_of_birth: "",
                          dob_day: "",
                          dob_month: "",
                          dob_year: ""
                        });
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
          <div className="text-center py-16 text-slate-400">
            <div className="text-sm font-medium">Loading members...</div>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-400 mb-6 text-sm">
              {members.length === 0 ? "No members in this class yet" : "No members match your search"}
            </p>
            <button
              onClick={handleAddMember}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all shadow-lg"
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
                className="bg-slate-800/50 border border-slate-600/50 rounded-2xl p-4 backdrop-blur-sm transition-all hover:bg-slate-800/70"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1">
                    <h4 className="font-semibold text-white">
                      {member.name}
                    </h4>
                    {(member.phone || member.phoneNumber) && (
                      <p className="text-sm text-slate-400">{member.phone || member.phoneNumber}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditMember(member)}
                      className="p-2.5 hover:bg-blue-600/20 rounded-lg transition border border-transparent hover:border-blue-500/30"
                    >
                      <Edit2 className="w-4 h-4 text-blue-400" />
                    </button>
                    <button
                      onClick={() => handleDeleteMember(member.id!)}
                      className="p-2.5 hover:bg-red-600/20 rounded-lg transition border border-transparent hover:border-red-500/30"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => updateMemberStatus(member.id!, "present")}
                    className={`col-span-2 py-3 px-2 rounded-xl font-bold text-base transition ${
                      member.attendanceStatus === "present"
                        ? "bg-green-600 text-white shadow-lg"
                        : "bg-slate-700 text-slate-300 hover:bg-green-600/30 hover:text-green-300 border border-slate-600"
                    }`}
                  >
                    ✓ Present
                  </button>
                  <button
                    onClick={() => updateMemberStatus(member.id!, "absent")}
                    className={`py-3 px-2 rounded-xl font-medium text-sm transition border ${
                      member.attendanceStatus === "absent"
                        ? "bg-red-600 text-white border-red-500"
                        : "bg-slate-700 text-slate-300 hover:bg-red-600/30 hover:text-red-300 border border-slate-600"
                    }`}
                  >
                    Absent
                  </button>
                  <button
                    onClick={() => updateMemberStatus(member.id!, "sick")}
                    className={`py-3 px-2 rounded-xl font-medium text-sm transition border ${
                      member.attendanceStatus === "sick"
                        ? "bg-orange-600 text-white border-orange-500"
                        : "bg-slate-700 text-slate-300 hover:bg-orange-600/30 hover:text-orange-300 border border-slate-600"
                    }`}
                  >
                    Sick
                  </button>
                  <button
                    onClick={() => updateMemberStatus(member.id!, "travel")}
                    className={`py-3 px-2 rounded-xl font-medium text-sm transition border ${
                      member.attendanceStatus === "travel"
                        ? "bg-purple-600 text-white border-purple-500"
                        : "bg-slate-700 text-slate-300 hover:bg-purple-600/30 hover:text-purple-300 border border-slate-600"
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
          <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 via-slate-900 to-transparent border-t border-slate-700/50 p-4 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto flex gap-3">
              <button
                onClick={handleAddMember}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-semibold transition-all border border-slate-600"
              >
                <Plus className="w-5 h-5" />
                Add Member
              </button>
              <button
                onClick={handleSubmitAttendance}
                disabled={loading || !!serviceDateWarning}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all disabled:opacity-50 shadow-lg"
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



