# Starfall Grove

A responsive single-player 2D action RPG built with React, TypeScript and Vite. The world is drawn with the Canvas 2D API, and React handles the menus, HUD, touch controls, dialogue, journal and map. All in-game music and sound are synthesized live with Web Audio. The only media files are the five hero intro films (`public/intro/`).

**Plays offline and installs like an app.** A service worker (made by `vite-plugin-pwa`) keeps every game file on the device after the first visit, so the game opens with no connection and loads faster. The app manifest lets phones and PCs install it to the home screen, where it opens full screen with its own icon. A new version downloads quietly in the background. The game looks for one when it opens, when it comes back to the front, and every half hour. The title screen then shows **A new version is ready** with a **Restart** button. In the game a gold dot appears on the pause button, and the pause menu offers **Restart now**, which saves the adventure first. The game never reloads by itself in the middle of a fight. Restarting asks the new version to take over and reloads as soon as it does. If it hasn't taken over within three seconds, the old copy is dropped and the game reloads from the web, which installs the new version fresh (offline it just reloads). The fonts (Cinzel Decorative, Cinzel, Nunito) ship with the game, latin letters and used weights only, so text never jumps when a font arrives late. Until the code has loaded, `index.html` shows its own loading screen (the name in inked letters, a spinning paper star and a card loading bar), which fades once the fonts are in.

## Run the project

Requirements: Node.js 18+ and npm.

```bash
npm install
npm run dev      # development server
npm run build    # production build
npm run preview  # preview the build
```

Every push to `master` deploys to GitHub Pages through `.github/workflows/deploy.yml`.

## Landing page

The website for promoting the game (landing page, privacy policy, terms, support and imprint) is a separate Vite + React + TypeScript project in `landing/`, meant to live in its own repo. It is not part of the game's build. It carries a copy of the game's paper art, so its heroes look exactly as in the game. See `landing/README.md`.

## The world

The valley is **one continuous world** (38,912 × 6,720 px) made of four lands laid side by side. You walk from one to the next, and every border is a journey of its own:
- **The Meadow and the Woods** are split by the **Gloomwater**, a river that runs the whole height of the valley and can only be crossed on the Gloomwater Bridge once it is rebuilt. Every hero's bridge quest builds it on the river itself: its plan glows across the water, and the timber piles up on the bank. A Frost Step or a leap can't hop the river.
- **The Woods and the Summit** are split by a **snowy mountain range** (`range` in `worldgen.ts`): a wall of peaks along both of its faces, great peaks behind them, and one canyon through it, **Frostspine Pass**. Past the thorn wall at its mouth, a **rockfall** buries the pass: the hero has to smash it (any attack works, bombs and thunder three times as hard; it has 1,800 health and a bar over it). The main arrow leads to it and the quest tracker says *Break through the rockfall*.
- **The Summit and the Ember Wastes** are split by **volcanic mountains** with a great volcano over the canyon, which runs through the mountain as a cave, **the Cindermaw**. A rock roof covers it, fading away while the hero is inside, where it is dark but for the lava in the cracks. The black ice seal stands at its mouth; behind it the **cave mouth has caved in** and has to be smashed open the same way (3,200 health).
Nothing gets over the mountains: the hero, creatures and people are kept out of them, and no teleport passes a rockfall still standing. A save from before the mountains that is already past one counts it as broken. Each land keeps its own look, lighting, weather, music and difficulty:

| Chapter | Land | Creature levels | Guardian |
| --- | --- | --- | --- |
| I · The Broken Beacon | Sunpetal Meadow | 1–6 | Mossback (Lv 7) — each hero meets their own, see Story |
| II · The Bell Beneath the Roots | Whisperroot Woods | 7–12 | Bramble Warden (Lv 13) |
| III · The Hollow Star | Starfall Summit | 13–18 | The Hollow Star (Lv 19) |
| IV · The Dawn Forge | The Ember Wastes | 19–24 | Pyrrhus, the Cinder Tyrant (Lv 25), then **Umbra** (Lv 27–30), the final boss of all bosses, in the depths beneath the Dawn Forge |

The Ember Wastes are an ash desert with lava lakes, falling ash and rising embers, a smoky red night and their own desert theme and soundscape. Its creatures are new: **ember imps** (hover out of reach and throw fire), **ash scorpions** (burrow under the sand and burst up beneath you; the ring on the ground is the warning) and **magma hulks** (crack the ground open around themselves and under you). Its city is Brasshaven.

Creature levels rise from a land's entrance to its far side. Every creature shows a coloured **Lv** tag (grey, green, white, orange, red with a skull), and a banner warns you when you walk into a land that is too strong for you. Creatures above your level take less damage from you and hit much harder.

Each land has a **main city** (Goldenhearth, Lanternmarket, Cloudcrest, Brasshaven): a fountain plaza, manors, rows of houses, market stalls, a **merchant** (potions), a **smith** (upgrades) and an **inn** (rest and resting point). Each land also has villages, a farm, camps, ruins, lakes, lairs, a grove, a shrine and its finale.

**Each land is its own country** (`features` and `forest` on each land in `worlds.ts`, laid out by `addFeatures` in `worldgen.ts`):
- **Sunpetal Meadow:** open green country with fewer woods: great meadows of wildflowers, each its own colour (lavender, poppies, buttercups, daisies) where no tree grows, orchards of fruit trees beside the farms and villages, hedgerows with a gap to walk through, and beehives.
- **Whisperroot Woods:** a much denser forest with giant mossy oaks, dark bogs full of lily pads, fairy rings of glowing toadstools ringed by great mushrooms, and fallen leaves everywhere.
- **Starfall Summit:** mountains: ridges of crags across the slopes (a road always finds a gap), small snowy mountains of their own, cairns along the trails, frozen tarns and snowdrifts.
- **The Ember Wastes:** four volcanoes, smoking and glowing, with lava running down their flanks in cracks; more lava pools, clusters of obsidian spires, steaming fumaroles and old bones.

Things to find: chests (potions, bombs, gear, gold, XP), runestones with lore, wells and fountains, campfires, glow pods and caged captives.

## Story

Master Orrin vanished the night the star fell. Mira and her fox Tuft follow his trail across the valley and learn that the Beacon, the Bell and the Star were lit to seal away **Umbra, the Eclipse**. Orrin's lost pupil **Sable** is putting the lights out because Umbra promised to end her pain. On the Summit, Mira frees Orrin, learns that he pulled the star down trying to heal Sable, and wins Sable back. When the Hollow Star breaks and returns to its Cradle, Umbra slips out of the shell and flees east into the Ember Wastes. There Pyrrhus, the Cinder Tyrant, guards the cold Dawn Forge; once he falls, Umbra rises from all four lands at once. It uses every guardian's attacks. Lighting the Dawn Forge ends the story.

That is Mira's story (`story.ts`, 12 / 17 / 20 / 15 quests per chapter, plus her own quests in `heroStory.ts`): Tuft follows Orrin's scent, she passes the Apprentice's Test at the Moss Shrine, tells Orrin whether she forgives him and builds a star lantern of her own.

**Every other hero plays a main questline of their own** (`src/game/heroes/<hero>.ts`). The lands and side quests are the same for everyone, but each hero's chapters are their own chain of 14–18 main quests, and **no two heroes play the same main quest**. The only shared quests are the four guardian fights and Umbra, told in each hero's own words.

Each hero also has:
- their own quest to open each land's gate;
- their own hiding places for the land's relics (an own key quest with a `place` hides that relic there, for that hero only);
- their own opening near where they wake. The first four or five quests are of different kinds, with new cutscenes: Kael follows his lost knight's horse from Millbrook, Lyra wakes the frost runes at Mirror Lake, Riven returns the Hushed's stolen takings in Goldenhearth, and Wren reads the night her pack vanished at the Old Stone Garden. Umbra's shadow takes the shape of what each hero fears most, so **every hero meets different guardians** (`bosses.ts`), with their own look, name and attacks (aimed volleys, strings of shadow strikes, the ground erupting in spikes, lava or frost, howls that call the pack):

| Hero | Meadow | Woods | Summit | Ember | Umbra |
| --- | --- | --- | --- | --- | --- |
| Mira | Mossback | Bramble Warden | The Hollow Star | Pyrrhus | The Eclipse Sovereign |
| Kael | The Hollow Bulwark | Ser Briarthorn | The Frost Marshal | The Iron Colossus | The Black Oath |
| Lyra | Gloamgill | The Pale Huntress | Queen Hoarfrost | Cinderwyrm | The Endless Winter Night |
| Riven | Corvane | Silkmother Vesh | Nullface | The Ashen Broker | The Shadow That Chose |
| Wren | Gorehide | Duskmane | Starhorn | The Duneworm | The Moon-Eater |

- **Kael, the Oathsworn:** musters the farms and the city guard, finds the Wardens' lost hall and the oath-stones, holds Silver Pass again and is knighted by Warden Brin, then finds Ser Aldric in the Ember Wastes and walks him to the Phoenix Spring.
- **Lyra, Winter's Daughter:** follows the lost post and Nessa's letters, learns her family are Rimewards (frost-singers), frees Nessa early on the Summit and sings the two-voiced Rime Song with her against Queen Hoarfrost.
- **Riven, the Foundling:** steals the Beacon's crystals back from the Hushed, finds the foundling house he grew up in, faces a double wearing his face, reaches Sable himself and breaks the ice seal with her, then takes the Ashen Broker's network apart.
- **Wren, the Pack:** proves it was the Boar King, not wolves, learns Duskmane is the shadow wearing a wolf's shape, frees Starhorn's fawn, and heals Snowmoon at the Phoenix Spring; Burr the poacher is slowly redeemed.

Each hero also has their own chapter endings and cutscenes. `npm run check:stories` checks every hero's chain:
- people present when needed, and places that exist;
- keys before each guardian, and each chapter ending with its gate;
- no shared quest besides the guardians;
- no two heroes' quests with the same title;
- every cutscene pointing at places, people and objects that exist;
- no lines left over from Mira's story.

A save made before a hero's story was rewritten catches up on load: the main quests before the furthest point it reached, and every chapter the hero has already left, count as done, along with their relics.

Each hero also has their own intro and their own lines at key moments, and their own thoughts voice the story's nudges between quests (Tuft does it for Mira).

**The intro film:** a new adventure opens with the hero's own 30-second animated film (`public/intro/<hero>.mp4`, 1280×720, with its own score):
- **Mira:** the star falls past the cottage window, Orrin walks into the dark with his lantern, and at dawn she and Tuft set out.
- **Kael:** the night watch with Ser Aldric, the Beacon bursting into shadow, Aldric's last stand, and Kael's oath at sunrise.
- **Lyra:** the ice shrine under the aurora, Nessa running on the lake road, Lyra's eyes opening, and her walk down the mountain.
- **Riven:** the Hushed's last contract and its black feathers, the run over the rooftops, the shadow Riven knows, and the leap out of the window.
- **Wren:** the pack at the campfire, the howl at the falling star, the shadow taking the wolves, Snowmoon's last look, and the tracks at dawn.

Each score was composed for its film and timed to what happens on screen: music box, strings, choir, horns and drums, with sound effects on the beats of the action (the falling star, the Beacon dying, sword on shield, a heartbeat, wolf howls, rooftop footsteps, a shing as Kael raises his sword). The films are compressed to 2–4.5 MB each and stream as they play. The game's own music and ambience go quiet while one plays, and its volume follows the master, music and effects settings. If the browser won't start it with sound, it plays muted with a *Tap for sound* button. **Skip** (or Esc / Enter) ends it. Then a cutscene of that hero's own night in the valley plays in the game world, and in every one the Beacon is seen burning and then going out in a burst of shadow: Orrin's lantern moving away down the east road (Mira), Kael and Aldric on the Rise and Kael's flight to Millbrook (Kael), Nessa on the lake road with her letters scattering (Lyra), the Hushed counting black feathers in Goldenhearth (Riven), and the pack howling at the Hunter's Camp and running with the shadow (Wren). It ends on the hero where they woke. On a landscape screen the film fills the whole screen; upright, it shows the whole frame. Offline, or if the film can't load within a few seconds, the game goes straight to the hero's full in-game intro cutscene instead (films aren't kept for offline play, to keep the offline download small).

**Where each hero starts:** every hero wakes in a different corner of the first land, and their first quest takes a different road into the story before it joins at Elder Rowan in Sunpetal:
- **Mira** at the Bridgekeeper's Rest: Bridgekeeper Tamsin sends her to Rowan.
- **Kael** at Millbrook Farm, where Farmer Bram found him in the hay: Bram sends him to warn Captain Brannoc in Goldenhearth, and Brannoc sends him on to Rowan.
- **Lyra** on the shore of Mirror Lake, on Nessa's road: Fisher Lou saw a courier girl run past, and sends her to Postmistress Wynne in Sunpetal.
- **Riven** in Goldenhearth: Baker Tom hands over a honey bun and points Riven to Rowan.
- **Wren** at the Old Stone Garden, on her pack's tracks, which lead her west to Sunpetal.

Creatures near each start are no stronger than those around the Rest, so no hero starts among tougher foes. No creature lives within about 1,050 px of any hero's starting point either (creatures that would are moved just outside it), so every adventure begins in peace, out of reach of the nearest pack.

**The in-game intro cutscene** (when the film can't play): the camera flies down into the valley at night: the star streaks across the sky, the Beacon dies in a burst of shadow, gloomlings rise out of the grass, and then comes the hero's own night:
- Orrin walking into the dark (Mira)
- Aldric facing the shadow (Kael)
- Nessa running from the gloom (Lyra)
- the Hushed taking the contract (Riven)
- the wolf pack turning (Wren)

**Cutscenes** (`cutscenes.ts`) play at the story's big moments, 39 in all (ten of them hero intros and arrivals). The camera leaves the hero, pans or cuts to what happened, and letterbox bars and captions (narration or a speaker) tell it. World effects show the change:
- a falling star
- bursts of shadow
- creatures rising from the ground
- burning roofs
- a collapsing bridge
- light sweeping the land
- Umbra's smoke fleeing east
- black ice shattering
- thorns withering
- memories of the past, with people from long ago on stage

Night scenes darken the world, so lamps and fires glow. Tap or Enter moves to the next shot, and Skip (or Esc) ends the scene; its effects still happen. The fighting pauses and the hero can't be hurt while a cutscene plays.

**Chapters don't have to end with a guardian.** A chapter ends with its last main quest, and each land's Eastern Gate is closed until the story opens it:
- **Chapter I** ends by rebuilding the collapsed Gloomwater Bridge.
- **Chapter II** ends by lighting the Bell-lanterns that wither a wall of thorns, after holding Lanternmarket against the shadow's counterattack.
- **Chapter III** ends by walking Orrin to the gate, where he and Sable break Umbra's black-ice seal together.

The last chapter ends with Umbra, then an epilogue shows every light shining. Umbra no longer rises at the Dawn Forge: when Pyrrhus falls, the ground shakes, every shadow in the valley sinks into the earth beneath the Forge, and the ground gives way under the hero (see **The depths** below). There is no chapter-complete screen: the chapter's achievement pops up, its closing cutscene plays (ending on the next chapter's title), and the next land's first quest begins. Older saves are carried onto the longer chains: quests added before the point a save has reached count as done.

## Levels, spells and quests

No ability, item, hero, guardian, mount or place shares its name with one from another well-known game: the spells were renamed in this version (Sunfire → Sunflare, Starfall → Comet Shower, Charge → Lion’s Rush, Shield Wall → Bulwark, Bladestorm → Steel Cyclone, Frost Bolt → Rime Shard, Blink → Frost Step, Frost Nova → Glacial Burst, Ice Block → Glacier Shell, Blizzard → Whiteout, Shadowstep → Shade Step, Fan of Knives → Dagger Burst, Stealth → Nightveil, Death Mark → Doom Sigil, Quick Shot → Swift Arrow, Volley → Arrow Fan, Call of the Wild → Howl of the Pack), and so were Skyhold (now Cloudcrest), Moonfang (Snowmoon), Skyhorn (Starhorn), Shadowmane (Duskmane), the Frostmane Wolf (Rimecoat Wolf), Barkskin Brew (Oakhide Brew), the Frost Bomb (Ice Bomb), the Smoke Bomb (Smoke Pouch) and the Sunfire Elixir (Dawnfire Elixir).

There are five heroes, each with their own level, gold, bag, quests, achievements and chapter stars. The title screen has one **Play** button; it leads to the character select screen, where the chosen hero stands as a paper puppet on a rune pedestal (drag to turn them), wearing the gear they have equipped, and **Enter world** starts or continues that hero's adventure. Levels go up to 30 (they used to stop at 25, so a hero who had finished the story could not grow any more). Gear and the last land's armourer go up to item level 30; fallen stars and the depths are where a hero grows past 25. Mira travels with Tuft the fox and Wren with Fenn the wolf; the others travel alone, and the story's nudges come from their own thoughts.

The pedestal (`src/ui/paperStage.ts`) draws the same figure the world uses, only larger: it breathes, turns in four steps when dragged, shows off a spell now and then and wears the equipped gear. Tuft or Fenn sit beside Mira and Wren.

| Level | Mira, Astralmancer (ranged) | Kael, Knight (melee) | Lyra, Frostweaver (ranged) | Riven, Assassin (melee) |
| --- | --- | --- | --- | --- |
| 1 | Spark (L), Gravity Well (E): a black star on the nearest foe drags creatures into its heart for 2 s and grinds them | Slash (L), Lion’s Rush (E): rush at a foe up to 340 px away, needs a foe | Rime Shard (L): chills, Frost Step (E): short teleport that leaves frost | Twin Daggers (L): two stabs, crits deal triple, Shade Step (E): appear behind a foe up to 380 px away (needs a foe), next stab is a sure crit |
| 3 | Sunflare (K) | Bulwark (K) | Glacial Burst (K): freezes everything nearby for 2 s | Dagger Burst (K): ten knives in every direction |
| 6 | Guardian Stars (J): three stars circle her for 8 s, each catches one blow | Earthsplitter (J): stunning shockwave | Glacier Shell (J): frozen in ice, nothing can harm her, press again to break out | Nightveil (J): invisible to every creature for up to 15 s, first strike deals triple damage |
| 10 | Comet Shower (H) | Steel Cyclone (H): 3 s whirlwind, half damage taken | Whiteout (H): 4 s of ice raining on a pack | Doom Sigil (H): the toughest foe near you bursts after 2 s |

**Wren, Ranger (ranged), with Fenn the wolf:** Swift Arrow (L): an arrow that pierces the first creature it hits · Fenn: Attack / Passive (E): a command to Fenn (see below) · Arrow Fan (K, level 3): seven arrows in a fan · Hawk Leap (J, level 6): she vaults about 270 px away from the nearest foe (or the way she is moving), can't be hurt during the leap, and looses three arrows at it in mid-air; every creature they hit is pinned for 1.5 s (guardians for 0.6 s). It replaced the Snare Trap, which was rarely worth setting; stars bought for the trap carry over · Howl of the Pack (H, level 10): for 8 s two spirit wolves join the hunt and Fenn bites twice as fast and hard. Fenn follows her everywhere, runs at whatever she shoots (or anything fighting her) and bites on his own; he can't be hurt. On the pedestal he sits beside her.

**The toggles:**
- **Fenn's command** (Wren, E): pressed while Fenn is attacking, he goes **passive**: he stays at her heel and attacks nothing, even what she shoots (the button shows 💤 and glows). Pressed again, he goes back to **attack**: he pounces on the nearest foe within 520 px and stuns it (the pounce needs 5 s to come back). Out of combat that means he picks the nearest creature and starts the fight. Howl of the Pack always sends him back to attack.
- **Glacier Shell** (Lyra, J): she is frozen in a clear block of ice. No damage gets through, from blows, projectiles or ground attacks, but she can't move, cast, drink, talk or mount. Pressing it again breaks the ice (it melts by itself after 6 s). The 16 s cooldown starts when she comes out.
- **Nightveil** (Riven, J): he turns into a faint, wavering shimmer. Every creature in the world loses him and none can find him, guardians and heroic creatures included, anywhere, including the dummy world. It lasts up to 15 s. Striking (the first blow is a veil strike for triple damage), getting hurt or pressing it again brings him out. Shade Step keeps him hidden. The 8 s cooldown starts when he comes out.

Mira fights from range, is the most fragile hero and has no escape spell, so she holds foes in place instead: a Gravity Well pulls a pack together for her Sunflare, and Guardian Stars soak the blows that reach her. Kael fights up close, has more health and takes about 35% less damage; his Lion’s Rush needs a foe to aim at, runs up to 340 px and stops at that foe. Lyra controls fights: chilled creatures move and act at 55% speed, frozen ones stand still. Riven hits hardest and can vanish, but is lightly armoured. Wren is the fastest on foot (312 against 255–292 for the others). On touch screens the level-6 ability sits right next to the attack button.

**Balance:** the heroes are tuned to be about equally strong, though some are harder to play well. A simulation (`.sim/bal.ts`, run with esbuild) runs each hero, with no gear or spell stars, under a simple bot. At levels 3 to 25 it fights a creature pack of each land and measures the time to clear it and the health lost. Against each guardian it measures the share of the guardian's health taken in 40 seconds and the damage received. After tuning, every hero clears a pack within about 20% of the others (Lyra had been 60–90% slower). Kael is the toughest. Riven deals the most damage but takes the most, so Riven is the one to play carefully. Mira and Lyra are safer at range. The tuning: Lyra's Rime Shard 12 → 18 (cooldown 0.42 → 0.4 s), Frost Step 10 → 12, Glacial Burst 28 → 40, Whiteout 13 → 18; Mira's Spark 10 → 12, Sunflare 40 → 44, Starfall 34 → 38; Wren's Swift Arrow 11 → 10 and Arrow Fan 20 → 18; Riven now takes 78% of a hit instead of 82%, and gains 10 health per level instead of 9. Ability damage now comes from one table (`spells.ts`), which the engine and the spellbook both read. The spellbook shows each ability's current damage, cost and cooldown, plus your smith upgrade ranks.

**Casting.** Mira's and Lyra's bolts and big spells take a moment to cast, with a small bar filling above the hero's head:

| Spell | Cast time |
| --- | --- |
| Spark | 0.45 s |
| Rime Shard | 0.5 s |
| Sunflare | 0.95 s |
| Whiteout | 1.05 s |

- While casting the hero walks at under half speed.
- Another spell, Frost Step, the Glacier Shell, mounting or a cutscene breaks the cast off.
- Magic is spent and the cooldown starts when the spell goes off.
- A tap on a bolt while it is being cast (or a held key) casts it again straight after.
- Upgrades that speed up a bolt shorten its cast just as much.
- The bolts hit harder to make up for the wait (Spark 17, Rime Shard 22, Sunflare 58).

**Magic, stamina, energy and focus run out.** In a fight they regenerate slowly:
- each hero's own rate (2–2.6 per second);
- a little more each level;
- 40% of what quests and gear add.

Out of a fight they come back 2.5 times as fast.
- A kill gives back a little: a normal creature drops one orb about half the time, and a fifth of those are hearts.
- Glow pods, wells, campfires, level-ups and potions refill more.
- Abilities cost 15–25% more than before; basic attacks are free.

In a bot's minute of pressing every ability on cooldown in a crowd, Mira, Kael and Wren at level 12 ran dry, and Lyra and Riven fell to about a fifth. Before, no hero ever dropped below half.

**More creatures, a little less experience each.** Each land has up to 60 roaming packs (was 34), at least 430 px apart (was 540). A phone screen in the wild shows about 3.5 creatures on average (was 2.3), and only 7–14% of the wild is more than 600 px from one (was 21–26%). Villages, farms, camps and each hero's start stay calm. Each kill gives a fifth less experience than before.

When the new spells came in, the same bot was run on packs and on a heroic creature at levels 3, 8, 14 and 21, before and after. Gravity Well was first far too strong (packs cleared 2–3 times faster, because Sunflare hit the whole bunched-up pack), so it was cut to 3 damage a tick, a 2 s pull with a weaker drag, an 11 s cooldown and 16 magic. Mira still clears packs faster than before (about 3–8 s against 5–11 s), but she no longer has Dash to escape. Riven's Nightveil now breaks when he is hurt (Smoke Veil did not), so Riven takes 72% of a hit instead of 78%. Wren's walking speed went from 275 to 312. Lion’s Rush and Shade Step only changed in needing a target, and they fight as before.

Levelling is paced so you reach Whisperroot at about level 7 and the Summit at about level 13. Creatures far below your level give little XP.

**Spell stars:** every ability can be upgraded five times in the spellbook (U) with gold. Each star adds 12% damage (15% for Lion’s Rush, Gravity Well and Fenn's pounce); Frost Step, Shade Step, Glacier Shell and Nightveil get 8% shorter cooldowns per star, and Bulwark and Howl of the Pack last 12% longer. Stars bought for a spell that was replaced (Dash, Moss Shield, Ice Barrier, Smoke Veil, Tumble) carry over to the spell in its place. Star *n* needs hero level `ability level + 3 × (n − 1)`.

**Equipment and loot:** nine slots: head, shoulders, back, chest, hands, waist, legs, feet and **weapon**. Each hero has their own kind of weapon (Mira a staff, Kael a sword, Lyra a frost staff, Riven twin daggers, Wren a bow), named for the land it comes from (Oak Staff, Bronze Leafblade, Glacier Staff, Obsidian Fangs, Moonhowl…). The weapon changes how it looks in the game and on the pedestal: its wood or metal follows the land (wood and iron, then root and bronze, starsilver and crystal, obsidian and ember), its gem or edge takes the rarity colour, higher tiers add ornaments (leaves, a crescent, a crown of flame, cross-guard wings, a glowing edge), and epic and legendary weapons glow. Weapons roll power and critical chance with a bigger budget than armour. Worn gear changes how the hero looks, in the game and on the pedestal: each piece dyes its body part (hat or helm, robe or armour, cape, gloves, belt, boots) in a colour picked from its land and rarity, shoulder pads and leg guards appear when worn, and epic and legendary pieces glow. Pieces come in five rarities (common, uncommon, rare, epic, legendary) and roll armour, power, health, magic, regeneration, speed or critical chance from a budget set by item level and rarity. Creatures sometimes drop a glowing loot bag, elites and chests often do, guardians always drop an epic. Every side quest rewards a rare piece (shown in the offer), and guardian quests an epic one. A piece for a slot that is still empty is put on straight away; everything else goes into the bag. Worn gear is capped at 40% armour, 25% speed and 30% critical chance in total.

**Character and bag:** one screen (I for the bag tab, P or the portrait for stats). The hero stands on the pedestal in the middle with the slots around them, WoW-style; the bag is a 36-slot grid that scrolls on phones. Tap anything to see its card: use or throw a consumable, put it on the second quick button, or equip a piece. **Loot comparison:** bag slots carry a green ▲ when a piece is better than what you wear in that slot and a red ▼ when it is weaker; on PC, hovering a piece shows a tooltip with every stat compared (green ▲ / red ▼ per stat), the overall verdict ("▲ Upgrade · +22 item score") and the worn piece below. The same comparison is on the tapped card, at the armourer, and in the loot notice ("▲ upgrade"). Merchants buy spare gear.

**Consumables:** Healing Draught, Starwater Flask, Swiftwind Tonic, Dawnfire Elixir and Oakhide Brew (keys 1–5), plus Fire Bomb, Ice Bomb (freezes for 3 s), Thunder in a Jar (lightning on up to six foes), Smoke Pouch (creatures lose you for 8 s) and Giant's Brew (keys 6–0), Sands of Haste (all cooldowns ready, then twice as fast), Four-leaf Clover (+50% XP and gold) and the Phoenix Feather, which revives you on the spot when you would fall.

**Journal:** the book button in the top bar (O, U or Y) opens the journal, with its three tabs: quests, spellbook and achievements.

**Achievements (Y, or the journal's Achievements tab):** 60 achievements in six categories (Story, Guardians, Combat, Exploration, Quests, Character), worth 1,140 points, in the spirit of WoW. They cover finishing each chapter and beating each guardian, creatures and elites defeated, combos, critical hits, places, chests and runestones, the fog lifted off the world map, side quests and rescues, levels, gold, a full set of gear, epic and legendary finds, five-star abilities, and more. Earning one shows a gold pop-up; the tab shows points, a filter per category and the progress of every achievement. Progress an older save already made is counted when it loads.

**World map (M, the map button, or a tap on the minimap):** the whole valley at once, all four lands side by side, with the fog lifted wherever the hero has been. It opens zoomed on the current land; drag to pan, pinch or scroll to zoom, or jump with the buttons (Whole valley or one land).

**Android back button:** the page keeps an extra history entry, so back never leaves the game by accident. While playing it closes whatever is open, or opens the pause menu (which has **Leave game**). On the title screen it asks "Do you really want to leave the game?". Leaving closes the app through the wrapper's bridge if it offers one (`Android.exitApp`, Capacitor or Cordova); otherwise the next back press closes it.

**Gold and upgrades:** creatures, chests and quests give gold. Merchants sell potions and bombs, and buy anything you don't need: gear, potions, bombs and charms (for 40% of their price). **Armourers** (⛨, one in every city) buy your spare gear too (their Sell tab), and sell equipment, but it is not easy to get: six pieces per shelf (one uncommon, three rare, two epic, sometimes a legendary), at 8–12 times what a merchant would pay for them. The best pieces are above your level and stay locked until you reach it. Each piece can be bought once, and the shelf is restocked when you level up. Smiths sell three upgrades with five ranks each: Starsteel Weapon (+8% power), Warden's Mantle (−6% damage taken) and Heartstone Amulet (+30 max health).

**Quests:** gold main quests (with the hero's own quests among them) and blue side quests (51 in total). Someone with both a main quest and a side quest offers only the main quest; speak to them again after accepting it for the side quest. Handing a quest in can lead straight on to the next main quest, but never to a side quest. The quest offer ends with **Decline / Accept**, with Accept on the right, and the buttons ignore taps for half a second so a skip-tap can't answer by accident. Quest kinds:
- **Collect, slay, deliver, visit, talk, relic and boss.**
- **Rescue:** defeat the guards around a cage, then open it. Many captives then have to be **walked home**.
- **Escort:** someone walks with you (green ring and ♥ over their head). They won't move while creatures are near (the ring turns red), wait if you run too far ahead, and two ambushes lie in wait along the road.
- **Defend:** a siege. When the quest's place is a village, city, camp or farm, the creatures come for **the town itself**: there is no fence, they pour out of the dark from three or four sides at once, each goes for one of the houses, stalls or tents on its side of town, and the ones that reach it tear at it and set it alight while the villagers cry for help. Each wave is 2.6 times what the quest names (at most 20 at once), each raider frailer than a creature of the wild (60% health, 75% damage) and worth less experience. A bar at the top shows the town's health, the wave and how many attackers are left; if the town burns down, you can regroup and try again. Winning puts the fires out. A quest that guards one thing (a cart, a lantern, a song-stone, a knight) shows that thing on a ward ring, and its waves come twice over.
- **Build:** gather materials, then stand still at the site while you build (a progress bar, hammering and dust). The plan glows faintly until it's built.
- **Light:** braziers, lanterns, runes, totems or vents. Some are puzzles that must be lit in the right order (the clue is in the quest's words); a wrong one puts them all out.
- **Chase:** a thief runs from you, circling back toward their hideout. They tire every few seconds, which is your chance to catch them.
- **Follow the trail:** glowing footprints lead from clue to clue, and each clue tells a piece of the story.
- **Herd:** walk up behind sheep or goats to drive them into their pen. Every herd has two spare animals, and they can't leave their land or stray far from the herd's ground (one pushed to the edge wanders back), so a lost animal never blocks the quest.

**Abandoning a quest:** the journal has an **Abandon quest** button under the current main quest and each side quest under way (it asks once more). The quest goes back to whoever gave it: followers, thieves and herds go home, rescue guards and siege attackers melt away, and lanterns, runes, clues and cages are reset. Things already gathered for a collect or build quest are kept and count again. An abandoned quest shows **Take up again** in the journal, or you can ask its giver again. A guardian's fight, a siege in progress and a build in progress can't be abandoned.

Some conversations end with **a choice** of two answers. The answer changes what is said and the bonus reward, and it is remembered.

**Creatures:** every land has creatures of its own, and none of them is met in another land (`LAND_KINDS` in `worlds.ts`; `npm run check:kinds` checks every quest, pack and siege):

| Land | Creatures |
| --- | --- |
| Sunpetal Meadow | gloomlings, thornlings, bristleboars (telegraphed charge), sporecaps (poison clouds) |
| Whisperroot Woods | shadewolves (circling packs), webspinners (slowing silk), boglings, briarlings, mirecaps, marsh lights |
| Starfall Summit | void wisps, frost wraiths (blink and ice shards), crag golems (ground slam), snowfangs, rimelings |
| The Ember Wastes | ember imps, ash scorpions, magma hulks, cinderhounds, pyre wisps |
| The depths | umbral knights (a telegraphed great-blade cleave), duskwings (circling, diving bats), hollow archers (volleys of shadow bolts), shardbacks (ground slam and a ring of crystal shards), eclipse acolytes (blink, rings of void orbs, call duskwings) |

The newer kinds fight like a cousin from another land (`ENEMY_AI` in `engine.ts`: a bogling lunges like a gloomling, a briarling or rimeling spits like a thornling, a mirecap puffs spores, marsh lights and pyre wisps dart and shoot like wisps, snowfangs and cinderhounds circle and dart like shadewolves) but are drawn in their land's colours, with their own details (a lily leaf, frost, embers). Any creature a quest, siege, guardian or cutscene calls into a land it doesn't live in comes as that land's own kin (`localKind`). The one exception is Wren's own shadow-bound pack, which comes back for her at the Hunter's Camp. Lairs hold packs led by a gold-starred elite. Defeated creatures **respawn after 4 minutes** (heroic ones after 10), and the clock keeps running while the game is closed: each hero's save remembers when every creature fell, so leaving the game and coming straight back doesn't bring a pack back early.

**Falling in battle** sends the hero to the last resting place and costs 10% of their gold. Every creature and guardian still standing is back at full health, at home, and calm: a lost fight starts over.

**Aggro:** a creature that is after the hero turns red, glows red and stands in a pulsing red ring, so it is easy to see who is fighting you.

## The depths

When Pyrrhus falls and the last quest begins, the ground shakes and gives way, and the hero falls into **the depths beneath the Dawn Forge** (`depths.ts`): seven chambers joined by halls (The Fall, Hall of Bones, the Sunken Hoard, the Crystal Gallery with a fire to rest at, the Ember Vaults, the Hall of Echoes and **Umbra's Throne**), about five minutes of fighting through creatures found nowhere else. They are stronger than anything in the four lands: levels 26 to 30, following the hero's own. Walking into the throne room wakes Umbra (each hero's own Umbra, with their own scene, such as Kael's black knight).

The depths lie in a space of their own beside the valley, count as part of the Ember Wastes, have their own dark music (`depths` in `music.ts`), and are **not on the valley's map**: once the ground has opened, the hole beside the Dawn Forge shows there, and tapping it (or the map's *The Depths* tab) opens a map of the depths on dark paper. Down there the minimap and the map show the depths.

Roots at the Fall climb back up at any time; once Umbra is beaten a **shaft of dawnlight** in the throne room does too, and the story ends at the Dawn Forge as before. **The hole stays open**: going down again brings every creature back as strong as the hero has grown, and an **echo of Umbra** rises on the empty throne (60% of Umbra's health and experience, with Umbra's loot and the chance of the Starlit Unicorn). The arrows lead through the hole and back out, and a save made down there loads down there.

## Starfall events

Every ten to twenty minutes of play, three times in four, **a star falls** (`updateStarfall` in `engine.ts`) on open ground somewhere the hero can reach, mostly in their own land, away from every town: a streak across the sky, a banner (*A star has fallen, near …*), a gold-white arrow, a star on the minimap and the map, and a line in the quest tracker with the time left. Where it lands:
- **a meteor crater**, the star still glowing at its heart;
- **star fragments** scattered round it, picked up by walking over them: experience, gold, and every eight fuse into a **Starheart** (one more heart of health, up to six); creatures touched by the star leave another behind;
- **rare creatures**: six of the land's own kinds touched by the star, gleaming gold, with more health and two and a half times the experience;
- **a world boss** that fell with the star (Astralith, the Comet-Eater, Meteorgeist…): a hulk of meteor rock with a star for a heart, raining meteors, spiralling void light, blinking and charging, calling the land's creatures;
- **a star-forged chest**, sealed until the beast falls, with a legendary piece every time, star fragments and a heap of gold.

All of it is as strong as the hero (or the land, if that is stronger). The star shines for six minutes (not while its beast is being fought), then fades with everything it brought. Achievements: Stargazer, Starchaser, Star Collector and Starheart.

**Secrets:** every land hides four. Three **cracked walls** stand near old places: the cracks glow faintly, and inspecting one says a bomb could break it. A Fire Bomb, Ice Bomb or Thunder Jar thrown nearby (bombs aim at a close cracked wall when no creature is closer) shatters it and reveals a hidden runestone (one per land, with lore about the lights and the Dawn Forge) or a **Hidden cache** with better loot: always a rare or better piece, extra gold and an item. At each land's biggest lake a **waterfall** (a lava fall in the Ember Wastes) hides a cave: explore it to reveal the **Cave hoard**. Achievements: Something Hidden (the first) and Keeper of Secrets (all 16).

**Mini-games:** some villagers (and every innkeeper, after you rest) ask if you want to play; the offer has **Play** and **Not now**, and players call out for a game as you pass. **Starfall Dice:** three dice each, keep what you like and reroll the rest once, pairs add 4 and three of a kind 12, best of three rounds for a stake that grows with your level (win it back doubled; a draw returns it). **Archery match** (hunters, guards and a few villagers): eight arrows at three moving targets, aim with the mouse or finger while the bow sways a little; bullseyes score 10, far targets double, and gold is paid by score, with bronze, silver and gold medals at 40, 70 and 100 points. Achievements: Lucky Streak (win 5 dice games) and Eagle Eye (a gold medal).

**Trails:** cosmetic sparkles that follow a walking hero, chosen in the stable: Stardust (find a secret), Lucky Clovers (Lucky Streak) and Golden Sparks (Eagle Eye).

**Heroic creatures:** the leader of each lair is a named little boss, two per land: Murkmaw the Gloom King and Old Tusker (Meadow), Mother Briar and Silkshade the Weaver (Woods), Frostfang the Unbroken and Nulleye (Summit), Sandreaper and Slagjaw (Ember Wastes). They are bigger, stand in a violet rune ring with a crown, their name and a long health bar, and have nine times an ordinary creature's health. Besides their kind's own attacks they slam the ground every few seconds (a warning ring under them and under you; lava in the Ember Wastes), and at half health they enrage and call two of their kin. They always drop a rare or better piece (often epic, sometimes legendary) plus a second piece, two consumables, lots of gold and nine times the XP. They come back after 10 minutes and show as violet dots on the world map. Achievements: Heroic Deed (the first one) and Bane of the Lairs (eight).

**Mounts:** no mount comes for free. Every city has a **stable master** (♞) who sells four, each from a level: Sunpetal Pony (level 4, 350 gold, +50% speed), Whisperroot Stag (level 9, 1,400 gold, +65%), Rimecoat Wolf (level 14, 3,200 gold, +75%) and Cinder Drake (level 20, 6,000 gold, +85%). Two can only be won in battle: the Tusked Bristleboar (+55%) drops now and then from a heroic creature (one in five), and the Starlit Unicorn (+100%) from Umbra. A mount is kept by that hero (`mounts` in the profile); saves from before mounts were sold keep the ones they had already earned. Press R or the saddle button in the top bar to ride; you can't call a mount in combat (while a creature within 900 px is after you, in a guardian fight or a siege, or within 5 s of striking or being struck), and attacking, casting, throwing a bomb or being hit puts you back on your feet. The Achievements tab starts with the stable, where you pick which mount to ride.

**Phones:** the prompt just says **Talk** (or Trade, Rest…), notifications are one or two words, and every screen, including the prologue and cutscenes, fits a landscape phone without scrolling.

## Sound and music

- **Music:** composed themes for the menu, each chapter and victory (`music.ts`). They crossfade, and chapter themes add a percussion layer when creatures are near.
- **Battle music:** each fight that matters has its own dramatic theme:
  - **Guardians** (Mossback, the Bramble Warden, the Hollow Star, the Cinder Tyrant): a driving D-minor battle theme with brass stabs.
  - **Umbra, the Eclipse:** a theme of its own in C harmonic minor, with double-time drums, tolling bells, dark pads and a climbing brass line. It starts the moment Umbra begins to rise.
  - **Sieges:** *Hold the Line*, an A-minor march with snare rolls and brass calls, while a barricade is under attack.
- **Custom music files:** to use recorded tracks instead, add them under `public/music/` with a `manifest.json` such as `{ "meadow": "meadow.mp3" }`.
- **Sound effects:** layered and positional, so they pan and fade with distance, with a shared reverb.
- **Ambience:** birds, crickets, owls, dripping water, wind and crystal chimes per chapter. Water and campfires get louder as you walk near them.
- **Footsteps:** they change with the ground (grass, road, stone, snow).
- **Volume:** master, music and effects sliders in the pause menu.

**Pause:** the pause menu (and any menu, conversation or map) stops the world completely: creatures, spells, timers and buffs, and the picture itself (water, grass, sparks and creatures hold still), because the renderer runs on a world clock that only moves while the game does.

## Art direction

The whole game is a **pop-up paper storybook**, in the spirit of Cult of the Lamb, Wytchwood and Paper Mario. Everything is cut from coloured card:

- **Living things** (heroes, villagers, creatures, pets, critters) are paper stickers: flat shapes with a soft top-left light, a cream paper edge, a thin ink line around it and a drop shadow, as if they stood a little above the page.
- **Scenery** (houses, trees, rocks, wells, stalls, lamps) has an ink edge and a longer shadow. Houses have scalloped roofs, shutters and flower boxes. Trees are stacked cloud shapes, pines are tiered cones.
- **Ground** is layered sheets of paper: meadow over earth, roads with a stitched centre line, cobbles and flagstones for towns, paper grass tufts and flowers.
- **Characters** share one figure rig (`src/game/art/rig.ts`): big head, small body, four facings, walk, idle and action poses. Each hero has a signature look (Mira's green star hat, Kael's plumed helm, Lyra's pale hair, Riven's cowl and glowing eyes, Wren's hood and braid). Villagers get a build, outfit, hair and hat from their name, so each one always looks the same.
- **Menus** match the world. The HUD is dark card with a cream edge. Everything you read (journal, dialogue, shop, character sheet, map, item cards) is a parchment page with ink text. Portraits are cut from the same figures.
- **Title:** a paper diorama at night. Hills with trees, a paper moon, punched-out stars and clouds, and the Beacon tower glowing.

**How it is drawn** (`src/game/art/`):

| File | What it draws |
| --- | --- |
| `cutout.ts` | The paper compositor. A shape is painted once, then lit and grained, then the edge, ink ring and shadow are built from its silhouette. |
| `rig.ts` | The figure rig for everyone. |
| `heroes.ts` | The heroes' looks and weapons. |
| `people.ts` | The villagers and their tools. |
| `animals.ts` | The fox and the wolf. |
| `props.ts` | Every building and object. |
| `ground.ts` | Paper sheets, roads, paving, grass and flowers. |
| `bust.ts` | The portraits. |

`src/theme.css` recolours the menus. It is loaded after `styles.css` and changes only colours, borders and shadows, never layout, so every phone, tablet and desktop layout rule still applies.

**Art lab:** `npm run dev`, then open `/lab.html` to see every hero, villager, creature, building and ground piece side by side. Use this when changing the art.

## Performance

Phones and tablets come first: changes are measured in phone and tablet emulation with the CPU slowed 4× (roughly a mid-range phone).

- **Ground:** pre-rendered into cached 512 px chunks. The chunks just outside the view are baked in the browser's idle time between frames, so walking into new ground doesn't stutter.
- **Grass and flowers:** on High they sway every frame and bend away from the hero's feet. Below High (where phones and tablets play) they are pasted into the ground chunks as still paper pieces, each with its own lean, so they cost nothing a frame. Tufts rooted just outside a chunk that reach into it are pasted too, so nothing is clipped at a chunk's edge. While the ground is being re-baked after a quality change, tufts on ground not done yet are drawn live, so none go missing.
- **Entering the world:** a short loading card ("Unfolding the valley") stays up while the first frames are drawn but not played. Meanwhile the ground, houses and trees around the start and the minimap's world map are prepared, so the first steps don't stutter. A fast device only sees a quick fade; a slow one waits four seconds at most, and anything left is finished in the background.
- **Trees and buildings:** cached paper sprites that sway with a cheap skew. The ones just beyond the view are baked ahead, a few per frame. Scenery without moving parts skips the per-frame pass for smoke, flags and lights.
- **Paper figures:** the edge, ink line and shadow are built once per pose, not every frame, with only as many outline copies as that edge's width on screen needs.
  - Villagers keep a cache of their poses (walk, work and sweep steps).
  - Creatures, pets, critters and objects move in stop-motion, each on its own beat: 12 frames a second on High, 8 on Balanced, 6 below (chests, signs and lore stones at 6). Mana pods share twelve rocking frames per land.
  - Fights stay smooth however big: only a few re-cuts fit in a frame (8 on High, 2 below). In a crowd each creature waits a beat or two longer, the stalest first, so frame cost doesn't grow with the number of creatures. Each creature kind's cut is only as big as its art, measured over every frame of it fighting.
  - The hero is cut every frame on High, 30 times a second on Balanced and 20 below. They are still drawn where they stand every frame, so movement stays smooth.
  - Quest badges, shop signs, place names, speech bubbles, level tags and damage numbers are painted once and stamped. Below High at most ten damage numbers show at once.
- **No slow motion:** a frame that comes late is played in steps of at most 50 ms (up to a tenth of a second), so a stutter never slows the game down.
  - Hit-stops (the world holding still on a big hit) come at most every 0.35 s of play, and are half as long when many creatures fight. In a crowd they used to follow one another.
- **Fast screens:** 90 and 120 Hz touch screens draw every refresh (smoother, and a late frame costs only a few ms); 144 Hz and faster draw every other refresh to save work and heat.
- **Ground in fights:** during and just after a fight, ground beyond the view is baked only in real idle time (or at most once a second).
- **Sparks and sounds:** below High, bursts are thinner, fewer sparks live at once and sparks have no glow. The same sound plays at most every 70 ms, with at most 20 voices at once.
- **Minimap:** the map, fog and markers are redrawn ten times a second into a slightly larger canvas that slides under the window every frame. The hero's arrow is drawn live.
- **HUD:** the game sends the HUD a snapshot ten times a second (five below High), and only when something in it changed. Unchanged parts keep their identity, so memoised HUD pieces (vitals, quest tracker, spell and potion buttons) don't re-render. The touch prompt's position is written straight onto the prompt, so the rest of the HUD isn't restyled every frame. Quest rows reuse reward texts and look people up by id.
- **Big screens:** on large monitors the camera comes closer, so a 1440p screen shows about the same part of the valley as a laptop. The ground is still baked at screen resolution, because larger ground textures were too much for the GPU.
- **Queries:** everything is looked up through spatial grids, so only what is on screen or nearby gets drawn or collided with.
- **Distant entities:** creatures, villagers and animals far from Mira sleep.
- **Settings (pause menu → ⚙ Settings):**
  - quality (Auto, High, Balanced, Low, Lowest);
  - grass and flowers (Full, Less, Off);
  - weather effects, a 30 fps cap and screen shake;
  - an FPS counter, which also shows the slowest frame of the last half second and the level.
- **Graphics quality:** Each level caps the canvas resolution and sets how many glows, particles and screen effects are drawn, and how often the hero is re-cut. Auto starts where it settled last time on this device, or with a guess the first time: lower on tablets and low-core devices. It judges each second of play by the average of the fastest nine tenths of the frames, so a moment of baking new ground doesn't count. It steps down after two slow seconds in a row (under about 50 fps), or at once below about 30 fps. It steps up only after 30 smooth seconds, when there has been no fight for 20 seconds and no step down for a minute, and only when frames use less than a third of their time. After every change it waits until the ground and pieces have been remade at the new level before judging again, so a change can't set off another. A level it had to drop from right after reaching it, or during a fight, is remembered as that device's ceiling. (A phone that stepped up while walking and down in every crowded fight remade the ground and every piece just as the fight began.)
- **Still HUD below High:** bars jump instead of gliding, and the pulsing glow on active spells, the achievement sheen and the enraged boss bar's shimmer hold still. Animating a painted property repaints it every frame.
- **Menus (title and hero select):**
  - The night backdrop's sky, moon, stars, hills, clouds and glows are painted once when the page is sized; a frame only places them and moves the twinkling stars, fireflies and petals.
  - The hero's pedestal is painted once per hero.
  - On touch screens:
    - both canvases paint 30 frames a second, and the backdrop has no parallax, so its sheets share two canvases;
    - the hero is re-cut 12 times a second;
    - the gold titles and the buttons' shine hold still.
- **No live blur:** the HUD uses solid glass panels. `backdrop-filter` blur over the constantly redrawn canvas was the biggest cost on weak tablets.
- **Memory:** the ground chunk cache is sized to the view.

## Controls

**Keyboard (default keys, all of them can be changed):**

- Move: WASD / arrows
- Left hand: WASD move · E level-1 ability (Gravity Well, Lion’s Rush, Frost Step, Shade Step or Fenn’s command) · R ride
- Right hand, home row: L attack (F also works while it is unbound), then leftward in learning order: K · J · H (see the table above)
- Right hand, menus (row above): U spellbook · I inventory · O quest log · P character · Y achievements
- Space / Enter talk, open or use · 1–0 potions and bombs · M map · Tab quest log · N mute · Esc pause

**Remapping keys:** Settings → Controls lists every action; click one and press the new key. A key that is already in use swaps places with it, so nothing is left unbound, and Reset brings back the defaults. The arrow keys always move, 1–0 stay on the potion slots, and Esc, Tab and Enter keep their jobs. Every key hint in the game (spell buttons, pause menu, spellbook, title screen) shows the keys you chose. The bindings are saved in `starfall-grove-keys-v1`.

**Settings:** the ⚙ button on the title screen (and ⚙ Settings in the pause menu) has all graphics and sound settings, plus **Back up your saves** (below), **Start over as** with a list of the five heroes (erases only the hero picked and starts a new adventure as them; if that is a different hero from the one being played, the current one's adventure is saved first) and **Delete all saves** (erases every hero). Both ask for a second tap. Sound and graphics settings are kept.

**Touch:** a floating joystick that appears wherever you put your thumb on the left side, plus a spell wheel on the right. The layout switches automatically on touch devices, and prompts say "Tap" instead of showing keyboard keys.

## Project structure

```text
landing/               The website (see Landing page): pages, landing.css, site.json and src/ (cast, hero select)
src/
  App.tsx              Screens, HUD, banners, dialogue, journal, map overlay, touch controls
  TitleBackdrop.tsx    The paper diorama behind the menus: hills, moon, stars, clouds and the Beacon
  styles.css           Layout, responsive rules and animation library
  theme.css            The paper storybook colours for every menu (colours only, loaded after styles.css)
  lab/lab.ts           The art lab page (lab.html): every figure and prop side by side
  game/
    types.ts           Shared game types
    spells.ts          Heroes, their abilities and unlock levels
    progression.ts     Levels, XP curve and the hero profile that carries between chapters
    story.ts           The shared main story: 64 quests across four chapters
    heroStory.ts       Each hero's own quests and the people in them
    cutscenes.ts       The cutscenes: shots, captions, world effects and the hero intros
    achievements.ts    The achievements, their categories, goals and points
    worlds.ts          Region layouts: places, people, side quests, lore and scripts
    worldgen.ts        Builds each region and stitches them into one valley: roads, cities, villages, forests, each land's own country, the river and the mountain ranges, creatures, loot
    depths.ts          The depths beneath the Dawn Forge: chambers, halls, their creatures, the hole and the ways out
    spatial.ts         Uniform grid for fast proximity and view queries
    engine.ts          Movement, combat, bosses, quests, villagers, wildlife, exploration, saves
    render.ts          Canvas renderer: ground chunks, sprites, characters, lighting, minimap, world map
    art/               The paper look: cutout compositor, figure rig, heroes, villagers, animals, props, ground, portraits
    audio.ts           Audio core, sound effects, footsteps and ambient soundscapes
    music.ts           Music sequencer and composed themes
    GameCanvas.tsx     Game loop, pixel budget, adaptive quality, music switching, autosave
    storage.ts         In-chapter save helpers
    mounts.ts          The mounts, their speeds, what stable masters ask for them and who drops the rest
    trails.ts          Cosmetic trails and the achievements that earn them
    keys.ts            Remappable key bindings
    backup.ts          Save backup export and import
  pwa.ts               Offline service worker registration and the update notice
  ui/MiniGames.tsx     Starfall Dice and the archery range
  ui/paperStage.ts     The hero on the rune pedestal (character select and character sheet)
  ui/Story.tsx         The intro film player, the cutscene letterbox and captions, and the siege bar
```

## Save data

Progress is stored in browser storage on the current device:

- `starfall-grove-save-v2`, `starfall-grove-hero-v1`, `starfall-grove-valley-v1`: Mira's chapter stars, profile (level, XP, gold, upgrades, bag) and adventure in progress.
- The same keys with `-kael`, `-lyra`, `-riven` or `-wren` in the name hold the other heroes' progress, including their achievements and the chosen mount.
- Armourer pieces already bought are kept in the profile (`bought`).
- `starfall-grove-hero-choice`: the hero picked on the title screen.

**Backups:** Settings → **Back up your saves** → **Export** downloads one file (`starfall-grove-backup-<date>.json`) with every `starfall-grove-` entry: all heroes, their adventures, achievements, key bindings and settings. **Import** reads such a file, says when it was made and how many heroes it holds, and after a second tap replaces every save on this device with it and reloads. Files that aren't backups are refused. Use it before clearing browser data, or to move your heroes to another device.

Saves from the older three-map version start a fresh adventure. The hero's level and bag are kept.
