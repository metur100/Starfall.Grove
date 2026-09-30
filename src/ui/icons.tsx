import type { CSSProperties } from 'react';
import { ITEMS } from '../game/items';
import { RARITY } from '../game/gear';
import type { GearItem, GearSlot, HeroId, ItemId, NpcLook } from '../game/types';
import { heroBust, villagerBust } from '../game/art/bust';

// Small drawn icons: hero faces, consumables and equipment slots. All inline SVG, so they stay sharp at any size.

/** A hero's face: head and shoulders cut from the same paper puppet as in the world. */
export function HeroFace({ hero }: { hero: HeroId }) {
  return <img className="hero-face paper" src={heroBust(hero)} alt="" aria-hidden="true" draggable={false} />;
}
/** A villager's face, cut from the paper figure they have in the world. */
export function PersonFace({ id, look }: { id: string; look: NpcLook }) {
  return <img className="hero-face paper" src={villagerBust(id, look)} alt="" aria-hidden="true" draggable={false} />;
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
  const c = item ? RARITY[item.rarity].color : 'rgba(59,42,47,.2)', id = `gi-${slot}-${item?.rarity || 'none'}`;
  return <svg style={{ width: size, height: size }} viewBox="0 0 40 40" aria-hidden="true">
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" stopOpacity={item ? .9 : .1} /><stop offset=".35" stopColor={c} /><stop offset="1" stopColor={item ? '#1a1430' : 'rgba(59,42,47,.3)'} /></linearGradient></defs>
    <path d={SLOT_PATHS[slot]} fill={`url(#${id})`} fillRule="evenodd" stroke={item ? c : 'rgba(59,42,47,.45)'} strokeWidth="1.2" strokeLinejoin="round" />
  </svg>;
}

/** The journal button: a leather book with a gold star on the cover, a ribbon for quests and a quill for the spellbook. */
export function JournalIcon({ size = 24 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <path d="M6 5.5c0-1.4 1.1-2.5 2.5-2.5H25v22H8.5C7.1 25 6 26.1 6 27.5z" fill="#8a4f3a" stroke="#3a2016" strokeWidth="1.2" />
    <path d="M6 27.5C6 26.1 7.1 25 8.5 25H25v4H8.5C7.1 29 6 28.4 6 27.5z" fill="#f3e6c4" stroke="#3a2016" strokeWidth="1.2" />
    <path d="M9 3.2v21.6" stroke="#5e3222" strokeWidth="1.4" />
    <path d="M16.5 8.2l1.5 3.1 3.4.5-2.5 2.4.6 3.4-3-1.6-3 1.6.6-3.4-2.5-2.4 3.4-.5z" fill="#ffd35c" stroke="#9a6a1a" strokeWidth=".7" />
    <path d="M21.5 25v6l1.8-1.4 1.8 1.4v-6z" fill="#c0392b" />
    <path d="M12.5 20.5h9" stroke="#e8c46a" strokeWidth="1.2" strokeLinecap="round" />
  </svg>;
}

/** The leave button's power symbol, drawn, since the ⏻ character is missing from many phones' fonts. */
export function PowerIcon({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
    <path d="M7.1 6.6a8 8 0 1 0 9.8 0" />
    <path d="M12 3v8.5" />
  </svg>;
}
