import React from "react";

interface WelcomeScreenProps {
  classNumber: number;
  classLeaderName?: string | null;
  onMarkAttendance: () => void;
  onEditAttendance: () => void;
  onViewRecent: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  classNumber,
  classLeaderName,
  onMarkAttendance,
  onEditAttendance,
  onViewRecent,
}) => {
  const displayName = (classLeaderName || "").trim() || "Class Leader";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-emerald-950 pb-24">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-24 -left-10 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 right-2 h-52 w-52 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="px-5 pt-10 pb-6 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-slate-100">
            Welcome back • GMCT Bible Class Attendance
          </div>
          <h1 className="mt-4 text-3xl font-black text-white tracking-tight">
            Hello, <span className="text-cyan-300">{displayName}</span>
          </h1>
          <p className="mt-2 text-slate-300 text-sm">
            Class {classNumber} • Choose what you want to do today.
          </p>
        </div>
      </div>

      <div className="px-5 max-w-3xl mx-auto space-y-4">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/80 p-5 shadow-2xl">
          <h2 className="text-lg font-bold text-white mb-2">Quick Actions</h2>
          <p className="text-sm text-slate-300">
            Mark attendance for today or edit a previous record.
          </p>

          <div className="mt-5 grid gap-3">
            <button
              onClick={onMarkAttendance}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-500 via-green-600 to-teal-500 px-5 py-4 text-left text-white font-bold shadow-lg transition active:scale-95"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-base">Mark Attendance</div>
                  <div className="text-xs text-emerald-100">Open today’s attendance sheet</div>
                </div>
                <span className="text-xl">✅</span>
              </div>
            </button>

            <button
              onClick={onEditAttendance}
              className="w-full rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-5 py-4 text-left text-cyan-100 font-bold shadow-lg transition active:scale-95"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-base">Edit Attendance</div>
                  <div className="text-xs text-cyan-200">Go to records to update entries</div>
                </div>
                <span className="text-xl">📝</span>
              </div>
            </button>

            <button
              onClick={onViewRecent}
              className="w-full rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-5 py-4 text-left text-emerald-100 font-bold shadow-lg transition active:scale-95"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-base">View Recent</div>
                  <div className="text-xs text-emerald-200">Check latest attendance stats</div>
                </div>
                <span className="text-xl">📊</span>
              </div>
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-xs text-slate-300">
          Tip: If Sunday is already recorded this week, you can still submit Bible Study for the same week.
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
