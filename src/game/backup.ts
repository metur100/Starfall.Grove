// Save backups. Every hero's progress lives in this browser's storage, so clearing site data would erase it; a backup
// file holds all of it (every hero, their adventure, achievements and the settings) and can be loaded back on any
// device.

const PREFIX = 'starfall-grove-';
type Backup = { app: 'starfall-grove'; version: 1; exported: string; data: Record<string, string> };

/** Downloads a file with everything the game has stored. */
export function exportBackup() {
  const data: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith(PREFIX)) data[k] = localStorage.getItem(k) ?? ''; }
  const b: Backup = { app: 'starfall-grove', version: 1, exported: new Date().toISOString(), data };
  const blob = new Blob([JSON.stringify(b)], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = `starfall-grove-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return Object.keys(data).length;
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
