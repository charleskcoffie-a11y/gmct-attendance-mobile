import { Member } from "./types";

export interface SavedMemberStatus {
  member_id: string;
  member_name: string;
  status: string;
  absence_reason?: string;
  self_marked_at?: string | null;
}

export interface MemberWithStatus extends Member {
  attendanceStatus: "present" | "absent";
  absenceReason: "S" | "D" | "B" | "";
  selfMarked: boolean;
}

export function applyAttendanceStatuses(
  members: Member[],
  statuses: SavedMemberStatus[]
): MemberWithStatus[] {
  return members.map((member) => {
    const saved = statuses.find((record) => String(record.member_id) === String(member.id));
    const status = saved?.status.trim().toLowerCase();
    const selfMarked = Boolean(saved?.self_marked_at);
    const present = selfMarked || status === "present";
    const reason = saved?.absence_reason?.trim().toUpperCase();
    return {
      ...member,
      attendanceStatus: present ? "present" : "absent",
      absenceReason: present ? "" : status === "sick" ? "S" : status === "travel" ? "D"
        : reason === "S" || reason === "D" || reason === "B" ? reason : "",
      selfMarked,
    };
  });
}
