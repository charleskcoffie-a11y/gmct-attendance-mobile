import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
async function compile(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  return ts.transpileModule(source.replaceAll('import.meta.env.BASE_URL', "'/'"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    },
  }).outputText;
}

const watcherCode = await compile('../src/services/appUpdateService.ts');
function createWatcher(update) {
  const window = new EventTarget();
  const document = new EventTarget();
  document.visibilityState = 'visible';
  const serviceWorker = new EventTarget();
  serviceWorker.controller = {};
  const navigator = { onLine: true, serviceWorker };
  const registration = new EventTarget();
  registration.update = update;
  let interval;
  let intervalMs;
  window.setInterval = (callback, milliseconds) => {
    interval = callback;
    intervalMs = milliseconds;
    return 1;
  };
  window.clearInterval = id => {
    assert.equal(id, 1);
    interval = undefined;
  };
  const exports = {};
  new Function('exports', 'window', 'document', 'navigator', watcherCode)(exports, window, document, navigator);
  const errors = [];
  let ready = 0;
  const stop = exports.watchAppUpdates(registration, error => errors.push(error), () => ready++);
  return { window, document, navigator, registration, errors, stop, ready: () => ready, tick: () => interval?.(), intervalMs };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('checks on startup, foreground, reconnect and hourly; cleanup removes all listeners', async () => {
  let checks = 0;
  const watcher = createWatcher(async () => { checks++; });
  await flush();
  assert.equal(checks, 1);
  assert.equal(watcher.intervalMs, 60 * 60 * 1000);
  watcher.document.dispatchEvent(new Event('visibilitychange'));
  await flush();
  watcher.window.dispatchEvent(new Event('online'));
  await flush();
  watcher.tick();
  await flush();
  assert.equal(checks, 4);
  watcher.stop();
  watcher.document.dispatchEvent(new Event('visibilitychange'));
  watcher.window.dispatchEvent(new Event('online'));
  watcher.tick();
  await flush();
  assert.equal(checks, 4);
});

test('does not check while hidden or offline; retries when visible and connected', async () => {
  let checks = 0;
  const watcher = createWatcher(async () => { checks++; });
  await flush();
  watcher.document.visibilityState = 'hidden';
  watcher.document.dispatchEvent(new Event('visibilitychange'));
  watcher.tick();
  await flush();
  assert.equal(checks, 1);
  watcher.document.visibilityState = 'visible';
  watcher.navigator.onLine = false;
  watcher.document.dispatchEvent(new Event('visibilitychange'));
  watcher.tick();
  await flush();
  assert.equal(checks, 1);
  watcher.navigator.onLine = true;
  watcher.window.dispatchEvent(new Event('online'));
  await flush();
  assert.equal(checks, 2);
  watcher.stop();
});

test('deduplicates concurrent checks and surfaces errors without disabling future checks', async () => {
  let reject;
  let checks = 0;
  const watcher = createWatcher(() => {
    checks++;
    if (checks === 1) return new Promise((_resolve, fail) => { reject = fail; });
    return Promise.resolve();
  });
  watcher.tick();
  watcher.window.dispatchEvent(new Event('online'));
  assert.equal(checks, 1);
  const error = new Error('Network failure');
  reject(error);
  await flush();
  assert.deepEqual(watcher.errors, [error]);
  watcher.tick();
  await flush();
  assert.equal(checks, 2);
  watcher.stop();
});

test('detects waiting updates on foreground and installed worker events; cleans up', async () => {
  const watcher = createWatcher(async () => {});
  await flush();
  watcher.registration.waiting = {};
  watcher.window.dispatchEvent(new Event('pageshow'));
  await flush();
  assert.ok(watcher.ready() > 0);
  watcher.registration.waiting = null;
  const worker = new EventTarget();
  watcher.registration.installing = worker;
  watcher.registration.dispatchEvent(new Event('updatefound'));
  watcher.registration.waiting = {};
  const before = watcher.ready();
  worker.dispatchEvent(new Event('statechange'));
  assert.equal(watcher.ready(), before + 1);
  watcher.stop();
  worker.dispatchEvent(new Event('statechange'));
  watcher.window.dispatchEvent(new Event('focus'));
  assert.equal(watcher.ready(), before + 1);
});

test('first installation does not prompt as an update without an existing controller', async () => {
  const watcher = createWatcher(async () => {});
  await flush();
  watcher.navigator.serviceWorker.controller = null;
  watcher.registration.waiting = {};
  watcher.window.dispatchEvent(new Event('focus'));
  await flush();
  assert.equal(watcher.ready(), 0);
  watcher.stop();
});

test('another window activating an update offers a reload without reloading automatically', async () => {
  const watcher = createWatcher(async () => {});
  await flush();
  watcher.registration.active = { state: 'activated' };
  watcher.navigator.serviceWorker.dispatchEvent(new Event('controllerchange'));
  assert.equal(watcher.ready(), 1);
  watcher.stop();
  watcher.navigator.serviceWorker.dispatchEvent(new Event('controllerchange'));
  assert.equal(watcher.ready(), 1);
});

test('update activation reloads only after controller changes and reports timeout/errors', async () => {
  const serviceWorker = new EventTarget();
  let timeout;
  let reloads = 0;
  const window = {
    setTimeout(callback) { timeout = callback; return 1; },
    clearTimeout(id) { assert.equal(id, 1); timeout = undefined; },
    location: { reload() { reloads++; } },
  };
  const exports = {};
  new Function('exports', 'window', 'navigator', watcherCode)(exports, window, { serviceWorker });
  await assert.rejects(exports.applyAppUpdate({}), /no longer waiting/);
  const posted = [];
  const worker = new EventTarget();
  worker.postMessage = message => posted.push(message);
  const registration = { waiting: worker };
  const updating = exports.applyAppUpdate(registration);
  assert.equal(reloads, 0);
  assert.deepEqual(posted, [{ type: 'SKIP_WAITING' }]);
  serviceWorker.dispatchEvent(new Event('controllerchange'));
  await updating;
  assert.equal(reloads, 1);
  const expired = exports.applyAppUpdate(registration);
  timeout();
  await assert.rejects(expired, /did not activate/);
  serviceWorker.dispatchEvent(new Event('controllerchange'));
  assert.equal(reloads, 1);
  const failedWorker = new EventTarget();
  failedWorker.postMessage = () => { throw new Error('Message failed'); };
  await assert.rejects(exports.applyAppUpdate({ waiting: failedWorker }), /Message failed/);
  assert.equal(timeout, undefined);
  const fallback = exports.applyAppUpdate(registration);
  worker.state = 'activated';
  worker.dispatchEvent(new Event('statechange'));
  await fallback;
  assert.equal(reloads, 2);
  serviceWorker.dispatchEvent(new Event('controllerchange'));
  assert.equal(reloads, 2);
  await exports.applyAppUpdate({ active: { state: 'activated' } });
  assert.equal(reloads, 3);
  const redundant = exports.applyAppUpdate(registration);
  worker.state = 'redundant';
  worker.dispatchEvent(new Event('statechange'));
  await assert.rejects(redundant, /could not be installed/);
});

const updatesCode = await compile('../src/components/AppUpdates.tsx');
function updateControls({ ready = false, online = true, confirm = true, registration, failUpdate = false } = {}) {
  let updated = 0;
  const messages = [];
  let options;
  let stateIndex = 0;
  let refIndex = 0;
  const registerCalls = [];
  let watches = 0;
  let stops = 0;
  const exports = {};
  const fakeRequire = name => {
    if (name === 'react') return {
      useRef: () => ({ current: refIndex++ === 0 ? registration : undefined }),
      useState: initial => [stateIndex++ === 3 ? ready : initial, value => messages.push(value)],
      useEffect(effect) { options = effect; },
    };
    if (name === '../services/appUpdateService') return {
      watchAppUpdates() { watches++; return () => { stops++; }; },
      async applyAppUpdate() {
        updated++;
        if (failUpdate) throw new Error('Update failed');
      },
    };
    return require(name);
  };
  new Function('require', 'exports', 'navigator', 'window', '__APP_VERSION__', updatesCode)(
    fakeRequire, exports, {
      serviceWorker: {
        register(url, config) {
          registerCalls.push({ url, config });
          return Promise.resolve(registration);
        },
      },
      onLine: online,
    },
    { confirm(text) { assert.match(text, /Unsaved changes will be lost/); return confirm; } },
    '1.0.1',
  );
  const tree = exports.default();
  const button = tree.props.children[0].props.children[1];
  return {
    tree, button, messages, options: () => options, updated: () => updated,
    registerCalls, watches: () => watches, stops: () => stops,
  };
}

test('native registration bypasses HTTP worker cache and cancels late registration callbacks', async () => {
  const controls = updateControls({ registration: {} });
  const cleanup = controls.options()();
  await flush();
  assert.deepEqual(controls.registerCalls, [{
    url: '/sw.js', config: { scope: '/', updateViaCache: 'none' },
  }]);
  assert.equal(controls.watches(), 1);
  cleanup();
  assert.equal(controls.stops(), 1);
  const cancelled = updateControls({ registration: {} });
  cancelled.options()()();
  await flush();
  assert.equal(cancelled.watches(), 0);
});

test('update controls are touch-sized, available without login, and require confirmation', async () => {
  const controls = updateControls({ ready: true, registration: {} });
  const markup = renderToStaticMarkup(controls.tree);
  assert.match(markup, /New update available/);
  assert.match(markup, /Update now/);
  assert.match(markup, /fixed inset-x-3 bottom-4/);
  assert.match(markup, /Save your work/);
  assert.match(markup, /min-h-\[44px\]/);
  assert.match(markup, /Installed app version/);
  assert.match(markup, /Version 1\.0\.1/);
  controls.button.props.onClick();
  await flush();
  assert.equal(controls.updated(), 1);
  const cancelled = updateControls({ ready: true, confirm: false });
  cancelled.button.props.onClick();
  await flush();
  assert.equal(cancelled.updated(), 0);
});

test('manual checking explains offline/unready states and checks a ready registration', async () => {
  const offline = updateControls({ online: false });
  offline.button.props.onClick();
  await flush();
  assert.ok(offline.messages.some(message => String(message).includes('Connect to the internet')));
  const unready = updateControls();
  unready.button.props.onClick();
  await flush();
  assert.ok(unready.messages.some(message => String(message).includes('starting')));
  let checks = 0;
  const controls = updateControls({ registration: { async update() { checks++; } } });
  controls.button.props.onClick();
  await flush();
  assert.equal(checks, 1);
  assert.equal(controls.updated(), 0);
});

test('recovery screen explains saved versus unsaved data and offers reload', async () => {
  const code = await compile('../src/components/AppRecovery.tsx');
  const exports = {};
  let reloads = 0;
  new Function('require', 'exports', 'window', code)(require, exports, { location: { reload() { reloads++; } } });
  const recovery = new exports.default({ children: 'Original app' });
  assert.equal(recovery.render(), 'Original app');
  recovery.state = exports.default.getDerivedStateFromError();
  const tree = recovery.render();
  const markup = renderToStaticMarkup(tree);
  assert.match(markup, /saved offline attendance/);
  assert.match(markup, /unsaved edits/);
  tree.props.children.props.children[3].props.onClick();
  assert.equal(reloads, 1);
});

test('PWA waits for user approval and cleans obsolete precaches', async () => {
  const code = await compile('../vite.config.ts');
  const exports = {};
  let options;
  new Function('require', 'exports', code)(name => {
    if (name === 'vite') return { defineConfig: value => value };
    if (name === '@vitejs/plugin-react') return () => {};
    if (name === 'vite-plugin-pwa') return { VitePWA(value) { options = value; } };
    throw new Error(`Unexpected import ${name}`);
  }, exports);
  assert.equal(options.registerType, 'prompt');
  assert.equal(options.injectRegister, false);
  assert.equal(options.workbox.clientsClaim, true);
  assert.equal(options.workbox.cleanupOutdatedCaches, true);
});
