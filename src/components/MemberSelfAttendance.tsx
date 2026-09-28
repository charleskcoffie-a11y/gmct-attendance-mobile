import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, MapPin } from 'lucide-react';
import { markMemberSelfAttendance } from '../supabase';

interface MemberSelfAttendanceProps {
  onBack: () => void;
}

export default function MemberSelfAttendance({ onBack }: MemberSelfAttendanceProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingLocation, setPendingLocation] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const hasCheckedOnOpen = useRef(false);

  const checkLocation = () => {
    setLoading(true);
    setMessage(null);
    setError(null);
    setPendingLocation(null);

    if (!navigator.geolocation) {
      setLoading(false);
      setError('Location services are not available on this device.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPendingLocation({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
        });
        setLoading(false);
      },
      (locationError) => {
        setLoading(false);
        setError(
          locationError.code === locationError.PERMISSION_DENIED
            ? 'Location permission is required to mark attendance.'
            : 'We could not determine your location. Please try again near the church.'
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };

  const confirmAttendance = async () => {
    if (!pendingLocation) return;

    setLoading(true);
    setError(null);
    try {
      const result = await markMemberSelfAttendance(
        pendingLocation.latitude,
        pendingLocation.longitude,
        pendingLocation.accuracy
      );
      setPendingLocation(null);
      setMessage(
        result.already_marked
          ? 'Your Sunday attendance was already marked.'
          : 'Your Sunday attendance has been marked.'
      );
    } catch (requestError: any) {
      setError(requestError?.message || 'Attendance could not be marked.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasCheckedOnOpen.current || new Date().getDay() !== 0) return;
    hasCheckedOnOpen.current = true;
    checkLocation();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100">
      <div className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 p-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 transition hover:bg-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <p className="text-sm font-semibold text-slate-200">My Attendance</p>
        </div>
      </div>

      <main className="mx-auto max-w-2xl p-6">
        <section className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6 shadow-xl">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
            <MapPin className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold">Mark Sunday attendance</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Attendance can be marked when you are inside the church attendance area. Your location is used only to verify this check-in.
          </p>

          {pendingLocation && !message && (
            <div className="mt-6 rounded-xl border border-emerald-700 bg-emerald-900/30 p-4 text-emerald-100">
              <p className="text-sm font-semibold">You are at the church location.</p>
              <p className="mt-1 text-sm text-emerald-200/80">Confirm to mark your Sunday attendance.</p>
              <button
                onClick={confirmAttendance}
                disabled={loading}
                className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Saving...' : 'Confirm Attendance'}
              </button>
            </div>
          )}

          <button
            onClick={checkLocation}
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <MapPin className="h-5 w-5" />}
            {loading ? 'Checking location...' : 'Check My Location Again'}
          </button>

          {message && (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-700 bg-emerald-900/30 p-4 text-emerald-200">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm">{message}</p>
            </div>
          )}

          {error && (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-700 bg-amber-900/30 p-4 text-amber-200">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}