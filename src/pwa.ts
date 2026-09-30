import { registerSW } from 'virtual:pwa-register';

// Offline play: the service worker keeps a copy of every game file on the device. A new version downloads quietly in
// the background; the title screen and the pause menu then offer a restart instead of reloading in the middle of a
// fight. Phones rarely reload an installed game (they resume it), so the game also looks for a new version when it
// comes back to the front and every half hour.

type Listener = (ready: boolean) => void;
const listeners = new Set<Listener>();
let ready = false, restarting = false;

export function startOffline() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  registerSW({
    immediate: true,
    onNeedRefresh() { ready = true; for (const l of listeners) l(true); },
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => { if (navigator.onLine && !ready) reg.update().catch(() => { /* try again later */ }); };
      setInterval(check, 30 * 60 * 1000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    },
  });
}
/** Calls back with true once a newer version of the game has been downloaded and is waiting. */
export function onUpdateReady(l: Listener) { listeners.add(l); if (ready) l(true); return () => { listeners.delete(l); }; }
/**
 * Switches to the waiting version and reloads the page. It asks the waiting service worker itself to take over and
 * reloads the moment it does. Should it not take over within a few seconds (some phones keep it waiting), the old one
 * is dropped and the page reloads from the web, which installs the new version fresh; offline it simply reloads.
 */
export async function applyUpdate() {
  if (restarting) return; restarting = true;
  let done = false;
  const reload = () => { if (!done) { done = true; location.reload(); } };
  const sw = navigator.serviceWorker;
  try {
    const reg = sw && await sw.getRegistration();
    const waiting = reg?.waiting;
    if (!reg || !waiting) { reload(); return; }
    sw.addEventListener('controllerchange', reload);
    waiting.addEventListener('statechange', () => { if (waiting.state === 'activated') reload(); });
    waiting.postMessage({ type: 'SKIP_WAITING' });
    window.setTimeout(async () => {
      if (done) return;
      if (navigator.onLine) await reg.unregister().catch(() => false);
      reload();
    }, 3000);
  } catch { reload(); }
}
