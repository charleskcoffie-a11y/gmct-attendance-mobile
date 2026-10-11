import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, MapPin, X } from 'lucide-react';
import { markMemberSelfAttendance } from '../supabase';
import {
  checkAttendanceLocation,
  getAttendanceErrorMessage,
} from '../services/attendanceLocationService';

interface PendingLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export default function MemberAttendancePrompt() {
  const [checking, setChecking] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<PendingLocation | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (new Date().getDay() !== 0 || !navigator.geolocation) return;

    setChecking(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const location = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
        };

        try {
          const locationCheck = await checkAttendanceLocation(location);
          if (locationCheck.isWithinArea) {
            setPendingLocation(location);
          }
        } catch (locationError) {
          console.error('Unable to prepare Sunday attendance prompt:', locationError);
        } finally {
          setChecking(false);
        }
      },
      () => setChecking(false),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }, []);

  useEffect(() => {
    if (!message) return;

    const dismissTimer = window.setTimeout(() => setDismissed(true), 3000);
    return () => window.clearTimeout(dismissTimer);
  }, [message]);

  const confirmAttendance = async () => {
    if (!pendingLocation) return;

    setSaving(true);
    setError(null);
    try {
      const result = await markMemberSelfAttendance(
        pendingLocation.latitude,
        pendingLocation.longitude,
        pendingLocation.accuracy
      );
      setPendingLocation(null);
      setMessage(result.already_marked ? 'Your Sunday attendance was already marked.' : 'Your Sunday attendance has been marked.');
    } catch (requestError) {
      setError(getAttendanceErrorMessage(requestError, 'Attendance could not be marked.'));
    } finally {
      setSaving(false);
    }
  };

  if (checking || dismissed || (!pendingLocation && !message && !error)) return null;

  return (
    <div className="fixed inset-x-3 bottom-4 z-50 mx-auto max-w-md rounded-2xl border border-emerald-500/40 bg-slate-950/95 p-4 text-slate-100 shadow-2xl backdrop-blur-xl">
      {message ? (
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
          <p className="text-sm text-emerald-100">{message}</p>
        </div>
      ) : error ? (
        <div className="flex items-start gap-3" role="alert">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
          <div>
            <p className="font-semibold text-amber-200">Attendance was not marked</p>
            <p className="mt-1 text-sm text-amber-100">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="ml-auto rounded-lg p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            aria-label="Dismiss attendance error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
            <div>
              <p className="font-semibold">You are at the church</p>
              <p className="mt-1 text-sm text-slate-300">You have not marked Sunday attendance yet. Mark yourself now?</p>
            </div>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="ml-auto rounded-lg p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              aria-label="Dismiss attendance prompt"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={confirmAttendance}
            disabled={saving}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Saving...' : 'Confirm Attendance'}
          </button>
        </>
      )}
    </div>
  );
}