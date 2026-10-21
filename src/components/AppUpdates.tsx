import { useEffect, useRef, useState } from 'react';
import { applyAppUpdate, watchAppUpdates } from '../services/appUpdateService';

export default function AppUpdates() {
  const registrationRef = useRef<ServiceWorkerRegistration>();
  const stopWatchingRef = useRef<() => void>();
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState('');
  const [needRefresh, setNeedRefresh] = useState(false);
  const reportError = (error: unknown) => {
    console.error('App update failed:', error);
    setMessage(error instanceof Error ? error.message : 'App update failed. Check your connection and try again.');
  };
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let cancelled = false;
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
      updateViaCache: 'none',
    }).then(registration => {
      if (cancelled) return;
      registrationRef.current = registration;
      stopWatchingRef.current = watchAppUpdates(registration, reportError, () => setNeedRefresh(true));
    }).catch(error => {
      if (!cancelled) reportError(error);
    });
    return () => {
      cancelled = true;
      stopWatchingRef.current?.();
    };
  }, []);

  const checkForUpdate = async () => {
    if (!navigator.onLine) {
      setMessage('Connect to the internet to check for updates.');
      return;
    }
    if (!registrationRef.current) {
      setMessage('The update service is starting. Wait a moment, then try again.');
      return;
    }
    setChecking(true);
    setMessage('');
    try {
      await registrationRef.current.update();
      setMessage('Update check complete. A notice will appear if a new version is ready.');
    } catch (error) {
      reportError(error);
    } finally {
      setChecking(false);
    }
  };
  const applyUpdate = async () => {
    if (updating) return;
    if (!window.confirm('Reload to update the app? Save your attendance and any other edits first. Unsaved changes will be lost.')) return;
    setUpdating(true);
    setMessage('');
    try {
      if (!registrationRef.current) throw new Error('Update service is not ready. Please try again.');
      await applyAppUpdate(registrationRef.current);
    } catch (error) {
      reportError(error);
    } finally {
      setUpdating(false);
    }
  };

  if (!('serviceWorker' in navigator)) return null;

  return (
    <aside
      className={needRefresh
        ? 'fixed inset-x-3 bottom-4 z-50 mx-auto max-w-lg rounded-xl border border-cyan-300 bg-slate-900 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-slate-100 shadow-2xl'
        : 'sticky top-0 z-50 border-b border-slate-700 bg-slate-950 px-4 py-2 text-slate-100'}
      aria-label="App updates"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <p role="status" className="flex-1">
          {needRefresh ? (
            <><strong className="block text-sm text-cyan-200">New update available</strong>Save your work, then tap Update now. No reinstall needed.</>
          ) : message || 'GMCT Connect'}
        </p>
        <button
          type="button"
          disabled={checking || updating}
          onClick={() => { void (needRefresh ? applyUpdate() : checkForUpdate()); }}
          className="min-h-[44px] rounded-lg border border-cyan-300/40 px-3 py-2 font-semibold text-cyan-200 hover:bg-cyan-400/10 disabled:opacity-50"
        >
          {updating ? 'Updating...' : needRefresh ? 'Update now' : checking ? 'Checking...' : 'Check for updates'}
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-400" aria-label="Installed app version">
        Version {__APP_VERSION__}
      </p>
      {needRefresh && message && <p role="alert" className="mt-2 text-sm text-amber-200">{message}</p>}
    </aside>
  );
}
