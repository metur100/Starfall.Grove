import type { ItemId } from './types';

/**
 * Consumables found in chests, dropped by strong creatures, bought from merchants and given as quest rewards.
 * `duration` is 0 for instant effects. `icon` picks the bag picture; `key` is the keyboard shortcut (if any).
 */
export type ItemIconKind = 'flask' | 'bomb' | 'jar' | 'hourglass' | 'clover' | 'feather';
export type ItemInfo = { name: string; key: string; color: string; description: string; duration: number; price: number; icon: ItemIconKind; kind: 'potion' | 'bomb' | 'charm' };

export const ITEMS: Record<ItemId, ItemInfo> = {
  healthPotion: { name: 'Healing Draught', key: '1', color: '#ff5f74', description: 'Restores half of your health.', duration: 0, price: 30, icon: 'flask', kind: 'potion' },
  manaPotion: { name: 'Starwater Flask', key: '2', color: '#6fb8ff', description: 'Refills all of your magic.', duration: 0, price: 25, icon: 'flask', kind: 'potion' },
  swiftTonic: { name: 'Swiftwind Tonic', key: '3', color: '#9fe8b0', description: 'Move 40% faster for 25 seconds.', duration: 25, price: 40, icon: 'flask', kind: 'potion' },
  powerElixir: { name: 'Sunfire Elixir', key: '4', color: '#ffb05c', description: 'Spells deal 35% more damage for 30 seconds.', duration: 30, price: 55, icon: 'flask', kind: 'potion' },
  barkskin: { name: 'Barkskin Brew', key: '5', color: '#c9a06a', description: 'Take half damage for 25 seconds.', duration: 25, price: 55, icon: 'flask', kind: 'potion' },
  fireBomb: { name: 'Fire Bomb', key: '6', color: '#ff7a3d', description: 'Thrown at the nearest foe: a roaring blast of flame hits everything around it.', duration: 0, price: 45, icon: 'bomb', kind: 'bomb' },
  frostBomb: { name: 'Frost Bomb', key: '7', color: '#8fd8ff', description: 'Shatters into ice: every creature nearby is frozen solid for 3 seconds.', duration: 0, price: 50, icon: 'bomb', kind: 'bomb' },
  thunderJar: { name: 'Thunder in a Jar', key: '8', color: '#ffe96b', description: 'Uncork it and lightning strikes up to six foes around you.', duration: 0, price: 65, icon: 'jar', kind: 'bomb' },
  smokeBomb: { name: 'Smoke Bomb', key: '9', color: '#b8b0c8', description: 'Vanish in a cloud: creatures lose track of you and ignore you for 8 seconds.', duration: 8, price: 35, icon: 'bomb', kind: 'bomb' },
  giantBrew: { name: 'Giant’s Brew', key: '0', color: '#c98aff', description: 'Grow to giant size for 20 seconds: +40% damage, 30% less damage taken, huge knockback.', duration: 20, price: 90, icon: 'flask', kind: 'potion' },
  hourglass: { name: 'Sands of Haste', key: '', color: '#f2d38a', description: 'Every cooldown is ready at once, and they recover twice as fast for 10 seconds.', duration: 10, price: 70, icon: 'hourglass', kind: 'charm' },
  luckyClover: { name: 'Four-leaf Clover', key: '', color: '#6fdc7a', description: '+50% experience and gold for 90 seconds.', duration: 90, price: 80, icon: 'clover', kind: 'charm' },
  phoenixFeather: { name: 'Phoenix Feather', key: '', color: '#ff9a4a', description: 'Carried, not drunk: when you would fall, it burns and brings you back with 60% health.', duration: 0, price: 220, icon: 'feather', kind: 'charm' },
};
export const ITEM_ORDER: ItemId[] = ['healthPotion', 'manaPotion', 'swiftTonic', 'powerElixir', 'barkskin', 'fireBomb', 'frostBomb', 'thunderJar', 'smokeBomb', 'giantBrew', 'hourglass', 'luckyClover', 'phoenixFeather'];

const LOOT: Array<[ItemId, number]> = [
  ['healthPotion', 36], ['manaPotion', 24], ['swiftTonic', 9], ['powerElixir', 9], ['barkskin', 8],
  ['fireBomb', 9], ['frostBomb', 7], ['thunderJar', 5], ['smokeBomb', 6], ['giantBrew', 3], ['hourglass', 3], ['luckyClover', 3], ['phoenixFeather', 1],
];
export function rollItem(): ItemId {
  let r = Math.random() * LOOT.reduce((s, [, w]) => s + w, 0);
  for (const [id, w] of LOOT) { r -= w; if (r <= 0) return id; }
  return 'healthPotion';
}
