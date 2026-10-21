import { Component, ErrorInfo, ReactNode } from 'react';

export default class AppRecovery extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App screen failed to load:', error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
        <div className="max-w-sm space-y-4" role="alert">
          <h1 className="text-xl font-bold">This screen could not load</h1>
          <p>Check your connection, then reload the app. You do not need to reinstall it.</p>
          <p className="text-sm text-slate-300">
            Reloading keeps your sign-in and saved offline attendance, but unsaved edits on this screen will be lost.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-[44px] rounded-lg bg-indigo-600 px-4 py-3 font-semibold hover:bg-indigo-500"
          >
            Reload app
          </button>
        </div>
      </main>
    );
  }
}
