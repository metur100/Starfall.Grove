import { registerSW } from 'virtual:pwa-register';

// Offline play: the service worker keeps a copy of every game file on the device. A new version downloads quietly in
// the background; the title screen then offers a restart instead of reloading in the middle of a fight.

type Listener = (ready: boolean) => void;
const listeners = new Set<Listener>();
let update: ((reload?: boolean) => Promise<void>) | null = null;
let ready = false;

export function startOffline() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  update = registerSW({
    immediate: true,
    onNeedRefresh() { ready = true; for (const l of listeners) l(true); },
  });
}
/** Calls back with true once a newer version of the game has been downloaded and is waiting. */
export function onUpdateReady(l: Listener) { listeners.add(l); if (ready) l(true); return () => { listeners.delete(l); }; }
/** Switches to the waiting version and reloads the page. A hard reload is scheduled as a fallback in case the
 *  service worker never fires its own reload (the tab would otherwise be stuck showing the "Restart" button). */
export function applyUpdate() {
  const hardReload = () => location.reload();
  if (update) { void update(true).catch(hardReload); window.setTimeout(hardReload, 2500); }
  else hardReload();
}
