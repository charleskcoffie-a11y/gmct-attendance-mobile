import { useState, useEffect } from 'react';
import { getAppSettings, supabase } from '../supabase';

interface LoginProps {
  onLogin: (classNumber: number, accessCode: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [className, setClassName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [maxClasses, setMaxClasses] = useState<number | null>(null);
  const [loadingClasses, setLoadingClasses] = useState(true);

  useEffect(() => {
    loadMaxClasses();
    const savedClass = localStorage.getItem('lastClassSelection');
    if (savedClass) {
      setClassName(savedClass);
    }
  }, []);
  const handleClassChange = (value: string) => {
    setClassName(value);
    localStorage.setItem('lastClassSelection', value);
  };


  const loadMaxClasses = async () => {
    try {
      const settings = await getAppSettings();
      const max = typeof settings?.max_classes === 'number' ? settings.max_classes : 10;
      setMaxClasses(max);
    } catch (err) {
      console.error('Error loading classes:', err);
      setMaxClasses(10);
    } finally {
      setLoadingClasses(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const settings = await getAppSettings();
      const dbAdminCode = settings?.admin_password;
      const envAdminCode = import.meta.env.VITE_ADMIN_CODE || 'admin123';
      
      const adminCode = dbAdminCode || envAdminCode;
      
      // Check for admin access
      if (password.trim().toLowerCase() === adminCode.toLowerCase() && className === 'admin') {
        onLogin(-1, password.trim());
        return;
      }

      // Validate class leader credentials
      if (!className || !password) {
        setError('Please select a class and enter your password');
        setLoading(false);
        return;
      }

      const classNum = parseInt(className);
      
      // Check class_leaders table for matching class and password
      const { data: leaders, error: dbError } = await supabase
        .from('class_leaders')
        .select('*')
        .eq('class_number', classNum)
        .eq('password', password.trim())
        .eq('active', true)
        .limit(1);

      if (dbError) {
        console.error('Database error:', dbError);
        setError('Connection error. Please try again.');
        setLoading(false);
        return;
      }

      if (leaders && leaders.length > 0) {
        const leader = leaders[0];
        onLogin(classNum, password.trim());
        // Store leader info for profile access
        localStorage.setItem('classLeaderId', leader.id);
        localStorage.setItem('classLeaderName', leader.full_name || '');
      } else {
        setError('Invalid class number or password. Please try again.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Connection error. Please check your internet and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-emerald-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-20 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-16 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(56,189,248,0.12),_transparent_60%)]" />
      </div>
      <div className="relative w-full max-w-md">
        <div className="rounded-3xl p-[1px] bg-gradient-to-br from-blue-400/60 via-emerald-400/40 to-cyan-400/60 shadow-2xl">
          <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl p-8 border border-white/10">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-slate-900 via-blue-700 to-emerald-600 rounded-2xl mb-4 shadow-lg border border-white/10">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2 font-['Cinzel'] tracking-wide">GMCT Attendance</h1>
              <p className="text-slate-300">Welcome back — sign in to continue</p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                Secure access • Offline ready
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label htmlFor="className" className="block text-base font-semibold text-slate-200 mb-2">
                  User / Class
                </label>
                <select
                  id="className"
                  value={className}
                  onChange={(e) => handleClassChange(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:border-transparent text-base bg-slate-900/70 text-white"
                  disabled={loadingClasses}
                  required
                  autoFocus
                >
                  <option value="">Select a class or admin</option>
                  <option value="admin">Admin</option>
                  {maxClasses && Array.from({ length: maxClasses }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      Class {i + 1}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="password" className="block text-base font-semibold text-slate-200 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 border border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:border-transparent text-base bg-slate-900/70 text-white"
                  required
                  autoComplete="off"
                />
              </div>

              {error && (
                <div className="bg-red-500/15 border border-red-400/30 text-red-200 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !className || !password || loadingClasses}
                className="w-full bg-gradient-to-r from-cyan-500 via-blue-600 to-emerald-500 text-white py-3 px-4 rounded-xl font-semibold text-lg hover:from-cyan-400 hover:via-blue-500 hover:to-emerald-400 focus:outline-none focus:ring-4 focus:ring-cyan-300/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing In...
                  </span>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-slate-300">
              <p className="font-semibold">📱 Install for offline use</p>
              <p className="text-xs mt-1">Tap Share → Add to Home Screen</p>
              <p className="text-xs mt-2">Contact your administrator for login credentials</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
