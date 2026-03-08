import React from "react";
import { Edit2, Trash2 } from "lucide-react";

interface MemberAttendanceRowProps {
  id: string;
  name: string;
  phone?: string;
  phoneNumber?: string;
  attendanceStatus?: "present" | "absent";
  absenceReason?: "S" | "D" | "B" | "";
  onStatusChange: (memberId: string, status: "present" | "absent") => void;
  onAbsenceReasonChange: (memberId: string, reason: "S" | "D" | "B" | "") => void;
  onEdit: () => void;
  onDelete?: () => void;
  showDeleteButton?: boolean;
}

const normalizeStatus = (value?: string) =>
  (value || "").toString().trim().toLowerCase();

export const MemberAttendanceRow: React.FC<MemberAttendanceRowProps> = React.memo(({
  id,
  name,
  phone,
  phoneNumber,
  attendanceStatus,
  absenceReason,
  onStatusChange,
  onAbsenceReasonChange,
  onEdit,
  onDelete,
  showDeleteButton = false,
}) => {
  const isAbsent = normalizeStatus(attendanceStatus) !== "present";

  return (
    <div
      key={id}
      className="bg-slate-700/40 border border-slate-600 rounded-lg p-4 hover:bg-slate-700/60 transition"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-white">{name}</h4>
          {(phone || phoneNumber) && (
            <p className="text-sm text-slate-300">{phone || phoneNumber}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="p-2 hover:bg-blue-600/20 rounded-lg transition"
          >
            <Edit2 className="w-4 h-4 text-blue-400" />
          </button>
          {showDeleteButton && (
            <button
              onClick={onDelete}
              className="p-2 hover:bg-red-600/20 rounded-lg transition"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onStatusChange(id, "present")}
          className={`py-2 px-2 rounded-lg font-medium text-sm transition border ${
            normalizeStatus(attendanceStatus) === "present"
              ? "bg-emerald-600 text-white border-emerald-500"
              : "bg-slate-700 text-slate-300 hover:bg-green-600/30 hover:text-green-300 border border-slate-600"
          }`}
        >
          {normalizeStatus(attendanceStatus) === "present" ? "✓" : "Present"}
        </button>
        <button
          onClick={() => onStatusChange(id, "absent")}
          className={`py-2 px-2 rounded-lg font-medium text-sm transition border ${
            normalizeStatus(attendanceStatus) === "absent"
              ? "bg-red-600 text-white border-red-500"
              : "bg-slate-700 text-slate-300 hover:bg-red-600/30 hover:text-red-300 border border-slate-600"
          }`}
        >
          {normalizeStatus(attendanceStatus) === "absent" ? "✗" : "Absent"}
        </button>
      </div>

      {isAbsent && (
        <div className="mt-2">
          <label className="block text-xs text-slate-300 mb-1">Absent Reason</label>
          <select
            value={absenceReason || ""}
            onChange={(e) => onAbsenceReasonChange(id, e.target.value as "S" | "D" | "B" | "")}
            className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select reason</option>
            <option value="S">S - Sickness</option>
            <option value="D">D - Through Distance</option>
            <option value="B">B - Pressure of Business</option>
          </select>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent re-renders when props are the same
  return (
    prevProps.id === nextProps.id &&
    prevProps.name === nextProps.name &&
    prevProps.phone === nextProps.phone &&
    prevProps.phoneNumber === nextProps.phoneNumber &&
    prevProps.attendanceStatus === nextProps.attendanceStatus &&
    prevProps.absenceReason === nextProps.absenceReason &&
    prevProps.showDeleteButton === nextProps.showDeleteButton
  );
});

MemberAttendanceRow.displayName = 'MemberAttendanceRow';
