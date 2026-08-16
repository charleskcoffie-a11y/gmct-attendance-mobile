import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export default function InstallApp() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setIos(isIosDevice());
    setInstalled(isStandalone());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
      setShowInstructions(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (installed) return null;

  const handleInstall = async () => {
    if (!installEvent) {
      setShowInstructions(true);
      return;
    }

    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') {
      setInstalled(true);
    }
    setInstallEvent(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleInstall}
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/40 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20 focus:outline-none focus:ring-2 focus:ring-cyan-300/60"
      >
        <Download className="h-4 w-4" />
        Install GMCT Connect
      </button>

      {showInstructions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-labelledby="install-title">
          <div className="w-full max-w-sm rounded-2xl border border-cyan-300/30 bg-slate-900 p-5 text-left shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="install-title" className="text-lg font-bold text-white">Install GMCT Connect</h2>
                <p className="mt-1 text-sm text-slate-300">
                  {ios ? 'Install from Safari to add GMCT Connect to your home screen.' : 'Use your browser menu to add GMCT Connect to your home screen.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowInstructions(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
                aria-label="Close installation instructions"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <ol className="mt-4 space-y-3 text-sm text-slate-200">
              {ios ? (
                <>
                  <li className="flex gap-3"><Share className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" /><span>Tap the Share button in Safari.</span></li>
                  <li className="flex gap-3"><span className="font-bold text-cyan-300">2.</span><span>Choose <strong>Add to Home Screen</strong>.</span></li>
                  <li className="flex gap-3"><span className="font-bold text-cyan-300">3.</span><span>Tap <strong>Add</strong>.</span></li>
                </>
              ) : (
                <>
                  <li className="flex gap-3"><span className="font-bold text-cyan-300">1.</span><span>Open the browser menu.</span></li>
                  <li className="flex gap-3"><span className="font-bold text-cyan-300">2.</span><span>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</span></li>
                  <li className="flex gap-3"><span className="font-bold text-cyan-300">3.</span><span>Confirm by tapping <strong>Install</strong> or <strong>Add</strong>.</span></li>
                </>
              )}
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
