import { useState, useEffect, Suspense, lazy } from 'react';
import Login from './components/Login';
import ChangePassword from './components/ChangePassword';
import EditAttendanceMarking from './components/EditAttendanceMarking';
import { ClassSession, Member } from './types';
import { authService } from './services/authService';

// Lazy load components for code splitting & performance
const AttendanceMarking = lazy(() => import('./components/AttendanceMarking'));
const AdminAttendanceView = lazy(() => import('./components/AdminAttendanceView'));
const AdminSettings = lazy(() => import('./components/AdminSettings'));
const AdminClassSelector = lazy(() => import('./components/AdminClassSelector'));
const ClassReports = lazy(() => import('./components/ClassReports'));
const ClassLeaderProfile = lazy(() => import('./components/ClassLeaderProfile'));
const AttendanceRecords = lazy(() => import('./components/AttendanceRecords'));
const RecentAttendanceView = lazy(() => import('./components/RecentAttendanceView'));
const SyncManager = lazy(() => import('./components/SyncManager'));
const WelcomeScreen = lazy(() => import('./components/WelcomeScreen'));
const MemberManagement = lazy(() => import('./components/MemberManagement'));
const MemberDashboard = lazy(() => import('./components/MemberDashboard'));

// Loading fallback component
const ComponentLoader = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="w-12 h-12 border-4 border-slate-600 border-t-indigo-500 rounded-full animate-spin"></div>
      <p className="text-slate-400">Loading...</p>
    </div>
  </div>
);

function App() {
  const [session, setSession] = useState<ClassSession | null>(null);
  const [memberSession, setMemberSession] = useState<Member | null>(null);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminView, setAdminView] = useState<'attendance' | 'recent-attendance' | 'settings' | 'class' | 'members'>('attendance');
  const [classView, setClassView] = useState<'welcome' | 'attendance' | 'recent-attendance' | 'reports' | 'records' | 'settings' | 'edit'>('attendance');
  const [adminSelectedClass, setAdminSelectedClass] = useState<number | null>(null);
  const [adminClassView, setAdminClassView] = useState<'attendance' | 'reports'>('attendance');
  const [editRecordDate, setEditRecordDate] = useState<string | null>(null);
  const [editRecordServiceType, setEditRecordServiceType] = useState<string>('sunday');
  const [editRecordMemberStatuses, setEditRecordMemberStatuses] = useState<Array<{ member_id: string; member_name: string; status: string }>>([]);
  const adminTabIndex = adminView === 'attendance' ? 0 : adminView === 'recent-attendance' ? 1 : adminView === 'class' ? 2 : adminView === 'members' ? 3 : 4;
  const classTabIndex = classView === 'attendance' ? 0 : classView === 'recent-attendance' ? 1 : classView === 'records' ? 2 : classView === 'reports' ? 3 : classView === 'settings' ? 4 : -1;

  useEffect(() => {
    const refreshMemberSession = async () => {
      try {
        const refreshedMember = await authService.getCurrentMemberInfo();
        if (refreshedMember) {
          setMemberSession(refreshedMember);
          localStorage.setItem('memberSession', JSON.stringify(refreshedMember));
        }
      } catch (error) {
        console.error('Error refreshing member session:', error);
      }
    };

    const savedSession = localStorage.getItem('classSession');
    const savedMemberSession = localStorage.getItem('memberSession');

    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        // Class leader session takes priority — clear any stale member session
        localStorage.removeItem('memberSession');
        setMemberSession(null);
        setSession(parsed);
        setIsAdmin(parsed.classNumber === -1);
        if (parsed.classNumber === -1) {
          setAdminView('class');
        }
      } catch (error) {
        console.error('Error loading session:', error);
        localStorage.removeItem('classSession');
      }
    } else if (savedMemberSession) {
      try {
        const parsedMember = JSON.parse(savedMemberSession);
        setMemberSession(parsedMember);
        void refreshMemberSession();
      } catch (error) {
        console.error('Error loading member session:', error);
        localStorage.removeItem('memberSession');
      }
    }
  }, []);

  // Reset edit record state when navigating away from attendance view
  useEffect(() => {
    if (classView !== 'attendance' && classView !== 'edit') {
      setEditRecordDate(null);
      setEditRecordServiceType('sunday');
      setEditRecordMemberStatuses([]);
    }
  }, [classView]);

  const handleLogin = (classNumber: number, accessCode: string) => {
    const newSession: ClassSession = {
      classNumber,
      accessCode,
      loginTime: new Date().toISOString()
    };
    // Clear any stale member session so class leader view takes priority
    setMemberSession(null);
    localStorage.removeItem('memberSession');
    setSession(newSession);
    setIsAdmin(classNumber === -1);
    if (classNumber === -1) {
      setAdminView('class');
    } else {
      setClassView('welcome');
    }
    localStorage.setItem('classSession', JSON.stringify(newSession));
  };

  const handleMemberLogin = (memberInfo: Member, isFirstLogin: boolean) => {
    if (isFirstLogin) {
      setShowPasswordChange(true);
      setMemberSession(memberInfo);
    } else {
      setMemberSession(memberInfo);
      setShowPasswordChange(false);
      localStorage.setItem('memberSession', JSON.stringify(memberInfo));
    }
  };

  const handlePasswordChanged = () => {
    setShowPasswordChange(false);
    if (memberSession) {
      localStorage.setItem('memberSession', JSON.stringify(memberSession));
    }
  };

  const handleMemberUpdated = (updatedMember: Member) => {
    setMemberSession(updatedMember);
    localStorage.setItem('memberSession', JSON.stringify(updatedMember));
  };

  const handleLogout = () => {
    void authService.signOut();
    setSession(null);
    setMemberSession(null);
    setShowPasswordChange(false);
    setIsAdmin(false);
    setAdminView('attendance');
    setClassView('attendance');
    setAdminSelectedClass(null);
    setAdminClassView('attendance');
    localStorage.removeItem('classSession');
    localStorage.removeItem('memberSession');
    localStorage.removeItem('classLeaderId');
    localStorage.removeItem('classLeaderName');
  };

  return (
    <>
      {showPasswordChange ? (
        <Suspense fallback={<ComponentLoader />}>
          <ChangePassword 
            onPasswordChanged={handlePasswordChanged}
            onCancel={() => {
              setShowPasswordChange(false);
              handleLogout();
            }}
          />
        </Suspense>
      ) : session || memberSession ? (
        <>
          {memberSession ? (
            <Suspense fallback={<ComponentLoader />}>
              <MemberDashboard
                member={memberSession}
                onLogout={handleLogout}
                onMemberUpdated={handleMemberUpdated}
              />
            </Suspense>
          ) : isAdmin ? (
            <div className="flex flex-col h-screen">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
                <div className="flex items-center justify-between px-4 py-4">
                  <div>
                    <h1 className="text-xl font-bold">GMCT Connect</h1>
                    <p className="text-xs text-blue-100">Admin Dashboard</p>
                  </div>
                  <button onClick={handleLogout} className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium transition text-sm backdrop-blur-sm">
                    Logout
                  </button>
                </div>
              </div>

              {/* Content Area */}
              <div className="flex-1 overflow-y-auto bg-gray-50 pb-20">
                {adminView === 'attendance' ? (
                  <Suspense fallback={<ComponentLoader />}>
                    <div className="pb-4">
                      <AdminAttendanceView onLogout={handleLogout} />
                      <SyncManager />
                    </div>
                  </Suspense>
                ) : adminView === 'recent-attendance' ? (
                  <Suspense fallback={<ComponentLoader />}>
                    <div className="pb-4">
                      <div className="p-4">
                        <button 
                          onClick={() => setAdminView('attendance')}
                          className="mb-4 px-3 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                        >
                          ← Back
                        </button>
                      </div>
                      <RecentAttendanceView classNumber={0} />
                    </div>
                  </Suspense>
                ) : adminView === 'settings' ? (
                  <Suspense fallback={<ComponentLoader />}>
                    <AdminSettings onBack={() => setAdminView('attendance')} />
                  </Suspense>
                ) : adminView === 'members' ? (
                  <Suspense fallback={<ComponentLoader />}>
                    <MemberManagement onBack={() => setAdminView('attendance')} />
                  </Suspense>
                ) : adminSelectedClass === null ? (
                  <Suspense fallback={<ComponentLoader />}>
                    <AdminClassSelector
                      onSelectClass={(classNumber) => {
                        setAdminSelectedClass(classNumber);
                        setAdminClassView('attendance');
                      }}
                    />
                  </Suspense>
                ) : adminClassView === 'attendance' ? (
                  <Suspense fallback={<ComponentLoader />}>
                    <>
                      <AttendanceMarking
                        classNumber={adminSelectedClass}
                        onBackToClasses={() => setAdminSelectedClass(null)}
                        isAdminView={true}
                      />
                      <SyncManager />
                    </>
                  </Suspense>
                ) : (
                  <Suspense fallback={<ComponentLoader />}>
                    <ClassReports
                      classNumber={adminSelectedClass}
                      onBack={() => setAdminClassView('attendance')}
                    />
                  </Suspense>
                )}
              </div>

              {/* Bottom Navigation - Mobile Optimized */}
              <div className="fixed bottom-2 left-1/2 z-40 w-[calc(100%-1rem)] max-w-md -translate-x-1/2 rounded-2xl border border-slate-700/70 bg-slate-900/90 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                <div className="relative">
                  <div className="pointer-events-none absolute inset-1.5">
                    <div
                      className="h-11 rounded-xl border border-blue-500/30 bg-gradient-to-r from-blue-500/20 via-cyan-500/10 to-blue-500/20 shadow-[0_0_20px_rgba(56,189,248,0.2)] transition-transform duration-300"
                      style={{ width: 'calc(100% / 5)', transform: `translateX(${adminTabIndex * 100}%)` }}
                    />
                  </div>
                  <div className="relative z-10 grid grid-cols-5 gap-0.5 h-14 px-1">
                  <button 
                    onClick={() => setAdminView('attendance')} 
                    className={`group flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all duration-200 ${
                      adminView === 'attendance' 
                        ? 'text-white' 
                        : 'text-slate-400 active:text-slate-200'
                    }`}
                  >
                    <span className={`grid h-7 w-7 place-items-center rounded-lg border transition-transform duration-200 active:scale-95 ${
                      adminView === 'attendance'
                        ? 'scale-110 bg-blue-500/20 border-blue-500/60 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                        : 'bg-slate-800/50 border-slate-700/60'
                    }`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </span>
                    <span className="text-[10px] font-bold">Dashboard</span>
                  </button>
                  <button 
                    onClick={() => setAdminView('recent-attendance')} 
                    className={`group flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all duration-200 ${
                      adminView === 'recent-attendance' 
                        ? 'text-white' 
                        : 'text-slate-400 active:text-slate-200'
                    }`}
                  >
                    <span className={`grid h-7 w-7 place-items-center rounded-lg border transition-transform duration-200 active:scale-95 ${
                      adminView === 'recent-attendance'
                        ? 'scale-110 bg-blue-500/20 border-blue-500/60 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                        : 'bg-slate-800/50 border-slate-700/60'
                    }`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </span>
                    <span className="text-[10px] font-bold">Recent</span>
                  </button>
                  <button 
                    onClick={() => setAdminView('class')} 
                    className={`group flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all duration-200 ${
                      adminView === 'class' 
                        ? 'text-white' 
                        : 'text-slate-400 active:text-slate-200'
                    }`}
                  >
                    <span className={`grid h-7 w-7 place-items-center rounded-lg border transition-transform duration-200 active:scale-95 ${
                      adminView === 'class'
                        ? 'scale-110 bg-blue-500/20 border-blue-500/60 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                        : 'bg-slate-800/50 border-slate-700/60'
                    }`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </span>
                    <span className="text-[10px] font-bold">Classes</span>
                  </button>
                  <button 
                    onClick={() => setAdminView('members')} 
                    className={`group flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all duration-200 ${
                      adminView === 'members' 
                        ? 'text-white' 
                        : 'text-slate-400 active:text-slate-200'
                    }`}
                  >
                    <span className={`grid h-7 w-7 place-items-center rounded-lg border transition-transform duration-200 active:scale-95 ${
                      adminView === 'members'
                        ? 'scale-110 bg-blue-500/20 border-blue-500/60 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                        : 'bg-slate-800/50 border-slate-700/60'
                    }`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </span>
                    <span className="text-[10px] font-bold">Members</span>
                  </button>
                  <button 
                    onClick={() => setAdminView('settings')} 
                    className={`group flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all duration-200 ${
                      adminView === 'settings' 
                        ? 'text-white' 
                        : 'text-slate-400 active:text-slate-200'
                    }`}
                  >
                    <span className={`grid h-7 w-7 place-items-center rounded-lg border transition-transform duration-200 active:scale-95 ${
                      adminView === 'settings'
                        ? 'scale-110 bg-blue-500/20 border-blue-500/60 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                        : 'bg-slate-800/50 border-slate-700/60'
                    }`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </span>
                    <span className="text-[10px] font-bold">Settings</span>
                  </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-screen">
              {/* Header - Mobile Optimized */}
              <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-blue-700 to-emerald-700 text-white shadow-lg">
                <div className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
                <div className="pointer-events-none absolute -bottom-12 left-6 h-24 w-24 rounded-full bg-cyan-300/20 blur-2xl" />
                <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="h-10 w-10 rounded-xl bg-white/15 border border-white/20 grid place-items-center shadow-lg shrink-0">
                      <span className="text-base font-black">GM</span>
                    </div>
                    <div className="min-w-0">
                      <h1 className="text-lg font-black tracking-tight">GMCT Connect</h1>
                      <p className="text-xs font-bold text-blue-100">Class Leader</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-white/20 border border-white/25">
                        Class {session!.classNumber}
                    </span>
                    <button
                      onClick={handleLogout}
                      className="px-3 py-1.5 bg-white/15 active:bg-white/25 text-white rounded-lg font-semibold transition text-xs backdrop-blur-sm border border-white/20"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              </div>

              {/* Content Area */}
              <div className="flex-1 overflow-y-auto bg-gray-50 pb-20">
                {classView === 'welcome' ? (
                  <Suspense fallback={<ComponentLoader />}>
                    <WelcomeScreen
                      classNumber={session!.classNumber}
                      classLeaderName={localStorage.getItem('classLeaderName')}
                      onMarkAttendance={() => setClassView('attendance')}
                      onEditAttendance={() => setClassView('records')}
                      onViewRecent={() => setClassView('recent-attendance')}
                    />
                  </Suspense>
                ) : classView === 'edit' ? (
                  <Suspense fallback={<ComponentLoader />}>
                    <EditAttendanceMarking
                      classNumber={session!.classNumber}
                      date={editRecordDate || ''}
                      serviceType={editRecordServiceType as 'sunday' | 'bible-study'}
                      initialMemberStatuses={editRecordMemberStatuses}
                      onBack={() => {
                        setClassView('records');
                        setEditRecordDate(null);
                        setEditRecordServiceType('sunday');
                        setEditRecordMemberStatuses([]);
                      }}
                    />
                  </Suspense>
                ) : classView === 'attendance' ? (
                  <Suspense fallback={<ComponentLoader />}>
                    <>
                      <AttendanceMarking
                        classNumber={session!.classNumber}
                        isAdminView={false}
                      />
                      <SyncManager />
                    </>
                  </Suspense>
                ) : classView === 'recent-attendance' ? (
                  <Suspense fallback={<ComponentLoader />}>
                    <RecentAttendanceView classNumber={session!.classNumber} />
                  </Suspense>
                ) : classView === 'records' ? (
                  <Suspense fallback={<ComponentLoader />}>
                    <AttendanceRecords
                      classNumber={session!.classNumber}
                      onEditRecord={(date, serviceType) => {
                        // Navigate immediately — EditAttendanceMarking loads its own data
                        const normalizedDate = (date || '').slice(0, 10);
                        setEditRecordDate(normalizedDate);
                        setEditRecordServiceType(serviceType);
                        setEditRecordMemberStatuses([]);
                        setClassView('edit');
                      }}
                    />
                  </Suspense>
                ) : classView === 'reports' ? (
                  <Suspense fallback={<ComponentLoader />}>
                    <ClassReports
                      classNumber={session!.classNumber}
                      onBack={() => setClassView('attendance')}
                    />
                  </Suspense>
                ) : (
                  <Suspense fallback={<ComponentLoader />}>
                    <ClassLeaderProfile
                      classNumber={session!.classNumber}
                    />
                  </Suspense>
                )}
              </div>

              {/* Bottom Navigation - Mobile Optimized */}
              {classView !== 'welcome' && (
              <div className="fixed bottom-2 left-1/2 z-40 w-[calc(100%-1rem)] max-w-md -translate-x-1/2 rounded-2xl border border-slate-700/70 bg-slate-900/90 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                <div className="relative">
                  <div className="pointer-events-none absolute inset-1.5">
                    <div
                      className="h-11 rounded-xl border border-blue-500/30 bg-gradient-to-r from-blue-500/20 via-cyan-500/10 to-blue-500/20 shadow-[0_0_20px_rgba(56,189,248,0.2)] transition-transform duration-300"
                      style={{ width: 'calc(100% / 5)', transform: `translateX(${classTabIndex * 100}%)` }}
                    />
                  </div>
                  <div className="relative z-10 grid grid-cols-5 gap-0.5 h-14 px-1">
                  <button 
                    onClick={() => setClassView('attendance')} 
                    className={`group flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all duration-200 ${
                      classView === 'attendance' 
                        ? 'text-white' 
                        : 'text-slate-400 active:text-slate-200'
                    }`}
                  >
                    <span className={`grid h-7 w-7 place-items-center rounded-lg border transition-transform duration-200 active:scale-95 ${
                      classView === 'attendance'
                        ? 'scale-110 bg-blue-500/20 border-blue-500/60 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                        : 'bg-slate-800/50 border-slate-700/60'
                    }`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </span>
                    <span className="text-[10px] font-bold">Mark</span>
                  </button>
                  <button 
                    onClick={() => setClassView('recent-attendance')} 
                    className={`group flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all duration-200 ${
                      classView === 'recent-attendance' 
                        ? 'text-white' 
                        : 'text-slate-400 active:text-slate-200'
                    }`}
                  >
                    <span className={`grid h-7 w-7 place-items-center rounded-lg border transition-transform duration-200 active:scale-95 ${
                      classView === 'recent-attendance'
                        ? 'scale-110 bg-blue-500/20 border-blue-500/60 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                        : 'bg-slate-800/50 border-slate-700/60'
                    }`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </span>
                    <span className="text-[10px] font-bold">Recent</span>
                  </button>
                  <button 
                    onClick={() => setClassView('records')} 
                    className={`group flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all duration-200 ${
                      classView === 'records' 
                        ? 'text-white' 
                        : 'text-slate-400 active:text-slate-200'
                    }`}
                  >
                    <span className={`grid h-7 w-7 place-items-center rounded-lg border transition-transform duration-200 active:scale-95 ${
                      classView === 'records'
                        ? 'scale-110 bg-blue-500/20 border-blue-500/60 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                        : 'bg-slate-800/50 border-slate-700/60'
                    }`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </span>
                    <span className="text-[10px] font-bold">Records</span>
                  </button>
                  <button 
                    onClick={() => setClassView('reports')} 
                    className={`group flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all duration-200 ${
                      classView === 'reports' 
                        ? 'text-white' 
                        : 'text-slate-400 active:text-slate-200'
                    }`}
                  >
                    <span className={`grid h-7 w-7 place-items-center rounded-lg border transition-transform duration-200 active:scale-95 ${
                      classView === 'reports'
                        ? 'scale-110 bg-blue-500/20 border-blue-500/60 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                        : 'bg-slate-800/50 border-slate-700/60'
                    }`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </span>
                    <span className="text-[10px] font-bold">Reports</span>
                  </button>
                  <button 
                    onClick={() => setClassView('settings')} 
                    className={`group flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all duration-200 ${
                      classView === 'settings' 
                        ? 'text-white' 
                        : 'text-slate-400 active:text-slate-200'
                    }`}
                  >
                    <span className={`grid h-7 w-7 place-items-center rounded-lg border transition-transform duration-200 active:scale-95 ${
                      classView === 'settings'
                        ? 'scale-110 bg-blue-500/20 border-blue-500/60 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                        : 'bg-slate-800/50 border-slate-700/60'
                    }`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </span>
                    <span className="text-[10px] font-bold">Profile</span>
                  </button>
                  </div>
                </div>
              </div>
              )}
            </div>
          )}
        </>
      ) : (
        <Login onLogin={handleLogin} onMemberLogin={handleMemberLogin} />
      )}
    </>
  );
}

export default App;
