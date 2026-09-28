// Save backups. Every hero's progress lives in this browser's storage, so clearing site data would erase it; a backup
// file holds all of it (every hero, their adventure, achievements and the settings) and can be loaded back on any
// device.

const PREFIX = 'starfall-grove-';
type Backup = { app: 'starfall-grove'; version: 1; exported: string; data: Record<string, string> };

/** Saves a file with everything the game has stored: through the Android app's bridge (to Downloads) when the game
 *  runs inside it, since a WebView ignores downloads, or as a normal browser download. `native` says which. */
export function exportBackup(): { count: number; native: boolean; ok: boolean } {
  const data: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith(PREFIX)) data[k] = localStorage.getItem(k) ?? ''; }
  const b: Backup = { app: 'starfall-grove', version: 1, exported: new Date().toISOString(), data };
  const name = `starfall-grove-backup-${new Date().toISOString().slice(0, 10)}.json`, count = Object.keys(data).length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bridge = (window as any).Android;
  if (typeof bridge?.saveFile === 'function') { let ok = false; try { ok = !!bridge.saveFile(name, JSON.stringify(b)); } catch { ok = false; } return { count, native: true, ok }; }
  const blob = new Blob([JSON.stringify(b)], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return { count, native: false, ok: true };
}
/** Reads a backup file: the number of saved entries, or an error message when the file is not a backup. */
export async function readBackup(file: File): Promise<{ ok: true; backup: Backup; heroes: number } | { ok: false; error: string }> {
  try {
    const b = JSON.parse(await file.text()) as Partial<Backup>;
    if (b?.app !== 'starfall-grove' || b.version !== 1 || !b.data || typeof b.data !== 'object') return { ok: false, error: 'That file is not a Starfall Grove backup.' };
    const entries = Object.entries(b.data).filter(([k, v]) => k.startsWith(PREFIX) && typeof v === 'string');
    if (!entries.length) return { ok: false, error: 'That backup is empty.' };
    const heroes = entries.filter(([k]) => k === 'starfall-grove-hero-v1' || /^starfall-grove-hero-[a-z]+-v1$/.test(k)).length;
    return { ok: true, backup: { app: 'starfall-grove', version: 1, exported: String(b.exported || ''), data: Object.fromEntries(entries) }, heroes };
  } catch { return { ok: false, error: 'That file could not be read.' }; }
}
/** Replaces everything stored with the backup's contents. The page reloads afterwards. */
export function restoreBackup(b: Backup) {
  const old: string[] = [];
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith(PREFIX)) old.push(k); }
  for (const k of old) localStorage.removeItem(k);
  for (const [k, v] of Object.entries(b.data)) localStorage.setItem(k, v);
}
export type { Backup };
