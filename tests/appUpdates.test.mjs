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
  return ts.transpileModule(source, {
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
  const navigator = { onLine: true };
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
  const stop = exports.watchAppUpdates({ update }, error => errors.push(error));
  return { window, document, navigator, errors, stop, tick: () => interval?.(), intervalMs };
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

const updatesCode = await compile('../src/components/AppUpdates.tsx');
function updateControls({ ready = false, online = true, confirm = true, registration, failUpdate = false } = {}) {
  let updated = 0;
  const messages = [];
  let options;
  const exports = {};
  const fakeRequire = name => {
    if (name === 'react') return {
      useRef: () => ({ current: registration }),
      useState: initial => [initial, value => messages.push(value)],
      useEffect() {},
    };
    if (name === 'virtual:pwa-register/react') return {
      useRegisterSW(value) {
        options = value;
        return {
          needRefresh: [ready],
          async updateServiceWorker(reload) {
            assert.equal(reload, true);
            updated++;
            if (failUpdate) throw new Error('Update failed');
          },
        };
      },
    };
    if (name === '../services/appUpdateService') return { watchAppUpdates() { return () => {}; } };
    return require(name);
  };
  new Function('require', 'exports', 'navigator', 'window', updatesCode)(
    fakeRequire, exports, { serviceWorker: {}, onLine: online },
    { confirm(text) { assert.match(text, /Unsaved changes will be lost/); return confirm; } },
  );
  const tree = exports.default();
  const button = tree.props.children.props.children[1];
  return { tree, button, messages, options: () => options, updated: () => updated };
}

test('update controls are touch-sized, available without login, and require confirmation', async () => {
  const controls = updateControls({ ready: true });
  const markup = renderToStaticMarkup(controls.tree);
  assert.match(markup, /Update app/);
  assert.match(markup, /Save your work/);
  assert.match(markup, /min-h-\[44px\]/);
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
  assert.ok(unready.messages.some(message => String(message).includes('not ready')));
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
  assert.equal(options.workbox.cleanupOutdatedCaches, true);
});
