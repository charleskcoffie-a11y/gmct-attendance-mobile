import { useState, useEffect } from 'react';
import Login from './components/Login';
import AttendanceMarking from './components/AttendanceMarking';
import AdminAttendanceView from './components/AdminAttendanceView';
import AdminSettings from './components/AdminSettings';
import ClassReports from './components/ClassReports';
import SyncManager from './components/SyncManager';
import { ClassSession } from './types';

function App() {
  const [session, setSession] = useState<ClassSession | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminView, setAdminView] = useState<'attendance' | 'settings'>('attendance');
  const [classView, setClassView] = useState<'attendance' | 'reports'>('attendance');

  useEffect(() => {
    const savedSession = localStorage.getItem('classSession');
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        setSession(parsed);
        setIsAdmin(parsed.classNumber === -1);
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
    localStorage.setItem('classSession', JSON.stringify(newSession));
  };

  const handleLogout = () => {
    setSession(null);
    setIsAdmin(false);
    setAdminView('attendance');
    setClassView('attendance');
    localStorage.removeItem('classSession');
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
                ) : (
                  <AdminSettings onBack={() => setAdminView('attendance')} />
                )}
              </div>

              {/* Bottom Navigation */}
              <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg safe-area-bottom">
                <div className="grid grid-cols-2 h-16">
                  <button 
                    onClick={() => setAdminView('attendance')} 
                    className={`flex flex-col items-center justify-center space-y-1 transition ${adminView === 'attendance' ? 'text-blue-600' : 'text-gray-500'}`}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    <span className="text-xs font-medium">Attendance</span>
                  </button>
                  <button 
                    onClick={() => setAdminView('settings')} 
                    className={`flex flex-col items-center justify-center space-y-1 transition ${adminView === 'settings' ? 'text-blue-600' : 'text-gray-500'}`}
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
            <>
              {classView === 'attendance' ? (
                <>
                  <AttendanceMarking
                    classNumber={session.classNumber}
                    onLogout={handleLogout}
                    onShowReports={() => setClassView('reports')}
                  />
                  <SyncManager />
                </>
              ) : (
                <ClassReports
                  classNumber={session.classNumber}
                  onBack={() => setClassView('attendance')}
                />
              )}
            </>
          )}
        </>
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </>
  );
}

export default App;
