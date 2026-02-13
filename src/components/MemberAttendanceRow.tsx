import React from "react";
import { Edit2, Trash2 } from "lucide-react";

interface MemberAttendanceRowProps {
  id: string;
  name: string;
  phone?: string;
  phoneNumber?: string;
  attendanceStatus?: "present" | "absent" | "sick" | "travel";
  onStatusChange: (memberId: string, status: "present" | "absent" | "sick" | "travel") => void;
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
  onStatusChange,
  onEdit,
  onDelete,
  showDeleteButton = false,
}) => {
  return (
    <div
      key={id}
      className="bg-slate-700/40 border border-slate-600 rounded-lg p-4 hover:bg-slate-700/60 transition"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-white">{name}</h4>
          {(phone || phoneNumber) && (
            <p className="text-sm text-slate-400">{phone || phoneNumber}</p>
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

      <div className="grid grid-cols-4 gap-2">
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
        <button
          onClick={() => onStatusChange(id, "sick")}
          className={`py-2 px-2 rounded-lg font-medium text-sm transition border ${
            normalizeStatus(attendanceStatus) === "sick"
              ? "bg-orange-600 text-white border-orange-500"
              : "bg-slate-700 text-slate-300 hover:bg-orange-600/30 hover:text-orange-300 border border-slate-600"
          }`}
        >
          {normalizeStatus(attendanceStatus) === "sick" ? "🤒" : "Sick"}
        </button>
        <button
          onClick={() => onStatusChange(id, "travel")}
          className={`py-2 px-2 rounded-lg font-medium text-sm transition border ${
            normalizeStatus(attendanceStatus) === "travel"
              ? "bg-purple-600 text-white border-purple-500"
              : "bg-slate-700 text-slate-300 hover:bg-purple-600/30 hover:text-purple-300 border border-slate-600"
          }`}
        >
          {normalizeStatus(attendanceStatus) === "travel" ? "✈️" : "Travel"}
        </button>
      </div>
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
    prevProps.showDeleteButton === nextProps.showDeleteButton
  );
});

MemberAttendanceRow.displayName = 'MemberAttendanceRow';
