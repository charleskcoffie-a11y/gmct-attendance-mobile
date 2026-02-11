import React, { useEffect, useMemo, useState } from "react";
import { getAppSettings } from "../supabase";

interface AdminClassSelectorProps {
  onSelectClass: (classNumber: number) => void;
  onLogout: () => void;
}

export const AdminClassSelector: React.FC<AdminClassSelectorProps> = ({
  onSelectClass,
  onLogout
}) => {
  const [maxClasses, setMaxClasses] = useState<number>(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await getAppSettings();
        const max = typeof settings?.max_classes === "number" ? settings.max_classes : 10;
        setMaxClasses(max);
      } catch (err) {
        setError("Failed to load classes. Using default list.");
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const classes = useMemo(() => {
    return Array.from({ length: maxClasses }, (_, i) => i + 1);
  }, [maxClasses]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-4 md:p-6 text-slate-100">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/15 text-indigo-200 text-xs font-semibold mb-3 border border-indigo-400/30">
              Admin Mode
            </div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              View Class As Admin
            </h1>
            <p className="text-sm md:text-base text-slate-300">Select a class to view the leader experience</p>
          </div>
          <button
            onClick={onLogout}
            className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition-all shadow-md border border-white/20"
          >
            Logout
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-700/40 text-red-200 rounded-xl text-sm">
            {error}
          </div>
        )}

        <div className="bg-slate-900/70 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-700/60 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Classes</h2>
            <span className="text-xs text-slate-400">{maxClasses} total</span>
          </div>

          {loading ? (
            <div className="text-sm text-slate-400">Loading classes...</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {classes.map((classNumber) => (
                <button
                  key={classNumber}
                  onClick={() => onSelectClass(classNumber)}
                  className="p-4 bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl shadow-sm hover:shadow-md hover:from-slate-800/80 hover:to-indigo-900/40 transition"
                >
                  <div className="text-xs text-slate-400">Class</div>
                  <div className="text-2xl font-bold text-cyan-200">{classNumber}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminClassSelector;
