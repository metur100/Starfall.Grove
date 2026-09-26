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

Each chapter is a large open map of 9600 × 6720 px, about 10× bigger than before. Every map has:

- **13 named places:** villages, farms, camps, ruins, lakes, creature lairs, groves, a shrine, a lookout and the guardian's lair.
- **Roads between the places**, with signposts that point the way.
- **Forests shaped by noise**, open meadows and extra ponds between them.
- **Fog of war:** the minimap and the full map (M) reveal the world as you explore.
- **Discovery rewards:** a new place gives XP and becomes a resting point.

The world lives on its own:

- **Villagers:** they sweep, hammer, farm, chop wood, fish, patrol, play tag and travel the roads between villages. They call out to you as you pass.
- **Animals:** rabbits, deer, squirrels, goats, frogs and ducks run away from you, and birds take flight.
- **Buildings:** chimneys smoke, windmills turn, and in the woods and on the summit house windows glow at night.

Things to find:

- Chests (loot and XP)
- Runestones with lore (XP the first time you read one)
- Wells and campfires (restore health and set your resting point)
- Glow pods (mana and hearts)

## Levels, spells and quests

Mira starts with **Spark** and **Dash** only. Defeating creatures, finishing quests, opening chests, reading runestones and discovering places all give XP. Levelling up restores health and magic, raises max mana and spell power, and adds hearts at levels 4, 8 and 12.

| Level | Spell learned |
| --- | --- |
| 1 | Spark (J / Space), Dash (Shift / K) |
| 2 | Leaf Burst (Q) |
| 4 | Sunfire (R) |
| 7 | Moss Shield (F) |
| 10 | Starfall (T) |

Level, XP and quest rewards carry over between chapters.

**Main quest:** talk to the guide, find three key items spread across the map, defeat the guardian, then restore the finale.

**Side quests:** each chapter has 9, of four kinds:

- **Collect:** gather items in a named area.
- **Slay:** defeat a number of creatures.
- **Deliver:** carry an item to someone in another village.
- **Visit:** travel to a distant place.

NPC markers show where quests are: **!** means a quest is available, **?** means one is ready to hand in. Click a quest in the journal to follow it; a green arrow then points to its goal.

Creatures respawn after a while so you can keep levelling. Lairs hold packs with a gold-starred elite.

| Chapter | Guardian | Guardian level |
| --- | --- | --- |
| I · Sunpetal Meadow | Mossback | 4+ |
| II · Whisperroot Woods | Bramble Warden | 8+ |
| III · Starfall Summit | The Hollow Star | 12+ |

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
- **Resolution:** canvas resolution is capped by a pixel budget.
- **Adaptive quality:** ambient detail thins out if frames run long.

## Controls

**Keyboard:**

- Move: WASD / arrows
- Spells: J / Space Spark · Shift / K Dash · Q Leaf Burst · R Sunfire · F Moss Shield · T Starfall
- E / Enter interact · M map · Tab journal · N mute · Esc pause

**Touch:** a floating joystick that appears wherever you put your thumb on the left side, plus a spell wheel on the right. The layout switches automatically on touch devices.

## Project structure

```text
src/
  App.tsx              Screens, HUD, banners, dialogue, journal, map overlay, touch controls
  TitleBackdrop.tsx    Animated night-sky menu background
  styles.css           Visual system and animation library
  game/
    types.ts           Shared game types
    spells.ts          Spell table and unlock levels
    progression.ts     Levels, XP curve and the hero profile that carries between chapters
    worlds.ts          Chapter layouts: places, people, quests, lore and scripts
    worldgen.ts        Builds each map: roads, villages, forests, creatures, loot, critters
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

- `starfall-grove-save-v2`: chapters completed and stars.
- `starfall-grove-hero-v1`: level, XP and quest rewards.
- `starfall-grove-session-v3-<chapter>`: the in-chapter state (position, quests, chests, explored map).

A chapter in progress under the older save format starts fresh; completed chapters are kept.
