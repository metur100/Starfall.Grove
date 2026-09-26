# Starfall Grove: The Lost Beacon

A responsive, single-player 2D action-RPG prototype built with React, TypeScript, and Vite. The game world is rendered with the Canvas 2D API, with React handling the menus, touch controls, dialogue, and quest journal. There is no backend or external runtime asset requirement.

## Run the project

Requirements: Node.js 18+ and npm.

1. Extract the ZIP and open the `starfall-grove` folder in a terminal.
2. Install the dependencies declared in `package.json` with npm.
3. Start the Vite development server with `npm run dev`.
4. For a production web build, run `npm run build`; preview it with `npm run preview`.

## Included gameplay

- **Chapter 1 — Sunpetal Meadow: The Broken Beacon**: Bridgekeeper quest, three sun-crystals, three optional glowbugs for Elder Rowan, Pip's lost bell, Gloomlings and Thornlings, and the Mossback boss.
- **Chapter 2 — Whisperroot Woods: The Bell Beneath the Roots**: three root runes, a shrine that unlocks Moss Shield, three optional moon moths, Pip's lost satchel, more creatures, the phase-changing Bramble Warden, and the ancient bell finale.
- Automatic target selection for the Spark attack; Leaf Burst; and a defensive Moss Shield unlocked in Chapter 2.
- Enemy attacks have visible warning circles. Defeated fantasy creatures vanish in leaf-light; there is no blood or graphic injury.
- Main and side quests, dialogue, a fox companion, health/mana, boss health bars, checkpoints, autosaved campaign progress, and autosaved in-level state.
- Responsive tablet/desktop/mobile layout with touch joystick and action buttons, keyboard controls, safe-area spacing, and reduced-motion support.

## Controls

**Touch:** drag the virtual joystick to move. Use Attack, Leaf Burst, Moss Shield, and Interact when available.

**Keyboard:** WASD or arrow keys to move; J or Space to attack; Q for Leaf Burst; F for Moss Shield; E or Enter to interact; Escape to pause.

The attack gently targets the nearest creature in range so precise aiming is not required. The player can pause at any time. If Mira loses all hearts, she returns to her latest checkpoint without losing quest progress.

## Mobile / Android WebView

The project is a Vite web app and can be wrapped in Capacitor for Android or iOS. The touch UI is sized for tablets and adapts to portrait screens, though landscape is recommended. Store signing, native orientation configuration, native billing, and store assets are not included in this source ZIP. Test the WebView build on the actual target tablet before submission.

## Project structure

```text
src/
  App.tsx                 React screens, touch controls, dialogue, quest UI
  styles.css              Responsive visual system
  game/
    types.ts              Game and world types
    worlds.ts             Two world maps, objects, enemy and obstacle placements
    engine.ts             Movement, combat, interactions, quests, saves
    render.ts             Canvas world drawing and camera
    GameCanvas.tsx        Responsive canvas loop and local autosave
    storage.ts            In-level save helpers
```

## Playtime note

The chapters are designed as larger exploratory areas with a main quest, optional errands, combat encounters, and a boss. **Thirty minutes per chapter is a playtest target, not a guaranteed runtime**; actual duration depends on how much the player explores and fights. Adjust the distances, encounter counts, and dialogue after testing with the intended players.

## Save data

Progress is stored on the current device in browser storage. Clearing WebView/site data or uninstalling the app can erase it. No account, tracking, chat, advertising, or online connection is required by this prototype.
