import type { CSSProperties } from 'react';
import { ITEMS } from '../game/items';
import { RARITY } from '../game/gear';
import type { GearItem, GearSlot, HeroId, ItemId } from '../game/types';

// Small drawn icons: hero faces, consumables and equipment slots. All inline SVG, so they stay sharp at any size.

/** Mira keeps her warlock emoji; the others get drawn faces: Kael in a plumed helm, Lyra under a frost circlet, Riven hooded. */
export function HeroFace({ hero }: { hero: HeroId }) {
  if (hero === 'mira') return <span className="hero-face emoji" aria-hidden="true">🧙‍♀️</span>;
  if (hero === 'lyra') return <svg className="hero-face" viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <radialGradient id="lf-skin" cx=".45" cy=".4" r=".75"><stop offset="0" stopColor="#fff0e4" /><stop offset="1" stopColor="#e8bfa4" /></radialGradient>
      <linearGradient id="lf-hair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f4fbff" /><stop offset="1" stopColor="#9fd0ee" /></linearGradient>
      <linearGradient id="lf-ice" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#7fd0ff" /></linearGradient>
    </defs>
    <path d="M14 34 C 12 50, 16 58, 22 60 L 24 40 Z M50 34 C 52 50, 48 58, 42 60 L 40 40 Z" fill="url(#lf-hair)" />
    <circle cx="32" cy="36" r="16" fill="url(#lf-skin)" />
    <path d="M15 34 C 14 20, 22 13, 32 13 C 42 13, 50 20, 49 34 C 45 27, 40 24, 32 25 C 24 24, 19 27, 15 34 Z" fill="url(#lf-hair)" stroke="#8ac4e6" strokeWidth=".8" />
    <path d="M18 24 C 24 19 40 19 46 24" stroke="#c9eaff" strokeWidth="2.6" fill="none" strokeLinecap="round" />
    <path d="M32 7 L 36 17 L 32 22 L 28 17 Z" fill="url(#lf-ice)" stroke="#7fd0ff" strokeWidth=".8" />
    <path d="M24 12 L 26 19 L 23 21 Z M40 12 L 38 19 L 41 21 Z" fill="url(#lf-ice)" />
    <circle cx="25.5" cy="37" r="2.3" fill="#2a4a6a" /><circle cx="38.5" cy="37" r="2.3" fill="#2a4a6a" />
    <circle cx="26.3" cy="36.2" r=".8" fill="#fff" /><circle cx="39.3" cy="36.2" r=".8" fill="#fff" />
    <circle cx="21" cy="42" r="2.3" fill="#8ec8f0" opacity=".45" /><circle cx="43" cy="42" r="2.3" fill="#8ec8f0" opacity=".45" />
    <path d="M28.5 45 Q 32 47.5 35.5 45" stroke="#9a5a6a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
  </svg>;
  if (hero === 'wren') return <svg className="hero-face" viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient id="wf-hood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6f9a4a" /><stop offset="1" stopColor="#2f5230" /></linearGradient>
      <radialGradient id="wf-skin" cx=".45" cy=".4" r=".75"><stop offset="0" stopColor="#ffe2c8" /><stop offset="1" stopColor="#e2aa80" /></radialGradient>
    </defs>
    <path d="M20 40 C 12 48, 14 58, 20 62 C 22 54, 22 48, 26 44 Z" fill="#a8502e" stroke="#6a3018" strokeWidth=".8" />
    <path d="M32 6 C 47 6, 56 19, 56 36 C 56 46, 52 54, 48 58 L 44 40 L 20 40 L 16 58 C 12 54, 8 46, 8 36 C 8 19, 17 6, 32 6 Z" fill="url(#wf-hood)" stroke="#1f3a20" strokeWidth="1.2" />
    <circle cx="32" cy="37" r="15" fill="url(#wf-skin)" />
    <path d="M17 34 C 18 25, 25 21, 32 21 C 40 21, 46 25, 47 32 C 42 27, 36 26, 32 28 C 27 26, 21 28, 17 34 Z" fill="#a8502e" />
    <circle cx="26" cy="38" r="2.2" fill="#2d3a20" /><circle cx="38" cy="38" r="2.2" fill="#2d3a20" />
    <circle cx="26.8" cy="37.2" r=".8" fill="#fff" /><circle cx="38.8" cy="37.2" r=".8" fill="#fff" />
    <g fill="#b0683a" opacity=".7"><circle cx="23" cy="43" r=".8" /><circle cx="25.5" cy="44" r=".8" /><circle cx="38.5" cy="44" r=".8" /><circle cx="41" cy="43" r=".8" /></g>
    <path d="M28.5 46 Q 32 48.5 35.5 46" stroke="#9a5a4a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    <path d="M50 12 L 56 4 M 53 10 L 58 12" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" />
  </svg>;
  if (hero === 'riven') return <svg className="hero-face" viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient id="rf-hood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5a4a7a" /><stop offset="1" stopColor="#241a34" /></linearGradient>
      <radialGradient id="rf-skin" cx=".45" cy=".4" r=".75"><stop offset="0" stopColor="#f0d0b8" /><stop offset="1" stopColor="#c89878" /></radialGradient>
    </defs>
    <path d="M32 5 C 46 5, 56 18, 56 36 C 56 50, 50 58, 44 61 L 20 61 C 14 58, 8 50, 8 36 C 8 18, 18 5, 32 5 Z" fill="url(#rf-hood)" stroke="#16101f" strokeWidth="1.2" />
    <path d="M18 34 C 18 22, 24 17, 32 17 C 40 17, 46 22, 46 34 L 46 44 L 18 44 Z" fill="url(#rf-skin)" />
    <path d="M18 29 C 22 23, 42 23, 46 29" stroke="#16101f" strokeWidth="3" fill="none" opacity=".35" />
    <path d="M22 33.5 L 29 34.5" stroke="#2a1f1b" strokeWidth="2" strokeLinecap="round" /><path d="M42 33.5 L 35 34.5" stroke="#2a1f1b" strokeWidth="2" strokeLinecap="round" />
    <ellipse cx="25.5" cy="37.5" rx="2.6" ry="1.8" fill="#b69cff" /><ellipse cx="38.5" cy="37.5" rx="2.6" ry="1.8" fill="#b69cff" />
    <circle cx="25.5" cy="37.5" r=".9" fill="#1a1028" /><circle cx="38.5" cy="37.5" r=".9" fill="#1a1028" />
    <path d="M16 41 C 22 39, 42 39, 48 41 L 47 52 C 40 56, 24 56, 17 52 Z" fill="#2e2440" stroke="#16101f" strokeWidth="1" />
    <path d="M20 45 C 28 47, 36 47, 44 45" stroke="#6a5a8a" strokeWidth="1.2" fill="none" />
    <path d="M32 5 L 32 16" stroke="#7a6a9a" strokeWidth="1.2" opacity=".6" />
  </svg>;
  return <svg className="hero-face" viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient id="kf-steel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f0f4fa" /><stop offset=".55" stopColor="#9aa6b8" /><stop offset="1" stopColor="#5a6478" /></linearGradient>
      <radialGradient id="kf-skin" cx=".45" cy=".4" r=".75"><stop offset="0" stopColor="#ffe2c8" /><stop offset="1" stopColor="#e2aa80" /></radialGradient>
    </defs>
    <path d="M31 12 C 42 1, 60 5, 60 25 C 53 16, 45 13, 36 17 Z" fill="#c0392b" />
    <path d="M35 12 C 45 6, 55 10, 58 20" stroke="#ef6a52" strokeWidth="2" fill="none" strokeLinecap="round" />
    <circle cx="32" cy="37" r="17" fill="url(#kf-skin)" />
    <path d="M22 33.5 L 28.5 34.3" stroke="#6b3f2a" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M42 33.5 L 35.5 34.3" stroke="#6b3f2a" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="25.5" cy="38" r="2.3" fill="#2d2420" /><circle cx="38.5" cy="38" r="2.3" fill="#2d2420" />
    <circle cx="26.3" cy="37.2" r=".8" fill="#fff" /><circle cx="39.3" cy="37.2" r=".8" fill="#fff" />
    <circle cx="21" cy="43" r="2.4" fill="#ec8a80" opacity=".45" /><circle cx="43" cy="43" r="2.4" fill="#ec8a80" opacity=".45" />
    <path d="M28 46 Q 32 48.5 36 46" stroke="#9a5a4a" strokeWidth="1.7" fill="none" strokeLinecap="round" />
    <path d="M13 35 C 13 19, 22 11, 32 11 C 42 11, 51 19, 51 35 L 45.5 35 C 44 31 40 29 32 29 C 24 29 20 31 18.5 35 Z" fill="url(#kf-steel)" stroke="#3a4050" strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M14.5 30.5 C 21 26.5 43 26.5 49.5 30.5" stroke="#e8c46a" strokeWidth="3" fill="none" strokeLinecap="round" />
    <path d="M22 17 C 25 14.5 29 13.6 32 13.6" stroke="#fff" strokeWidth="2" opacity=".7" fill="none" strokeLinecap="round" />
    <rect x="30" y="28" width="4" height="14" rx="1.6" fill="url(#kf-steel)" stroke="#3a4050" strokeWidth=".9" />
    <path d="M13 33 L 19 35 L 20 47 C 16 46 13 42 13 39 Z" fill="url(#kf-steel)" stroke="#3a4050" strokeWidth="1" strokeLinejoin="round" />
    <path d="M51 33 L 45 35 L 44 47 C 48 46 51 42 51 39 Z" fill="url(#kf-steel)" stroke="#3a4050" strokeWidth="1" strokeLinejoin="round" />
    <circle cx="18" cy="24" r="1.1" fill="#e8c46a" /><circle cx="46" cy="24" r="1.1" fill="#e8c46a" /><circle cx="32" cy="19" r="1.1" fill="#e8c46a" />
  </svg>;
}

/** A consumable's picture: flasks, bombs, a lightning jar, an hourglass, a clover or a feather. */
export function ItemIcon({ id, size = 34 }: { id: ItemId; size?: number }) {
  const info = ITEMS[id], c = info.color, s = { width: size, height: size } as CSSProperties;
  switch (info.icon) {
    case 'bomb': return <svg style={s} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M27 9 C 30 5, 34 6, 35 3" stroke="#c9a06a" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="35" cy="3.5" r="2.6" fill="#fff4b0" /><circle cx="35" cy="3.5" r="4.5" fill="#ffd27a" opacity=".45" />
      <rect x="22" y="8" width="8" height="6" rx="1.5" transform="rotate(35 26 11)" fill="#6a6a78" />
      <circle cx="18" cy="23" r="13" fill="#2f2a36" /><path d="M6 21 C 10 19 26 19 30 21 L 30 25 C 26 27 10 27 6 25 Z" fill={c} opacity=".9" />
      <circle cx="13" cy="17" r="3.5" fill="#fff" opacity=".35" />
    </svg>;
    case 'jar': return <svg style={s} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="12" y="4" width="16" height="5" rx="1.5" fill="#8a6a4a" />
      <path d="M11 9 H 29 C 32 9 33 12 33 15 V 32 C 33 35 31 37 28 37 H 12 C 9 37 7 35 7 32 V 15 C 7 12 8 9 11 9 Z" fill="rgba(180,220,255,.25)" stroke="#dfeaff" strokeWidth="1.5" />
      <path d="M22 12 L 14 24 H 20 L 17 34 L 27 20 H 21 Z" fill={c} stroke="#fff8c0" strokeWidth=".8" />
    </svg>;
    case 'hourglass': return <svg style={s} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="8" y="3" width="24" height="4" rx="1.5" fill="#8a6a4a" /><rect x="8" y="33" width="24" height="4" rx="1.5" fill="#8a6a4a" />
      <path d="M11 7 H 29 C 29 15 22 17 22 20 C 22 23 29 25 29 33 H 11 C 11 25 18 23 18 20 C 18 17 11 15 11 7 Z" fill="rgba(200,230,255,.22)" stroke="#e8f0ff" strokeWidth="1.3" />
      <path d="M14 11 H 26 C 25 15 21 16 20 19 C 19 16 15 15 14 11 Z" fill={c} /><path d="M13 32 C 14 27 19 26 20 24 C 21 26 26 27 27 32 Z" fill={c} />
    </svg>;
    case 'clover': return <svg style={s} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M20 22 C 22 28 24 32 28 36" stroke="#3f8a4a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {[0, 90, 180, 270].map(r => <path key={r} transform={`rotate(${r} 20 19)`} d="M20 19 C 14 13 14 6 18 6 C 20 6 20 8 20 9 C 20 8 20 6 22 6 C 26 6 26 13 20 19 Z" fill={c} stroke="#3f8a4a" strokeWidth="1" />)}
      <circle cx="20" cy="19" r="2" fill="#bff5c4" />
    </svg>;
    case 'feather': return <svg style={s} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M8 36 L 30 8" stroke="#fff1b8" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M31 5 C 38 12 30 26 18 29 L 11 33 L 14 26 C 16 15 24 7 31 5 Z" fill={c} /><path d="M29 8 C 33 14 27 23 18 26" stroke="#ffd35c" strokeWidth="1.2" fill="none" />
      <path d="M31 5 C 35 9 33 16 28 20" stroke="#ff5f3d" strokeWidth="2" fill="none" opacity=".8" />
    </svg>;
    default: return <svg style={s} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="15.5" y="3" width="9" height="6" rx="1.5" fill="#c9a06a" /><rect x="16.5" y="9" width="7" height="5" fill="rgba(230,240,255,.5)" />
      <path d="M16.5 13 C 9 15 6 20 6 25 C 6 32 12 37 20 37 C 28 37 34 32 34 25 C 34 20 31 15 23.5 13 Z" fill="rgba(220,235,255,.25)" stroke="#f0f4ff" strokeWidth="1.3" />
      <path d="M8 25 C 12 23 28 23 32 25 C 32 31 27 35 20 35 C 13 35 8 31 8 25 Z" fill={c} /><circle cx="14" cy="21" r="2.5" fill="#fff" opacity=".65" />
    </svg>;
  }
}

const SLOT_PATHS: Record<GearSlot, string> = {
  head: 'M6 26 C 6 13 12 6 20 6 C 28 6 34 13 34 26 L 30 26 C 29 21 26 19 20 19 C 14 19 11 21 10 26 Z M18 19 H 22 V 31 H 18 Z',
  shoulders: 'M3 24 C 3 15 9 10 16 10 C 18 10 19 12 19 14 L 19 26 C 13 25 8 25 3 24 Z M37 24 C 37 15 31 10 24 10 C 22 10 21 12 21 14 L 21 26 C 27 25 32 25 37 24 Z',
  back: 'M12 6 H 28 L 30 10 C 33 20 35 28 36 35 C 30 33 25 35 20 33 C 15 35 10 33 4 35 C 5 28 7 20 10 10 Z',
  chest: 'M10 6 L 15 5 C 16 8 18 9 20 9 C 22 9 24 8 25 5 L 30 6 L 36 12 L 31 17 L 30 35 H 10 L 9 17 L 4 12 Z',
  hands: 'M11 36 V 22 L 7 16 C 6 14 8 12 10 14 L 13 18 V 8 C 13 6 16 6 16 8 V 16 V 6 C 16 4 19 4 19 6 V 16 V 7 C 19 5 22 5 22 7 V 17 V 10 C 22 8 25 8 25 10 V 24 C 25 30 23 33 23 36 Z',
  waist: 'M3 15 H 37 V 25 H 3 Z M15 12 H 25 V 28 H 15 Z',
  legs: 'M10 5 H 30 L 31 18 L 28 36 H 22 L 20 18 L 18 36 H 12 L 9 18 Z',
  feet: 'M11 4 H 22 V 22 L 33 26 C 36 27 37 30 36 34 H 9 C 8 30 9 26 10 22 Z',
  weapon: 'M30 3 H 37 V 10 L 18 29 L 21 32 L 18 35 L 15 32 L 9 38 C 8 39 6 39 5 38 L 2 35 C 1 34 1 32 2 31 L 8 25 L 5 22 L 8 19 L 11 22 Z',
};
/** An equipment slot's silhouette, tinted with the item's rarity (or dim when the slot is empty). */
export function GearIcon({ slot, item, size = 34 }: { slot: GearSlot; item?: GearItem | null; size?: number }) {
  const c = item ? RARITY[item.rarity].color : 'rgba(255,255,255,.18)', id = `gi-${slot}-${item?.rarity || 'none'}`;
  return <svg style={{ width: size, height: size }} viewBox="0 0 40 40" aria-hidden="true">
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" stopOpacity={item ? .9 : .25} /><stop offset=".35" stopColor={c} /><stop offset="1" stopColor={item ? '#1a1430' : 'rgba(255,255,255,.08)'} /></linearGradient></defs>
    <path d={SLOT_PATHS[slot]} fill={`url(#${id})`} fillRule="evenodd" stroke={item ? c : 'rgba(255,255,255,.25)'} strokeWidth="1.2" strokeLinejoin="round" />
  </svg>;
}
