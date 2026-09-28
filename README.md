# Starfall Grove

A responsive single-player 2D action RPG built with React, TypeScript and Vite. The world is drawn with the Canvas 2D API, and React handles the menus, HUD, touch controls, dialogue, journal and map. All music and sound are synthesized live with Web Audio, so there are no asset files.

**Plays offline and installs like an app.** A service worker (made by `vite-plugin-pwa`) keeps every game file on the device after the first visit, so the game opens with no connection and loads faster. The app manifest lets phones and PCs install it to the home screen, where it opens full screen with its own icon. A new version downloads quietly in the background; the title screen then shows **A new version is ready · Restart**, so it never reloads in the middle of a fight. The fonts (Cinzel Decorative, Cinzel, Nunito) ship with the game, latin letters and used weights only, so text never jumps when a font arrives late. Until the code has loaded, `index.html` shows its own loading screen (logo, a spinning star and rising sparks), which fades once the fonts are in.

## Run the project

Requirements: Node.js 18+ and npm.

```bash
npm install
npm run dev      # development server
npm run build    # production build
npm run preview  # preview the build
```

Every push to `master` deploys to GitHub Pages through `.github/workflows/deploy.yml`.

## The world

The valley is **one continuous world** (38,912 × 6,720 px) made of four lands laid side by side. You walk from one to the next through a gate in the border cliffs. Each land keeps its own look, lighting, weather, music and difficulty:

| Chapter | Land | Creature levels | Guardian |
| --- | --- | --- | --- |
| I · The Broken Beacon | Sunpetal Meadow | 1–6 | Mossback (Lv 7) |
| II · The Bell Beneath the Roots | Whisperroot Woods | 7–12 | Bramble Warden (Lv 13) |
| III · The Hollow Star | Starfall Summit | 13–18 | The Hollow Star (Lv 19) |
| IV · The Dawn Forge | The Ember Wastes | 19–24 | Pyrrhus, the Cinder Tyrant (Lv 25), then **Umbra** (Lv 26), the final boss of all bosses |

The Ember Wastes are an ash desert with lava lakes, falling ash and rising embers, a smoky red night and their own desert theme and soundscape. Its creatures are new: **ember imps** (hover out of reach and throw fire), **ash scorpions** (burrow under the sand and burst up beneath you; the ring on the ground is the warning) and **magma hulks** (crack the ground open around themselves and under you). Its city is Brasshaven.

Creature levels rise from a land's entrance to its far side. Every creature shows a coloured **Lv** tag (grey, green, white, orange, red with a skull), and a banner warns you when you walk into a land that is too strong for you. Creatures above your level take less damage from you and hit much harder.

Each land has a **main city** (Goldenhearth, Lanternmarket, Skyhold, Brasshaven): a fountain plaza, manors, rows of houses, market stalls, a **merchant** (potions), a **smith** (upgrades) and an **inn** (rest and resting point). Each land also has villages, a farm, camps, ruins, lakes, lairs, a grove, a shrine and its finale.

Things to find: chests (potions, bombs, gear, gold, XP), runestones with lore, wells and fountains, campfires, glow pods and caged captives.

## Story

Master Orrin vanished the night the star fell. Mira and her fox Tuft follow his trail across the valley and learn that the Beacon, the Bell and the Star were lit to seal away **Umbra, the Eclipse**. Orrin's lost pupil **Sable** is putting the lights out because Umbra promised to end her pain. On the Summit, Mira frees Orrin, learns that he pulled the star down trying to heal Sable, and wins Sable back. When the Hollow Star breaks and returns to its Cradle, Umbra slips out of the shell and flees east into the Ember Wastes. There Pyrrhus, the Cinder Tyrant, guards the cold Dawn Forge; once he falls, Umbra rises from all four lands at once. It uses every guardian's attacks. Lighting the Dawn Forge ends the story.

The main story (in `story.ts`) has **10 quests in Chapter I, 15 in Chapter II, 19 in Chapter III and 13 in Chapter IV**. The other heroes get the same story with their own name, and without Tuft.

**No chapter screen:** when a chapter's light is restored, a *Chapter complete* banner plays over the game for a few seconds (story line, stars, time, side quests and the chapter's achievement), then the next chapter's title appears and its first quest starts by itself. After the last chapter the ending follows. Older saves that were left waiting on the old chapter screen (where the next quest had no arrow and could not be finished) are repaired when they load.

## Levels, spells and quests

There are five heroes, each with their own level, gold, bag, quests, achievements and chapter stars. The title screen has one **Play** button; it leads to the character select screen, where the chosen hero stands in 3D on a rune pedestal (drag to turn them), wearing the gear they have equipped, and **Enter world** starts or continues that hero's adventure. Levels go up to 25. Mira travels with Tuft the fox and Wren with Fenn the wolf; the others travel alone, and the story's nudges come from their own thoughts.

The 3D heroes (`src/ui/hero3d.ts`) are built from simple shapes with three.js, which is loaded only when a 3D view is first shown. Without WebGL a large portrait is shown instead.

| Level | Mira, star warlock (ranged) | Kael, warrior (melee) | Lyra, frost mage (ranged) | Riven, shadow assassin (melee) |
| --- | --- | --- | --- | --- |
| 1 | Spark (L), Dash (E) | Slash (L), Charge (E) | Frost Bolt (L): chills, Blink (E): short teleport that leaves frost | Twin Daggers (L): two stabs, crits deal triple, Shadowstep (E): appear behind the nearest foe, next stab is a sure crit |
| 3 | Sunfire (K) | Shield Wall (K) | Frost Nova (K): freezes everything nearby for 2 s | Fan of Knives (K): ten knives in every direction |
| 6 | Moss Shield (J) | Earthsplitter (J): stunning shockwave | Ice Barrier (J): blocks all harm, chills attackers | Smoke Veil (J): vanish for 4 s, first strike deals triple damage |
| 10 | Starfall (H) | Bladestorm (H): 3 s whirlwind, half damage taken | Blizzard (H): 4 s of ice raining on a pack | Death Mark (H): the toughest foe near you bursts after 2 s |

**Wren, beast hunter (ranged), with Fenn the wolf:** Quick Shot (L): an arrow that pierces the first creature it hits · Tumble (E): an untouchable roll, and Fenn pounces on the nearest foe and stuns it · Volley (K, level 3): seven arrows in a fan · Snare Trap (J, level 6): a trap at her feet that catches and hurts the first creatures to step on it for 3 s (up to three traps, 20 s each) · Call of the Wild (H, level 10): for 8 s two spirit wolves join the hunt and Fenn bites twice as fast and hard. Fenn follows her everywhere, runs at whatever she shoots (or anything fighting her) and bites on his own; he can't be hurt. In 3D he sits beside her on the pedestal.

Mira fights from range and is fragile. Kael fights up close, has more health and takes about 35% less damage; his Charge is a short rush (about 230 px) that stops at the foe it aims for. Lyra controls fights: chilled creatures move and act at 55% speed, frozen ones stand still. Riven is the fastest hero and hits hardest, but is lightly armoured. On touch screens the shield sits right next to the attack button. The spellbook shows each ability's current damage, cost and cooldown, plus your smith upgrade ranks.

Levelling is paced so you reach Whisperroot at about level 7 and the Summit at about level 13. Creatures far below your level give little XP.

**Spell stars:** every ability can be upgraded five times in the spellbook (U) with gold. Each star adds 12% damage (15% for Charge); Dash gets 8% shorter cooldown per star, and the two shields last 12% longer. Star *n* needs hero level `ability level + 3 × (n − 1)`.

**Equipment and loot:** eight slots: head, shoulders, back, chest, hands, waist, legs and feet. Worn gear changes how the hero looks, in the game and in 3D: each piece dyes its body part (hat or helm, robe or armour, cape, gloves, belt, boots) in a colour picked from its land and rarity, shoulder pads and leg guards appear when worn, and epic and legendary pieces glow. Pieces come in five rarities (common, uncommon, rare, epic, legendary) and roll armour, power, health, magic, regeneration, speed or critical chance from a budget set by item level and rarity. Creatures sometimes drop a glowing loot bag, elites and chests often do, guardians always drop an epic. Every side quest rewards a rare piece (shown in the offer), and guardian quests an epic one. A piece for a slot that is still empty is put on straight away; everything else goes into the bag. Worn gear is capped at 40% armour, 25% speed and 30% critical chance in total.

**Character and bag:** one screen (I for the bag tab, P or the portrait for stats). The hero stands in 3D in the middle with the slots around them, WoW-style; the bag is a 36-slot grid that scrolls on phones. Tap anything to see its card: use or throw a consumable, put it on the second quick button, or equip a piece. **Loot comparison:** bag slots carry a green ▲ when a piece is better than what you wear in that slot and a red ▼ when it is weaker; on PC, hovering a piece shows a tooltip with every stat compared (green ▲ / red ▼ per stat), the overall verdict ("▲ Upgrade · +22 item score") and the worn piece below. The same comparison is on the tapped card, at the armourer, and in the loot notice ("▲ upgrade"). Merchants buy spare gear.

**Consumables:** Healing Draught, Starwater Flask, Swiftwind Tonic, Sunfire Elixir and Barkskin Brew (keys 1–5), plus Fire Bomb, Frost Bomb (freezes for 3 s), Thunder in a Jar (lightning on up to six foes), Smoke Bomb (creatures lose you for 8 s) and Giant's Brew (keys 6–0), Sands of Haste (all cooldowns ready, then twice as fast), Four-leaf Clover (+50% XP and gold) and the Phoenix Feather, which revives you on the spot when you would fall.

**Achievements (Y, or the quest log's Achievements tab):** 49 achievements in six categories (Story, Guardians, Combat, Exploration, Quests, Character), worth 905 points, in the spirit of WoW. They cover finishing each chapter and beating each guardian, creatures and elites defeated, combos, critical hits, places, chests and runestones, the fog lifted off the world map, side quests and rescues, levels, gold, a full set of gear, epic and legendary finds, five-star abilities, and more. Earning one shows a gold pop-up; the tab shows points, a filter per category and the progress of every achievement. Progress an older save already made is counted when it loads.

**World map (M):** the whole valley at once, all four lands side by side, with the fog lifted wherever the hero has been. It opens zoomed on the current land; drag to pan, pinch or scroll to zoom, or jump with the buttons (Whole valley or one land).

**Android back button:** the page keeps an extra history entry, so back never leaves the game by accident. While playing it closes whatever is open, or opens the pause menu (which has **Leave game**). On the title screen it asks "Do you really want to leave the game?". Leaving closes the app through the wrapper's bridge if it offers one (`Android.exitApp`, Capacitor or Cordova); otherwise the next back press closes it.

**Gold and upgrades:** creatures, chests and quests give gold. Merchants sell potions and bombs, and buy anything you don't need: gear, potions, bombs and charms (for 40% of their price). **Armourers** (⛨, one in every city) sell equipment, but it is not easy to get: six pieces per shelf (one uncommon, three rare, two epic, sometimes a legendary), at 8–12 times what a merchant would pay for them. The best pieces are above your level and stay locked until you reach it. Each piece can be bought once, and the shelf is restocked when you level up. Smiths sell three upgrades with five ranks each: Starsteel Weapon (+8% power), Warden's Mantle (−6% damage taken) and Heartstone Amulet (+30 max health). Falling in battle drops 10% of your gold.

**Quests:** gold main quests and blue side quests (47 side quests in total). Quest kinds are collect, slay, deliver, visit, talk, relic and boss, plus **rescue**: defeat the guards around a cage, then open it to free the captive. The quest offer ends with **Decline / Accept**, with Accept on the right, and the buttons ignore taps for half a second so a skip-tap can't answer by accident.

**Creatures:** gloomlings, thornlings, void wisps, bristleboars (telegraphed charge), sporecaps (poison clouds), shadewolves (circling packs), webspinners (slowing silk), frost wraiths (blink and ice shards), crag golems (ground slam), ember imps, ash scorpions and magma hulks. Lairs hold packs led by a gold-starred elite. Defeated creatures **respawn after 4 minutes**.

**Heroic creatures:** the leader of each lair is a named little boss, two per land: Murkmaw the Gloom King and Old Tusker (Meadow), Mother Briar and Silkshade the Weaver (Woods), Frostfang the Unbroken and Nulleye (Summit), Sandreaper and Slagjaw (Ember Wastes). They are bigger, stand in a violet rune ring with a crown, their name and a long health bar, and have nine times an ordinary creature's health. Besides their kind's own attacks they slam the ground every few seconds (a warning ring under them and under you; lava in the Ember Wastes), and at half health they enrage and call two of their kin. They always drop a rare or better piece (often epic, sometimes legendary) plus a second piece, two consumables, lots of gold and nine times the XP. They come back after 10 minutes and show as violet dots on the world map. Achievements: Heroic Deed (the first one) and Bane of the Lairs (eight).

**Mounts:** earned through achievements and kept by that hero: Sunpetal Pony (Wanderer: discover 10 places, +50% speed), Tusked Bristleboar (Heroic Deed, +55%), Whisperroot Stag (finish Chapter II, +65%), Frostmane Wolf (finish Chapter III, +75%), Cinder Drake (finish Chapter IV, +85%) and Starlit Unicorn (defeat Umbra, +100%). Press R or the saddle button in the top bar to ride; you can't call a mount while creatures are after you, and attacking, casting, throwing a bomb or being hit puts you back on your feet. The Achievements tab starts with the stable, where you pick which mount to ride.

**Phones:** the prompt just says **Talk** (or Trade, Rest…), notifications are one or two words, and every screen, including the chapter-complete screen, fits a landscape phone without scrolling.

## Sound and music

- **Music:** composed themes for the menu, each chapter, boss fights and victory (`music.ts`). They crossfade, and chapter themes add a percussion layer when creatures are near.
- **Custom music files:** to use recorded tracks instead, add them under `public/music/` with a `manifest.json` such as `{ "meadow": "meadow.mp3" }`.
- **Sound effects:** layered and positional, so they pan and fade with distance, with a shared reverb.
- **Ambience:** birds, crickets, owls, dripping water, wind and crystal chimes per chapter. Water and campfires get louder as you walk near them.
- **Footsteps:** they change with the ground (grass, road, stone, snow).
- **Volume:** master, music and effects sliders in the pause menu.

## Performance

- **Ground:** pre-rendered into cached 512 px chunks.
- **Trees and buildings:** cached sprites that sway with a cheap skew.
- **Queries:** everything is looked up through spatial grids, so only what is on screen or nearby gets drawn or collided with.
- **Distant entities:** creatures, villagers and animals far from Mira sleep.
- **Settings (pause menu → ⚙ Settings):** quality (Auto, High, Balanced, Low, Lowest), grass and flowers (Full, Less, Off), weather effects, a 30 fps cap, screen shake and an FPS counter.
- **Graphics quality:** Each level caps the canvas resolution and sets how many glows, particles and screen effects are drawn. Auto starts lower on tablets and low-core devices, then steps down within a second if frames run long and back up once they are smooth.
- **No live blur:** the HUD uses solid glass panels. `backdrop-filter` blur over the constantly redrawn canvas was the biggest cost on weak tablets.
- **Memory:** the ground chunk cache is sized to the view.

## Controls

**Keyboard (default keys, all of them can be changed):**

- Move: WASD / arrows
- Left hand: WASD move · E Dash · R ride
- Right hand, home row: L attack (F also works while it is unbound), then leftward in learning order: K · J · H (see the table above)
- Right hand, menus (row above): U spellbook · I inventory · O quest log · P character · Y achievements
- Space / Enter talk, open or use · 1–0 potions and bombs · M map · Tab quest log · N mute · Esc pause

**Remapping keys:** Settings → Controls lists every action; click one and press the new key. A key that is already in use swaps places with it, so nothing is left unbound, and Reset brings back the defaults. The arrow keys always move, 1–0 stay on the potion slots, and Esc, Tab and Enter keep their jobs. Every key hint in the game (spell buttons, pause menu, spellbook, title screen) shows the keys you chose. The bindings are saved in `starfall-grove-keys-v1`.

**Settings:** the ⚙ button on the title screen (and ⚙ Settings in the pause menu) has all graphics and sound settings, plus **Back up your saves** (below), **Start over** (erases only the chosen hero and starts a new adventure) and **Delete all saves** (erases every hero). Both ask for a second tap. Sound and graphics settings are kept.

**Touch:** a floating joystick that appears wherever you put your thumb on the left side, plus a spell wheel on the right. The layout switches automatically on touch devices, and prompts say "Tap" instead of showing keyboard keys.

## Project structure

```text
src/
  App.tsx              Screens, HUD, banners, dialogue, journal, map overlay, touch controls
  TitleBackdrop.tsx    Animated night-sky menu background
  styles.css           Visual system and animation library
  game/
    types.ts           Shared game types
    spells.ts          Heroes, their abilities and unlock levels
    progression.ts     Levels, XP curve and the hero profile that carries between chapters
    story.ts           The main story: 57 quests across four chapters
    achievements.ts    The achievements, their categories, goals and points
    worlds.ts          Region layouts: places, people, side quests, lore and scripts
    worldgen.ts        Builds each region and stitches them into one valley: roads, cities, villages, forests, creatures, loot
    spatial.ts         Uniform grid for fast proximity and view queries
    engine.ts          Movement, combat, bosses, quests, villagers, wildlife, exploration, saves
    render.ts          Canvas renderer: ground chunks, sprites, characters, lighting, minimap, world map
    audio.ts           Audio core, sound effects, footsteps and ambient soundscapes
    music.ts           Music sequencer and composed themes
    GameCanvas.tsx     Game loop, pixel budget, adaptive quality, music switching, autosave
    storage.ts         In-chapter save helpers
    mounts.ts          The mounts, their speeds and the achievements that earn them
    keys.ts            Remappable key bindings
    backup.ts          Save backup export and import
  pwa.ts               Offline service worker registration and the update notice
```

## Save data

Progress is stored in browser storage on the current device:

- `starfall-grove-save-v2`, `starfall-grove-hero-v1`, `starfall-grove-valley-v1`: Mira's chapter stars, profile (level, XP, gold, upgrades, bag) and adventure in progress.
- The same keys with `-kael`, `-lyra`, `-riven` or `-wren` in the name hold the other heroes' progress, including their achievements and the chosen mount.
- Armourer pieces already bought are kept in the profile (`bought`).
- `starfall-grove-hero-choice`: the hero picked on the title screen.

**Backups:** Settings → **Back up your saves** → **Export** downloads one file (`starfall-grove-backup-<date>.json`) with every `starfall-grove-` entry: all heroes, their adventures, achievements, key bindings and settings. **Import** reads such a file, says when it was made and how many heroes it holds, and after a second tap replaces every save on this device with it and reloads. Files that aren't backups are refused. Use it before clearing browser data, or to move your heroes to another device.

Saves from the older three-map version start a fresh adventure. The hero's level and bag are kept.
