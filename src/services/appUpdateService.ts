export function watchAppUpdates(
  registration: ServiceWorkerRegistration,
  onError: (error: unknown) => void,
  onReady: () => void = () => {}
): () => void {
  let checking = false;
  const workers = new Set<ServiceWorker>();
  const detectWaiting = () => {
    if (registration.waiting && navigator.serviceWorker.controller) onReady();
  };
  const watchInstalling = () => {
    const worker = registration.installing;
    if (!worker || workers.has(worker)) return;
    workers.add(worker);
    worker.addEventListener('statechange', detectWaiting);
  };
  const check = async () => {
    detectWaiting();
    if (checking || !navigator.onLine || document.visibilityState !== 'visible') return;
    checking = true;
    try {
      await registration.update();
      watchInstalling();
      detectWaiting();
    } catch (error) {
      onError(error);
    } finally {
      checking = false;
    }
  };
  const onVisible = () => { void check(); };
  window.addEventListener('online', onVisible);
  window.addEventListener('focus', onVisible);
  window.addEventListener('pageshow', onVisible);
  document.addEventListener('visibilitychange', onVisible);
  registration.addEventListener('updatefound', watchInstalling);
  watchInstalling();
  const interval = window.setInterval(onVisible, 60 * 60 * 1000);
  void check();
  return () => {
    window.removeEventListener('online', onVisible);
    window.removeEventListener('focus', onVisible);
    window.removeEventListener('pageshow', onVisible);
    document.removeEventListener('visibilitychange', onVisible);
    registration.removeEventListener('updatefound', watchInstalling);
    for (const worker of workers) worker.removeEventListener('statechange', detectWaiting);
    window.clearInterval(interval);
  };
}

export async function applyAppUpdate(registration: ServiceWorkerRegistration): Promise<void> {
  const worker = registration.waiting;
  if (!worker) throw new Error('The update is no longer waiting. Check for updates again.');
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timeout);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
    const onControllerChange = () => {
      cleanup();
      resolve();
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('The update did not activate. Close all app windows and reopen while online.'));
    }, 20000);
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    try {
      worker.postMessage({ type: 'SKIP_WAITING' });
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
  window.location.reload();
}
