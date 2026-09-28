# Starfall Grove

A responsive single-player 2D action RPG built with React, TypeScript and Vite. The world is drawn with the Canvas 2D API, and React handles the menus, HUD, touch controls, dialogue, journal and map. All in-game music and sound are synthesized live with Web Audio. The only media files are the five hero intro films (`public/intro/`).

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

The shared main story (in `story.ts`) has **12 quests in Chapter I, 17 in Chapter II, 20 in Chapter III and 15 in Chapter IV**.

**Every hero has a story of their own** (`heroStory.ts`), woven into the main one: their quests slot into the main chain and are marked *<Hero>'s story* in the journal.
- **Mira, the Apprentice:** Tuft follows Orrin's scent to the Old Stone Garden. She passes the Apprentice's Test at the Moss Shrine, tells Orrin whether she forgives him, and finally builds a star lantern of her own at the Phoenix Spring. Also her own: relighting the three lanterns Orrin left burning in Sunpetal (a memory of him walking away plays), gathering starmoss at the Faerie Ring for Healer Maren, and defending the Moss Shrine from a swarm of wisps.
- **Kael, the Oathsworn:** a squire of the Wardens. He follows the tracks of Ser Aldric's warhorse, has Aldric's split shield mended, chases a black knight who knows his name, and lights the Warden fires at Silver Pass. At Ashfall Watch he chooses how to free Aldric from the shadow. Also his own: building Farmer Bram a barricade at Millbrook (the gloomlings come to the fence that night, and turn back), freeing Warden Brin from a thorn cage at the Faerie Ring and walking her to Captain Brannoc, and escorting Old Tobb, the last Warden of the woods, whose story of the young Aldric plays as a memory.
- **Lyra, Winter's Daughter:** follows her sister Nessa's scattered letters and catches the boy selling them. She learns from Courier Nutkin where the frost wraiths took Nessa, frees her at the Old Observatory and walks her to Frostpine Hamlet. Later she freezes Brasshaven's overheating forge vents. Also her own: waking frost runes on Mirror Lake, which show Nessa running the shore that night; gathering the rest of Nessa's letters from Gloom Hollow for Postmistress Wynne; and chasing the Pale Rider, a frost-wraith scout that flees north toward the Summit.
- **Riven, the Foundling:** raised by the Hushed, a thieves' guild paid in black feathers. Riven confronts their guildmistress Magpie and runs down the runner carrying the buyer's letter. Riven wakes Sable's shadow-runes in their old childhood order, answers Sable's question, and unmasks the Ashen Broker. Also Riven's own: returning the purses the Hushed stole in Sunpetal, following a trail of black feathers to Willowmere (a cloaked girl appears in the memory), and rescuing Tib, a foundling with a shadow like Riven's, from the Nest, which brings back a memory of the foundling house.
- **Wren, the Pack:** hears Moonfang's howl and wakes the hunter's totems. She tracks Moonfang to a den and walks Moonfang's moon-white pup, Snowpaw, to safety, herds Kiri's goats, and at last finds Moonfang at The Last Green. Also her own: pulling up a poacher's wolf snares at the Old Stone Garden, running the poacher down, and holding the Hunter's Camp when her own shadow-bound pack attacks it.

Each hero also has their own intro and their own lines at key moments, and their own thoughts voice the story's nudges between quests (Tuft does it for Mira).

**The intro film:** a new adventure opens with the hero's own 30-second animated film (`public/intro/<hero>.mp4`, 1280×720, with its own score):
- **Mira:** the star falls past the cottage window, Orrin walks into the dark with his lantern, and at dawn she and Tuft set out.
- **Kael:** the night watch with Ser Aldric, the Beacon bursting into shadow, Aldric's last stand, and Kael's oath at sunrise.
- **Lyra:** the ice shrine under the aurora, Nessa running on the lake road, Lyra's eyes opening, and her walk down the mountain.
- **Riven:** the Hushed's last contract and its black feathers, the run over the rooftops, the shadow Riven knows, and the leap out of the window.
- **Wren:** the pack at the campfire, the howl at the falling star, the shadow taking the wolves, Moonfang's last look, and the tracks at dawn.

Each score was composed for its film and timed to what happens on screen: music box, strings, choir, horns and drums, with sound effects on the beats of the action (the falling star, the Beacon dying, sword on shield, a heartbeat, wolf howls, rooftop footsteps, a shing as Kael raises his sword). The films are compressed to 2–4.5 MB each and stream as they play. The game's own music and ambience go quiet while one plays, and its volume follows the master, music and effects settings. If the browser won't start it with sound, it plays muted with a *Tap for sound* button. **Skip** (or Esc / Enter) ends it. Then a cutscene of that hero's own night in the valley plays in the game world, and in every one the Beacon is seen burning and then going out in a burst of shadow: Orrin's lantern moving away down the east road (Mira), Kael and Aldric on the Rise and Kael's flight to Millbrook (Kael), Nessa on the lake road with her letters scattering (Lyra), the Hushed counting black feathers in Goldenhearth (Riven), and the pack howling at the Hunter's Camp and running with the shadow (Wren). It ends on the hero where they woke. On a landscape screen the film fills the whole screen; upright, it shows the whole frame. Offline, or if the film can't load within a few seconds, the game goes straight to the hero's full in-game intro cutscene instead (films aren't kept for offline play, to keep the offline download small).

**Where each hero starts:** every hero wakes in a different corner of the first land, and their first quest takes a different road into the story before it joins at Elder Rowan in Sunpetal:
- **Mira** at the Bridgekeeper's Rest: Bridgekeeper Tamsin sends her to Rowan.
- **Kael** at Millbrook Farm, where Farmer Bram found him in the hay: Bram sends him to warn Captain Brannoc in Goldenhearth, and Brannoc sends him on to Rowan.
- **Lyra** on the shore of Mirror Lake, on Nessa's road: Fisher Lou saw a courier girl run past, and sends her to Postmistress Wynne in Sunpetal.
- **Riven** in Goldenhearth: Baker Tom hands over a honey bun and points Riven to Rowan.
- **Wren** at the Old Stone Garden, on her pack's tracks, which lead her west to Sunpetal.

Creatures near each start are no stronger than those around the Rest, so no hero starts among tougher foes.

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

The last chapter ends with Umbra, then an epilogue shows every light shining. There is no chapter-complete screen: the chapter's achievement pops up, its closing cutscene plays (ending on the next chapter's title), and the next land's first quest begins. Older saves are carried onto the longer chains: quests added before the point a save has reached count as done.

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

Mira fights from range and is fragile. Kael fights up close, has more health and takes about 35% less damage; his Charge is a short rush (about 230 px) that stops at the foe it aims for. Lyra controls fights: chilled creatures move and act at 55% speed, frozen ones stand still. Riven is the fastest hero and hits hardest, but is lightly armoured. On touch screens the shield sits right next to the attack button.

**Balance:** the heroes are tuned to be about equally strong, though some are harder to play well. A simulation (`.sim/bal.ts`, run with esbuild) runs each hero, with no gear or spell stars, under a simple bot. At levels 3 to 25 it fights a creature pack of each land and measures the time to clear it and the health lost. Against each guardian it measures the share of the guardian's health taken in 40 seconds and the damage received. After tuning, every hero clears a pack within about 20% of the others (Lyra had been 60–90% slower). Kael is the toughest. Riven deals the most damage but takes the most, so Riven is the one to play carefully. Mira and Lyra are safer at range. The tuning: Lyra's Frost Bolt 12 → 18 (cooldown 0.42 → 0.4 s), Blink 10 → 12, Frost Nova 28 → 40, Blizzard 13 → 18; Mira's Spark 10 → 12, Sunfire 40 → 44, Starfall 34 → 38; Wren's Quick Shot 11 → 10 and Volley 20 → 18; Riven now takes 78% of a hit instead of 82%, and gains 10 health per level instead of 9. Ability damage now comes from one table (`spells.ts`), which the engine and the spellbook both read. The spellbook shows each ability's current damage, cost and cooldown, plus your smith upgrade ranks.

Levelling is paced so you reach Whisperroot at about level 7 and the Summit at about level 13. Creatures far below your level give little XP.

**Spell stars:** every ability can be upgraded five times in the spellbook (U) with gold. Each star adds 12% damage (15% for Charge); Dash gets 8% shorter cooldown per star, and the two shields last 12% longer. Star *n* needs hero level `ability level + 3 × (n − 1)`.

**Equipment and loot:** nine slots: head, shoulders, back, chest, hands, waist, legs, feet and **weapon**. Each hero has their own kind of weapon (Mira a staff, Kael a sword, Lyra a frost staff, Riven twin daggers, Wren a bow), named for the land it comes from (Oak Staff, Bronze Leafblade, Glacier Staff, Obsidian Fangs, Moonhowl…). The weapon changes how it looks in the game and in 3D: its wood or metal follows the land (wood and iron, then root and bronze, starsilver and crystal, obsidian and ember), its gem or edge takes the rarity colour, higher tiers add ornaments (leaves, a crescent, a crown of flame, cross-guard wings, a glowing edge), and epic and legendary weapons glow. Weapons roll power and critical chance with a bigger budget than armour. Worn gear changes how the hero looks, in the game and in 3D: each piece dyes its body part (hat or helm, robe or armour, cape, gloves, belt, boots) in a colour picked from its land and rarity, shoulder pads and leg guards appear when worn, and epic and legendary pieces glow. Pieces come in five rarities (common, uncommon, rare, epic, legendary) and roll armour, power, health, magic, regeneration, speed or critical chance from a budget set by item level and rarity. Creatures sometimes drop a glowing loot bag, elites and chests often do, guardians always drop an epic. Every side quest rewards a rare piece (shown in the offer), and guardian quests an epic one. A piece for a slot that is still empty is put on straight away; everything else goes into the bag. Worn gear is capped at 40% armour, 25% speed and 30% critical chance in total.

**Character and bag:** one screen (I for the bag tab, P or the portrait for stats). The hero stands in 3D in the middle with the slots around them, WoW-style; the bag is a 36-slot grid that scrolls on phones. Tap anything to see its card: use or throw a consumable, put it on the second quick button, or equip a piece. **Loot comparison:** bag slots carry a green ▲ when a piece is better than what you wear in that slot and a red ▼ when it is weaker; on PC, hovering a piece shows a tooltip with every stat compared (green ▲ / red ▼ per stat), the overall verdict ("▲ Upgrade · +22 item score") and the worn piece below. The same comparison is on the tapped card, at the armourer, and in the loot notice ("▲ upgrade"). Merchants buy spare gear.

**Consumables:** Healing Draught, Starwater Flask, Swiftwind Tonic, Sunfire Elixir and Barkskin Brew (keys 1–5), plus Fire Bomb, Frost Bomb (freezes for 3 s), Thunder in a Jar (lightning on up to six foes), Smoke Bomb (creatures lose you for 8 s) and Giant's Brew (keys 6–0), Sands of Haste (all cooldowns ready, then twice as fast), Four-leaf Clover (+50% XP and gold) and the Phoenix Feather, which revives you on the spot when you would fall.

**Journal:** the book button in the top bar (O, U or Y) opens the journal, with its three tabs: quests, spellbook and achievements.

**Achievements (Y, or the journal's Achievements tab):** 53 achievements in six categories (Story, Guardians, Combat, Exploration, Quests, Character), worth 985 points, in the spirit of WoW. They cover finishing each chapter and beating each guardian, creatures and elites defeated, combos, critical hits, places, chests and runestones, the fog lifted off the world map, side quests and rescues, levels, gold, a full set of gear, epic and legendary finds, five-star abilities, and more. Earning one shows a gold pop-up; the tab shows points, a filter per category and the progress of every achievement. Progress an older save already made is counted when it loads.

**World map (M):** the whole valley at once, all four lands side by side, with the fog lifted wherever the hero has been. It opens zoomed on the current land; drag to pan, pinch or scroll to zoom, or jump with the buttons (Whole valley or one land).

**Android back button:** the page keeps an extra history entry, so back never leaves the game by accident. While playing it closes whatever is open, or opens the pause menu (which has **Leave game**). On the title screen it asks "Do you really want to leave the game?". Leaving closes the app through the wrapper's bridge if it offers one (`Android.exitApp`, Capacitor or Cordova); otherwise the next back press closes it.

**Gold and upgrades:** creatures, chests and quests give gold. Merchants sell potions and bombs, and buy anything you don't need: gear, potions, bombs and charms (for 40% of their price). **Armourers** (⛨, one in every city) sell equipment, but it is not easy to get: six pieces per shelf (one uncommon, three rare, two epic, sometimes a legendary), at 8–12 times what a merchant would pay for them. The best pieces are above your level and stay locked until you reach it. Each piece can be bought once, and the shelf is restocked when you level up. Smiths sell three upgrades with five ranks each: Starsteel Weapon (+8% power), Warden's Mantle (−6% damage taken) and Heartstone Amulet (+30 max health). Falling in battle drops 10% of your gold.

**Quests:** gold main quests (with the hero's own quests among them) and blue side quests (51 in total). The quest offer ends with **Decline / Accept**, with Accept on the right, and the buttons ignore taps for half a second so a skip-tap can't answer by accident. Quest kinds:
- **Collect, slay, deliver, visit, talk, relic and boss.**
- **Rescue:** defeat the guards around a cage, then open it. Many captives then have to be **walked home**.
- **Escort:** someone walks with you (green ring and ♥ over their head). They won't move while creatures are near (the ring turns red), wait if you run too far ahead, and two ambushes lie in wait along the road.
- **Defend:** a siege. Stand by a barricade while three waves march on it. A bar at the top shows its health, the wave and how many attackers are left; if it falls, you can regroup and try again.
- **Build:** gather materials, then stand still at the site while you build (a progress bar, hammering and dust). The plan glows faintly until it's built.
- **Light:** braziers, lanterns, runes, totems or vents. Some are puzzles that must be lit in the right order (the clue is in the quest's words); a wrong one puts them all out.
- **Chase:** a thief runs from you, circling back toward their hideout. They tire every few seconds, which is your chance to catch them.
- **Follow the trail:** glowing footprints lead from clue to clue, and each clue tells a piece of the story.
- **Herd:** walk up behind sheep or goats to drive them into their pen. Every herd has two spare animals, and they can't leave their land or stray far from the herd's ground (one pushed to the edge wanders back), so a lost animal never blocks the quest.

**Abandoning a quest:** the journal has an **Abandon quest** button under the current main quest and each side quest under way (it asks once more). The quest goes back to whoever gave it: followers, thieves and herds go home, rescue guards and siege attackers melt away, and lanterns, runes, clues and cages are reset. Things already gathered for a collect or build quest are kept and count again. An abandoned quest shows **Take up again** in the journal, or you can ask its giver again. A guardian's fight, a siege in progress and a build in progress can't be abandoned.

Some conversations end with **a choice** of two answers. The answer changes what is said and the bonus reward, and it is remembered.

**Creatures:** gloomlings, thornlings, void wisps, bristleboars (telegraphed charge), sporecaps (poison clouds), shadewolves (circling packs), webspinners (slowing silk), frost wraiths (blink and ice shards), crag golems (ground slam), ember imps, ash scorpions and magma hulks. Lairs hold packs led by a gold-starred elite. Defeated creatures **respawn after 4 minutes**.

**Secrets:** every land hides four. Three **cracked walls** stand near old places: the cracks glow faintly, and inspecting one says a bomb could break it. A Fire Bomb, Frost Bomb or Thunder Jar thrown nearby (bombs aim at a close cracked wall when no creature is closer) shatters it and reveals a hidden runestone (one per land, with lore about the lights and the Dawn Forge) or a **Hidden cache** with better loot: always a rare or better piece, extra gold and an item. At each land's biggest lake a **waterfall** (a lava fall in the Ember Wastes) hides a cave: explore it to reveal the **Cave hoard**. Achievements: Something Hidden (the first) and Keeper of Secrets (all 16).

**Mini-games:** some villagers (and every innkeeper, after you rest) ask if you want to play; the offer has **Play** and **Not now**, and players call out for a game as you pass. **Starfall Dice:** three dice each, keep what you like and reroll the rest once, pairs add 4 and three of a kind 12, best of three rounds for a stake that grows with your level (win it back doubled; a draw returns it). **Archery match** (hunters, guards and a few villagers): eight arrows at three moving targets, aim with the mouse or finger while the bow sways a little; bullseyes score 10, far targets double, and gold is paid by score, with bronze, silver and gold medals at 40, 70 and 100 points. Achievements: Lucky Streak (win 5 dice games) and Eagle Eye (a gold medal).

**Trails:** cosmetic sparkles that follow a walking hero, chosen in the stable: Stardust (find a secret), Lucky Clovers (Lucky Streak) and Golden Sparks (Eagle Eye).

**Heroic creatures:** the leader of each lair is a named little boss, two per land: Murkmaw the Gloom King and Old Tusker (Meadow), Mother Briar and Silkshade the Weaver (Woods), Frostfang the Unbroken and Nulleye (Summit), Sandreaper and Slagjaw (Ember Wastes). They are bigger, stand in a violet rune ring with a crown, their name and a long health bar, and have nine times an ordinary creature's health. Besides their kind's own attacks they slam the ground every few seconds (a warning ring under them and under you; lava in the Ember Wastes), and at half health they enrage and call two of their kin. They always drop a rare or better piece (often epic, sometimes legendary) plus a second piece, two consumables, lots of gold and nine times the XP. They come back after 10 minutes and show as violet dots on the world map. Achievements: Heroic Deed (the first one) and Bane of the Lairs (eight).

**Mounts:** earned through achievements and kept by that hero: Sunpetal Pony (Wanderer: discover 10 places, +50% speed), Tusked Bristleboar (Heroic Deed, +55%), Whisperroot Stag (finish Chapter II, +65%), Frostmane Wolf (finish Chapter III, +75%), Cinder Drake (finish Chapter IV, +85%) and Starlit Unicorn (defeat Umbra, +100%). Press R or the saddle button in the top bar to ride; you can't call a mount while creatures are after you, and attacking, casting, throwing a bomb or being hit puts you back on your feet. The Achievements tab starts with the stable, where you pick which mount to ride.

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

**Settings:** the ⚙ button on the title screen (and ⚙ Settings in the pause menu) has all graphics and sound settings, plus **Back up your saves** (below), **Start over as** with a list of the five heroes (erases only the hero picked and starts a new adventure as them; if that is a different hero from the one being played, the current one's adventure is saved first) and **Delete all saves** (erases every hero). Both ask for a second tap. Sound and graphics settings are kept.

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
    story.ts           The shared main story: 64 quests across four chapters
    heroStory.ts       Each hero's own quests and the people in them
    cutscenes.ts       The cutscenes: shots, captions, world effects and the hero intros
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
    trails.ts          Cosmetic trails and the achievements that earn them
    keys.ts            Remappable key bindings
    backup.ts          Save backup export and import
  pwa.ts               Offline service worker registration and the update notice
  ui/MiniGames.tsx     Starfall Dice and the archery range
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
