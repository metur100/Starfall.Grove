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

- Chests (potions, loot and XP)
- Runestones with lore (XP the first time you read one)
- Wells and campfires (restore health and set your resting point)
- Glow pods (mana and health)

## Levels, spells and quests

Mira starts with **Spark** and **Dash** only. Defeating creatures, finishing quests, opening chests, reading runestones and discovering places all give XP. Levelling up restores health and magic, raises max health, max mana and spell power, and adds a larger health boost at levels 4, 8 and 12. Health is shown as a bar.

| Level | Spell learned |
| --- | --- |
| 1 | Spark (L), Dash (E) |
| 2 | Leaf Burst (K) |
| 4 | Sunfire (J) |
| 7 | Moss Shield (H) |
| 10 | Starfall (G) |

Level, XP, quest rewards and the bag carry over between chapters.

**Bag and potions:** chests, elite creatures, guardians and every side quest give potions. Open the bag with **I** or the 🎒 button, or use a potion with **1–5**. On touch, a quick button next to the spells drinks a Healing Draught.

| Key | Potion | Effect |
| --- | --- | --- |
| 1 | Healing Draught | Restores half of your health |
| 2 | Starwater Flask | Refills all magic |
| 3 | Swiftwind Tonic | 40% faster movement for 25 s |
| 4 | Sunfire Elixir | 35% more spell damage for 30 s |
| 5 | Barkskin Brew | Half damage taken for 25 s |

**Character sheet:** tap or click the portrait (or press **P**) to see health, magic, regeneration, spell power, speed and adventure stats.

**Main quest:** each chapter tells its story as a chain of main quests: 5 in Chapter I, 7 in Chapter II and 10 in Chapter III (in `story.ts`). Every step is offered in dialogue and ends in a gold **Main quest** window with **Accept** / **Decline**. You speak with people, gather things, clear out creatures, visit places and find the three key relics, and usually the person you report to hands you the next step. The last quest is always the guardian fight, followed by restoring the chapter's light.

**Side quests:** each chapter has 9. Talking to a quest giver shows the quest and its reward with **Accept quest** and **Decline** buttons. There are four kinds:

- **Collect:** gather items in a named area.
- **Slay:** defeat a number of creatures.
- **Deliver:** carry an item to someone in another village.
- **Visit:** travel to a distant place.

The main quest is always **gold** and side quests are **blue**, on NPC markers, arrows, the map and the quest log. **!** means a quest is available, **?** means one is ready to hand in. A small tracker on the right lists the main quest and your active side quests with their counts; click a quest in the quest log to follow it.

Creatures glow and turn red when they are aggressive, and deepen to full red while winding up an attack. While any of them is close and hostile, the edges of the screen glow red.

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
- **Settings (pause menu → ⚙ Settings):** quality (Auto, High, Balanced, Low, Lowest), grass and flowers (Full, Less, Off), weather effects, a 30 fps cap, screen shake and an FPS counter.
- **Graphics quality:** Each level caps the canvas resolution and sets how many glows, particles and screen effects are drawn. Auto starts lower on tablets and low-core devices, then steps down within a second if frames run long and back up once they are smooth.
- **No live blur:** the HUD uses solid glass panels. `backdrop-filter` blur over the constantly redrawn canvas was the biggest cost on weak tablets.
- **Memory:** the ground chunk cache is sized to the view.

## Controls

**Keyboard:**

- Move: WASD / arrows
- Left hand: WASD move · E Dash
- Right hand, home row: L Spark (F also works), then leftward in learning order: K Leaf Burst · J Sunfire · H Moss Shield · G Starfall
- Right hand, menus (row above): U spellbook · I inventory · O quest log · P character
- Space / Enter talk, open or use · 1–5 potions · M map · Tab quest log · N mute · Esc pause

**Reset:** ⚙ Settings → **Reset entire game** (or **Reset game** on the title screen) erases all chapters, levels, potions and quests after a second tap to confirm. Sound and graphics settings are kept.

**Touch:** a floating joystick that appears wherever you put your thumb on the left side, plus a spell wheel on the right. The layout switches automatically on touch devices, and prompts say "Tap" instead of showing keyboard keys.

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
