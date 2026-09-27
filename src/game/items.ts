import type { ItemId } from './types';

/** Consumables found in chests, dropped by strong creatures, bought from merchants and given as quest rewards. `duration` is 0 for instant effects. */
export type ItemInfo = { name: string; key: string; color: string; description: string; duration: number; price: number };

export const ITEMS: Record<ItemId, ItemInfo> = {
  healthPotion: { name: 'Healing Draught', key: '1', color: '#ff5f74', description: 'Restores half of your health.', duration: 0, price: 30 },
  manaPotion: { name: 'Starwater Flask', key: '2', color: '#6fb8ff', description: 'Refills all of your magic.', duration: 0, price: 25 },
  swiftTonic: { name: 'Swiftwind Tonic', key: '3', color: '#9fe8b0', description: 'Move 40% faster for 25 seconds.', duration: 25, price: 40 },
  powerElixir: { name: 'Sunfire Elixir', key: '4', color: '#ffb05c', description: 'Spells deal 35% more damage for 30 seconds.', duration: 30, price: 55 },
  barkskin: { name: 'Barkskin Brew', key: '5', color: '#c9a06a', description: 'Take half damage for 25 seconds.', duration: 25, price: 55 },
};
export const ITEM_ORDER: ItemId[] = ['healthPotion', 'manaPotion', 'swiftTonic', 'powerElixir', 'barkskin'];

const LOOT: Array<[ItemId, number]> = [['healthPotion', 40], ['manaPotion', 28], ['swiftTonic', 11], ['powerElixir', 11], ['barkskin', 10]];
export function rollItem(): ItemId {
  let r = Math.random() * LOOT.reduce((s, [, w]) => s + w, 0);
  for (const [id, w] of LOOT) { r -= w; if (r <= 0) return id; }
  return 'healthPotion';
}
