import type { Captive, HeroId, NpcLook, RegionId } from './types';
import type { StoryQuest } from './story';
import type { NpcSpec } from './worldgen';

// Every hero has a story of their own, woven through the shared tale of the four lights.
//
// Mira, Orrin's apprentice, follows her teacher and grows into her own starlight. Kael, squire of the Wardens, searches
// for Ser Aldric, the knight who threw him clear of the shadow on the night the star fell. Lyra came down from the
// Silver Heights to find her little sister Nessa, a courier who vanished on the meadow roads. Riven walked away from the
// Hushed, a thieves' guild paid in black feathers, and knew Sable long ago in the foundling house. Wren's wolf pack was
// twisted into shadewolves; only young Fenn stayed, and the pack's mother Moonfang is somewhere ahead.
//
// A hero's quests go into the main story right after the quest named in `after` (a local id, or 'region:id'). Quests
// from `fox` are the hero's own thoughts (Tuft, for Mira) and start by themselves.
const h = (hero: HeroId, def: Omit<StoryQuest, 'hero'>): StoryQuest => ({ ...def, hero });
const person = (name: string, portrait: string, look: Partial<NpcLook>): Captive => ({ name, portrait, look: { skin: '#f0c8a2', robe: '#8a6fb0', hat: 'none', hatColor: '#5b5480', hair: '#6b3f2a', ...look } });
const look = (robe: string, hat: NpcLook['hat'], extra: Partial<NpcLook> = {}): Partial<NpcLook> => ({ robe, hat, hatColor: extra.hatColor || '#4a5b3e', skin: '#f0c8a2', hair: '#6b3f2a', ...extra });

const NESSA = person('Nessa', '👧', { robe: '#6f8fb8', hat: 'scarf', hatColor: '#dff6ff', hair: '#e8e2d0', small: true });

export const HERO_QUESTS: Record<RegionId, StoryQuest[]> = {
  // ═════════════════════════════ Chapter I
  meadow: [
    h('mira', { id: 'mira1', title: 'Tuft’s Nose', giver: 'fox', kind: 'trail', count: 4, near: 'sunpetal', place: 'stones', after: 'm2', auto: true, summary: 'Follow Tuft along Master Orrin’s trail to the Old Stone Garden.', reward: { xp: 110, mana: 10 },
      clues: ['(Tuft yips.) A bootprint in the mud, the heel worn crooked. Orrin’s boot. He always walks on the outside of his foot.', 'His lantern, dropped in the grass. The glass is cracked, and the wick smells of starlight.', 'Scorch marks in a perfect circle. He cast something here… something big. Something frightened him.', 'Star-dust, glittering on the old stones. He came this way, and he was not alone.'],
      text: { offer: ['(Tuft sneezes, spins round twice and puts his nose to the ground. He has Master Orrin’s scent!)', 'Follow him. Wherever Orrin went that night, the trail starts here in Sunpetal.'], progress: ['Follow the glowing footprints. Tuft is very sure.'], complete: ['(Tuft sits down among the stones, very pleased with himself.)', 'Orrin came to the Old Stone Garden looking for something. Elder Rowan will know what.'], after: [] } }),

    h('kael', { id: 'kael1', title: 'The Warden’s Trail', giver: 'fox', kind: 'trail', count: 4, near: 'sunpetal', place: 'millbrook', after: 'm2', auto: true, summary: 'Follow the tracks of Ser Aldric’s warhorse south to Millbrook Farm.', reward: { xp: 110, hearts: 1 },
      clues: ['Hoofprints, deep and fast. A warhorse at full gallop, running from the Rise. That’s Cinder, Aldric’s horse.', 'A torn blue pennant on a fence post. The Wardens’ colours.', 'Here the hoofprints turn to smudges of shadow… and stop.', 'Aldric’s shield lies in the wheat at Millbrook, split right down the middle. He never drops his shield.'],
      text: { offer: ['The Wardens’ horses always run home when they lose their rider. If Cinder came this way, the tracks will show where Aldric fell.', 'South, then. Toward the farms.'], progress: ['Follow the hoofprints.'], complete: ['I’ll carry it. Someone has to, until he can again.', 'Back to Elder Rowan. The valley still needs defending, and Aldric would tell me to get on with it.'], after: [] } }),
    h('kael', { id: 'kael2', title: 'Mend the Shield', giver: 'brannoc', kind: 'deliver', count: 1, to: 'smith', item: 'Aldric’s split shield', after: 'm6', summary: 'Bring Ser Aldric’s shield to Smith Hilda in Goldenhearth.', reward: { xp: 150, item: 'barkskin' },
      text: { offer: ['Is that… Aldric’s shield? I served under him, twenty years back. Best Warden the Rise ever had.', 'Hilda at the forge made it for him. Take it to her. If anyone can mend it, she can.'], progress: ['Hilda’s forge is here in the city.'], complete: [], after: ['A Warden’s shield, mended. Good.'],
        deliver: ['Rootsteel rivets, oak core… I made this for Aldric when he was younger than you.', 'Something hit it that was not a sword. The wood is cold as a grave.', 'There. It will hold. Carry it until you find him, lad, and give it back to him yourself.'] } }),

    h('lyra', { id: 'lyra1', title: 'Nessa’s Letters', giver: 'fox', kind: 'trail', count: 4, near: 'sunpetal', place: 'millbrook', after: 'm1', auto: true, summary: 'Follow the trail of Nessa’s dropped letters south toward Millbrook Farm.', reward: { xp: 90, mana: 10 },
      clues: ['A single blue mitten in the grass. Nessa’s. I knitted it for her, badly, the winter she turned nine.', 'Frost on the leaves, in the middle of summer. Is that her magic… or mine?', 'Letters, scattered in the ditch. Every one addressed in her round, careful hand.', 'Her courier satchel, torn and empty. And small, clawed footprints leading away. Gloomlings took her letters… but not her. She ran.'],
      text: { offer: ['Rowan says the couriers stopped coming the night the star fell. Nessa carried the post on the southern road.', 'If she dropped anything, the frost will show me. It always finds her.'], progress: ['Follow the trail of frost and letters.'], complete: ['She ran south and east. She’s alive. I know she is.', 'I’ll keep her letters until I can give them back. Now, Elder Rowan asked for help. Nessa would want me to give it.'], after: [] } }),
    h('lyra', { id: 'lyra2', title: 'The Letter Thief', giver: 'bram', kind: 'chase', count: 1, place: 'millbrook', after: 'm7', who: person('Wick the Magpie-boy', '🧒', { robe: '#5a4a3a', hat: 'cap', hatColor: '#2e2420', small: true }), summary: 'Catch the boy selling Nessa’s letters around Millbrook Farm.', reward: { xp: 150, gold: 40 },
      text: { offer: ['There’s a lad around the farm selling letters. Sealed ones, courier’s post. Says he found them.', 'One had frost on the seal, if you can believe it. In summer. That mean anything to you?'], progress: ['Wick hangs around Millbrook Farm. He’s quick, but he runs out of breath.'],
        deliver: ['Ow! Alright! I found them on the road, I swear!', 'The courier girl ran past me that night, white as snow. A girl in a black cloak was chasing her. East! Toward the big woods!'],
        complete: ['East, eh? Toward Whisperroot. Then that’s where your sister went.'], after: ['Wick’s mending my fences now. Honest work.'] } }),

    h('riven', { id: 'riven1', title: 'An Old Debt', giver: 'fox', kind: 'talk', count: 1, to: 'magpie', after: 'm4', summary: 'Find Magpie, Riven’s old guildmistress, in Goldenhearth.', reward: { xp: 90 },
      text: { offer: ['Sable. Ilse said Sable. I knew a Sable, once. In the foundling house, when we were small.', 'Magpie will know more. Magpie always knows more. She’s in the city, pretending to sell hats.'], progress: ['Magpie keeps a hat stall in Goldenhearth.'], complete: [], after: [],
        deliver: ['Riven. You walked out on the Hushed. People don’t do that.', 'The buyer? A girl in a black cloak. Paid in feathers that turned to smoke the next morning. She wanted the sun-crystals out of the Beacon.', 'I think she was one of ours. The foundling house, years back. The one the other children were scared of.'] } }),
    h('riven', { id: 'riven2', title: 'Needle Runs', giver: 'magpie', kind: 'chase', count: 1, place: 'willow', after: 'm4', who: person('Needle', '🥷', { robe: '#3a3048', hat: 'hood', hatColor: '#2a2438' }), summary: 'Catch Needle, the Hushed runner carrying the buyer’s letter, near Willowmere.', reward: { xp: 150, gold: 50 },
      text: { offer: ['Needle is carrying the buyer’s last letter east, to Willowmere. I want to know what it says. So do you.', 'Needle is fast. You were faster, once. Prove it.'], progress: ['Needle is near Willowmere, east of the city. Run the runner down.'],
        deliver: ['Riven?! You’re supposed to be gone!', 'Fine, take it! It’s sealed with a black sun. Gives me the creeps.'],
        complete: ['“The lights must go out, one by one. When they are all dark, I will stop hurting.” …An eclipse for a seal.', 'Go on, then. Do the right thing, whatever it is. You always were bad at being a thief.'], after: ['Hats! Fine hats!'] } }),

    h('wren', { id: 'wren1', title: 'The Howl in the East', giver: 'fox', kind: 'talk', count: 1, to: 'garrick', after: 'm10', summary: 'Ask Hunter Garrick at the Hunter’s Camp about Wren’s lost pack.', reward: { xp: 120 },
      text: { offer: ['(Fenn stops and stares east, ears flat. Far away, something howls.)', 'That was Moonfang. Our pack’s mother. Garrick raised me at the Hunter’s Camp. He’ll know which way they ran.'], progress: ['The Hunter’s Camp is south of Goldenhearth.'], complete: [], after: [],
        deliver: ['Wren! And Fenn. Good boy. I heard the pack go by, that night. Black as ink, all of them.', 'Moonfang led them east, into Whisperroot. The shadow is thickest there.', 'But she stopped at the edge of the camp and looked back. Something of her is still in there, girl.'] } }),
    h('wren', { id: 'wren2', title: 'The Hunter’s Totems', giver: 'garrick', kind: 'activate', count: 3, near: 'rot', switches: 'totem', order: ['Bear totem', 'Stag totem', 'Wolf totem'], after: 'm10', auto: true, summary: 'Wake the three old hunter’s totems around Rotwood Den.', reward: { xp: 160, hearts: 1 },
      text: { offer: ['The old hunters raised totems around Rotwood Den, to keep the gloom out of the beasts’ hearts. They’ve gone dark.', 'Wake them. Touch each one. If the gloom can be pushed out of a boar, maybe it can be pushed out of a wolf.'], progress: ['Three totems around Rotwood Den, east of here.'], complete: ['(All three totems glow green. Fenn sits up straight and howls, clear and bright, and far away the land goes quiet to listen.)', 'If the gloom can let go of a beast, it can let go of Moonfang. East, then, over the river.'], after: [] } }),

    // ── more of each hero's own road through the meadow
    h('mira', { id: 'mira0', title: 'Follow the Lights', giver: 'fox', kind: 'activate', count: 3, near: 'sunpetal', switches: 'lantern', order: ['Well lantern', 'Mill lantern', 'Gate lantern'], after: 'm1', auto: true, cine: { done: 'orrin-lanterns' }, summary: 'Relight the three lanterns Master Orrin hung in Sunpetal on the night he left.', reward: { xp: 90, mana: 8 },
      text: { offer: ['(Tuft runs to a lantern by the well and whines. It’s one of Orrin’s: star-glass, with his mark scratched on the frame.)', 'He hung lanterns here that night, three of them. He always said a lit lantern remembers who lit it. Let’s wake them.'], progress: ['Three of Orrin’s lanterns around Sunpetal.'], complete: [], after: [] } }),
    h('mira', { id: 'mira5', title: 'Starmoss', giver: 'maren', kind: 'collect', count: 4, near: 'faerie', item: 'Starmoss', icon: 'herb', after: 'm7', turnIn: 'maren', summary: 'Gather starmoss at the Faerie Ring for Healer Maren.', reward: { xp: 170, hearts: 1 },
      text: { offer: ['Orrin’s girl! He used to bring me starmoss from the Faerie Ring. Nothing mends a gloom-bite faster.', 'Half the village has bites since the Beacon died. Would you fetch four clumps? It glows at the roots. You can’t miss it.'], progress: ['Starmoss grows in the Faerie Ring, south of Goldenhearth.'], complete: ['Oh, it’s good and bright. He taught you where to look, didn’t he?', 'Here. Take this for your trouble, and keep that fox fed.'], after: ['Starmoss tea, anyone?'] } }),

    h('kael', { id: 'kael0', title: 'A Wall for Millbrook', giver: 'bram', kind: 'build', count: 4, near: 'millbrook', item: 'Fence stake', icon: 'bundle', place: 'millbrook', site: 'barricade', siteName: 'Millbrook barricade', after: 'kael1', turnIn: 'bram', cine: { done: 'barricade-kael' }, summary: 'Cut four fence stakes around Millbrook and build Farmer Bram a barricade.', reward: { xp: 150, hearts: 1 },
      text: { offer: ['You found the shield, then. I’m sorry, lad.', 'The gloomlings come right up to my door every night now. You Wardens used to build walls for the farms. Show me how?', 'Four good stakes from the woods around the farm, and we’ll put up a fence they won’t cross.'], progress: ['Four fence stakes around Millbrook, then build the barricade.'], complete: ['That’ll hold. That’ll hold for years.'], after: ['Not one gloomling since. Not one!'] } }),
    h('kael', { id: 'kael6', title: 'The Last Wardens', giver: 'brannoc', kind: 'rescue', count: 1, place: 'faerie', guards: 4, escort: true, after: 'm5', turnIn: 'brannoc', cine: { done: 'wardens-oath' }, summary: 'Free Warden Brin at the Faerie Ring and walk her to Captain Brannoc.',
      captive: person('Warden Brin', '🛡️', { robe: '#3f5a8a', hat: 'helm', hatColor: '#b8bcc6', hair: '#b8743c' }), reward: { xp: 190, item: 'barkskin' },
      text: { offer: ['One of my scouts saw a Warden at the Faerie Ring. Alive, in a cage of thorns, with gloomlings all round her.', 'Brin, I think. She rode with Aldric. Bring her back to me, squire. The valley can’t spare a single Warden.'], progress: ['Break the guards at the Faerie Ring, open the cage, and bring Brin to Brannoc.'], arrive: ['Goldenhearth. I never thought I’d see those walls again.'],
        deliver: ['A squire? Aldric’s squire! Then he got you clear. Good.', 'Get me out of here and I’ll tell you everything I saw on the Rise.'],
        complete: ['Brin says the shadow took Aldric whole. It didn’t kill him, lad. It took him.'], after: ['Two Wardens in my city again.'] } }),

    h('lyra', { id: 'lyra0', title: 'The Lake Remembers', giver: 'fox', kind: 'activate', count: 3, near: 'mirror', switches: 'rune', order: ['Frost rune', 'Road rune', 'Heart rune'], after: 'm5', auto: true, cine: { done: 'nessa-echo' }, summary: 'Wake three old frost runes on the shore of Mirror Lake to see what happened to Nessa.', reward: { xp: 150, mana: 10 },
      text: { offer: ['There are frost runes on these shore stones. Old ones, from when my family still lived in the valley.', 'Frost remembers. If I wake them, the lake might show me the night Nessa ran this road.'], progress: ['Three frost runes around Mirror Lake.'], complete: [], after: [] } }),
    h('lyra', { id: 'lyra6', title: 'Letters in the Gloom', giver: 'bram', kind: 'collect', count: 4, near: 'hollow', item: 'Nessa’s letter', icon: 'letter', after: 'lyra2', turnIn: 'wren', summary: 'Gather the rest of Nessa’s letters in Gloom Hollow and bring them to Postmistress Wynne.', reward: { xp: 170, gold: 45 },
      text: { offer: ['Wick says he threw the letters he couldn’t sell into Gloom Hollow. The gloomlings sit on them like eggs.', 'Postmistress Wynne would want them. Every one is somebody’s news.'], progress: ['Four of Nessa’s letters in Gloom Hollow, south of the farm.'], complete: ['Nessa’s round. Every last one, and not a stamp missing.', 'I’ll send them on, and I’ll tell every rider on every road: we’re looking for a courier girl with frost in her hair.'], after: ['The post goes out at dawn again.'] } }),

    h('riven', { id: 'riven0', title: 'Light Fingers', giver: 'maren', kind: 'collect', count: 4, near: 'sunpetal', item: 'Stolen purse', icon: 'bundle', after: 'm2', turnIn: 'maren', summary: 'Find the purses the Hushed lifted in Sunpetal during the attack and give them back.', reward: { xp: 120, gold: 30 },
      text: { offer: ['While everyone was at the barricade, someone went through every house on the lane. Purses, rings, my good scissors.', 'You move like one of them, dear. No offence. Maybe you know where a thief would stash things?'], progress: ['Four stolen purses hidden around Sunpetal.'], complete: ['Under the well cover? In the rain barrel? You do know how they think.', 'Thank you, Riven. You didn’t have to. That’s the point, isn’t it?'], after: ['Honest hands. Who’d have thought.'] } }),
    h('riven', { id: 'riven6', title: 'Follow the Feathers', giver: 'fox', kind: 'trail', count: 4, near: 'city', place: 'willow', after: 'riven1', auto: true, cine: { done: 'feather-trail' }, summary: 'Follow the trail of black feathers from Goldenhearth to Willowmere.', reward: { xp: 160, regen: .4 },
      clues: ['A black feather caught in the city gate. It crumbles to smoke when I touch it.', 'Another, on a milestone. Whoever paid the Hushed walked this road on foot, alone.', 'Scuff marks where someone sat and cried. Then stood up and kept walking.', 'Feathers all along the Willowmere jetty, as if someone waited here a long, long time.'],
      text: { offer: ['Magpie said the buyer paid in feathers that turn to smoke. Feathers leave a trail, if you know how to look.', 'East, out of the city. Let’s see where you went.'], progress: ['Follow the black feathers.'], complete: [], after: [] } }),

    h('wren', { id: 'wren7', title: 'Snares in the Stones', giver: 'fox', kind: 'collect', count: 4, near: 'stones', item: 'Poacher’s snare', icon: 'bundle', after: 'm2', auto: true, summary: 'Pull up the poacher’s snares around the Old Stone Garden before a wolf steps in one.', reward: { xp: 110, hearts: 1 },
      text: { offer: ['(Fenn yelps and jumps back from a loop of wire hidden in the grass.)', 'Snares. Wolf snares, set right where the pack ran. Someone knew they’d come this way. Let’s pull them all up.'], progress: ['Four snares hidden around the Old Stone Garden.'], complete: ['Four. All set for something big. Somebody wants a shadow-wolf pelt.', '(Fenn sniffs the last snare and growls, and sets off after a fresh trail.)'], after: [] } }),
    h('wren', { id: 'wren8', title: 'The Poacher', giver: 'fox', kind: 'chase', count: 1, place: 'stones', after: 'wren7', auto: true, who: person('Burr the Poacher', '🪤', { robe: '#5a5a3a', hat: 'cap', hatColor: '#3a3a24', beard: true }), summary: 'Catch the poacher who set wolf snares in the Old Stone Garden.', reward: { xp: 150, gold: 40 },
      text: { offer: ['There he is, among the stones, with a sack of wire. Fenn, with me!'], progress: ['Burr is quick, but he tires. Catch him.'],
        deliver: ['Alright, alright! Call off the wolf!', 'A lady in a black cloak pays good silver for shadow-wolf pelts. Says she needs them “to see in the dark”. I never caught one, I swear!', 'Your pack went east, past the Rise. I heard them howling at the Beacon.'],
        complete: ['(Burr runs off without his sack. Fenn looks very pleased.)', 'A lady in a black cloak. East, past the Rise. We’re coming, Moonfang.'], after: [] } }),
    h('wren', { id: 'wren9', title: 'Wolves at the Camp', giver: 'garrick', kind: 'defend', count: 3, place: 'camp', waves: [3, 3, 4], foes: ['shadewolf', 'gloomling', 'shadewolf'], ward: 'the Hunter’s Camp', after: 'wren1', cine: { start: 'pack-attack' }, summary: 'Hold the Hunter’s Camp when Wren’s own shadow-bound pack comes for it.', reward: { xp: 220, hearts: 1 },
      text: { offer: ['They come back every few nights, girl. Your pack. They circle the camp and howl at the tents.', 'Tonight they mean it. Stand with me at the fire. Drive them off, and we’ll go looking for Moonfang together.'], progress: ['Stay by the camp. Drive off every wave.'], complete: ['They broke and ran. And did you see? The last one looked back. Just like Moonfang did.', 'There’s still something of them in there. Now, those totems at Rotwood Den…'], after: ['Quiet night. Thanks to you.'] } }),
  ],

  // ═════════════════════════════ Chapter II
  woods: [
    h('mira', { id: 'mira2', title: 'The Apprentice’s Test', giver: 'fox', kind: 'activate', count: 3, near: 'spring', switches: 'rune', order: ['Root', 'Leaf', 'Star'], ordered: true, after: 'm12', auto: true, summary: 'Wake the runes at the Moss Shrine in the order Orrin taught you.', reward: { xp: 200, mana: 12 },
      text: { offer: ['(Tuft trots north, toward the Moss Shrine, and sits beside three old runestones as if he has been here before.)', 'Orrin brought me here once, when I was little. “First the root that holds, then the leaf that grows, then the star that guides.” He said I would understand one day.'],
        progress: ['Root, then Leaf, then Star.'], complete: ['(The runes blaze, one after another. Orrin’s voice rises out of the stones, warm and a little tired.)', '“If you are hearing this, Mira, you remembered. Then you are ready for more than I ever taught you. Be braver than me.”'], after: [] } }),

    h('kael', { id: 'kael3', title: 'The Black Knight', giver: 'thessaly', kind: 'chase', count: 1, place: 'glade', after: 'm5', escapes: true, cine: { caught: 'knight-vanish' }, who: person('The Black Knight', '🖤', { robe: '#1a1624', hat: 'helm', hatColor: '#2a2438', skin: '#3a3048', hair: '#1a1624' }), turnIn: 'thessaly', summary: 'Run down the knight in black armour seen near the Moonlit Glade, then report to Thessaly.', reward: { xp: 200 },
      text: { offer: ['Before Rook, one more thing. A knight in black armour haunts the Moonlit Glade. He attacks travellers, but never the children.', 'He carries a Warden’s sword. Your order’s sword, Kael. Find out who he is.'], progress: ['The black knight lurks near the Moonlit Glade.'],
        deliver: ['(The knight sags, and a voice you know whispers from inside the helm.)'],
        complete: ['An empty suit of armour that knew your name? Stars keep us.', 'If it was Aldric, then some part of him is still fighting. Hold on to that. Now, Rook.'], after: ['Keep your shield close.'] } }),

    h('lyra', { id: 'lyra3', title: 'The Courier’s Word', giver: 'guide', kind: 'talk', count: 1, to: 'nutkin', after: 'm1', summary: 'Ask Courier Nutkin at the camp about Nessa.', reward: { xp: 120 },
      text: { offer: ['A courier girl with frost in her hair? Nutkin would know. The couriers look after each other.'], progress: ['Nutkin is here at the camp.'], complete: [], after: [],
        deliver: ['Nessa? She carried the post with me for two whole summers! Fastest feet in the valley, after mine.', 'She came through here running, a week ago. Frost wraiths from the Summit caught her at the river and carried her off, up the mountain.', 'She kept shouting your name. “Lyra will come.” I didn’t know who Lyra was. Now I do.'] } }),

    h('riven', { id: 'riven3', title: 'Moon, Eye, Door', giver: 'fox', kind: 'activate', count: 3, near: 'ruins', switches: 'rune', order: ['Moon', 'Eye', 'Door'], ordered: true, after: 'm7', auto: true, cine: { done: 'sable-echo' }, summary: 'Touch Sable’s shadow-runes in the Root Ruins in the order of your old game.', reward: { xp: 200, regen: .6 },
      text: { offer: ['Rook said Sable carved runes into the Root Ruins. I know those shapes. Moon, eye, door: our game in the foundling house.', 'If I touch them in the old order, maybe they will answer.'], progress: ['Moon, then Eye, then Door.'], complete: [], after: [] } }),

    h('wren', { id: 'wren3', title: 'Moonfang’s Tracks', giver: 'fox', kind: 'trail', count: 4, near: 'bellhollow', place: 'pool', after: 'm3', auto: true, summary: 'Follow the great white wolf’s tracks from Bellhollow to Blackwater Pool.', reward: { xp: 160 },
      clues: ['Pawprints as wide as my hand. Moonfang’s. The shadow hasn’t shrunk her.', 'A tuft of fur on a bramble, half white and half black, as if it can’t decide.', 'A shadow-bound deer, left untouched. The other wolves would have eaten it. She stopped them.', 'By the water: a den dug under the roots. And inside, a tiny pale pup, glowing like moonlight.'],
      text: { offer: ['(Fenn’s hackles rise. He has found her scent, strong and fresh, running east out of Bellhollow.)', 'Easy, boy. Quietly. Let’s see where she went.'], progress: ['Follow the pawprints.'], complete: ['A pup. Moonfang left a pup, and the shadow never touched her. Fenn, that’s your sister.', 'We can’t leave her here with the shadewolves. Come on, little one.'], after: [] } }),
    h('wren', { id: 'wren4', title: 'Snowpaw', giver: 'fox', kind: 'escort', count: 1, from: 'pool', place: 'bellhollow', after: 'm3', auto: true, beast: 'wolf', who: person('Snowpaw', '🐺', { robe: '#dff6ff' }), ambush: ['shadewolf', 'shadewolf', 'webspinner'], summary: 'Bring Moonfang’s pup safely to Nana Bristle in Bellhollow.', reward: { xp: 200, hearts: 1 },
      text: { offer: ['She won’t come near the shadewolves. If they find us, she’ll freeze. Keep them off her.', 'Nana Bristle in Bellhollow feeds every stray in the woods. She’ll keep the pup safe.'], progress: ['Lead Snowpaw to Bellhollow. Chase off anything that threatens her.'], arrive: ['(Snowpaw bounds into Bellhollow and straight into Nana Bristle’s apron.)'], complete: ['“Oh, you little snowball! Of course you can stay. Every hero’s family is welcome at my table.”', 'She’s safe. Now let’s get back to the Bellkeeper, Fenn.'], after: [] } }),

    // ── more of each hero's own road through Whisperroot
    h('mira', { id: 'mira7', title: 'Guard the Moss Shrine', giver: 'fox', kind: 'defend', count: 3, place: 'spring', waves: [3, 4, 4], foes: ['wisp', 'thornling', 'gloomling'], ward: 'the Moss Shrine', after: 'mira2', auto: true, cine: { start: 'mira-shrine' }, summary: 'Protect the Moss Shrine and Orrin’s runes from a swarm of wisps.', reward: { xp: 240, mana: 12 },
      text: { offer: ['(Tuft’s ears go flat. The wisps heard Orrin’s voice in the runes, and they’re coming for it.)', 'Not his runes. Not while I’m standing here. Stay by the shrine, Tuft.'], progress: ['Stay by the Moss Shrine. Stop the wisps before they reach it.'], complete: ['(The last wisp pops like a soap bubble. The runes hum, safe.)', 'He left a piece of himself here for me. Nobody takes it.'], after: [] } }),

    h('kael', { id: 'kael7', title: 'Old Tobb', giver: 'thessaly', kind: 'escort', count: 1, from: 'watch', place: 'city', after: 'kael3', turnIn: 'thessaly', who: person('Old Tobb', '🧓', { robe: '#3f5a8a', hat: 'helm', hatColor: '#9aa0aa', beard: true, hair: '#e8e2d0' }), ambush: ['shadewolf', 'webspinner', 'thornling'], cine: { done: 'warden-lore' }, summary: 'Walk Old Tobb, the last Warden of the woods, from the Watchtower to Lanternmarket.', reward: { xp: 230, hearts: 1 },
      text: { offer: ['That black knight shook you. Talk to Tobb. He was a Warden before your Aldric was born.', 'He won’t leave the old Watchtower, and the woods are full of wolves. Walk him here, and he might tell you a thing or two.'], progress: ['Walk Old Tobb from the Watchtower to Lanternmarket. Keep the wolves off him.'], arrive: ['Lanternmarket. Smells like it always did. Burnt sugar and wet dog.'], complete: ['He’s talking. He hasn’t talked in years. Sit with him a while, Kael.'], after: ['Tobb tells the same story twice a night now.'] } }),

    h('lyra', { id: 'lyra7', title: 'The Pale Rider', giver: 'nutkin', kind: 'chase', count: 1, place: 'lodge', after: 'lyra3', escapes: true, turnIn: 'nutkin', who: person('The Pale Rider', '👻', { robe: '#dff6ff', hat: 'hood', hatColor: '#bfe8ff', skin: '#e8f4ff', hair: '#ffffff' }), cine: { caught: 'rider-flees' }, summary: 'Catch the frost wraith scout haunting the Trapper’s Lodge, then tell Nutkin where it went.', reward: { xp: 210, mana: 12 },
      text: { offer: ['One of them is still here. A pale thing, riding the mist around the Trapper’s Lodge. It was with the ones that took Nessa.', 'If you can catch it, maybe it’ll show you where they went.'], progress: ['The pale rider haunts the Trapper’s Lodge, far to the south-east.'],
        deliver: ['(The wraith hisses a single word, cold as the Summit wind: “…Observatory.”)'],
        complete: ['North, to the Summit? Then that’s where she is. Nutkin will carry word ahead. Couriers look after each other.'], after: ['Every courier on the road knows your sister’s name now.'] } }),

    h('riven', { id: 'riven7', title: 'The Foundling', giver: 'juna', kind: 'rescue', count: 1, place: 'nest', guards: 5, escort: true, after: 'riven3', turnIn: 'juna', cine: { done: 'foundling-memory' }, summary: 'Rescue Tib, a foundling taken by the shadow, from the Nest and bring him to Juna.',
      captive: person('Tib', '🧒', { robe: '#3a3458', hair: '#1a1a24', small: true }), reward: { xp: 230, regen: .5 },
      text: { offer: ['A boy went missing from my shelter. Tib. He has… a shadow that hurts. Something came for him in the night.', 'They took him to the Nest, north of the market. Please. Nobody else goes looking for children like him.'], progress: ['Break the guards at the Nest, free Tib, and walk him back to Juna.'], arrive: ['Is this where Juna lives? Is there a bed? A real one?'],
        deliver: ['You’re… like me. Your shadow moves too.', 'The lady in black said I’d stop hurting if I came with her. I didn’t want to go.'],
        complete: ['Tib, oh, Tib. Thank you. He hasn’t let go of your sleeve once, Riven.'], after: ['Tib says he wants to be a thief like you. I told him you’re a hero.'] } }),
  ],

  // ═════════════════════════════ Chapter III
  summit: [
    h('mira', { id: 'mira3', title: 'What Mira Believes', giver: 'orrin', kind: 'talk', count: 1, to: 'orrin', after: 'm11', summary: 'Tell Master Orrin what you think of what he did.', reward: { xp: 180 },
      text: { offer: ['I have told you everything, Mira. Every foolish, proud thing I did.', 'Before we go on, I need to hear it from you. Say what you think of me. I have earned it, whatever it is.'], progress: ['Orrin is waiting for your answer.'], complete: [], after: [],
        deliver: ['(Orrin looks at you the way he did on your very first day as his apprentice: hopeful, and a little afraid.)'] },
      choice: {
        a: { label: 'I forgive you', lines: ['(He lets out a breath he must have held for ten years.)', 'Then I will try to deserve it. Thank you, my brave girl. Now: the Crag Shard.'], reward: { hearts: 1 } },
        b: { label: 'Make it right first', lines: ['Yes. Yes, that is fair. That is exactly what I would have told you.', 'Then let us make it right, together. Starting with the Crag Shard.'], reward: { mana: 15 } },
      } }),

    h('kael', { id: 'kael4', title: 'The Wardens’ Fires', giver: 'dov', kind: 'activate', count: 3, near: 'pass', switches: 'brazier', order: ['Old fire', 'Watch fire', 'Last fire'], after: 'm14', auto: true, summary: 'Light the three Warden fires at Silver Pass.', reward: { xp: 220, hearts: 1 },
      text: { offer: ['You fought like a Warden out there. We have three old Warden fires on this pass. Nobody has lit them since the order broke up.', 'Light them. Let whatever is watching from the dark know the Wardens are back.'], progress: ['Three Warden fires around Silver Pass.'], complete: ['(The third fire roars up. Every soldier on the pass stands straighter, and somebody starts to sing the old Warden song.)', '“Hold the line where I cannot.” Aldric taught me that song. I’m holding it, Ser.'], after: [] } }),

    h('lyra', { id: 'lyra4', title: 'Nessa', giver: 'aune', kind: 'rescue', count: 1, place: 'observatory', guards: 5, escort: true, after: 'm2', captive: NESSA, summary: 'Free Nessa from the frost wraiths at the Old Observatory and bring her to Healer Aune.', reward: { xp: 260, hearts: 1 },
      text: { offer: ['A courier girl? Frost wraiths dragged someone like that past the hamlet, south to the Old Observatory. Poor Vale has locked himself in with his telescope.', 'Bring her here to me, whoever she is. She’ll be half frozen.'], progress: ['The Old Observatory lies south-west of the hamlet. Break the wraiths, open the cage, and bring her back.'],
        deliver: ['Lyra?! LYRA! I knew it, I told them you’d come!', 'They wanted my frost, the same as yours. To seal the mountain. I wouldn’t give it to them.'], arrive: ['Is that a healer? Is there soup? Lyra, is there soup?'],
        complete: ['Sit down, both of you. Your sister is frozen to the bone and stubborn as a goat. Must run in the family.', 'Nessa will stay with me until she’s warm. Now, about that emberroot…'], after: ['Two frost-girls in one hamlet. Stars help us.'] } }),

    h('riven', { id: 'riven4', title: 'Sable’s Question', giver: 'sable', kind: 'talk', count: 1, to: 'sable', after: 'm17', summary: 'Answer Sable’s question.', reward: { xp: 200 },
      text: { offer: ['Riven. I knew it was you the moment I saw you fight. You still move like a shadow that’s late for something.', 'Before I go back to him, I need to ask you one thing. Only you would know.'], progress: ['Sable is waiting.'], complete: [], after: [],
        deliver: ['The shadow we were born with. Did it ever stop hurting? For you?'] },
      choice: {
        a: { label: 'No, but it stopped choosing', lines: ['…It never stopped. But one day I realised it doesn’t get to decide what I do.', 'Then maybe it doesn’t get to decide for me either. Thank you, Riven. Go on. Tell Orrin.'], reward: { regen: .6 } },
        b: { label: 'Yes, when I found people', lines: ['When I found people worth standing in front of. It got quieter after that.', 'People worth standing in front of. I think I have some of those now. Go on, tell Orrin.'], reward: { hearts: 1 } },
      } }),

    h('wren', { id: 'wren5', title: 'Goats and a Wolf', giver: 'kiri', kind: 'herd', count: 5, animal: 'goat', near: 'hamlet', place: 'hamlet', after: 'm2', turnIn: 'kiri', summary: 'Herd Little Kiri’s runaway goats back into their pen.', reward: { xp: 180, mana: 12 },
      text: { offer: ['YOUR WOLF SCARED MY GOATS! They ran EVERYWHERE!', 'You have to put them back. All five. In the pen. Walk behind them and they go the other way. Everybody knows that.'], progress: ['Walk behind a goat to push it toward the pen.'], complete: ['Five goats! Okay. Okay, you’re forgiven. Can I pet the wolf?', '(Fenn allows it, with enormous dignity.)'], after: ['The goats still don’t like Fenn.'] } }),
  ],

  // ═════════════════════════════ Chapter IV
  ember: [
    h('mira', { id: 'mira4', title: 'A Light of Her Own', giver: 'fox', kind: 'build', count: 3, near: 'spring', item: 'Starglass', icon: 'gem', place: 'spring', site: 'lantern', siteName: 'Star lantern', after: 'm11', auto: true, cine: { done: 'mira-star' }, summary: 'Gather starglass in the Phoenix Spring and build a star lantern of your own.', reward: { xp: 320, hearts: 1 },
      text: { offer: ['(Tuft paws at the glittering shards in the shallows of the spring. Starglass: glass that remembers light.)', 'Orrin’s last lesson was that a light has to be your own. Let’s make one. Three pieces of starglass, and a lantern to put them in.'], progress: ['Three pieces of starglass around the Phoenix Spring.'], complete: [], after: [] } }),

    h('kael', { id: 'kael5', title: 'Unbroken', giver: 'fox', kind: 'talk', count: 1, to: 'aldric', after: 'm10', summary: 'Face the kneeling knight at Ashfall Watch.', reward: { xp: 320 },
      text: { offer: ['There, at the edge of the Watch. A knight in black armour, kneeling, with his sword driven into the ash.', 'It’s him. I know how he kneels.'], progress: ['The knight kneels at Ashfall Watch.'], complete: [], after: [],
        deliver: ['Kael. You… have my shield.', 'The shadow let me go when the Tyrant took the forge, and it wants me back. I can feel it pulling, lad. I can’t hold much longer.'] },
      choice: {
        a: { label: 'Offer him your hand', lines: ['(Aldric looks at your hand for a long moment. Then he grips it, and the black drains out of his armour like water.)', 'Hold the line where I cannot… you did, didn’t you? Go on. I’ll follow you to the Forge, Warden.'], reward: { hearts: 1 } },
        b: { label: 'Raise his shield against the dark', lines: ['(You set the mended shield between Aldric and the shadow. It breaks against the oak like a wave on a rock.)', 'Hilda’s rivets. Ha! Go on, then, Warden. I’ll be right behind you.'], reward: { item: 'phoenixFeather' } },
      } }),

    h('lyra', { id: 'lyra5', title: 'Winter in the Forge', giver: 'tovan', kind: 'activate', count: 3, near: 'city', switches: 'vent', order: ['West vent', 'North vent', 'East vent'], after: 'm7', turnIn: 'tovan', summary: 'Freeze Brasshaven’s three overheating forge vents before they burst.', reward: { xp: 260, mana: 14 },
      text: { offer: ['Three of my forge vents are glowing white. Since the Tyrant stirred, they won’t cool down, and if they burst, half the city burns.', 'You’re a frost mage, aren’t you? Freeze them. Just… not my beard.'], progress: ['Three vents around Brasshaven. Freeze them.'], complete: ['Ice! In Brasshaven! My apprentices are having snowball fights in the forge.', 'Your sister wrote, by the way. She says to tell you: “Don’t you dare get hurt.”'], after: ['Cool as a mountain morning.'] } }),

    h('riven', { id: 'riven5', title: 'The Ashen Broker', giver: 'hessa', kind: 'chase', count: 1, place: 'kiln', after: 'm3', escapes: true, turnIn: 'hessa', who: person('The Ashen Broker', '🎭', { robe: '#4a3a3a', hat: 'hood', hatColor: '#2a1e1a', skin: '#b0a090' }), summary: 'Catch the ash-masked broker buying ember cores in Kilnhollow.', reward: { xp: 260, gold: 90 },
      text: { offer: ['A masked stranger has been asking my glassblowers about ember cores, and paying in black feathers.', 'Black feathers, Riven. You know what those mean better than I do.'], progress: ['The broker lurks around Kilnhollow.'],
        deliver: ['“The Hushed trained you well, little shadow. But Umbra trained me.”', '(The mask cracks. There is nothing behind it but ash, and the ash blows away.)'],
        complete: ['A mask full of ash? Then Umbra has hands in every city. Thank the kilns you were here.'], after: ['No more feathers in Kilnhollow.'] } }),

    h('wren', { id: 'wren6', title: 'The Last Green', giver: 'fox', kind: 'trail', count: 4, near: 'watch', place: 'green', after: 'm10', auto: true, cine: { done: 'moonfang' }, summary: 'Follow Moonfang’s tracks from Ashfall Watch to The Last Green.', reward: { xp: 320, hearts: 1 },
      clues: ['Big pawprints in the ash, and between them, spots of blood. She’s hurt.', 'A burnt patch where something tried to hold her down. She broke free.', 'White fur on a black rock. The shadow is falling off her like old snow.', 'The first grass in a hundred miles. And under the last green tree, Moonfang.'],
      text: { offer: ['(Fenn freezes, nose up. Moonfang’s scent, here in the wastes, heading north-east.)', 'She came all this way. She was following us, Fenn. Come on.'], progress: ['Follow the pawprints in the ash.'], complete: [], after: [] } }),
  ],
};

/** People who only appear in one hero's story. */
export const HERO_NPCS: Record<RegionId, NpcSpec[]> = {
  meadow: [
    { id: 'magpie', name: 'Magpie', portrait: '🐦‍⬛', at: 'city', dx: -420, dy: 220, activity: 'idle', hero: 'riven', look: look('#2e2a36', 'hood', { hatColor: '#1e1a26', hair: '#2e2420' }), lines: ['Hats! Fine hats! Nobody looks twice at someone selling hats.'], barks: ['Hats!', 'Psst, Riven.'] },
  ],
  woods: [],
  summit: [
    { id: 'nessa', name: 'Nessa', portrait: '👧', at: 'hamlet', dx: 60, dy: -120, activity: 'play', hero: 'lyra', after: 'lyra4', look: NESSA.look, lines: ['Aune says I have to stay warm. I’m warm! I’m SO warm.', 'You came all this way for me. You’re the best big sister in the whole valley.'], barks: ['Lyra!', 'Snowball!'] },
  ],
  ember: [
    { id: 'aldric', name: 'Ser Aldric', portrait: '🛡️', at: 'watch', dx: 170, dy: 90, activity: 'idle', hero: 'kael', after: 'm10', look: look('#3f5a8a', 'helm', { hatColor: '#b8bcc6', beard: true, hair: '#8a8a8a' }), lines: ['You grew up while I was gone, Warden.', 'Aldric of the Rise, at your side. Where you go, I go.'], barks: ['For the valley.'] },
    { id: 'nessa', name: 'Nessa', portrait: '👧', at: 'city', dx: -60, dy: 300, activity: 'play', hero: 'lyra', after: 'summit:lyra4', look: NESSA.look, lines: ['I carried Tovan’s letters all the way here! Nobody catches me twice.'], barks: ['Special delivery!'] },
  ],
};
