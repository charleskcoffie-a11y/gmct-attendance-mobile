import { useState, useEffect } from 'react';
import Login from './components/Login';
import AttendanceMarking from './components/AttendanceMarking';
import AdminAttendanceView from './components/AdminAttendanceView';
import AdminSettings from './components/AdminSettings';
import AdminClassSelector from './components/AdminClassSelector';
import ClassReports from './components/ClassReports';
import ClassLeaderProfile from './components/ClassLeaderProfile';
import AttendanceRecords from './components/AttendanceRecords';
import SyncManager from './components/SyncManager';
import { ClassSession } from './types';

function App() {
  const [session, setSession] = useState<ClassSession | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminView, setAdminView] = useState<'attendance' | 'settings' | 'class'>('attendance');
  const [classView, setClassView] = useState<'attendance' | 'reports' | 'settings' | 'records'>('attendance');
  const [adminSelectedClass, setAdminSelectedClass] = useState<number | null>(null);
  const [adminClassView, setAdminClassView] = useState<'attendance' | 'reports'>('attendance');

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
              <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 via-slate-800 to-slate-800/95 border-t-2 border-slate-700 shadow-2xl backdrop-blur-md safe-area-bottom">
                <div className="grid grid-cols-3 h-16">
                  <button 
                    onClick={() => setAdminView('attendance')} 
                    className={`flex flex-col items-center justify-center space-y-1 transition hover:bg-white/5 rounded-t-xl ${
                      adminView === 'attendance' 
                        ? 'text-blue-400 border-t-2 border-blue-500' 
                        : 'text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    <span className="text-xs font-medium">Attendance</span>
                  </button>
                  <button 
                    onClick={() => setAdminView('class')} 
                    className={`flex flex-col items-center justify-center space-y-1 transition hover:bg-white/5 rounded-t-xl ${
                      adminView === 'class' 
                        ? 'text-blue-400 border-t-2 border-blue-500' 
                        : 'text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs font-medium">View Class</span>
                  </button>
                  <button 
                    onClick={() => setAdminView('settings')} 
                    className={`flex flex-col items-center justify-center space-y-1 transition hover:bg-white/5 rounded-t-xl ${
                      adminView === 'settings' 
                        ? 'text-blue-400 border-t-2 border-blue-500' 
                        : 'text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-xs font-medium">Settings</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-screen">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
                <div className="flex items-center justify-between px-4 py-4">
                  <div>
                    <h1 className="text-xl font-bold">GMCT Attendance</h1>
                    <p className="text-xs text-blue-100">Class Leader</p>
                  </div>
                  <button onClick={handleLogout} className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium transition text-sm backdrop-blur-sm">
                    Logout
                  </button>
                </div>
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
                ) : classView === 'reports' ? (
                  <ClassReports
                    classNumber={session.classNumber}
                    onBack={() => setClassView('attendance')}
                  />
                ) : classView === 'records' ? (
                  <AttendanceRecords
                    classNumber={session.classNumber}
                  />
                ) : (
                  <ClassLeaderProfile
                    classNumber={session.classNumber}
                  />
                )}
              </div>

              {/* Bottom Navigation */}
              <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 via-slate-800 to-slate-800/95 border-t-2 border-slate-700 shadow-2xl backdrop-blur-md safe-area-bottom">
                <div className="grid grid-cols-4 h-16">
                  <button 
                    onClick={() => setClassView('attendance')} 
                    className={`flex flex-col items-center justify-center space-y-1 transition hover:bg-white/5 rounded-t-xl ${
                      classView === 'attendance' 
                        ? 'text-blue-400 border-t-2 border-blue-500' 
                        : 'text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    <span className="text-xs font-medium text-center">Mark</span>
                  </button>
                  <button 
                    onClick={() => setClassView('records')} 
                    className={`flex flex-col items-center justify-center space-y-1 transition hover:bg-white/5 rounded-t-xl ${
                      classView === 'records' 
                        ? 'text-blue-400 border-t-2 border-blue-500' 
                        : 'text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-xs font-medium text-center">Records</span>
                  </button>
                  <button 
                    onClick={() => setClassView('reports')} 
                    className={`flex flex-col items-center justify-center space-y-1 transition hover:bg-white/5 rounded-t-xl ${
                      classView === 'reports' 
                        ? 'text-blue-400 border-t-2 border-blue-500' 
                        : 'text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span className="text-xs font-medium text-center">Reports</span>
                  </button>
                  <button 
                    onClick={() => setClassView('settings')} 
                    className={`flex flex-col items-center justify-center space-y-1 transition hover:bg-white/5 rounded-t-xl ${
                      classView === 'settings' 
                        ? 'text-blue-400 border-t-2 border-blue-500' 
                        : 'text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-xs font-medium text-center">Settings</span>
                  </button>
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
