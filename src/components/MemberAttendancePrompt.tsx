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

interface MemberAttendancePromptProps {
  memberId: string;
}

const getLocalDate = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

const getAttendanceStorageKey = (memberId: string, attendanceDate: string) =>
  `gmct-self-attendance:${memberId}:${attendanceDate}`;

export default function MemberAttendancePrompt({ memberId }: MemberAttendancePromptProps) {
  const [checking, setChecking] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<PendingLocation | null>(null);
  const [saving, setSaving] = useState(false);
  const [markedToday, setMarkedToday] = useState(() => {
    try {
      return localStorage.getItem(getAttendanceStorageKey(memberId, getLocalDate())) === 'marked';
    } catch (storageError) {
      console.error('Unable to read saved self-attendance status:', storageError);
      return false;
    }
  });
  const [message, setMessage] = useState<string | null>(() => (
    markedToday ? 'Attendance taken for today.' : null
  ));
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (markedToday || new Date().getDay() !== 0 || !navigator.geolocation) return;

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
  }, [markedToday, memberId]);

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
      const attendanceDate = result.attendance_date || getLocalDate();
      try {
        localStorage.setItem(getAttendanceStorageKey(memberId, attendanceDate), 'marked');
      } catch (storageError) {
        console.error('Unable to save self-attendance status on this device:', storageError);
      }
      setMarkedToday(true);
      setPendingLocation(null);
      setMessage('Attendance taken for today.');
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
          <p className="text-sm text-emerald-100" role="status">{message}</p>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="ml-auto rounded-lg p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            aria-label="Dismiss attendance confirmation"
          >
            <X className="h-4 w-4" />
          </button>
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