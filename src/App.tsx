import { useState, useEffect } from 'react';
import Login from './components/Login';
import AttendanceMarking from './components/AttendanceMarking';
import AdminAttendanceView from './components/AdminAttendanceView';
import AdminSettings from './components/AdminSettings';
import AdminClassSelector from './components/AdminClassSelector';
import ClassReports from './components/ClassReports';
import ClassLeaderProfile from './components/ClassLeaderProfile';
import AttendanceRecords from './components/AttendanceRecords';
import RecentAttendanceView from './components/RecentAttendanceView';
import SyncManager from './components/SyncManager';
import { ClassSession } from './types';

function App() {
  const [session, setSession] = useState<ClassSession | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminView, setAdminView] = useState<'attendance' | 'settings' | 'class'>('attendance');
  const [classView, setClassView] = useState<'attendance' | 'recent-attendance' | 'reports' | 'records' | 'settings'>('attendance');
  const [adminSelectedClass, setAdminSelectedClass] = useState<number | null>(null);
  const [adminClassView, setAdminClassView] = useState<'attendance' | 'reports'>('attendance');
  const adminTabIndex = adminView === 'attendance' ? 0 : adminView === 'class' ? 1 : 2;
  const classTabIndex = classView === 'attendance' ? 0 : classView === 'recent-attendance' ? 1 : classView === 'records' ? 2 : classView === 'reports' ? 3 : 4;

  useEffect(() => {
    const savedSession = localStorage.getItem('classSession');
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        setSession(parsed);
        setIsAdmin(parsed.classNumber === -1);
        if (parsed.classNumber === -1) {
          setAdminView('class');
        }
      } catch (error) {
        console.error('Error loading session:', error);
        localStorage.removeItem('classSession');
      }
    }
  }, []);

  const handleLogin = (classNumber: number, accessCode: string) => {
    const newSession: ClassSession = {
      classNumber,
      accessCode,
      loginTime: new Date().toISOString()
    };
    setSession(newSession);
    setIsAdmin(classNumber === -1);
    if (classNumber === -1) {
      setAdminView('class');
    }
    localStorage.setItem('classSession', JSON.stringify(newSession));
  };

  const handleLogout = () => {
    setSession(null);
    setIsAdmin(false);
    setAdminView('attendance');
    setClassView('attendance');
    setAdminSelectedClass(null);
    setAdminClassView('attendance');
    localStorage.removeItem('classSession');
    localStorage.removeItem('classLeaderId');
    localStorage.removeItem('classLeaderName');
  };

  return (
    <>
      {session ? (
        <>
          {isAdmin ? (
            <div className="flex flex-col h-screen">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
                <div className="flex items-center justify-between px-4 py-4">
                  <div>
                    <h1 className="text-xl font-bold">GMCT Attendance</h1>
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
                  <div className="pb-4">
                    <AdminAttendanceView onLogout={handleLogout} />
                    <SyncManager />
                  </div>
                ) : adminView === 'settings' ? (
                  <AdminSettings onBack={() => setAdminView('attendance')} />
                ) : adminSelectedClass === null ? (
                  <AdminClassSelector
                    onSelectClass={(classNumber) => {
                      setAdminSelectedClass(classNumber);
                      setAdminClassView('attendance');
                    }}
                    onLogout={handleLogout}
                  />
                ) : adminClassView === 'attendance' ? (
                  <>
                    <AttendanceMarking
                      classNumber={adminSelectedClass}
                      onLogout={handleLogout}
                      onShowReports={() => setAdminClassView('reports')}
                      onBackToClasses={() => setAdminSelectedClass(null)}
                      isAdminView={true}
                    />
                    <SyncManager />
                  </>
                ) : (
                  <ClassReports
                    classNumber={adminSelectedClass}
                    onBack={() => setAdminClassView('attendance')}
                    onBackToClasses={() => setAdminSelectedClass(null)}
                  />
                )}
              </div>

              {/* Bottom Navigation */}
              <div className="fixed bottom-3 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 rounded-2xl border border-slate-700/70 bg-slate-900/80 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl safe-area-bottom">
                <div className="relative">
                  <div className="pointer-events-none absolute inset-2">
                    <div
                      className="h-12 rounded-xl border border-blue-500/30 bg-gradient-to-r from-blue-500/20 via-cyan-500/10 to-blue-500/20 shadow-[0_0_24px_rgba(56,189,248,0.25)] transition-transform duration-300"
                      style={{ width: 'calc(100% / 3)', transform: `translateX(${adminTabIndex * 100}%)` }}
                    />
                  </div>
                  <div className="relative z-10 grid grid-cols-3 h-16 px-2">
                  <button 
                    onClick={() => setAdminView('attendance')} 
                    className={`group flex flex-col items-center justify-center gap-1 rounded-xl transition-all duration-200 ${
                      adminView === 'attendance' 
                        ? 'text-white' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className={`grid h-9 w-9 place-items-center rounded-xl border transition-transform duration-200 group-active:scale-95 ${
                      adminView === 'attendance'
                        ? 'scale-105 bg-blue-500/20 border-blue-500/60 text-blue-200 shadow-[0_0_18px_rgba(59,130,246,0.35)]'
                        : 'bg-slate-800/60 border-slate-700/60 group-hover:scale-105'
                    }`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </span>
                    <span className="text-xs font-semibold">Attendance</span>
                    {adminView === 'attendance' && <span className="h-1.5 w-1.5 rounded-full bg-blue-300" />}
                  </button>
                  <button 
                    onClick={() => setAdminView('class')} 
                    className={`group flex flex-col items-center justify-center gap-1 rounded-xl transition-all duration-200 ${
                      adminView === 'class' 
                        ? 'text-white' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className={`grid h-9 w-9 place-items-center rounded-xl border transition-transform duration-200 group-active:scale-95 ${
                      adminView === 'class'
                        ? 'scale-105 bg-blue-500/20 border-blue-500/60 text-blue-200 shadow-[0_0_18px_rgba(59,130,246,0.35)]'
                        : 'bg-slate-800/60 border-slate-700/60 group-hover:scale-105'
                    }`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </span>
                    <span className="text-xs font-semibold">View Class</span>
                    {adminView === 'class' && <span className="h-1.5 w-1.5 rounded-full bg-blue-300" />}
                  </button>
                  <button 
                    onClick={() => setAdminView('settings')} 
                    className={`group flex flex-col items-center justify-center gap-1 rounded-xl transition-all duration-200 ${
                      adminView === 'settings' 
                        ? 'text-white' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className={`grid h-9 w-9 place-items-center rounded-xl border transition-transform duration-200 group-active:scale-95 ${
                      adminView === 'settings'
                        ? 'scale-105 bg-blue-500/20 border-blue-500/60 text-blue-200 shadow-[0_0_18px_rgba(59,130,246,0.35)]'
                        : 'bg-slate-800/60 border-slate-700/60 group-hover:scale-105'
                    }`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </span>
                    <span className="text-xs font-semibold">Settings</span>
                    {adminView === 'settings' && <span className="h-1.5 w-1.5 rounded-full bg-blue-300" />}
                  </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-screen">
              {/* Header */}
              <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-blue-700 to-emerald-700 text-white shadow-xl">
                <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
                <div className="pointer-events-none absolute -bottom-16 left-8 h-32 w-32 rounded-full bg-cyan-300/20 blur-3xl" />
                <div className="flex items-center justify-between px-5 py-5">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-white/15 border border-white/20 grid place-items-center shadow-lg">
                      <span className="text-lg font-black">GM</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h1 className="text-2xl font-bold tracking-tight">GMCT Attendance</h1>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/15 border border-white/20">
                          Class {session.classNumber}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-blue-100/90">Class Leader</p>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white rounded-xl font-semibold transition text-sm backdrop-blur-sm border border-white/20"
                  >
                    Logout
                  </button>
                </div>
                <div className="h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              </div>

              {/* Content Area */}
              <div className="flex-1 overflow-y-auto bg-gray-50 pb-20">
                {classView === 'attendance' ? (
                  <>
                    <AttendanceMarking
                      classNumber={session.classNumber}
                      onLogout={handleLogout}
                      onShowReports={() => setClassView('reports')}
                      isAdminView={false}
                    />
                    <SyncManager />
                  </>
                ) : classView === 'recent-attendance' ? (
                  <RecentAttendanceView classNumber={session.classNumber} />
                ) : classView === 'records' ? (
                  <AttendanceRecords
                    classNumber={session.classNumber}
                  />
                ) : classView === 'reports' ? (
                  <ClassReports
                    classNumber={session.classNumber}
                    onBack={() => setClassView('attendance')}
                  />
                ) : (
                  <ClassLeaderProfile
                    classNumber={session.classNumber}
                  />
                )}
              </div>

              {/* Bottom Navigation */}
              <div className="fixed bottom-3 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 rounded-2xl border border-slate-700/70 bg-slate-900/80 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl safe-area-bottom">
                <div className="relative">
                  <div className="pointer-events-none absolute inset-2">
                    <div
                      className="h-12 rounded-xl border border-blue-500/30 bg-gradient-to-r from-blue-500/20 via-cyan-500/10 to-blue-500/20 shadow-[0_0_24px_rgba(56,189,248,0.25)] transition-transform duration-300"
                      style={{ width: 'calc(100% / 5)', transform: `translateX(${classTabIndex * 100}%)` }}
                    />
                  </div>
                  <div className="relative z-10 grid grid-cols-5 h-16 px-2">
                  <button 
                    onClick={() => setClassView('attendance')} 
                    className={`group flex flex-col items-center justify-center gap-1 rounded-xl transition-all duration-200 ${
                      classView === 'attendance' 
                        ? 'text-white' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className={`grid h-9 w-9 place-items-center rounded-xl border transition-transform duration-200 group-active:scale-95 ${
                      classView === 'attendance'
                        ? 'scale-105 bg-blue-500/20 border-blue-500/60 text-blue-200 shadow-[0_0_18px_rgba(59,130,246,0.35)]'
                        : 'bg-slate-800/60 border-slate-700/60 group-hover:scale-105'
                    }`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </span>
                    <span className="text-xs font-semibold text-center">Mark</span>
                    {classView === 'attendance' && <span className="h-1.5 w-1.5 rounded-full bg-blue-300" />}
                  </button>
                  <button 
                    onClick={() => setClassView('recent-attendance')} 
                    className={`group flex flex-col items-center justify-center gap-1 rounded-xl transition-all duration-200 ${
                      classView === 'recent-attendance' 
                        ? 'text-white' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className={`grid h-9 w-9 place-items-center rounded-xl border transition-transform duration-200 group-active:scale-95 ${
                      classView === 'recent-attendance'
                        ? 'scale-105 bg-blue-500/20 border-blue-500/60 text-blue-200 shadow-[0_0_18px_rgba(59,130,246,0.35)]'
                        : 'bg-slate-800/60 border-slate-700/60 group-hover:scale-105'
                    }`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </span>
                    <span className="text-xs font-semibold text-center">Recent</span>
                    {classView === 'recent-attendance' && <span className="h-1.5 w-1.5 rounded-full bg-blue-300" />}
                  </button>
                  <button 
                    onClick={() => setClassView('records')} 
                    className={`group flex flex-col items-center justify-center gap-1 rounded-xl transition-all duration-200 ${
                      classView === 'records' 
                        ? 'text-white' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className={`grid h-9 w-9 place-items-center rounded-xl border transition-transform duration-200 group-active:scale-95 ${
                      classView === 'records'
                        ? 'scale-105 bg-blue-500/20 border-blue-500/60 text-blue-200 shadow-[0_0_18px_rgba(59,130,246,0.35)]'
                        : 'bg-slate-800/60 border-slate-700/60 group-hover:scale-105'
                    }`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </span>
                    <span className="text-xs font-semibold text-center">Records</span>
                    {classView === 'records' && <span className="h-1.5 w-1.5 rounded-full bg-blue-300" />}
                  </button>
                  <button 
                    onClick={() => setClassView('reports')} 
                    className={`group flex flex-col items-center justify-center gap-1 rounded-xl transition-all duration-200 ${
                      classView === 'reports' 
                        ? 'text-white' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className={`grid h-9 w-9 place-items-center rounded-xl border transition-transform duration-200 group-active:scale-95 ${
                      classView === 'reports'
                        ? 'scale-105 bg-blue-500/20 border-blue-500/60 text-blue-200 shadow-[0_0_18px_rgba(59,130,246,0.35)]'
                        : 'bg-slate-800/60 border-slate-700/60 group-hover:scale-105'
                    }`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </span>
                    <span className="text-xs font-semibold text-center">Reports</span>
                    {classView === 'reports' && <span className="h-1.5 w-1.5 rounded-full bg-blue-300" />}
                  </button>
                  <button 
                    onClick={() => setClassView('settings')} 
                    className={`group flex flex-col items-center justify-center gap-1 rounded-xl transition-all duration-200 ${
                      classView === 'settings' 
                        ? 'text-white' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className={`grid h-9 w-9 place-items-center rounded-xl border transition-transform duration-200 group-active:scale-95 ${
                      classView === 'settings'
                        ? 'scale-105 bg-blue-500/20 border-blue-500/60 text-blue-200 shadow-[0_0_18px_rgba(59,130,246,0.35)]'
                        : 'bg-slate-800/60 border-slate-700/60 group-hover:scale-105'
                    }`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </span>
                    <span className="text-xs font-semibold text-center">Settings</span>
                    {classView === 'settings' && <span className="h-1.5 w-1.5 rounded-full bg-blue-300" />}
                  </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </>
  );
}

export default App;
