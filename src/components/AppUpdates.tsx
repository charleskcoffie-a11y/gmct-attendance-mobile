import { useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { watchAppUpdates } from '../services/appUpdateService';

export default function AppUpdates() {
  const registrationRef = useRef<ServiceWorkerRegistration>();
  const stopWatchingRef = useRef<() => void>();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');
  const reportError = (error: unknown) => {
    console.error('App update failed:', error);
    setMessage('Unable to check for updates. Check your connection and try again.');
  };
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      registrationRef.current = registration;
      stopWatchingRef.current?.();
      stopWatchingRef.current = watchAppUpdates(registration, reportError);
    },
    onRegisterError: reportError,
  });
  useEffect(() => () => stopWatchingRef.current?.(), []);

  const checkForUpdate = async () => {
    if (!navigator.onLine) {
      setMessage('Connect to the internet to check for updates.');
      return;
    }
    if (!registrationRef.current) {
      setMessage('Update service is not ready. Close and reopen the app, then try again.');
      return;
    }
    setChecking(true);
    setMessage('');
    try {
      await registrationRef.current.update();
      setMessage('Update check complete. If a new version is downloading, Update app will appear when ready.');
    } catch (error) {
      reportError(error);
    } finally {
      setChecking(false);
    }
  };
  const applyUpdate = async () => {
    if (!window.confirm('Reload to update the app? Save your attendance and any other edits first. Unsaved changes will be lost.')) return;
    try {
      await updateServiceWorker(true);
    } catch (error) {
      reportError(error);
    }
  };

  if (!('serviceWorker' in navigator)) return null;

  return (
    <aside className="sticky top-0 z-50 border-b border-slate-700 bg-slate-950 px-4 py-2 text-slate-100" aria-label="App updates">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <p role="status" className="flex-1">
          {needRefresh ? 'A new version is ready. Save your work before updating.' : message || 'GMCT Connect'}
        </p>
        <button
          type="button"
          disabled={checking}
          onClick={() => { void (needRefresh ? applyUpdate() : checkForUpdate()); }}
          className="min-h-[44px] rounded-lg border border-cyan-300/40 px-3 py-2 font-semibold text-cyan-200 hover:bg-cyan-400/10 disabled:opacity-50"
        >
          {needRefresh ? 'Update app' : checking ? 'Checking...' : 'Check for updates'}
        </button>
      </div>
    </aside>
  );
}
