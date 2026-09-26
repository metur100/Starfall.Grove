# Starfall Grove

A responsive single-player 2D action-RPG built with React, TypeScript and Vite. The world is drawn with the Canvas 2D API; React handles menus, HUD, touch controls, dialogue and the journal. Sound effects are synthesized with Web Audio, so there are no asset files.

## Run the project

Requirements: Node.js 18+ and npm.

```bash
npm install
npm run dev      # development server
npm run build    # production build
npm run preview  # preview the build
```

## Chapters, spells and guardians

Each chapter teaches a new spell at its shrine and ends with a boss that has its own attack patterns and an enraged second phase.

| Chapter | New spell | Boss | Boss attacks |
| --- | --- | --- | --- |
| I · Sunpetal Meadow | **Sunfire** (R): exploding sun orb | Mossback | Ground slam, boulder barrage, summons Gloomlings |
| II · Whisperroot Woods | **Moss Shield** (F): blocks damage, reflects projectiles | Bramble Warden | Thorn nova rings, racing root lines, bramble charge |
| III · Starfall Summit | **Starfall** (T): meteor shower on nearby foes | The Hollow Star | Void spiral, meteor rain, blink-and-slam |

Always available: **Spark** (J / Space, homing and can crit), **Dash** (Shift / K, you can't be hit while dashing) and **Leaf Burst** (Q).

Every chapter also has three key items that break the boss seal, two side quests (+1 max heart, faster mana), breakable glow pods that drop mana and hearts, and enemies that wander, notice you and chase.

## Living world

Trees and grass sway in the wind, and grass bends as Mira walks through it. Leaves and petals fall, butterflies and fireflies drift, water ripples and sparkles, and cloud shadows pass over the meadow. The woods and summit use dynamic lighting from lanterns, spells, mushrooms and crystals. Combat adds screen shake, hit-stop, particles, combo counts, damage numbers and cinematic boss intros. It respects `prefers-reduced-motion`.

## Controls

**Keyboard:** WASD / arrows move · J / Space Spark · Shift / K Dash · Q Leaf Burst · R Sunfire · F Moss Shield · T Starfall · E / Enter interact · Tab journal · M mute · Esc pause.

**Touch:** virtual joystick on the left, spell wheel on the right. The layout switches automatically on touch devices.

## Project structure

```text
src/
  App.tsx              Screens, HUD, banners, dialogue, journal, touch controls
  TitleBackdrop.tsx    Animated night-sky menu background
  styles.css           Visual system and animation library
  game/
    types.ts           Shared game types
    spells.ts          Spell table and per-chapter unlocks
    worlds.ts          Three chapter maps, scripts and procedural scenery
    engine.ts          Movement, combat, boss AI, quests, particles, saves
    render.ts          Canvas renderer: scenery, characters, effects, lighting, minimap
    audio.ts           Synthesized sound effects
    GameCanvas.tsx     Game loop and autosave
    storage.ts         In-chapter save helpers
```

## Save data

Progress is stored in browser storage on the current device (campaign `starfall-grove-save-v2`, plus a per-chapter session save). Chapters cleared under the old two-chapter save carry over.
