import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, RefreshCw, Sparkles } from 'lucide-react';
import { applyAppUpdate, watchAppUpdates } from '../services/appUpdateService';

export default function AppUpdates() {
  const registrationRef = useRef<ServiceWorkerRegistration>();
  const stopWatchingRef = useRef<() => void>();
  const confirmationRef = useRef<HTMLDialogElement>(null);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState('');
  const [needRefresh, setNeedRefresh] = useState(false);
  const [confirming, setConfirming] = useState(false);
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

  useEffect(() => {
    if (confirming) confirmationRef.current?.showModal();
  }, [confirming]);

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
    setConfirming(false);
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

  if (needRefresh) {
    return (
      <aside
        className="fixed inset-x-3 bottom-4 z-50 mx-auto max-w-lg overflow-hidden rounded-2xl border border-cyan-400/40 bg-slate-950 text-slate-100 shadow-2xl shadow-cyan-950/50"
        aria-label="App updates"
      >
        <div className="h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-emerald-400" aria-hidden="true" />
        <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-start gap-3" role="status">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300" aria-hidden="true">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">GMCT Connect</p>
              <p className="mt-1 text-base font-bold text-white">New update available</p>
              <p className="mt-1 text-sm leading-5 text-slate-300">
                A fresh version is ready. Save your attendance and any other edits first; the app will reload.
              </p>
            </div>
          </div>
          {message && <p role="alert" className="mt-3 text-sm text-amber-200">{message}</p>}
          <button
            type="button"
            disabled={checking || updating}
            onClick={() => setConfirming(true)}
            className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:from-cyan-300 hover:to-blue-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:opacity-50"
          >
            <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
            {updating ? 'Updating...' : 'Update now'}
          </button>
          <p className="mt-2 text-center text-xs text-slate-400" aria-label="Installed app version">
            Version {__APP_VERSION__} &middot; No reinstall needed
          </p>
        </div>
        {confirming && (
          <dialog
            ref={confirmationRef}
            onCancel={() => setConfirming(false)}
            aria-labelledby="update-confirm-title"
            aria-describedby="update-confirm-description"
            className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-cyan-400/30 bg-slate-900 p-0 text-slate-100 shadow-2xl backdrop:bg-slate-950/80"
          >
            <div className="p-5">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300" aria-hidden="true">
                <RefreshCw className="h-6 w-6" />
              </span>
              <h2 id="update-confirm-title" className="mt-4 text-xl font-bold text-white">Ready to update?</h2>
              <p id="update-confirm-description" className="mt-2 text-sm leading-6 text-slate-300">
                The app will reload to install the update. Save your attendance and any other edits first; unsaved changes will be lost.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  autoFocus
                  onClick={() => setConfirming(false)}
                  className="min-h-[44px] rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                >
                  Not yet
                </button>
                <button
                  type="button"
                  onClick={() => { void applyUpdate(); }}
                  className="min-h-[44px] rounded-xl bg-gradient-to-r from-cyan-400 to-blue-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:from-cyan-300 hover:to-blue-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                >
                  Update now
                </button>
              </div>
            </div>
          </dialog>
        )}
      </aside>
    );
  }

  return (
    <aside
      className="sticky top-0 z-50 border-b border-slate-700 bg-slate-950 px-4 py-2 text-slate-100"
      aria-label="App updates"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <p role="status" className="flex-1">
          {message || 'GMCT Connect'}
        </p>
        <button
          type="button"
          disabled={checking || updating}
          onClick={() => { void checkForUpdate(); }}
          className="min-h-[44px] rounded-lg border border-cyan-300/40 px-3 py-2 font-semibold text-cyan-200 hover:bg-cyan-400/10 disabled:opacity-50"
        >
          {checking ? 'Checking...' : 'Check for updates'}
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-400" aria-label="Installed app version">
        Version {__APP_VERSION__}
      </p>
    </aside>
  );
}
