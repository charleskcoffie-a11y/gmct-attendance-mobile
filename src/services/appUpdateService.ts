export function watchAppUpdates(
  registration: ServiceWorkerRegistration,
  onError: (error: unknown) => void
): () => void {
  let checking = false;
  const check = async () => {
    if (checking || !navigator.onLine || document.visibilityState !== 'visible') return;
    checking = true;
    try {
      await registration.update();
    } catch (error) {
      onError(error);
    } finally {
      checking = false;
    }
  };
  const onVisible = () => { void check(); };
  window.addEventListener('online', onVisible);
  document.addEventListener('visibilitychange', onVisible);
  const interval = window.setInterval(onVisible, 60 * 60 * 1000);
  void check();
  return () => {
    window.removeEventListener('online', onVisible);
    document.removeEventListener('visibilitychange', onVisible);
    window.clearInterval(interval);
  };
}
