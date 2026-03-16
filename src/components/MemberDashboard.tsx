import { useEffect, useState, Suspense, lazy } from 'react';
import { Member } from '../types';
import { Users, ClipboardCheck, FileText, LogOut, ArrowLeft, Coins } from 'lucide-react';
import EditAttendanceMarking from './EditAttendanceMarking';

const AttendanceMarking = lazy(() => import('./AttendanceMarking'));
const AttendanceRecords = lazy(() => import('./AttendanceRecords'));
const RecentAttendanceView = lazy(() => import('./RecentAttendanceView'));
const MemberContributions = lazy(() => import('./MemberContributions'));
const ClassReports = lazy(() => import('./ClassReports'));

interface MemberDashboardProps {
  member: Member;
  onLogout: () => void;
  onMemberUpdated: (member: Member) => void;
}

type MemberView = 'profile' | 'contributions' | 'attendance' | 'records' | 'recent-records' | 'reports' | 'edit';

const ComponentLoader = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="w-12 h-12 border-4 border-slate-600 border-t-indigo-500 rounded-full animate-spin"></div>
      <p className="text-slate-400">Loading...</p>
    </div>
  </div>
);

export default function MemberDashboard({ member, onLogout, onMemberUpdated }: MemberDashboardProps) {
  const [view, setView] = useState<MemberView>(() => (
    typeof member.assignedClass === 'number' && member.assignedClass > 0 ? 'profile' : 'contributions'
  ));
  const [currentMember, setCurrentMember] = useState<Member>(member);
  const [editRecordDate, setEditRecordDate] = useState<string>('');
  const [editRecordServiceType, setEditRecordServiceType] = useState<string>('sunday');

  useEffect(() => {
    setCurrentMember(member);
    // If role changes to class leader after refresh, surface leader actions immediately.
    if (typeof member.assignedClass === 'number' && member.assignedClass > 0) {
      setView((prev) => (prev === 'contributions' ? 'profile' : prev));
    }
  }, [member]);

  const mappedClassNumber = currentMember.assignedClass;
  const isClassLeader = typeof mappedClassNumber === 'number' && mappedClassNumber > 0;

  useEffect(() => {
    if (!isClassLeader && (view === 'attendance' || view === 'records' || view === 'recent-records' || view === 'reports' || view === 'edit')) {
      setView('contributions');
    }
  }, [isClassLeader, view]);

  if (view === 'profile') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100">
        <div className="max-w-2xl mx-auto p-6">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Users className="w-7 h-7 text-indigo-400" />
                Member Portal
              </h1>
              <p className="text-slate-400 mt-1">Welcome, {currentMember.name}</p>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>

          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
            <h2 className="text-xl font-semibold mb-4">Your Profile</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-slate-400">Name</p>
                <p className="text-lg font-medium">{currentMember.name}</p>
              </div>
              {currentMember.class_number && (
                <div>
                  <p className="text-sm text-slate-400">Class Number</p>
                  <p className="text-lg font-medium">{currentMember.class_number}</p>
                </div>
              )}
              {currentMember.member_number && (
                <div>
                  <p className="text-sm text-slate-400">Member Number</p>
                  <p className="text-lg font-medium">{currentMember.member_number}</p>
                </div>
              )}
              {currentMember.phone && (
                <div>
                  <p className="text-sm text-slate-400">Phone</p>
                  <p className="text-lg font-medium">{currentMember.phone}</p>
                </div>
              )}
            </div>

            <div className="mt-5 pt-5 border-t border-slate-700/80">
              <button
                onClick={() => setView('contributions')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition"
              >
                <Coins className="w-4 h-4" />
                View Contributions Dashboard
              </button>
            </div>
          </div>

          {isClassLeader ? (
            <div className="mt-6 p-5 bg-emerald-900/25 border border-emerald-700 rounded-xl">
              <p className="text-emerald-200 text-sm mb-4">
                You are mapped as class leader for <span className="font-semibold">Class {mappedClassNumber}</span>.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setView('attendance')}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition"
                >
                  <ClipboardCheck className="w-4 h-4" />
                  Mark Attendance
                </button>
                <button
                  onClick={() => setView('records')}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-semibold transition"
                >
                  <FileText className="w-4 h-4" />
                  View Records
                </button>
                <button
                  onClick={() => setView('recent-records')}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition"
                >
                  <FileText className="w-4 h-4" />
                  Recent Records
                </button>
                <button
                  onClick={() => setView('reports')}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition"
                >
                  <FileText className="w-4 h-4" />
                  Reports
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-6 p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
              <p className="text-blue-200 text-sm">
                You are logged in as a member. Class leader features are not available for your account.
                Contact your administrator if you need class leader access.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'contributions') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100">
        <div className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur border-b border-slate-800">
          <div className="max-w-4xl mx-auto p-3 flex items-center justify-between gap-3">
            <button
              onClick={() => setView('profile')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <p className="text-sm font-semibold text-slate-200">Contributions & Profile</p>
            <button
              onClick={onLogout}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto p-4">
          <Suspense fallback={<ComponentLoader />}>
            <MemberContributions
              member={currentMember}
              onMemberUpdated={(updatedMember) => {
                setCurrentMember(updatedMember);
                onMemberUpdated(updatedMember);
              }}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  if (!isClassLeader || typeof mappedClassNumber !== 'number') {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="sticky top-0 z-40 bg-gradient-to-r from-slate-900 via-blue-700 to-emerald-700 text-white shadow-lg">
        <div className="max-w-6xl mx-auto p-3 flex items-center justify-between gap-3">
          <button
            onClick={() => setView('profile')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold">Class {mappedClassNumber}</p>
            <p className="text-xs text-blue-100">
              {view === 'attendance'
                ? 'Mark Attendance'
                : view === 'records'
                ? 'Attendance Records'
                : view === 'recent-records'
                ? 'Recent Records'
                : view === 'edit'
                ? 'Edit Attendance'
                : 'Class Reports'}
            </p>
          </div>
          <button
            onClick={onLogout}
            className="px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 transition"
          >
            Logout
          </button>
        </div>
      </div>

      {view === 'attendance' ? (
        <Suspense fallback={<ComponentLoader />}>
          <AttendanceMarking classNumber={mappedClassNumber} isAdminView={false} />
        </Suspense>
      ) : view === 'records' ? (
        <Suspense fallback={<ComponentLoader />}>
          <AttendanceRecords
            classNumber={mappedClassNumber}
            onEditRecord={(date, serviceType) => {
              setEditRecordDate(date.slice(0, 10));
              setEditRecordServiceType(serviceType);
              setView('edit');
            }}
          />
        </Suspense>
      ) : view === 'edit' ? (
        <EditAttendanceMarking
          classNumber={mappedClassNumber}
          date={editRecordDate}
          serviceType={editRecordServiceType as 'sunday' | 'bible-study'}
          initialMemberStatuses={[]}
          onBack={() => setView('records')}
        />
      ) : view === 'recent-records' ? (
        <Suspense fallback={<ComponentLoader />}>
          <RecentAttendanceView classNumber={mappedClassNumber} />
        </Suspense>
      ) : (
        <Suspense fallback={<ComponentLoader />}>
          <ClassReports classNumber={mappedClassNumber} onBack={() => setView('profile')} />
        </Suspense>
      )}
    </div>
  );
}
