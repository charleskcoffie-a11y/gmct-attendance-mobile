import React, { useEffect, useMemo, useState } from "react";
import { getAppSettings } from "../supabase";

interface AdminClassSelectorProps {
  onSelectClass: (classNumber: number) => void;
}

export const AdminClassSelector: React.FC<AdminClassSelectorProps> = ({
  onSelectClass
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
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">View Class As Admin</h1>
          <p className="text-xs md:text-sm text-slate-400">Select a class to view the leader experience</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-900/30 border border-red-700/40 text-red-200 rounded-lg text-xs">
            {error}
          </div>
        )}

        <div className="bg-slate-900/70 backdrop-blur-sm rounded-xl shadow-lg border border-slate-700/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">Classes</h2>
            <span className="text-[10px] text-slate-400">{maxClasses} total</span>
          </div>

          {loading ? (
            <div className="text-xs text-slate-400">Loading classes...</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {classes.map((classNumber) => (
                <button
                  key={classNumber}
                  onClick={() => onSelectClass(classNumber)}
                  className="p-2.5 bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-lg shadow-sm hover:shadow-md hover:from-slate-800/80 hover:to-indigo-900/40 transition active:scale-95"
                >
                  <div className="text-[9px] text-slate-400 mb-0.5">Class</div>
                  <div className="text-lg font-bold text-cyan-200">{classNumber}</div>
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
