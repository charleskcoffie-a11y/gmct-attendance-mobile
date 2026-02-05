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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              View Class As Admin
            </h1>
            <p className="text-sm text-gray-600">Select a class to view the leader experience</p>
          </div>
          <button
            onClick={onLogout}
            className="px-5 py-3 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-medium transition-all shadow-md border border-gray-200"
          >
            Logout
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
            {error}
          </div>
        )}

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Classes</h2>
            <span className="text-xs text-gray-600">{maxClasses} total</span>
          </div>

          {loading ? (
            <div className="text-sm text-gray-600">Loading classes...</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {classes.map((classNumber) => (
                <button
                  key={classNumber}
                  onClick={() => onSelectClass(classNumber)}
                  className="p-4 bg-gradient-to-br from-white to-blue-50 border border-blue-100 rounded-xl shadow-sm hover:shadow-md hover:from-blue-50 hover:to-indigo-50 transition"
                >
                  <div className="text-xs text-gray-500">Class</div>
                  <div className="text-2xl font-bold text-blue-700">{classNumber}</div>
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
