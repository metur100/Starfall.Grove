# Starfall Grove

A responsive single-player 2D action RPG built with React, TypeScript and Vite. The world is drawn with the Canvas 2D API, and React handles the menus, HUD, touch controls, dialogue, journal and map. All music and sound are synthesized live with Web Audio, so there are no asset files.

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

The valley is **one continuous world** (29,184 × 6,720 px) made of three lands laid side by side. You walk from one to the next through a gate in the border cliffs. Each land keeps its own look, lighting, weather, music and difficulty:

| Chapter | Land | Creature levels | Guardian |
| --- | --- | --- | --- |
| I · The Broken Beacon | Sunpetal Meadow | 1–6 | Mossback (Lv 7) |
| II · The Bell Beneath the Roots | Whisperroot Woods | 7–12 | Bramble Warden (Lv 13) |
| III · The Hollow Star | Starfall Summit | 13–18 | The Hollow Star (Lv 19), then Umbra (Lv 20) |

Creature levels rise from a land's entrance to its far side. Every creature shows a coloured **Lv** tag (grey, green, white, orange, red with a skull), and a banner warns you when you walk into a land that is too strong for you. Creatures above your level take less damage from you and hit much harder.

Each land has a **main city** (Goldenhearth, Lanternmarket, Skyhold): a fountain plaza, manors, rows of houses, market stalls, a **merchant** (potions), a **smith** (upgrades) and an **inn** (rest and resting point). Each land also has villages, a farm, camps, ruins, lakes, lairs, a grove, a shrine and its finale.

Things to find: chests (potions, gold, XP), runestones with lore, wells and fountains, campfires, glow pods and caged captives.

## Story

Master Orrin vanished the night the star fell. Mira and her fox Tuft follow his trail across the valley and learn that the Beacon, the Bell and the Star were lit to seal away **Umbra, the Eclipse**. Orrin's lost pupil **Sable** is putting the lights out because Umbra promised to end her pain. On the Summit, Mira frees Orrin, learns that he pulled the star down trying to heal Sable, and wins Sable back. When the Hollow Star breaks, Umbra rises from all three lands at once. It uses every guardian's attacks and has three times the Hollow Star's health.

The main story (in `story.ts`) has **10 quests in Chapter I, 15 in Chapter II and 20 in Chapter III**. Finishing a chapter shows a chapter-complete screen with a **Next chapter** button. The world stays the same: you simply walk on.

## Levels, spells and quests

There are two heroes, each with their own level, gold, bag, quests and chapter stars. Pick one on the title screen. Levels go up to 20.

| Level | Mira, star warlock | Kael, warrior |
| --- | --- | --- |
| 1 | Spark (L), Dash (E) | Slash (L), Charge (E) |
| 3 | Sunfire (K) | Shield Wall (K) |
| 6 | Moss Shield (J) | Earthsplitter (J): stunning shockwave |
| 10 | Starfall (H) | Bladestorm (H): 3 s whirlwind, half damage taken |

Mira fights from range and is fragile. Kael fights up close, has more health and takes about 35% less damage. On touch screens the shield sits right next to the attack button. The spellbook shows each ability's current damage, cost and cooldown, plus your smith upgrade ranks.

Levelling is paced so you reach Whisperroot at about level 7 and the Summit at about level 13. Creatures far below your level give little XP.

**Gold and upgrades:** creatures, chests and quests give gold. Merchants sell potions. Smiths sell three upgrades with five ranks each: Starsteel Weapon (+8% power), Warden's Mantle (−6% damage taken) and Heartstone Amulet (+30 max health). Falling in battle drops 10% of your gold.

**Quests:** gold main quests and blue side quests (38 side quests in total). Quest kinds are collect, slay, deliver, visit, talk, relic and boss, plus **rescue**: defeat the guards around a cage, then open it to free the captive. The quest offer ends with **Decline / Accept**, with Accept on the right, and the buttons ignore taps for half a second so a skip-tap can't answer by accident.

**Creatures:** gloomlings, thornlings, void wisps, bristleboars (telegraphed charge), sporecaps (poison clouds), shadewolves (circling packs), webspinners (slowing silk), frost wraiths (blink and ice shards) and crag golems (ground slam). Lairs hold packs led by a gold-starred elite. Defeated creatures **respawn after 60 seconds**.

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

**Keyboard:**

- Move: WASD / arrows
- Left hand: WASD move · E Dash
- Right hand, home row: L attack (F also works), then leftward in learning order: K · J · H (see the table above)
- Right hand, menus (row above): U spellbook · I inventory · O quest log · P character
- Space / Enter talk, open or use · 1–5 potions · M map · Tab quest log · N mute · Esc pause

**Settings:** the ⚙ button on the title screen (and ⚙ Settings in the pause menu) has all graphics and sound settings, plus **Start over** (erases only the chosen hero and starts a new adventure) and **Delete all saves** (erases every hero). Both ask for a second tap. Sound and graphics settings are kept.

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
    story.ts           The main story: 45 quests across three chapters
    worlds.ts          Region layouts: places, people, side quests, lore and scripts
    worldgen.ts        Builds each region and stitches them into one valley: roads, cities, villages, forests, creatures, loot
    spatial.ts         Uniform grid for fast proximity and view queries
    engine.ts          Movement, combat, bosses, quests, villagers, wildlife, exploration, saves
    render.ts          Canvas renderer: ground chunks, sprites, characters, lighting, minimap, world map
    audio.ts           Audio core, sound effects, footsteps and ambient soundscapes
    music.ts           Music sequencer and composed themes
    GameCanvas.tsx     Game loop, pixel budget, adaptive quality, music switching, autosave
    storage.ts         In-chapter save helpers
```

## Save data

Progress is stored in browser storage on the current device:

- `starfall-grove-save-v2`, `starfall-grove-hero-v1`, `starfall-grove-valley-v1`: Mira's chapter stars, profile (level, XP, gold, upgrades, bag) and adventure in progress.
- The same keys with `-kael` in the name hold Kael's progress.
- `starfall-grove-hero-choice`: the hero picked on the title screen.

Saves from the older three-map version start a fresh adventure. The hero's level and bag are kept.
