import { LOOKS, type Shot } from '../cutscenes';
import { look, own, person, type HeroStory } from './kit';

// Riven, the Shadow. A foundling with a shadow that moves on its own and hurts, sold as a child to the Hushed, a guild
// of thieves. The night the star fell the Hushed stole the Beacon's sun-crystals for a buyer who paid in black feathers,
// and Riven, who had cased the job, walked out and left the pay on the table.
//
// I · The Broken Beacon: a thief catches thieves. Riven wakes on Baker Tom's step, puts back what the Hushed lifted from
//     Goldenhearth's tills, catches little Wick on the chimneys and calls Magpie out of hiding with the old rooftop
//     lamps. Then he steals the crystals back out of the Hushed's three drops (a moth stone, the reeds where Wick threw
//     his away, a shrine no Hushed would rob) before Corvane, the Feathered Shade, comes to collect. He crosses east on
//     the Hushed's own smuggling planks.
// II · The Bell Beneath the Roots: the Hushed smuggle through Silkmother Vesh's tunnels and pay her toll in foundlings.
//     Riven finds the Lantern House he grew up in, catches the matron who sold him, and cuts the web's knots in her
//     cellar, under Blackwater's reeds and at the Hushed's meeting stump. The lamp he lights in the window burns the
//     thorns away.
// III · The Hollow Star: Nullface wears Riven's face, then Sable's. Riven picks Orrin's chains and hears what he paid,
//     steals the star shards from under Nullface's nose (one from beneath a flock of goats), and is the one who reaches
//     Sable, as an equal, because they carry the same shadow. Two shadows break the black ice together.
// IV · The Dawn Forge: the Ashen Broker's network in Kilnhollow and Brasshaven, the thieves who learn to say no, and
//     Umbra, which claims to be the shadow Riven and Sable were born with. The shadow was never the enemy. The choosing is.
const q = own('riven');

const L = {
  wick: person('Wick', '🧒', { robe: '#4a4058', hat: 'cap', hatColor: '#2e2a36', hair: '#2e2420', small: true }),
  needle: person('Needle', '🥷', { robe: '#3a3048', hat: 'hood', hatColor: '#2a2438' }),
  loom: person('Matron Loom', '👵', { robe: '#5a4a3a', hat: 'bonnet', hatColor: '#3a2e24', hair: '#8a8a8a' }),
  tib: person('Tib', '🧒', { robe: '#3a3458', hair: '#1a1a24', small: true }),
  ada: person('Little Ada', '👧', { robe: '#4a4468', hair: '#2e2420', small: true }),
  double: person('Riven?', '🗡️', { robe: '#3a3048', hat: 'hood', hatColor: '#2a2438', hair: '#1a1a24', skin: '#c8bcd8' }),
  aled: person('Brother Aled', '🧘', { robe: '#a8844a', hair: '#8a6a4a' }),
  orrin: person('Master Orrin', '🧙‍♂️', { robe: '#5b5480', hat: 'wizard', hatColor: '#3f3a70', beard: true, hair: '#e8e2d0' }),
  sable: person('Sable', '🌑', { robe: '#2a2438', hat: 'hood', hatColor: '#1a1428', hair: '#1a1a24' }),
  broker: person('The Ashen Broker', '🎭', { robe: '#4a3a3a', hat: 'hood', hatColor: '#2a1e1a', skin: '#b0a090' }),
};
const corvane = look('#1e1a26', 'hood', { hatColor: '#120e18', skin: '#2a2438', hair: '#120e18' });
const loomLook = look('#5a4a3a', 'bonnet', { hatColor: '#3a2e24', hair: '#8a8a8a' });
const wickLook = look('#4a4058', 'cap', { hatColor: '#2e2a36', hair: '#2e2420', small: true });
const tomLook = look('#e8e2d0', 'cap', { hatColor: '#ffffff' });
const kid = (robe: string, hair = '#2e2420') => look(robe, 'none', { hair, small: true });
const hushed = look('#3a3048', 'hood', { hatColor: '#2a2438', hair: '#1a1a24' });

// ═════════════════════════════ cutscenes
const cines: Record<string, Shot[]> = {
  // ─────────────── Chapter I
  'riven-rooftops': [
    { at: 'meadow:city', dy: -220, text: 'Noon over Goldenhearth. Pigeons, chimney smoke, four takings tins back on four counters…', dur: 3.8 },
    { dx: 140, dy: -260, text: '…and a small hooded figure, crouched on a chimney pot, watching every one of them go home.', actors: [{ id: 'rwick', name: '???', look: wickLook, dx: 20, dy: 20, face: -1 }], dur: 4.4 },
    { text: 'It has followed you since the first tin. Now it is staring at Tom’s honey buns, very hard.', actors: [{ id: 'rtom', name: 'Baker Tom', look: tomLook, dx: -160, dy: 440 }], dur: 4 },
    { at: 'hero', speaker: 'Riven', portrait: '🗡️', text: '“Hushed. Twelve at most. And hungry.”', dur: 3.2 }],
  'riven-wick': [
    { at: '$thief', text: 'Round a chimney, over a gutter, across the bakery roof. You catch the boy by the hood one step before he jumps.', actors: [{ id: 'cwick', name: 'Wick', look: wickLook, dx: 30, dy: 10, face: -1 }], dur: 4.4 },
    { text: 'His name is Wick. The Hushed took him in last winter, the same way they once took you in: cold, and small, and quick.', fx: [{ kind: 'memory' }], actors: [{ id: 'clriven', name: 'Little Riven', look: LOOKS.littleRiven, dx: -60, dy: 20, spirit: true }], dur: 4.8 },
    { at: '$thief', speaker: 'Riven', portrait: '🗡️', text: '“Easy. I’m not taking you back to anybody.”', dur: 3.4 }],
  'riven-call': [
    { at: 'meadow:city', dy: -180, night: .5, text: 'Dusk over Goldenhearth. Three small lamps burn in three high places, one after another.', fx: [{ kind: 'kindle', dx: -260, dy: -40 }, { kind: 'kindle', dy: -120, delay: .7 }, { kind: 'kindle', dx: 260, dy: -40, delay: 1.4 }], dur: 4.4 },
    { dx: 220, dy: -220, text: 'On the tannery roof, a tall figure in a hood unfolds from behind a chimney, as if she had been there all along.', actors: [{ id: 'cmagpie', name: 'Magpie', look: LOOKS.magpie, dy: 30, face: -1 }], dur: 4.4 },
    { speaker: 'Magpie', portrait: '🐦‍⬛', text: '“Three lamps. You always did have lovely manners, for a thief. The hat stall. Ten minutes.”', dur: 4.2 },
    { text: 'Then she is gone. So, somehow, is a pigeon.', fx: [{ kind: 'feathers', dy: 20 }], dur: 3 },
    { at: 'hero', night: 0, speaker: 'Riven', portrait: '🗡️', text: '“She came. She’s scared. Magpie is never scared.”', dur: 3.4 }],
  'riven-reeds': [
    { at: 'meadow:mirror', dx: 200, dy: -560, night: .45, text: 'In the reeds, the sun-crystal glows. And Mirror Lake remembers who threw it there.', fx: [{ kind: 'memory' }], dur: 4 },
    { text: 'Dawn, this morning. A boy in a patched hood stood on this shore and hurled a glowing stone as far as he could.', actors: [{ id: 'mwick', name: 'Wick', look: wickLook, dx: -40, dy: 20 }], fx: [{ kind: 'kindle', dx: 120, dy: 60, delay: 1 }], dur: 4.6 },
    { speaker: 'Wick', portrait: '🧒', text: '“I won’t carry it! You can’t make me!”', dur: 3 },
    { text: 'Behind him, the gloom came up out of the water like a cold hand, and pulled him away east.', fx: [{ kind: 'gloom', n: 3, dx: -80, dy: 40 }, { kind: 'shadow', dx: -40, delay: .6 }], actors: [{ id: 'mwick2', look: wickLook, dx: -40, dy: 20, walk: { dx: 560, dy: 60 } }], dur: 4.6 },
    { at: 'hero', night: 0, speaker: 'Riven', portrait: '🗡️', text: '“He said no. To Corvane. Hold on, Wick.”', dur: 3.4 }],
  'riven-hushed-scatter': [
    { at: 'meadow:shepherd', night: .5, text: 'Moth, crow, owl. The oldest signal the Hushed have: the guard is coming. Scatter.', fx: [{ kind: 'kindle', dx: -120 }, { kind: 'kindle', delay: .6 }, { kind: 'kindle', dx: 120, delay: 1.2 }], dur: 4.2 },
    { text: 'Hooded figures burst out of the heather and bolt downhill in every direction.', actors: [{ id: 'h1', name: 'Hushed', look: hushed, dx: -40, dy: 20, walk: { dx: -520, dy: 260 } }, { id: 'h2', name: 'Hushed', look: hushed, dx: 30, dy: 40, walk: { dx: 480, dy: 320 } }, { id: 'h3', name: 'Hushed', look: hushed, dx: 0, dy: -20, walk: { dx: 60, dy: 560 } }], fx: [{ kind: 'smoke', delay: .3 }], dur: 4.4 },
    { text: 'None of them is carrying anything that glows. So is a great deal of scattered, furious sheep.', dur: 4.2 },
    { at: 'hero', night: 0, speaker: 'Riven', portrait: '🗡️', text: '“I taught half of them that signal. Nice to know somebody listened.”', dur: 3.8 }],
  'riven-corvane': [
    { at: 'meadow:rise', cut: true, dy: -80, night: .65, text: 'The dark of the moon. Above the cold Beacon, a masked shade unfolds a cloak of black feathers.', actors: [{ id: 'corvane', name: 'Corvane', look: corvane, dy: 40, spirit: true }], fx: [{ kind: 'feathers', dy: -20 }, { kind: 'shadow', delay: .8 }], dur: 4.8 },
    { speaker: 'Corvane', portrait: '🎭', text: '“Three crystals, little shadow. I paid for them. Everything I pay for comes to me in the end.”', dur: 4.4 },
    { speaker: 'Corvane', portrait: '🎭', text: '“You took my job once, little shadow. Take my feathers again. Everyone has a price.”', dur: 4.4 },
    { at: 'hero', cut: true, night: 0, speaker: 'Riven', portrait: '🗡️', text: '“Keep your feathers. I left them on the table.”', dur: 3.6 }],
  'beacon-lit@riven': [
    { at: 'meadow:rise', dy: -90, text: 'The Beacon roars back to life. Corvane’s feathers blow away across the meadow, and every one turns to smoke.', fx: [{ kind: 'light', dy: -90 }, { kind: 'feathers', dy: -60, delay: .4 }], dur: 4.4 },
    { at: 'obj:meadow:barrier', cut: true, text: 'Its light reaches all the way to the Eastern Gate, where the old Gloomwater Bridge lies broken in the river.', fx: [{ kind: 'collapse' }], dur: 4.6 },
    { at: 'npc:meadow:holt', text: 'Bridgewright Holt is already there, scratching his head at the wreck.', dur: 3.6 }],
  'chapter-meadow@riven': [
    { at: 'obj:meadow:barrier', text: 'Tarred plank by tarred plank, the Hushed’s old smuggling planks become the Gloomwater Bridge.', fx: [{ kind: 'build' }], dur: 3.8 },
    { at: 'meadow:city', cut: true, night: .4, text: 'In Goldenhearth, a boy called Wick falls asleep on Tom’s flour sacks, still holding half a honey bun.', actors: [{ id: 'swick', name: 'Wick', look: wickLook, dx: 90, dy: 280 }], dur: 4.4 },
    { at: 'obj:meadow:barrier', cut: true, night: 0, dx: 900, text: 'Beyond the bridge the road dives under ancient trees: Whisperroot Woods. Somewhere under those roots, the Hushed’s tunnels run east.', dur: 4.6 },
    { at: 'woods:web', cut: true, night: .4, text: 'In Silkshadow Hollow, something with far too many legs is spinning.', fx: [{ kind: 'shadow' }], dur: 4 },
    { at: 'woods:bell', cut: true, dy: -60, text: 'And around the Ancient Bell hangs a web of runes. Riven knows those shapes. He drew them himself, once, in chalk.', fx: [{ kind: 'shadow', dy: -60 }], dur: 4.8 },
    { title: 'Chapter II', sub: 'The Bell Beneath the Roots', dur: 3.4 }],
  // ─────────────── Chapter II
  'riven-roots': [
    { at: 'woods:gateW', dx: 300, night: .4, text: 'Past the new bridge, the road dives under trees so old they seem to be listening.', fx: [{ kind: 'shadow', dx: 200 }], dur: 4 },
    { at: 'woods:shroomfarm', cut: true, dx: 300, dy: 200, text: 'Far to the north, a cart with no lamp creaks off the road, loaded with barrels. Its driver wears a hood.', actors: [{ id: 'rcart', name: 'Hushed', look: hushed, dx: 200, dy: 60, walk: { dx: -300, dy: -160 } }], dur: 4.6 },
    { text: 'The cart rolls into a hole under the glowcaps, and the ground swallows it whole.', fx: [{ kind: 'smoke', dx: -100, dy: -100 }], dur: 3.6 },
    { at: 'hero', night: 0, speaker: 'Riven', portrait: '🗡️', text: '“Hushed carts. I used to ride on those, curled up under the sacking.”', dur: 3.8 }],
  'riven-lantern-house': [
    { at: 'npc:woods:juna', dy: -40, night: .4, text: 'Behind Juna’s stall stands a tall, crooked house with one round window at the top. The window is dark.', dur: 4.2 },
    { text: 'Riven knows that window. A boy with a restless shadow sat behind it every night, waiting for somebody to come back for him.', actors: [{ id: 'hriven', name: 'Little Riven', look: LOOKS.littleRiven, dx: 40, dy: -30, spirit: true, face: -1 }], fx: [{ kind: 'memory', dy: -40 }], dur: 5 },
    { text: 'Nobody ever did. In the end, the Hushed came instead.', fx: [{ kind: 'feathers', dy: -20 }], dur: 3.6 },
    { at: 'hero', night: 0, speaker: 'Riven', portrait: '🗡️', text: '“The Lantern House. It’s smaller than I remember. Everything is.”', dur: 3.6 }],
  'riven-loom': [
    { at: '$thief', text: 'The old woman stops running at last, out of breath, a great ring of keys clutched to her chest.', actors: [{ id: 'lloom', name: 'Matron Loom', look: loomLook, dx: 20, dy: 10, face: -1 }], dur: 4 },
    { night: .4, text: 'Riven was five the last time she looked at him like that. She was counting coins, then.', actors: [{ id: 'lloom2', name: 'Matron Loom', look: loomLook, dx: -70, dy: 30, spirit: true }, { id: 'lriven', name: 'Little Riven', look: LOOKS.littleRiven, dx: 30, dy: 50, spirit: true, face: -1 }], fx: [{ kind: 'memory' }], dur: 4.8 },
    { speaker: 'Matron Loom', portrait: '👵', text: '“Little Riven. The quiet one. The Hushed paid double for quiet.”', dur: 4 },
    { night: 0, speaker: 'Riven', portrait: '🗡️', text: '“They got a bargain.”', dur: 2.8 }],
  'glade-memory@riven': [
    { at: 'woods:glade', text: 'You step into the glade, and the old lanterns flicker on by themselves. Silver light fills it…', fx: [{ kind: 'memory' }], dur: 3.4 },
    { night: .45, text: '…and it shows two small children from the Lantern House, holding lanterns almost as big as they are.', actors: [{ id: 'gsable', name: 'Little Sable', look: LOOKS.littleSable, dx: -50, dy: 50 }, { id: 'griven', name: 'Little Riven', look: LOOKS.littleRiven, dx: 40, dy: 55, face: -1 }], fx: [{ kind: 'lantern', dx: -50, dy: 20 }], dur: 5 },
    { speaker: 'Little Sable', portrait: '👧', text: '“If you touch moon, then eye, then door, the shadows have to let you through. It’s the rule.”', dur: 4.4 },
    { speaker: 'Little Riven', portrait: '🧒', text: '“You made that rule up.”', dur: 2.8 },
    { speaker: 'Little Sable', portrait: '👧', text: '“So? Somebody has to make them. Might as well be us.”', dur: 3.8 },
    { night: 0, text: 'The light fades. The glade is empty again.', fx: [{ kind: 'memory' }], dur: 3 }],
  'riven-lamp': [
    { at: 'npc:woods:juna', dy: -40, night: .5, text: 'The Lantern House lamp catches, and warm light spills out of a window that has been dark for twenty years.', fx: [{ kind: 'light', dy: -40 }], dur: 4.4 },
    { text: 'Up at the sill, a small boy presses his nose to the glass. His shadow sits beside him, quiet for once.', actors: [{ id: 'ltib', name: 'Tib', look: kid('#3a3458', '#1a1a24'), dx: 50, dy: 20, face: -1 }], dur: 4.4 },
    { at: 'hero', night: 0, speaker: 'Riven', portrait: '🗡️', text: '“Somebody should have done that for us.”', dur: 3.2 }],
  'bell-rung@riven': [
    { at: 'woods:bell', dy: -80, text: 'The Ancient Bell rings out, and its voice rolls through every root in Whisperroot.', fx: [{ kind: 'light', dy: -80 }, { kind: 'ring', dy: -80, delay: .3 }], dur: 4 },
    { text: 'Sable’s rune-web shivers, and comes apart like frost in the sun.', fx: [{ kind: 'wither', dy: -40 }], dur: 3.6 },
    { dy: 40, text: 'Out of the falling silk step the missing children: blinking, holding hands, their shadows all a-twitch.', actors: [{ id: 'bada', name: 'Little Ada', look: kid('#4a4468'), dx: -60, dy: 40, walk: { dx: 60, dy: 30 } }, { id: 'bk1', look: kid('#5a4a3a', '#6b3f2a'), dx: -20, dy: 70, walk: { dx: 50, dy: 30 } }, { id: 'bk2', look: kid('#3a4a5a', '#1a1a24'), dx: 20, dy: 60, walk: { dx: 40, dy: 30 } }], dur: 4.8 },
    { speaker: 'Little Ada', portrait: '👧', text: '“Are you the one Tib talks about? The one with a shadow like ours?”', dur: 3.8 },
    { at: 'woods:city', cut: true, dx: 520, dy: -320, text: 'Deep in the woods, something answers with a howl. The shadow wants its children back.', fx: [{ kind: 'wolves', n: 5 }, { kind: 'shadow', delay: .4 }], dur: 4.4 }],
  'riven-thorns': [
    { at: '$ward', dy: -40, night: .5, text: 'Dusk at the Eastern Gate. The little lamp from the Lantern House burns against a wall of black thorns.', fx: [{ kind: 'lantern', dy: -20 }], dur: 4.2 },
    { at: '$ward', dx: -420, dy: 80, text: 'Out of the trees come the wolves, and the spinners, and everything else the shadow has left.', fx: [{ kind: 'wolves', n: 4 }, { kind: 'howl', delay: .6 }], dur: 4.2 },
    { at: '$ward', speaker: 'Riven', portrait: '🗡️', text: '“Nobody puts that lamp out. Not tonight.”', dur: 3.2 }],
  'chapter-woods@riven': [
    { at: 'obj:woods:barrier', text: 'The Lantern House lamp burns on at the Eastern Gate, small and stubborn…', fx: [{ kind: 'light' }], dur: 3.4 },
    { text: '…and the black thorns remember they were only ever roots, and crumble into dust.', fx: [{ kind: 'wither' }], dur: 3.6 },
    { at: 'summit:spire', cut: true, night: .4, text: 'High on Starfall Summit, a girl in a black cloak sits alone at the Broken Spire, scratching a chalk moth on the stones.', actors: [{ id: 'wsable', name: 'Sable', look: LOOKS.sable, dx: -40, dy: 60 }], dur: 5 },
    { at: 'summit:cradle', cut: true, dy: -80, text: 'Above her, the fallen star glows black in its Cradle. Inside it, something without a face is trying faces on.', fx: [{ kind: 'shadow', dy: -80 }], dur: 4.8 },
    { title: 'Chapter III', sub: 'The Hollow Star', dur: 3.4 }],
  // ─────────────── Chapter III
  'riven-heights': [
    { at: 'summit:gateW', dx: 320, night: .3, text: 'The road climbs into the Silver Heights. The snow squeaks under your boots, and the wind smells of nothing at all.', fx: [{ kind: 'frost' }], dur: 4.4 },
    { at: 'summit:hamlet', cut: true, dx: -420, dy: -260, text: 'On a ridge above Frostpine Hamlet, a hooded figure stands very still, watching you climb. It has your face.', actors: [{ id: 'hdbl', name: 'Riven?', look: LOOKS.riven, spirit: true, dy: 30, face: -1 }], fx: [{ kind: 'shadow', delay: .8 }], dur: 5 },
    { text: 'It raises one hand, exactly as you would, and steps back behind the rocks.', actors: [{ id: 'hdbl', look: LOOKS.riven, spirit: true, dy: 30, walk: { dx: 260, dy: -60 } }], dur: 3.8 },
    { at: 'hero', night: 0, speaker: 'Riven', portrait: '🗡️', text: '“I don’t stand like that. …Do I stand like that?”', dur: 3.4 }],
  'riven-double': [
    { at: '$thief', text: 'You catch the thief by the hood. It turns around, and it is wearing your face.', actors: [{ id: 'dbl', name: 'Riven?', look: LOOKS.riven, spirit: true, face: -1 }], dur: 4 },
    { speaker: 'Riven?', portrait: '🗡️', text: '“Riven. You look so tired of being you. Let me wear it for a while.”', dur: 4 },
    { text: 'Its face runs like wet paint, and it bursts into black smoke that streams away up the mountain.', fx: [{ kind: 'shadow' }, { kind: 'smoke', to: { dx: 1400, dy: -1200 }, delay: .3 }], dur: 4.2 }],
  'riven-rift': [
    { at: 'summit:rift', night: .5, text: 'The Void Rift. Stolen faces drift in the dark like paper lanterns, smiling at nothing.', fx: [{ kind: 'wisps', n: 3 }, { kind: 'shadow', delay: .4 }], dur: 4.4 },
    { text: 'Among them, one face is real: an old man with a white beard, chained to a black stone.', actors: [{ id: 'rorrin', name: 'Master Orrin', look: LOOKS.orrin, dy: 40 }], dur: 4.4 },
    { at: 'hero', night: 0, speaker: 'Riven', portrait: '🗡️', text: '“Chains. I know chains. Let’s see what these ones are made of.”', dur: 3.6 }],
  'riven-orrin': [
    { at: 'npc:summit:orrin', night: .5, text: '(Orrin closes his eyes, and an old memory rises like frost on glass.)', fx: [{ kind: 'memory' }], dur: 3.6 },
    { text: 'The Lantern House, long ago. A young wizard counts gold into Matron Loom’s hand, and a small girl in a black cloak is led out to him.', actors: [{ id: 'oorrin', name: 'Orrin', look: LOOKS.youngOrrin, dx: -80, dy: 40 }, { id: 'oloom', name: 'Matron Loom', look: loomLook, dx: 10, dy: 30, face: -1 }, { id: 'osable', name: 'Little Sable', look: LOOKS.littleSable, dx: 40, dy: 60, walk: { dx: -90, dy: 0 }, face: -1 }], dur: 5.4 },
    { text: 'Behind the door, a boy with the very same shadow watches her go.', actors: [{ id: 'oriven', name: 'Little Riven', look: LOOKS.littleRiven, dx: 120, dy: 20, face: -1 }], dur: 4 },
    { speaker: 'Master Orrin', portrait: '🧙‍♂️', text: '“I never even saw you, Riven. I am sorry for that too.”', dur: 3.8 },
    { at: 'hero', night: 0, text: 'Riven says nothing for a long time.', dur: 3 }],
  'tarn-vision@riven': [
    { at: 'summit:tarn', text: 'The ice clears. You look into Mirrorsky Tarn, and your own face looks back…', fx: [{ kind: 'memory' }], dur: 3.2 },
    { text: '…and ripples, and becomes Sable’s. The same eyes. The same shadow, standing up behind her.', actors: [{ id: 'tsable', name: 'Sable', look: LOOKS.sable, dy: 40, spirit: true }], dur: 4.6 },
    { at: 'summit:crystal', cut: true, text: 'Then the water shows a light in Crystal Hollow, cold as a coin,', fx: [{ kind: 'ring' }], dur: 3 },
    { at: 'summit:terrace', cut: true, text: 'a warm glow on Goatherd’s Terrace, under a heap of very comfortable goats,', fx: [{ kind: 'ring' }], dur: 3.4 },
    { at: 'summit:spire', cut: true, text: 'and a third light at the Broken Spire, right beside a girl in black.', fx: [{ kind: 'ring' }], dur: 3.6 }],
  'riven-two-shadows': [
    { at: 'summit:spire', text: 'Door, eye, moon. The runes around the Spire flare one by one…', fx: [{ kind: 'ring' }, { kind: 'memory', delay: .6 }], dur: 3.8 },
    { dy: 50, text: '…and two shadows stretch out across the snow, born the same, and touch.', actors: [{ id: 'ssable', name: 'Sable', look: LOOKS.sable, dx: -50, dy: 60 }, { id: 'sriven', name: 'Riven', look: LOOKS.riven, dx: 50, dy: 60, face: -1 }], fx: [{ kind: 'shadow', dy: 80, delay: .5 }], dur: 4.6 },
    { speaker: 'Sable', portrait: '🌑', text: '“Oh. It doesn’t hurt. Why doesn’t it hurt?”', dur: 3.4 },
    { speaker: 'Riven', portrait: '🗡️', text: '“Because nobody’s pulling on it. It’s just us.”', dur: 3.6 },
    { at: 'summit:cradle', cut: true, dy: -80, text: 'Far above, inside the hollow star, something without a face turns toward them, and begins to put one on.', fx: [{ kind: 'shadow', dy: -80 }], dur: 4.6 }],
  'star-rises@riven': [
    { at: 'summit:cradle', dy: -100, text: 'The star rises from its Cradle, whole again, and the whole Summit shines.', fx: [{ kind: 'light', dy: -100 }], dur: 4 },
    { text: 'Where Nullface fell there is only an empty mask, and a thread of black smoke tearing loose from it…', fx: [{ kind: 'smoke', dy: -100, to: { dx: 1600, dy: 900 } }], dur: 4 },
    { at: 'obj:summit:barrier', cut: true, text: '…that flees east, and seals the Eastern Gate behind it with black ice.', fx: [{ kind: 'quake' }, { kind: 'shadow', delay: .3 }], dur: 4.2 },
    { at: 'summit:cradle', cut: true, text: 'Sable’s shadow is still there beside her. It just isn’t hurting her any more.', actors: [{ id: 'rsable', name: 'Sable', look: LOOKS.sable, dx: -40, dy: 70 }, { id: 'rriven', name: 'Riven', look: LOOKS.riven, dx: 40, dy: 70, face: -1 }], dur: 4.4 },
    { speaker: 'Sable', portrait: '🌑', text: '“The ice at the Eastern Gate is humming. Both our names, Riven. Meet me there?”', dur: 4.2 },
    { speaker: 'Riven', portrait: '🗡️', text: '“I always do.”', dur: 2.6 }],
  'chapter-summit@riven': [
    { at: 'obj:summit:barrier', text: 'Riven and Sable lay their hands on the black ice. Two shadows, born the same, reach into it together.', actors: [{ id: 'criven', name: 'Riven', look: LOOKS.riven, dx: -170, dy: 60 }, { id: 'csable', name: 'Sable', look: LOOKS.sable, dx: -170, dy: -60 }], fx: [{ kind: 'shadow', delay: .6 }], dur: 4.6 },
    { speaker: 'Sable', portrait: '🌑', text: '“Moon, eye, door?”', dur: 2.4 },
    { speaker: 'Riven', portrait: '🗡️', text: '“Just the door.”', dur: 2.4 },
    { text: 'The black ice cracks from end to end, and shatters. Behind them, an old wizard leans on his staff and, for once, lets someone else do the magic.', actors: [{ id: 'corrin', name: 'Orrin', look: LOOKS.orrin, dx: -300, dy: 40, walk: { dx: 60, dy: 0 } }], fx: [{ kind: 'shatter' }], dur: 5 },
    { at: 'ember:forge', cut: true, dy: -60, text: 'Beyond lie the Ember Wastes, where the Dawn Forge has gone cold… and a broker in an ash mask is buying up its fire.', fx: [{ kind: 'quake' }, { kind: 'feathers', delay: .6 }], dur: 5 },
    { title: 'Chapter IV', sub: 'The Dawn Forge', dur: 3.4 }],
  // ─────────────── Chapter IV
  'riven-wastes': [
    { at: 'ember:gateW', dx: 320, night: .3, text: 'Beyond the ice, the land turns to ash. The wind smells of hot iron and old candles.', actors: [{ id: 'wriven', name: 'Riven', look: LOOKS.riven, dx: -60, dy: 40, walk: { dx: 220, dy: 0 } }, { id: 'wsable', name: 'Sable', look: LOOKS.sable, dx: -100, dy: 70, walk: { dx: 220, dy: 0 } }], fx: [{ kind: 'embers' }], dur: 4.6 },
    { at: 'ember:forge', cut: true, dy: -60, text: 'Far to the north-east, the Dawn Forge sits cold. On its steps, a figure in an ash mask is counting black feathers.', actors: [{ id: 'wbroker', name: 'The Ashen Broker', look: look('#4a3a3a', 'hood', { hatColor: '#2a1e1a', skin: '#b0a090' }), dy: 60 }], fx: [{ kind: 'feathers', dy: 20, delay: .6 }, { kind: 'smoke', delay: 1 }], dur: 5 },
    { at: 'hero', night: 0, speaker: 'Sable', portrait: '🌑', text: '“It’s waiting for us.”', dur: 2.8 },
    { speaker: 'Riven', portrait: '🗡️', text: '“Let it wait. I’ve kept worse people waiting.”', dur: 3.2 }],
  'riven-broker': [
    { at: '$thief', text: 'You catch the broker by the sleeve. The sleeve is full of ash.', dur: 3.4 },
    { speaker: 'The Ashen Broker', portrait: '🎭', text: '“The Hushed trained you well, little shadow. But Umbra trained me.”', dur: 4 },
    { text: 'The mask cracks. There is nothing behind it but ash, and the ash blows away north-east, toward Brasshaven.', fx: [{ kind: 'smoke', to: { dx: 1300, dy: -600 } }, { kind: 'feathers', delay: .4 }], dur: 4.4 }],
  'riven-last-green': [
    { at: 'ember:green', text: 'The Last Green. Leaves, real green leaves, in the middle of all that ash.', fx: [{ kind: 'memory' }], dur: 3.8 },
    { text: 'Wrapped in an old hood among the roots, an ember core glows like a small sun. The leaves above it have not even curled.', fx: [{ kind: 'embers', dy: 30 }, { kind: 'light', dy: 30, delay: .5 }], dur: 4.8 },
    { text: 'Scratched into the bark beside it, in a hand you know: a chalk moth, and the word “NO.”', dur: 3.8 },
    { at: 'hero', speaker: 'Riven', portrait: '🗡️', text: '“Needle. You clever, clever boy.”', dur: 3 }],
  'pyrrhus-wakes@riven': [
    { at: 'ember:forge', dy: -60, text: 'One, two, three. Riven sets the stolen cores into the cold forge, and for the first time in weeks, the Dawn Forge breathes.', fx: [{ kind: 'build' }, { kind: 'embers', delay: .4 }], dur: 4.4 },
    { text: 'The ash around the anvil rises into a towering shape: the old armour of Pyrrhus, the forge’s fallen keeper…', fx: [{ kind: 'quake' }, { kind: 'embers', delay: .3 }, { kind: 'smoke', delay: .6 }], dur: 4.6 },
    { text: '…with a cracked grey mask where his face used to be.', fx: [{ kind: 'shadow', delay: .2 }], dur: 3.4 },
    { speaker: 'The Ashen Broker', portrait: '🎭', text: '“Three cores, carried right to my door. And two little shadows, for the price of none.”', dur: 4.4 },
    { at: 'hero', speaker: 'Riven', portrait: '🗡️', text: '“We’re not for sale.”', dur: 2.8 }],
  'chapter-ember@riven': [
    { at: 'ember:forge', dy: -60, text: 'The Dawn Forge burns white and gold, and a new dawn spills across the wastes.', fx: [{ kind: 'light', dy: -60 }], dur: 4.2 },
    { dy: 40, text: 'Two friends sit on the forge steps. Their shadows lie beside them in the sunrise, perfectly still.', actors: [{ id: 'eriven', name: 'Riven', look: LOOKS.riven, dx: 30, dy: 50, face: -1 }, { id: 'esable', name: 'Sable', look: LOOKS.sable, dx: -30, dy: 50 }], dur: 4.6 },
    { speaker: 'Sable', portrait: '🌑', text: '“It’s not hurting.”', dur: 2.6 },
    { speaker: 'Riven', portrait: '🗡️', text: '“No. It’s just ours.”', dur: 2.8 },
    { at: 'woods:city', cut: true, text: 'In Lanternmarket, the lamp in the Lantern House window has not gone out once.', fx: [{ kind: 'light' }], dur: 3.8 },
    { at: 'meadow:city', cut: true, text: 'In Goldenhearth, a boy called Wick sweeps the bakery step, and saves a honey bun for a thief.', dur: 4.2 },
    { at: 'meadow:rise', cut: true, dy: -80, text: 'And the Beacon, the Bell and the Star shine back across a valley that nobody owns.', fx: [{ kind: 'light', dy: -80 }], dur: 4.2 },
    { title: 'Every light is shining', sub: 'Riven chose, and the valley is whole', dur: 4 }],
};

export const RIVEN: HeroStory = {
  hero: 'riven',
  chains: {
    meadow: ['riven40', 'riven41', 'riven42', 'riven1', 'riven6', 'riven2', 'riven9', 'riven11', 'riven43', 'riven44', 'riven45', 'riven10', 'riven48', 'm10', 'riven49'],
    woods: ['riven50', 'riven16', 'riven52', 'riven7', 'riven14', 'riven53', 'riven15', 'riven54', 'riven3', 'riven55', 'riven18', 'riven19', 'riven56', 'm15', 'riven17', 'riven57'],
    summit: ['riven60', 'riven21', 'riven22', 'riven23', 'riven61', 'riven24', 'riven62', 'riven63', 'riven65', 'riven64', 'riven26', 'riven4', 'riven25', 'riven66', 'm19', 'riven67'],
    ember: ['riven70', 'riven71', 'riven5', 'riven29', 'riven30', 'riven35', 'riven72', 'riven73', 'riven74', 'riven32', 'riven31', 'riven75', 'riven34', 'm12', 'm13'],
  },
  quests: {
    // ═════════════════════════════ Chapter I · a thief catches thieves
    meadow: [
    q({ id: 'riven40', title: 'Honey and Hoods', giver: 'tom', kind: 'collect', count: 4, near: 'city', item: 'Stolen takings tin', icon: 'bundle', cine: { done: 'riven-rooftops' }, summary: 'Find the takings tins the Hushed lifted from Goldenhearth’s tills and give them back to Baker Tom.', reward: { xp: 130, gold: 20 },
      text: { offer: ['You look like someone who slept on my step. Because you did. Here, a honey bun. No charge.', 'Bad night. The Beacon went dark, and while everyone stood staring at the sky, somebody went through every till on the square. Mine too.', 'You’ve got the look of someone who knows where a thief hides things. No offence.', 'Four takings tins. Find them, and the buns are free for a week.'],
        progress: ['Four stolen takings tins are hidden around Goldenhearth. Think like a thief: rain barrels, chimney pots, loose stones.'],
        complete: ['In the rain barrel? Up the chimney? You do know how they think.', 'Every tin back, and not one coin missing. Whoever took them was too scared to spend it.', 'That little hooded one on the chimney pots has been watching you all morning, by the way. Friend of yours?'], after: ['Honey buns! Still warm!'] } }),
    q({ id: 'riven41', title: 'Wick on the Chimneys', giver: 'tom', kind: 'chase', count: 1, place: 'city', who: L.wick, cine: { caught: 'riven-wick' }, summary: 'Catch the hooded boy who snatched Tom’s honey buns and run him down across Goldenhearth.', reward: { xp: 140 },
      text: { offer: ['There he goes! Right off my counter: two honey buns, bold as brass!', 'Quick little thing. Patched hood, very fast feet.', 'Catch him, would you? Gently. He looked hungry.'], progress: ['The hooded boy is darting around Goldenhearth. Run him down.'],
        deliver: ['Riven?! You’re supposed to be gone! Everybody says you walked out!', 'Don’t tell Magpie I talked. She’s hiding. The whole crew is hiding. We did the Beacon job, and now the buyer won’t go away.', 'He paid in feathers. He wants me to carry a crystal to the Rise at the dark of the moon. I don’t want to. Everything he touches goes cold.', '…Can I keep the bun?'],
        complete: ['You let him go? With my bun? …Good. He needed it more than I do.', 'Captain Brannoc is stopping every hood in the city today. You’re wearing a hood. Just saying.', 'If you want to find somebody who’s hiding, don’t walk the streets. Go up. Nobody looks up.'], after: ['Honey buns! Still warm!'] } }),
    q({ id: 'riven42', title: 'Three Lamps for Magpie', giver: 'fox', kind: 'activate', count: 3, near: 'city', switches: 'lantern', order: ['Tannery window', 'Clock-tower window', 'Chimney lamp'], ordered: true, auto: true, cine: { done: 'riven-call' }, summary: 'Light the Hushed’s old call-lamps over Goldenhearth, in the right order, to fetch Magpie out of hiding.', reward: { xp: 140 },
      text: { offer: ['Magpie’s hiding. There is one way to fetch a guildmistress out of hiding, and it isn’t knocking.', 'Three lamps, lit in three high places around the square, in the right order: tannery, clock tower, chimney. It means “a Hushed wants a word.”', 'I’m not Hushed any more. Let’s see if she comes anyway.'],
        progress: ['Light the lamps around Goldenhearth: the Tannery window, then the Clock-tower window, then the Chimney lamp.'],
        complete: ['(Across the square, a shutter bangs. A stall selling hats opens very suddenly.)'], after: [] } }),
    q({ id: 'riven1', title: 'An Old Debt', giver: 'fox', kind: 'talk', count: 1, to: 'magpie', summary: 'Find Magpie, the guildmistress of the Hushed, at her hat stall in Goldenhearth.', reward: { xp: 110 },
      text: { offer: ['Ten minutes, she said. Magpie is never late, and never on time.', 'The hat stall, on the south-west side of the square. Let’s hear what she’s so scared of.'], progress: ['Magpie keeps a hat stall on the south-west side of Goldenhearth.'], complete: [], after: ['Hats! Fine hats!'],
        deliver: ['Riven. You walked out on the Hushed. People don’t do that. And you left your pay on the table, which is just rude.', 'The crystals? Gone to the drops. Three hiding places, for the buyer to collect at the dark of the moon.', 'He calls himself Corvane. A mask, all feathers. His pay turned to smoke by morning. Every last feather.', 'A girl in a black cloak brought us his job. I think she was one of yours, from the foundling house. She walked east, and she dropped feathers like breadcrumbs.', 'I won’t tell you where the drops are. Not yet. I’m more scared of him than I am of you.'] } }),
    q({ id: 'riven6', title: 'Follow the Feathers', giver: 'fox', kind: 'trail', count: 4, near: 'city', place: 'willow', auto: true, cine: { done: 'feather-trail' }, summary: 'Follow the trail of black feathers from Goldenhearth to Willowmere.', reward: { xp: 150, regen: .4 },
      clues: ['A black feather caught in the city gate. It crumbles to smoke when I touch it.', 'Another, on a milestone. Whoever paid the Hushed walked this road on foot, alone.', 'Scuff marks where someone sat and cried. Then stood up and kept walking.', 'Feathers all along the Willowmere jetty, as if someone waited here a long, long time.'],
      text: { offer: ['Magpie won’t give up the drops. But the girl in black left a trail, and feathers leave a trail if you know how to look.', 'East, out of the city, toward Willowmere. Let’s see where you went.'], progress: ['Follow the black feathers east from Goldenhearth.'], complete: [], after: [] } }),
    q({ id: 'riven2', title: 'Needle Runs', giver: 'ottilie', kind: 'chase', count: 1, place: 'willow', who: L.needle, summary: 'Catch the hooded sneak skulking around Willowmere for Mayor Ottilie.', reward: { xp: 150, gold: 50 },
      text: { offer: ['You there! Hooded person! Are you with the other hooded person?', 'A little sneak has been skulking round my jetty since dawn, and my weathervane has gone missing.', 'Catch him, please. And wipe your boots afterwards.'], progress: ['The sneak is darting around Willowmere. Run him down.'],
        deliver: ['Riven?! You’re supposed to be gone!', 'Fine, take it! Take the weathervane too, it was heavy anyway. And this letter. Magpie said carry it to the jetty and never read it. It’s sealed with a black sun.'],
        complete: ['My weathervane! And a letter? I read all the post in Willowmere. It’s a mayor’s privilege.', '“The lights must go out, one by one. When they are all dark, I will stop hurting.” And underneath, in a nasty scratchy hand:', '“Crystals to the three drops. Corvane collects at the dark of the moon.” And a little map on the back: the Old Stone Garden, with a chalk moth on the third stone.'], after: ['Boots. Wiped. Thank you.'] } }),
    q({ id: 'riven9', title: 'The Moth Under the Stone', giver: 'fox', kind: 'key', count: 1, keys: [0], auto: true, summary: 'Open the Hushed’s first drop in the Old Stone Garden and take back a sun-crystal.', reward: { xp: 140, mana: 8 },
      text: { offer: ['A chalk moth on a stone. That’s a Hushed drop. We used to leave each other things under moths.', 'The Old Stone Garden lies west of here, north of the city. Let’s see what the buyer left there.'], progress: ['Find the drop under the moth stone in the Old Stone Garden, north of Goldenhearth.'],
        complete: ['(Under the stone: a sun-crystal, wrapped in black cloth. On top of it lies a single black feather.)', 'One crystal back. This feather should have turned to smoke by now. It hasn’t. Like it’s waiting for its buyer.'], after: [] } }),
    q({ id: 'riven11', title: 'Smoke and Feathers', giver: 'fox', kind: 'deliver', count: 1, to: 'ilse', item: 'Corvane’s feather', summary: 'Show the feather from the drop to Scholar Ilse in Goldenhearth.', reward: { xp: 110 },
      text: { offer: ['Scholar Ilse in Goldenhearth knows every old story in the valley. Maybe one of them has feathers that won’t melt.'], progress: ['Scholar Ilse is in Goldenhearth, on the west side of the square.'], complete: [], after: ['Books remember what people forget.'],
        deliver: ['Oh my. Don’t hold it so close to your face, dear.', 'Corvane, the Feathered Shade. In the oldest tales he buys lights: lamps, hearths, beacons. He pays in feathers that fade the moment he has what he paid for.', 'They say Umbra’s shadow takes the shape of whatever frightens you most. For a thief, what’s worse than a buyer you can never say no to?', 'This one hasn’t faded, so he hasn’t collected. And whoever took his pay will have written it down. Thieves do love their books.'] } }),
    q({ id: 'riven43', title: 'The Captain’s Evidence', giver: 'ilse', kind: 'talk', count: 1, to: 'brannoc', summary: 'Read the Hushed’s seized ledger for Captain Brannoc in Goldenhearth.', reward: { xp: 140 },
      text: { offer: ['And as it happens, Captain Brannoc’s men raided a room above the tannery at dawn. They carried out a whole crate of books.', 'Every one of them written in moths and crows and numbers. Nobody at the barracks can read a word. I expect you can.', 'He’s by the barracks, on the north side of the square. Mind your hood.'], progress: ['Captain Brannoc is by the barracks, on the north side of Goldenhearth.'], complete: [], after: ['The walls hold. So, it turns out, do some thieves.'],
        deliver: ['A hood. Today, everyone in a hood is either a thief or cold. Which are you?', '…You’re the one from the tannery. The one who walked out. Yes, I know about you. I know about everybody.', 'This ledger is all moths and crows. I can’t read a line of it, and you can.', 'So here’s the deal. You read it to me, you bring me the crystals, and I forget your face.'] },
      choice: {
        a: { label: 'Read it to him, honestly', lines: ['“Second drop: Mirror Lake. Wick carries.” Wick? That’s a child’s name.', 'Honest words, from a Hushed. I’ll remember that. Go and find your Wick before I do.'], reward: { mana: 10 } },
        b: { label: 'Read it, and pocket a page', lines: ['(You read him the ledger. The page with the crew’s real names stays up your sleeve.)', '“Mirror Lake. Wick carries.” Good. And Riven, whatever you just put up your sleeve, keep it. I didn’t see.'], reward: { gold: 40 } },
      } }),
    q({ id: 'riven44', title: 'The Crystal in the Reeds', giver: 'brannoc', kind: 'key', count: 1, keys: [1], place: 'mirror', turnIn: 'lou', cine: { ready: 'riven-reeds' }, summary: 'Find the sun-crystal Wick took to Mirror Lake, then ask Fisher Lou what happened to him.', reward: { xp: 160 },
      text: { offer: ['My men saw a boy in a patched hood running for Mirror Lake at first light. Clutching something that glowed.', 'The lake is south-west of the city. Fisher Lou sits on that shore every day, rain or shine. If the boy went by, Lou saw.'], progress: ['Search the shore of Mirror Lake, south-west of the city, then talk to Fisher Lou.'],
        complete: ['Shh. You’ll scare the big one. …A boy? Aye. He sat right there and cried at a glowing stone.', 'Then he threw it in the reeds as hard as he could, and shouted “I won’t!” at nobody.', 'Only it wasn’t nobody. The gloom came up out of the water and dragged him off east, toward Rotwood Den. I’m sorry, lad. I’m old, and I only had a rod.'], after: ['Nibble…'] } }),
    q({ id: 'riven45', title: 'Nobody Comes Back', giver: 'lou', kind: 'rescue', count: 1, place: 'rot', guards: 5, escort: true, turnIn: 'tom', captive: L.wick, summary: 'Free Wick from Rotwood Den and walk him home to Baker Tom in Goldenhearth.', reward: { xp: 180, hearts: 1 },
      text: { offer: ['Rotwood Den is far to the east of the city. Boars, and worse.', 'If the lad’s alive, he’ll be in a cage there. Somebody ought to bring him home. …Looks like it’s you.'], progress: ['Rotwood Den lies far to the east. Break the guards, open the cage, and walk Wick to Baker Tom in Goldenhearth.'], arrive: ['Is that the bakery? It smells like the bakery. Riven, is Tom going to shout?'],
        deliver: ['Riven? You came back for me? Nobody comes back.', 'I told the shade no. So it sent the gloom. It said nobody says no to Corvane.', 'The rest of the crew are up on Shepherd’s Hill with the last crystal, waiting for the dark of the moon. They’re scared stiff.'],
        complete: ['There you are. I kept your bun warm, lad. Both of them.', 'You can sleep on the flour sacks. You can sweep the step in the mornings. You can stop running.', '(Wick sits down on the bakery step and, for the first time, lets go of your sleeve.)'], after: ['Wick’s on the step at dawn every day. Best sweeper I ever had.'] } }),
    q({ id: 'riven10', title: 'The Scatter Signal', giver: 'fox', kind: 'activate', count: 3, near: 'shepherd', switches: 'lantern', order: ['Moth lamp', 'Crow lamp', 'Owl lamp'], ordered: true, auto: true, cine: { done: 'riven-hushed-scatter' }, summary: 'Light the Hushed’s warning lamps on Shepherd’s Hill, in the old order, to scatter the crew.', reward: { xp: 150, gold: 40 },
      text: { offer: ['The crew is up on Shepherd’s Hill, far to the north-east. A dozen scared thieves sitting on one crystal.', 'The Hushed have a signal for “the guard is coming, scatter”: moth lamp, crow lamp, owl lamp, in that order. I taught it to half of them.', 'Light the three lamps around the hill and they’ll run. They’ll leave the crystal behind. Thieves always do.'], progress: ['Light the lamps around Shepherd’s Hill: Moth, then Crow, then Owl.'],
        complete: ['(Down the hill, hooded figures bolt in every direction. So, unfortunately, does a great number of sheep.)', '(…You hadn’t thought about the sheep.)'], after: [] } }),
    q({ id: 'riven48', title: 'Never Rob a Shrine', giver: 'fox', kind: 'key', count: 1, keys: [2], place: 'shrine', auto: true, cine: { done: 'riven-corvane' }, summary: 'Find the last sun-crystal where the fleeing crew hid it: the Sun Shrine, south-east of Shepherd’s Hill.', reward: { xp: 180, hearts: 1 },
      text: { offer: ['Nobody ran off with anything that glowed. So somebody hid it before the lamps went up.', 'There’s one rule every Hushed keeps: never rob a shrine. Which makes a shrine the best hiding place in the valley.', 'The Sun Shrine, south-east of the hill. Let’s go and be very rude.'], progress: ['Search the Sun Shrine, south-east of Shepherd’s Hill, for the last sun-crystal.'],
        complete: ['(Tucked in the shrine’s offering bowl, under a heap of petals: the last sun-crystal. Somebody has left a honey bun beside it, as an apology.)', 'All three. And the moon is going dark.'], after: [] } }),
    q({ id: 'riven49', title: 'The Smugglers’ Crossing', giver: 'holt', kind: 'build', count: 5, near: 'camp', item: 'Tarred plank', icon: 'bundle', place: 'gateE', site: 'bridge', siteName: 'Gloomwater Bridge', summary: 'Find the Hushed’s hidden planks around the Hunter’s Camp, then rebuild the Gloomwater Bridge with Holt.', reward: { xp: 260, hearts: 1 },
      text: { offer: ['You lit the Beacon? The one they said was robbed? Funny old week.', 'The Gloomwater Bridge fell into the river the night the star fell. Nobody gets east to Whisperroot without her.', 'Trouble is timber. Every tree by the river is soaked through. But Hunter Garrick swears somebody stacked dry planks in the thickets round his camp, all tarred black.', 'Five of those, and we build her together, here at the gate.'],
        progress: ['Find five tarred planks in the thickets around the Hunter’s Camp, south-west of the gate, then build the bridge at the Eastern Gate.'],
        complete: ['There. Straight and true, and I only swore twice.', 'Funny planks, those. Somebody carved a little moth into every one.', 'A hat-seller left word for you, by the way. Said the Hushed run their goods east under Whisperroot, through the spiders’ tunnels.'], after: ['Mind the third plank. It squeaks.'] } }),
    ],
    // ═════════════════════════════ Chapter II · the Lantern House
    woods: [
    q({ id: 'riven50', title: 'Barrel Ruts', giver: 'fox', kind: 'trail', count: 4, near: 'gateW', place: 'shroomfarm', auto: true, cine: { start: 'riven-roots' }, summary: 'Follow the Hushed’s cart ruts from the Western Gate to Glowcap Farm.', reward: { xp: 150 },
      clues: ['Deep cart ruts, turning off the road into the ferns. Somebody didn’t want to be seen.', 'A chalk moth on a birch trunk, knee high. Hushed height. It means “keep going.”', 'A cracked cask of lamp oil, stamped with a black feather.', 'The ruts end at the edge of a mushroom farm, beside a hole in the ground that smells of barrels.'],
      text: { offer: ['(Past the bridge, the road dives under trees so old they seem to be listening.)', 'Magpie said the Hushed run their goods east through these woods. Hushed carts leave ruts. Let’s find some.'], progress: ['Follow the cart ruts north from the Western Gate.'],
        complete: ['(Somewhere under the glowcaps, someone giggles. The forester by the woodpile is glaring at the hole as if it owes him money.)'], after: [] } }),
    q({ id: 'riven16', title: 'Needle Again', giver: 'forester', kind: 'chase', count: 1, place: 'shroomfarm', who: L.needle, summary: 'Catch the runner popping out of the tunnels under Glowcap Farm.', reward: { xp: 170, gold: 60 },
      text: { offer: ['There! Popping out of my glowcaps like a mole! Hood, sack, very fast little legs.', 'Catch him before he gets back underground. I’d help, but I’m holding an axe and I don’t trust myself.'], progress: ['The runner is darting around Glowcap Farm. Catch him.'],
        deliver: ['No. No, no, no. Riven AGAIN? I walked all the way to a different forest!', 'Fine! Here’s the map! Every Hushed tunnel under Whisperroot. They all run east, into the spider queen’s hollow.', 'Vesh, she’s called. The Silkmother. She lets the Hushed pass, for a toll. Not gold.', 'Ask the herbalist in Lanternmarket why her children keep going missing. I only carry barrels. I don’t carry kids. I swear I don’t.'],
        complete: ['A map of tunnels under my own farm. I’ll be filling those in with manure, thank you very much.'], after: ['Your little friend hauls mushrooms for me now. He giggles less.'] } }),
    q({ id: 'riven52', title: 'A Mitten With a Lantern', giver: 'forester', kind: 'deliver', count: 1, to: 'juna', item: 'Lantern House mitten', cine: { done: 'riven-lantern-house' }, summary: 'Bring the child’s mitten from the smugglers’ barrels to Herbalist Juna in Lanternmarket.', reward: { xp: 130 },
      text: { offer: ['One more thing. Your runner dropped this when you sat on him.', 'A child’s mitten, with a little lantern sewn on the cuff. It was in one of the barrels. A barrel!', 'That’s a Lantern House stitch. Herbalist Juna keeps the old house, in Lanternmarket, east past the glade. Take it to her. Mind the wolves on the road.'], progress: ['Bring the mitten to Herbalist Juna in Lanternmarket, east of the Moonlit Glade.'], complete: [], after: ['Mind the lanterns. Mind the children.'],
        deliver: ['That’s my stitching. I sew a lantern on everything, so the little ones don’t lose their mittens. They lose them anyway.', 'In a barrel? Under the farm? Oh, stars. Then it’s true: somebody is carrying children off through the tunnels.', 'I’m Juna. I keep the Lantern House now. It was a foundling house, once. …You’re looking at it like you’ve seen it before.'] } }),
    q({ id: 'riven7', title: 'The Foundling', giver: 'juna', kind: 'rescue', count: 1, place: 'nest', guards: 5, escort: true, turnIn: 'juna', cine: { done: 'foundling-memory' }, summary: 'Rescue Tib, a foundling taken from the Lantern House, from the Briarling Nest and bring him to Juna.',
      captive: L.tib, reward: { xp: 200, regen: .5 },
      text: { offer: ['A boy went missing from the Lantern House last night. Tib. He has… a shadow that hurts. You wouldn’t understand.', '…Oh. You would. Your shadow just moved on its own.', 'Something dragged him north, to the Briarling Nest. Please. Nobody else goes looking for children like him.'], progress: ['Break the guards at the Briarling Nest, north of the market, free Tib, and walk him back to Juna.'], arrive: ['Is this where Juna lives? Is there a bed? A real one?'],
        deliver: ['You’re… like me. Your shadow moves too.', 'The lady in black said I’d stop hurting if I came with her. I didn’t want to go. Then the spiders came instead.'],
        complete: ['Tib, oh, Tib. He hasn’t let go of your sleeve once, Riven.', 'He says a woman with a ring of keys took the other children. South, toward the water.'], after: ['Tib says he wants to be a thief like you. I told him you’re a hero. He says what’s the difference.'] } }),
    q({ id: 'riven14', title: 'Little Footprints', giver: 'juna', kind: 'trail', count: 4, near: 'city', place: 'pool', turnIn: 'maeve', summary: 'Follow the missing children’s tracks south from Lanternmarket to Blackwater Pool, then talk to Fisher Maeve.', reward: { xp: 160, mana: 10 },
      clues: ['Small boot prints in the soft ground. Three pairs, walking in a line, very close together.', 'A rag doll face down in the ferns. Someone was in too much of a hurry to go back for it.', 'A ring of keys scratched into the bark. The mark of the Lantern House. The old one.', 'The prints end at the water’s edge, where a tunnel mouth yawns under the reeds.'],
      text: { offer: ['A woman with a ring of keys. …No. It can’t be.', 'Follow the children’s tracks south from the market to Blackwater Pool. Fisher Maeve is always there. She sees everything and says nothing.'], progress: ['Follow the small footprints south to Blackwater Pool, then talk to Fisher Maeve.'],
        complete: ['Tunnel? Aye, under the reeds. Lanterns go in at night, and come out without the little ones.', 'And there’s a green light down there that hums. Like a knot pulled much too tight.'], after: ['Shh. The fish are listening.'] } }),
    q({ id: 'riven53', title: 'The Door Under the Reeds', giver: 'maeve', kind: 'key', count: 1, keys: [0], place: 'pool', summary: 'Wake the knot-rune in the smugglers’ tunnel under the reeds of Blackwater Pool.', reward: { xp: 170 },
      text: { offer: ['Go on, then. Mind the eels. They’re friendlier than they look, which isn’t saying much.', 'Whatever’s humming in there, it’s been keeping my fish awake.'], progress: ['Find the knot-rune in the tunnel mouth under the reeds of Blackwater Pool, then tell Maeve.'],
        complete: ['You woke it? The water’s gone quiet. Even the fish noticed.', 'That woman with the keys, now. Nana Bristle in Bellhollow knew her once. Knew her well. Ask Nana.'], after: ['Shh. The fish are listening.'] } }),
    q({ id: 'riven15', title: 'Nana Remembers', giver: 'maeve', kind: 'talk', count: 1, to: 'nana', summary: 'Ask Nana Bristle in Bellhollow about the woman with the ring of keys.', reward: { xp: 110 },
      text: { offer: ['Bellhollow is west of here, up the stream. Nana Bristle makes a stew that could wake the Bell by itself.', 'Tell her Maeve sent you. And bring a spoon.'], progress: ['Nana Bristle lives in Bellhollow, west of the pool.'], complete: [], after: ['Mind the spoon.'],
        deliver: ['Let me look at you. Dark hair, quick hands, a shadow that won’t sit still… Little Riven. You used to hide in my flour sacks.', 'I cooked at the Lantern House when you were small. Matron Loom ran it. A ring of keys, and a heart like a coin purse.', 'She found homes for the children with the hurting shadows, she said. For a price. The Hushed paid for you. An old star-wizard paid for Sable.', 'Now nobody buys children, so she sells them to the spider instead. Oh, my little flour-sack boy. I’m so sorry.'] } }),
    q({ id: 'riven54', title: 'Where We Made the Rules', giver: 'nana', kind: 'trail', count: 4, near: 'bellhollow', place: 'glade', cine: { ready: 'glade-memory' }, summary: 'Walk the Lantern House children’s old moon-night path from Bellhollow to the Moonlit Glade, then tell Nana Bristle what you saw.', reward: { xp: 150 },
      clues: ['A rusty lantern hook, low on an oak. Low enough for a child to reach.', 'Another hook, and a ribbon gone grey with age, still tied in a bow.', 'Two sets of initials carved in a root, very small: an R and an S. The S is much neater.', 'The path opens into the Moonlit Glade. The old lanterns are still standing, waiting.'],
      text: { offer: ['Before you go charging after Loom: on moon-nights she walked you all up the lantern path to the Moonlit Glade, north-east of here, to make wishes.', 'Walk it again. The glade remembers faces. It might remember yours.'], progress: ['Follow the old lantern path from Bellhollow to the Moonlit Glade, then come back to Nana.'],
        complete: ['Two little ones with lanterns, making up rules. That was you and Sable. Always the two of you.', 'She carved her runes on every stone she passed. When she ran from the star-wizard, she carved them all over the Root Ruins, north of the glade. Go and read them. She’d want you to.'], after: ['Eat something, dear. You’re all shadow.'] } }),
    q({ id: 'riven3', title: 'Moon, Eye, Door', giver: 'fox', kind: 'activate', count: 3, near: 'ruins', switches: 'rune', order: ['Moon', 'Eye', 'Door'], ordered: true, auto: true, cine: { done: 'sable-echo' }, summary: 'Touch Sable’s shadow-runes in the Root Ruins in the order of your old game.', reward: { xp: 190, regen: .6 },
      text: { offer: ['Moon, eye, door. Sable carved our game into the Root Ruins when she ran from Orrin, far to the north.', 'If I touch the runes in the old order, maybe they will answer.'], progress: ['Find Sable’s runes in the Root Ruins, north of the glade. Moon, then Eye, then Door.'], complete: [], after: [] } }),
    q({ id: 'riven55', title: 'The Ring of Keys', giver: 'fox', kind: 'chase', count: 1, place: 'ruins', who: L.loom, turnIn: 'thessaly', cine: { caught: 'riven-loom' }, summary: 'Catch Matron Loom in the Root Ruins, then hand her over to Warden Thessaly in Lanternmarket.', reward: { xp: 190, hearts: 1 },
      text: { offer: ['(Somewhere in the ruins, keys jingle. A whole ring of them, trying very hard to be quiet.)', 'Matron Loom. Come to fetch more children for the spider, I suppose.', 'She never could run. I learned how, in her house.'], progress: ['Matron Loom is scuttling around the Root Ruins. Catch her, then see Warden Thessaly in Lanternmarket.'],
        deliver: ['Riven. Look at you, all grown up. Worth every coin the Hushed paid.', 'The Silkmother keeps the children in the web around the Old Bell, knotted to three runes. You’ve cut one already, under the reeds.', 'The others? One in my old cellar under the Lantern House. One at Trapper’s Lodge, where the Hushed meet her runners.', 'Let me go, and you’ll never see me again. You know I mean it. I always meant it about money.'],
        complete: ['Matron Loom. My watch has wanted her for twenty years. They picked her up at the market gate, still jingling.', 'But you caught her, Riven. So it’s your debt, not mine. You choose what happens to her.'], after: ['The watch owes you, thief.'] },
      choice: {
        a: { label: 'Let the watch judge her', lines: ['Then she’ll answer for every child, in front of the whole market.', 'That isn’t revenge. That’s the right thing. It rarely feels like much, does it?'], reward: { regen: .4 } },
        b: { label: 'Let her walk away', lines: ['Soft, for a thief. But it’s your debt. Go, Loom, and never come back.', '(Loom stares at you as if nobody has ever let her off anything. Then she goes, and the keys don’t jingle at all.)'], reward: { mana: 10 } },
      } }),
    q({ id: 'riven18', title: 'A Lamp in the Window', giver: 'juna', kind: 'build', count: 4, near: 'shroomfarm', item: 'Glowcap', icon: 'mushroom', place: 'city', site: 'lantern', siteName: 'Lantern House lamp', turnIn: 'juna', cine: { done: 'riven-lamp' }, summary: 'Gather glowcaps at Glowcap Farm and light the old lamp in the Lantern House window.', reward: { xp: 170, gold: 50 },
      text: { offer: ['Before you go down into Loom’s cellar, help me with one thing. The Lantern House always kept a lamp in the window, so lost children could find their way home.', 'Loom let it go out, years ago. Bring me four glowcaps from Glowcap Farm, in the north-west. They burn all night.', 'Then we light it together, here in the market.'], progress: ['Gather four glowcaps around Glowcap Farm, then build the lamp at the Lantern House in Lanternmarket.'],
        complete: ['There. The first light in that window in twenty years.', 'Tib drew you something. A chalk moth, with a lamp. It’s for “the lady in black, so she knows the lamp is lit.” Keep it safe.'], after: ['The lamp stays lit. Always.'] } }),
    q({ id: 'riven19', title: 'Loom’s Cellar', giver: 'juna', kind: 'key', count: 1, keys: [1], place: 'city', summary: 'Go down into Matron Loom’s old cellar under the Lantern House and wake the knot-rune there.', reward: { xp: 150 },
      text: { offer: ['Loom’s old cellar is under the Lantern House. I never go down there. I don’t like what she kept.', 'If there’s a knot-rune in Lanternmarket, it’s down there. Take a lamp. Take two.'], progress: ['Find the knot-rune in Loom’s old cellar, under the Lantern House in Lanternmarket.'],
        complete: ['(Juna holds the lamp at the top of the stairs.) Little chains on the walls. Little ones. I’m going to burn that door.', 'One knot left, Loom said. At Trapper’s Lodge, far to the south-east. Ysolde keeps it. She doesn’t like visitors.'], after: ['The lamp stays lit. Always.'] } }),
    q({ id: 'riven56', title: 'Quiet Feet', giver: 'juna', kind: 'key', count: 1, keys: [2], place: 'lodge', turnIn: 'ysolde', summary: 'Wake the last knot-rune under the stump where the Hushed met the spiders’ runners, by Trapper’s Lodge.', reward: { xp: 180 },
      text: { offer: ['Trapper’s Lodge is far to the south-east, past Blackwater. Go quietly. Ysolde hears everything.', 'And Riven… when all three knots are cut, the web will shake. Whatever holds it will wake up.'], progress: ['Find the last knot-rune by Trapper’s Lodge, then talk to Trapper Ysolde.'],
        complete: ['You walked right up to my lodge and I didn’t hear you. I’m impressed, and cross.', 'Hooded runners met at the old stump behind my smokehouse. I thought they were poachers. That green thing under it hummed all night.', 'Now it’s quiet, and the whole web is shaking, all the way up to the Old Bell. Something up there with eight legs and a crown just woke up.'], after: ['Quiet feet catch more than loud ones.'] } }),
    q({ id: 'riven17', title: 'The Way Home', giver: 'fox', kind: 'escort', count: 1, who: L.ada, from: 'bell', place: 'city', ambush: ['shadewolf', 'webspinner', 'shadewolf'], auto: true, summary: 'Walk Ada and the freed foundlings from the Old Bell to the Lantern House in Lanternmarket.', reward: { xp: 200, item: 'healthPotion' },
      text: { offer: ['(The children huddle behind Ada, the oldest. Six of them, and every shadow twitching.)', 'Lanternmarket is south-west of here. There’s a lamp in the window, waiting. Stay close to me.'], progress: ['Walk Ada and the children to Lanternmarket, south-west of the Bell. Keep the wolves off them.'], arrive: ['Is that the lamp? Tib said there’d be a lamp.'],
        complete: ['(The children run for the Lantern House door. Juna is already there, arms wide open, and Tib is shouting everybody’s name.)'], after: [] } }),
    q({ id: 'riven57', title: 'A Lamp at the Thorns', giver: 'juna', kind: 'defend', count: 3, place: 'gateE', waves: [4, 5, 6], foes: ['shadewolf', 'webspinner', 'briarling'], ward: 'The Lantern House lamp', auto: true, cine: { start: 'riven-thorns' }, summary: 'Keep the Lantern House lamp burning against the thorn wall at the Eastern Gate while the shadow comes for it.', reward: { xp: 280, hearts: 1 },
      text: { offer: ['You brought them home, and the shadow followed you. Every wolf in the woods wants its children back.', 'Tib says the thorns at the Eastern Gate are only roots having a bad dream. He says a lamp will wake them. He’s six. He’s usually right.', 'Thessaly’s watch has carried the Lantern House lamp to the gate. Keep it burning, and keep the shadow off it.'], progress: ['Stand by the Lantern House lamp at the Eastern Gate and stop the shadow before it reaches it.'],
        complete: ['(The last wolf slinks away into the dark. Against the black thorns, the little lamp burns on, and the thorns begin to wither.)'], after: [] } }),
    ],
    // ═════════════════════════════ Chapter III · two shadows
    summit: [
    q({ id: 'riven60', title: 'Moths on the Milestones', giver: 'fox', kind: 'trail', count: 4, near: 'gateW', place: 'hamlet', auto: true, cine: { start: 'riven-heights' }, summary: 'Follow Sable’s chalk moths up the mountain road to Frostpine Hamlet.', reward: { xp: 150 },
      clues: ['A chalk moth on a milestone, half rubbed out by the snow.', 'Another, on a frozen fence post. This one has a little crown. She always drew mine with a crown.', 'Boot prints in the snow. Two sets. Both mine. …Only one of them is me.', 'A last moth on the hamlet gate, and underneath it, in fresh chalk: “DON’T.”'],
      text: { offer: ['(An icy wind howls through the Eastern Gate. Somewhere up there, a star has gone black.)', 'Sable came this way. She always left me chalk moths, so I’d know where she went. Let’s see if she still does.'], progress: ['Follow the chalk moths up the road to Frostpine Hamlet.'],
        complete: ['(Inside the hamlet, somebody is shouting about stolen tonics, and about you.)'], after: [] } }),
    q({ id: 'riven21', title: 'Someone With My Face', giver: 'aune', kind: 'chase', count: 1, place: 'hamlet', who: L.double, escapes: true, turnIn: 'aune', cine: { caught: 'riven-double' }, summary: 'Catch the thief in Frostpine Hamlet who looks exactly like you.', reward: { xp: 160, gold: 40 },
      text: { offer: ['You! You have some nerve, walking back in here after emptying my whole cupboard of tonics!', '…Wait. Your shadow is on the left. The thief’s shadow fell the wrong way.', 'Then there are two of you, and the other one is still in the hamlet. Catch it!'], progress: ['Your double is lurking around Frostpine Hamlet. Catch it.'],
        deliver: ['(Only a smear of black smoke is left, drifting up toward the Summit.)'],
        complete: ['It melted? Into smoke? Stars keep us.', 'The mirror-shades come down from the hollow star. If one wears your face, something up there knows you.', 'And Brother Aled from Cloudcrest went up the mountain two days ago. He met himself up there, and he won’t come down.'], after: ['Real Riven. Shadow on the correct side. Good.'] } }),
    q({ id: 'riven22', title: 'The Monk Who Met Himself', giver: 'aune', kind: 'escort', count: 1, who: L.aled, from: 'bloom', place: 'city', ambush: ['wisp', 'frostwraith', 'wisp'], turnIn: 'orla', summary: 'Walk Brother Aled down from the Starbloom Grove to Tinker Orla in Cloudcrest.', reward: { xp: 170, mana: 10 },
      text: { offer: ['Brother Aled went to pray in the Starbloom Grove, far to the north. He sat down beside a man with his own face, and he hasn’t moved since.', 'Walk him to Cloudcrest, south-east of the tarn. Tinker Orla has been studying these mirror-shades. She’ll want to see him.'], progress: ['Find Brother Aled at the Starbloom Grove and walk him to Tinker Orla in Cloudcrest.'], arrive: ['Cloudcrest. Real towers. Real bells. And that’s really me, isn’t it? Yes. I think that’s me.'],
        complete: ['Brother Aled! Sit down, sit down. Don’t look at the shiny bits.', 'So it’s true. The shades wear your face and walk off with your way home. And you say one wore yours, Riven?'], after: ['Tink tink. Don’t mind me.'] } }),
    q({ id: 'riven23', title: 'A Light That Shows Faces', giver: 'orla', kind: 'build', count: 4, near: 'observatory', item: 'Old lens', icon: 'gem', place: 'altar', site: 'lantern', siteName: 'True-light lantern', turnIn: 'orla', summary: 'Gather old lenses at the Old Observatory and build a true-light lantern on the Star Altar.', reward: { xp: 190, gold: 60 },
      text: { offer: ['Here’s my idea. A mirror-shade can wear any face but its own, because it hasn’t got one.', 'Give me a lantern that only shows true faces, and the shades will have to show nothing. And nothing is very easy to hit.', 'Old Vale’s observatory, far to the south-west, has a heap of cracked lenses. Bring me four, then build the lantern on the Star Altar, east of the city.'], progress: ['Gather four old lenses around the Old Observatory, then build the lantern at the Star Altar, east of Cloudcrest.'],
        complete: ['It works! I saw it from here: a great white beam, straight down into the Void Rift.', 'And down in the Rift, among all the stolen faces, one real one. An old man with a beard, in chains.'], after: ['Best thing I ever built. Don’t tell the monks, they think it was a prayer.'] } }),
    q({ id: 'riven61', title: 'Picking Old Locks', giver: 'orla', kind: 'escort', count: 1, who: L.orrin, from: 'rift', place: 'city', ambush: ['wisp', 'frostwraith', 'wisp'], turnIn: 'orla', cine: { start: 'riven-rift' }, summary: 'Pick the chains of the old man in the Void Rift and walk him to Tinker Orla in Cloudcrest.', reward: { xp: 190, hearts: 1 },
      text: { offer: ['An old man, chained in the Void Rift, south-east of the altar. The shades are keeping him for something.', 'Can you pick a lock, Riven? …Why am I asking. Of course you can.', 'Bring him here. I’ll put the kettle on.'], progress: ['Find the prisoner in the Void Rift, pick his chains, and walk him to Tinker Orla in Cloudcrest.'], arrive: ['Cloudcrest. I built my first telescope on those walls. I was so sure of everything, then.'],
        deliver: ['You… are not Sable. But you have her shadow. The very same shadow.', 'I am Orrin. I did a terrible thing to someone you love. Get me to Cloudcrest, and I will tell you all of it. My legs are slow.'],
        complete: ['Master Orrin? THE Master Orrin? The one who pulled down the star?', 'He’s resting on the west side of the city. He keeps asking for “the boy with Sable’s shadow”.'], after: ['I’m going to need a bigger kettle.'] } }),
    q({ id: 'riven24', title: 'What Orrin Paid', giver: 'orla', kind: 'talk', count: 1, to: 'orrin', cine: { done: 'riven-orrin' }, summary: 'Hear Master Orrin out in Cloudcrest.', reward: { xp: 120 },
      text: { offer: ['Go and see him. He looks like a man who’s been carrying a stone up a mountain for twenty years.'], progress: ['Master Orrin rests on the west side of Cloudcrest.'], complete: [], after: [],
        deliver: ['The Lantern House. Matron Loom. Yes. I paid her for Sable. I thought paying was the same as caring.', 'Her shadow hurt her. I called the star down to burn it out of her, and I tore the sky. Umbra slid in through the tear.', 'Now it wears faces in the hollow star, and whispers to her that the dark will make the hurting stop. It will not. It only wants out.'] },
      choice: {
        a: { label: 'You bought her, like they bought me', lines: ['Yes. And I have been paying for it ever since.', 'I cannot ask you to forgive me. Only to reach her. She will not listen to me. She might listen to you.'], reward: { mana: 12 } },
        b: { label: 'You tried. So did the Hushed, in their way', lines: ['…That is kinder than I deserve.', 'She will not listen to me. She might listen to you. You carry the same shadow. You know what it costs.'], reward: { regen: .5 } },
      } }),
    q({ id: 'riven62', title: 'Puddles Are Forbidden', giver: 'riven-aled', kind: 'activate', count: 3, near: 'tarn', switches: 'lantern', order: ['North frost-lantern', 'East frost-lantern', 'West frost-lantern'], cine: { ready: 'tarn-vision' }, summary: 'Light the three frost-lanterns around Mirrorsky Tarn so its ice clears, look in, then tell Brother Aled what you saw.', reward: { xp: 120 },
      text: { offer: ['I have taken a vow never to look in a puddle again. The other me lives in puddles.', 'But Mirrorsky Tarn cannot wear a false face. If you want to know where the star broke, look in it. North-west of the city.', 'It freezes over at night. Light the three old frost-lanterns on its shore and the ice will clear. I will wait here. Far from it. Very far.'], progress: ['Light the three frost-lanterns around Mirrorsky Tarn, north-west of Cloudcrest, then tell Brother Aled what you saw.'],
        complete: ['Your face, and then hers? And three lights? Don’t tell me. I’m not listening. …Tell me.', 'Crystal Hollow is far to the north-west. The goat terrace is south of the tarn. And the Spire, well. Everybody knows who sits at the Spire.'], after: ['I have taken a vow never to look in a puddle again.'] } }),
    q({ id: 'riven63', title: 'A Hum in the Hollow', giver: 'fox', kind: 'key', count: 1, keys: [0], auto: true, summary: 'Steal the first star shard out of Crystal Hollow before Nullface’s shades can.', reward: { xp: 140 },
      text: { offer: ['Crystal Hollow first. The water showed a light there, cold as a coin.', 'Nullface wants those shards. So I take them first. Stealing from thieves is the best kind of stealing.'], progress: ['Find the star shard in Crystal Hollow, far to the north-west.'],
        complete: ['(The shard hums in your palm, warm as a heartbeat. Far above, the hollow star turns a little, like somebody who just felt a pocket being picked.)'], after: [] } }),
    q({ id: 'riven65', title: 'Goats, Not Sheep', giver: 'brun', kind: 'herd', count: 5, animal: 'goat', near: 'terrace', place: 'terrace', summary: 'Drive five of Goatherd Brun’s shard-mad goats back into their pen.', reward: { xp: 150, gold: 40 },
      text: { offer: ['You’re the thief who scattered Odo’s whole flock? Word travels. Herders talk.', 'Something up here is humming, and my goats have gone mad for it. Pen five of them for me, and I’ll show you what they found.', 'Walk up behind one and it trots away from you. Unless it doesn’t. They’re goats.'], progress: ['Walk behind a goat to drive it into the pen. Goats argue. Keep at it.'],
        complete: ['Five! And not a single one grateful. Very goat.', 'Now. All week they’ve been sitting on a warm stone by the top wall, like hens. I’d have a look under there.'], after: ['My goats climb higher than any hero.'] } }),
    q({ id: 'riven64', title: 'The Warm Stone', giver: 'brun', kind: 'key', count: 1, keys: [1], place: 'terrace', summary: 'Take the star shard the goats have been sitting on at Goatherd’s Terrace.', reward: { xp: 150 },
      text: { offer: ['The top wall. The warm stone. Mind the big billy. He bites, and he means it.'], progress: ['Find the warm stone on Goatherd’s Terrace, then show Goatherd Brun.'],
        complete: ['A star shard! Under my goats! I’ll be telling that one for years.', 'And look up. Up at the Broken Spire, far to the north-east. Somebody in black has been watching you all afternoon.'], after: ['My goats climb higher than any hero.'] } }),
    q({ id: 'riven26', title: 'Tag, You’re It', giver: 'fox', kind: 'chase', count: 1, place: 'spire', who: L.sable, auto: true, summary: 'Catch Sable at the Broken Spire, the way you always did.', reward: { xp: 180 },
      text: { offer: ['Sable. Right there on the broken stones. And she’s running.', 'She always ran. I always caught her. Let’s see if that’s still true.'], progress: ['Catch Sable around the Broken Spire.'],
        deliver: ['You still cheat. You shadowstep on the corners.', '…Hello, Riven.'], complete: [], after: [] } }),
    q({ id: 'riven4', title: 'Sable’s Question', giver: 'sable', kind: 'talk', count: 1, to: 'sable', summary: 'Answer Sable’s question.', reward: { xp: 200 },
      text: { offer: ['I knew it was you the moment I saw you fight. You still move like a shadow that’s late for something.', 'You cut my web. Of course you did. I wrote your name into it so nobody else could.', 'Before Umbra calls me back to the star, I need to ask you one thing. Only you would know.'], progress: ['Sable is waiting at the Broken Spire.'], complete: [], after: [],
        deliver: ['The shadow we were born with. Did it ever stop hurting? For you?'] },
      choice: {
        a: { label: 'It never stopped. It just stopped choosing for me', lines: ['It doesn’t choose for you. You choose.', '…Then maybe it doesn’t get to choose for me either. I’d forgotten that was allowed.'], reward: { regen: .6 } },
        b: { label: 'It got quieter when I found people', lines: ['People worth standing in front of. A boy with a lamp. A thief who said no. A baker with too many buns.', 'Yes, I watched. I always watched. I think… I would like some of those, Riven.'], reward: { mana: 12 } },
      } }),
    q({ id: 'riven25', title: 'Door, Eye, Moon', giver: 'sable', kind: 'activate', count: 3, near: 'spire', switches: 'rune', order: ['Door', 'Eye', 'Moon'], ordered: true, auto: true, cine: { done: 'riven-two-shadows' }, summary: 'Touch the runes around the Broken Spire in the old game’s order, backwards.', reward: { xp: 200, gold: 50 },
      text: { offer: ['Nullface wears my face in the star. It wore yours too, didn’t it? It wants both of us.', 'There’s a way into the star that Umbra doesn’t know. Our game, backwards: door, eye, moon. Forwards, it lets the shadows in. Backwards, it lets us out.', 'I carved the stones around the Spire years ago, just in case. Touch them for me. My hands are shaking.'], progress: ['Touch the runes around the Broken Spire: Door, then Eye, then Moon.'],
        complete: ['(The last rune flares. Behind you, Sable lets out a breath she seems to have been holding for years.)'], after: [] } }),
    q({ id: 'riven66', title: 'What Sable Kept', giver: 'sable', kind: 'key', count: 1, keys: [2], summary: 'Take the last star shard from under the broken bell-stone at the Spire.', reward: { xp: 160 },
      text: { offer: ['Before we go up, you’ll want this. The last shard fell right here, at the Spire. I’ve been sitting on it for three days.', 'I told myself I was guarding it for Umbra. I think I was keeping it for you.', 'It’s under the broken bell-stone, somewhere round the Spire. Take it. My hands still shake.'], progress: ['Find the last star shard around the Broken Spire, then go back to Sable.'],
        complete: ['All three. You always did empty a room fast.', 'Nullface is waiting in the Cradle. Let’s go and be two shadows at it.'], after: [] } }),
    q({ id: 'riven67', title: 'Two Hands on the Ice', giver: 'riven-sable-ice', kind: 'activate', count: 2, near: 'gateE', switches: 'rune', order: ['Riven’s shadow-mark', 'Sable’s shadow-mark'], auto: true, summary: 'Lay your hand on the two shadow-marks in the black ice at the Eastern Gate.', reward: { xp: 300, hearts: 1 },
      text: { offer: ['Umbra sealed the pass with black ice. It knows starlight. It knows fear.', 'It doesn’t know two shadows that have stopped being afraid.', 'There’s a mark in the ice for each of us. Yours, and mine. Touch them both. I’ll hold on to you.'], progress: ['Touch the two shadow-marks on the black ice at the Eastern Gate.'],
        complete: ['(Two shadows stretch across the black ice, born the same, and touch.)'], after: [] } }),
    ],
    // ═════════════════════════════ Chapter IV · the broker's network
    ember: [
    q({ id: 'riven70', title: 'Two Shadows East', giver: 'fox', kind: 'visit', count: 1, place: 'camp', auto: true, cine: { start: 'riven-wastes' }, summary: 'Follow Umbra’s smoke into the Ember Wastes, to Emberwatch Outpost.', reward: { xp: 140 },
      text: { offer: ['(A thread of black smoke crawls east over the last ridge. Sable walks beside you, very quiet.)', 'Umbra ran into the Ember Wastes. There’s an outpost at the end of this road. Let’s see who keeps it.'], progress: ['Take the road east to Emberwatch Outpost.'],
        complete: ['(At the outpost gate, a captain in a dented helm watches you both come out of the smoke, spear in hand.)'], after: [] } }),
    q({ id: 'riven71', title: 'Kiln-fire Thieves', giver: 'guide', kind: 'defend', count: 3, place: 'kiln', waves: [4, 5, 6], foes: ['emberImp', 'emberImp', 'ashScorpion'], ward: 'Hessa’s great kiln', turnIn: 'hessa', summary: 'Hold Kilnhollow’s great kiln against the imps that steal its fire, then talk to Kiln-mother Hessa.', reward: { xp: 220, gold: 50 },
      text: { offer: ['Two of you, in black, out of the smoke? You’ll forgive me if I keep hold of my spear.', 'Something black fell out of the east wind. Since then: imps every night, the Dawn Forge cold, and a masked buyer paying for fire with feathers.', 'Your friend can go up to Ashfall Watch; the seer will want her. You: the imps raid Kilnhollow’s great kiln every dusk, south-east of here. Hold it, and Kiln-mother Hessa will talk to you.'], progress: ['Stand by Hessa’s great kiln in Kilnhollow and drive the imps off it.'],
        complete: ['You held my kiln! Imps everywhere, and not one ember stolen.', 'They steal fire for a masked buyer. He pays in black feathers, and he’s in the hollow right now, pretending he isn’t.'], after: ['Glass is only sand that was brave.'] } }),
    q({ id: 'riven5', title: 'The Ashen Broker', giver: 'hessa', kind: 'chase', count: 1, place: 'kiln', escapes: true, turnIn: 'hessa', who: L.broker, cine: { caught: 'riven-broker' }, summary: 'Catch the ash-masked broker buying up the kiln-fire in Kilnhollow.', reward: { xp: 240, gold: 90 },
      text: { offer: ['Black feathers, Riven. You know what those mean better than I do.', 'A masked stranger, buying up my kiln-fire. There he goes, round the back of the kilns. Catch him!'], progress: ['The broker lurks around Kilnhollow. Run him down.'],
        deliver: ['“Run home, little shadow. I will be waiting at the forge.”'],
        complete: ['A mask full of ash? Then Umbra has hands in every town.', 'The ash blew north-east, toward Brasshaven. That’s where the buying and selling is done.'], after: ['No more feathers in Kilnhollow.'] } }),
    q({ id: 'riven29', title: 'Where the Ash Blows', giver: 'hessa', kind: 'trail', count: 4, near: 'kiln', place: 'city', turnIn: 'riven-magpie', summary: 'Follow the broker’s ash from Kilnhollow to Brasshaven.', reward: { xp: 170, regen: .5 },
      clues: ['A smudge of grey ash on a kiln stone, in the shape of a hand.', 'Ash prints on the road, and a black feather that hasn’t crumbled yet.', 'A brass token dropped in the dust: “Orsolo, weigher. Brasshaven market.”', 'Ash all over a stall by the Brasshaven gate. A very familiar stall. It sells scarves.'],
      text: { offer: ['Follow the ash, Riven. A thing made of ash always leaves some behind.'], progress: ['Follow the trail of ash north-east from Kilnhollow to Brasshaven.'],
        complete: ['Don’t look at me like that. Somebody had to come east and keep you out of trouble.', 'Also I heard there were no hats in the Wastes. A market is a market.', 'That ash? The Broker. He’s bought half of Brasshaven with feathers, and his weigher is Orsolo, by the brass scales.'], after: ['Scarves! Fine scarves!'] } }),
    q({ id: 'riven30', title: 'The Weigher’s Scales', giver: 'riven-magpie', kind: 'talk', count: 1, to: 'riven-orsolo', summary: 'Get the truth out of Orsolo the weigher in the Brasshaven market.', reward: { xp: 120 },
      text: { offer: ['Orsolo weighs the Broker’s feathers like coin and hands them out to anyone who’ll sell fire.', 'He’s a coward, not a villain. Cowards talk. Go and make him.'], progress: ['Orsolo keeps his brass scales in the Brasshaven market.'], complete: [], after: [],
        deliver: ['Put that dagger away! Please! I only weigh things!', 'The Broker brings feathers, I weigh them, and people sell him fire. Lamp oil, kiln-coal… ember cores.', 'He hid the cores where honest folk never look: one sunk in the glass-sand of the Molten Mere, one given to a hooded boy to carry, and one in the Old Foundry, wrapped in his smoke.'] },
      choice: {
        a: { label: 'Scare him straight', lines: ['Yes! Straight! Very straight! I will never weigh another feather as long as I live!', '…Your friend with the scarves said you were nicer than this.'], reward: { gold: 50 } },
        b: { label: 'Offer him a way out', lines: ['A way out? For me? …I didn’t know that was allowed.', 'Then I’ll tell Captain Rusk everything. He’ll be cross. He is always cross.'], reward: { regen: .4 } },
      } }),
    q({ id: 'riven35', title: 'Smoke for Pay', giver: 'rusk', kind: 'collect', count: 5, near: 'city', item: 'Feather-coin', icon: 'feather', turnIn: 'rusk', summary: 'Collect the Broker’s feather-coins around Brasshaven and show Captain Rusk what they are worth.', reward: { xp: 140, gold: 40 },
      text: { offer: ['Orsolo’s been talking. About feathers, and a Broker, and a thief from the west who scares weighers.', 'Half my market has been paid in black feathers, and nobody believes me that they’re worthless.', 'Collect five of them from around the market and bring them here. In front of everyone. Let’s see what they’re worth.'], progress: ['Collect five feather-coins around the Brasshaven market, then bring them to Captain Rusk.'],
        complete: ['(The feathers crumble to smoke in Rusk’s hand, in front of half the market.)', 'There. Worth exactly nothing. Nobody sells that Broker so much as a candle from today.'], after: ['Nobody takes feathers in my city.'] } }),
    q({ id: 'riven72', title: 'Fishing in Glass', giver: 'rusk', kind: 'key', count: 1, keys: [0], place: 'mere', turnIn: 'tovan', summary: 'Dig the Broker’s first ember core out of the glass-sand of the Molten Mere, then bring it to Forgemaster Tovan.', reward: { xp: 180 },
      text: { offer: ['Now: the cores. The Molten Mere is north-west of the city. The glass-sand on its shore is hot enough to cook on. Don’t cook on it.', 'If that Broker sank a core in there, it’ll glow through the sand. Take it to Forgemaster Tovan after. He’ll know what to do with it.'], progress: ['Find the ember core in the glass-sand of the Molten Mere, then bring it to Forgemaster Tovan in Brasshaven.'],
        complete: ['A core, carried in by a thief. The forge won’t mind. Fire doesn’t care whose hands.', 'Pyrrhus kept the Dawn Forge once, until the shadow got into him. The Broker wears his ash now, like a coat.', 'And bad news. Zara’s hunters found a hooded boy caged at the Salt Caravan Camp, south-east. He keeps saying “Riven”.'], after: ['The anvils are ringing again.'] } }),
    q({ id: 'riven73', title: 'The Boy Who Carried Nothing', giver: 'tovan', kind: 'rescue', count: 1, place: 'caravan', guards: 6, escort: true, turnIn: 'riven-magpie', captive: L.needle, summary: 'Free Needle at the Salt Caravan Camp and bring him to Magpie in Brasshaven.', reward: { xp: 220, hearts: 1 },
      text: { offer: ['The Salt Caravan Camp is south-east of the city. Scorpions and imps are thick around it.', 'Get the boy out. And if he’s another one of your thieves, I don’t want to know.'], progress: ['Break the guards at the Salt Caravan Camp, free the hooded boy, and bring him to Magpie in Brasshaven.'], arrive: ['Magpie? Magpie! Don’t be cross. Be a little bit cross.'],
        deliver: ['Riven! You came for me? I ran away from you twice!', 'The Broker gave me a core to carry to the Foundry. I said no. First time I ever said no to a job.', 'I hid it where he’d never look. Somewhere green. I got that from you, you know. Walking out. It’s catching.'],
        complete: ['Needle said no? Our Needle?', 'You’ve ruined the whole guild, Riven. Every last one of them saying no to jobs. I’ve never been prouder.', '“Somewhere green,” he says. There’s only one green thing left in the Wastes: the Last Green, far to the north-east.'], after: ['Needle is selling scarves now. Badly.'] } }),
    q({ id: 'riven74', title: 'Somewhere Green', giver: 'fox', kind: 'key', count: 1, keys: [1], place: 'green', auto: true, cine: { done: 'riven-last-green' }, summary: 'Find the ember core Needle hid in the Last Green.', reward: { xp: 180 },
      text: { offer: ['The Last Green. One grove the ash never touched. Of course Needle hid it there. Nobody burns what’s still alive.', 'Far to the north-east of the city. Let’s go and see how clever he was.'], progress: ['Find the ember core Needle hid in the Last Green, north-east of Brasshaven.'],
        complete: ['(Under the roots of the last green tree, wrapped in Needle’s old hood, the core glows like a small sun.)'], after: [] } }),
    q({ id: 'riven32', title: 'A Chalk Moth for Sable', giver: 'fox', kind: 'deliver', count: 1, to: 'riven-sable', item: 'Tib’s chalk moth', summary: 'Bring Tib’s drawing to Sable at Ashfall Watch.', reward: { xp: 110, mana: 10 },
      text: { offer: ['Sable is up at Ashfall Watch, north of the city, reading the smoke with the seer.', 'I’ve carried Tib’s chalk moth since Whisperroot. I kept waiting for the right moment. There is never a right moment.'], progress: ['Bring Tib’s drawing to Sable at Ashfall Watch, north of Brasshaven.'], complete: [], after: [],
        deliver: ['A chalk moth. With a lamp. “For the lady in black, so she knows the lamp is lit.”', 'I put out every light I could reach, Riven. And a little boy I scared half to death lit one for me.', '…I’m keeping this. Forever. Don’t look at me. It’s the smoke.'] } }),
    q({ id: 'riven31', title: 'Clear the Smoke', giver: 'riven-sable', kind: 'activate', count: 3, near: 'foundry', switches: 'vent', order: ['Ash vent', 'Cinder vent', 'Smoke vent'], auto: true, summary: 'Open the three old vents around the Old Foundry to let the Broker’s smoke out.', reward: { xp: 180, gold: 60 },
      text: { offer: ['The Broker filled the Old Foundry with his smoke, so nothing honest can breathe in there. The last core is inside.', 'Three old vents stand around it. Open them, and the smoke has somewhere to go. The foundry is south-east of here.'], progress: ['Open the three vents around the Old Foundry, south-east of the watch.'],
        complete: ['(The vents roar. Black smoke pours out of the foundry and blows away over the dunes, and something glows inside.)'], after: [] } }),
    q({ id: 'riven75', title: 'The Core in the Smoke', giver: 'fox', kind: 'key', count: 1, keys: [2], auto: true, summary: 'Slip into the Old Foundry and steal back the last ember core.', reward: { xp: 200 },
      text: { offer: ['The smoke is gone. The last core is somewhere in the Old Foundry.', 'In and out. Quiet feet. Just like the old days, except this time I’m stealing it back.'], progress: ['Search the Old Foundry for the last ember core.'],
        complete: ['(Three cores, warm in your bag. Up at Ashfall Watch, Sable will be waiting.)'], after: [] } }),
    q({ id: 'riven34', title: 'Walk With Me', giver: 'riven-sable', kind: 'escort', count: 1, who: L.sable, from: 'watch', place: 'forge', ambush: ['emberImp', 'ashScorpion', 'emberImp'], auto: true, cine: { done: 'pyrrhus-wakes' }, summary: 'Walk with Sable to the Dawn Forge, keep the imps off her, and set the three cores in the forge.', reward: { xp: 220, hearts: 1 },
      text: { offer: ['I’m coming with you to the forge. Don’t argue. You’ll lose.', 'Umbra wants to catch one of us alone. So it doesn’t get to.'], progress: ['Walk with Sable to the Dawn Forge in the far north-east. Keep the imps off her.'], arrive: ['There it is. Cold as a grave. Let’s give it a heartbeat.'],
        complete: ['(Sable sits down on the forge steps to catch her breath. She doesn’t let go of the chalk moth.)'], after: [] } }),
    ],
  },
  reuse: {
    // ═════════════════════════════ Chapter I
    meadow: {
      m10: { title: 'The Feathered Shade', giver: 'fox', summary: 'Defeat Corvane at the Beacon Rise and put the sun-crystals back in the Beacon.', cine: { done: 'beacon-lit' },
        text: { offer: ['(The moon goes dark. Far to the south, on the Beacon Rise, a masked shade spreads its feathered cloak and waits.)', 'Corvane came to collect. He blinks, he strikes from the dark, he throws shadow. So do I.', 'Umbra takes the shape of what you fear. I always feared the buyer. Let’s see what a buyer does when nobody sells.'], progress: ['The Beacon Rise lies far to the south.'], complete: [], after: ['The Beacon shines, and nobody owns it.'] } },
    },
    // ═════════════════════════════ Chapter II
    woods: {
      m15: { title: 'Silkmother Vesh', giver: 'ysolde', summary: 'Defeat Silkmother Vesh and ring the Ancient Root Bell.', cine: { done: 'bell-rung' },
        text: { offer: ['The Old Bell hangs in the far north, wrapped in silk and runes. That’s where the crown is.', 'They say the Silkmother spits webs and sends roots racing through the ground. Keep moving, and cut yourself free.', 'And thief… the children are in that web. Aim carefully.'], progress: ['The Old Bell stands in the far north-east.'], complete: [], after: ['The Bell rings, and every trap I own went off at once. Worth it.'] } },
    },
    // ═════════════════════════════ Chapter III
    summit: {
      m19: { title: 'Nullface', giver: 'sable', summary: 'Defeat Nullface and return the shards to the Star Cradle.', cine: { done: 'star-rises' },
        text: { offer: ['The Star Cradle is north-east of here, at the top of the world. Nullface waits inside the hollow star.', 'It has no face of its own. It will wear yours first, then mine. It blinks, it strikes from behind, it rains the sky down. Don’t stop, whatever it looks like.', 'I’ll be right behind you. I promised once, remember? I always find you.'], progress: ['The Star Cradle is in the far north-east.'], complete: [], after: ['The star is home. So are we, nearly.'] } },
    },
    // ═════════════════════════════ Chapter IV
    ember: {
      m12: { title: 'The Ashen Broker', summary: 'Defeat the Ashen Broker, Umbra’s hand in the Wastes, at the Dawn Forge.',
        text: { offer: ['(The ash rises into Pyrrhus’s old armour, with the Broker’s cracked mask where his face should be.)', 'It throws fire, rains lava and strikes from the shadows. Like me, with worse manners.', 'Umbra had a buyer in every land. This is the last one.'], progress: ['Defeat the Ashen Broker at the Dawn Forge.'], complete: [], after: ['No more buyers.'] } },
      m13: { title: 'The Shadow That Chose', summary: 'Defeat Umbra and light the Dawn Forge.',
        text: { offer: ['(The Broker falls into ash, and the ash turns black and begins to crawl. Out of the Beacon, the Bell and the Star, every guardian’s shadow gathers into one.)', '(“I am the shadow you were born with, both of you,” Umbra says, with Sable’s voice and yours. “I chose you. You are mine.”)', 'It’s wrong. The shadow was never the enemy. The choosing is. And I choose.'], progress: ['Defeat Umbra at the Dawn Forge.'], complete: [], after: [] } },
    },
  },
  npcs: {
    meadow: [
      { id: 'magpie', name: 'Magpie', portrait: '🐦‍⬛', at: 'city', dx: -420, dy: 220, activity: 'idle', until: 'ember:riven70', look: look('#2e2a36', 'hood', { hatColor: '#1e1a26', hair: '#2e2420' }), lines: ['Hats! Fine hats! Nobody looks twice at someone selling hats.', 'You were the quietest little thing I ever took on. Still are. It’s unnerving.'], barks: ['Hats!', 'Psst, Riven.'] },
      { id: 'riven-wick', name: 'Wick', portrait: '🧒', at: 'city', dx: 130, dy: 300, activity: 'sweep', after: 'riven45', look: look('#4a4058', 'cap', { hatColor: '#2e2a36', hair: '#2e2420', small: true }), lines: ['Tom’s ovens in the mornings, Tom’s step in the afternoons. Nobody makes me carry anything any more.', 'I said no to a shade. Nobody can make me do anything now. Except Tom. Tom is terrifying.'], barks: ['Honey buns!', 'Riven!'] },
    ],
    woods: [
      { id: 'riven-tib', name: 'Tib', portrait: '🧒', at: 'city', dx: 230, dy: 200, activity: 'play', after: 'riven7', look: look('#3a3458', 'none', { hair: '#1a1a24', small: true }), lines: ['I’m practising being quiet. Like you. Did you hear me? No? Good.', 'My shadow does a dance when I’m happy. Juna says that’s allowed.'], barks: ['Riven!', 'Shh, I’m hiding.'] },
      { id: 'riven-needle', name: 'Needle', portrait: '🥷', at: 'shroomfarm', dx: -150, dy: 90, activity: 'wander', after: 'riven16', look: look('#3a3048', 'hood', { hatColor: '#2a2438', hair: '#1a1a24' }), lines: ['Mushrooms don’t run away. That’s the best thing about mushrooms.', 'If Magpie asks, I’m retired. From running. And from thieving. Mostly from you.'], barks: ['Not you again.', 'Hauling!'] },
    ],
    summit: [
      { id: 'riven-aled', name: 'Brother Aled', portrait: '🧘', at: 'city', dx: 300, dy: 250, activity: 'idle', after: 'riven22', look: look('#a8844a', 'none', { hair: '#8a6a4a' }), lines: ['I have taken a vow never to look in a puddle again.', 'The other me was very rude. I hope I am not like that.'], barks: ['Is that you? Good.'] },
      { id: 'riven-sable-ice', name: 'Sable', portrait: '🌑', at: 'gateE', dx: -150, dy: -90, activity: 'idle', after: 'm19', look: look('#2a2438', 'hood', { hatColor: '#1a1428', hair: '#1a1a24' }), lines: ['The ice is humming our names. It sounds scared. I’ve never heard Umbra sound scared.', 'Wherever you go next, I’m coming. Don’t argue.'], barks: ['Riven.', 'Two shadows.'] },
    ],
    ember: [
      { id: 'riven-magpie', name: 'Magpie', portrait: '🐦‍⬛', at: 'city', dx: -380, dy: 240, activity: 'idle', after: 'summit:riven67', look: look('#2e2a36', 'scarf', { hatColor: '#8a3b2f', hair: '#2e2420' }), lines: ['Scarves! Fine scarves! Keeps the ash out of your nose.', 'I came east because you’d get yourself killed without someone to disapprove of you.'], barks: ['Scarves!', 'Psst, Riven.'] },
      { id: 'riven-orsolo', name: 'Weigher Orsolo', portrait: '⚖️', at: 'city', dx: 60, dy: 280, activity: 'idle', after: 'summit:riven67', look: look('#8a6a3a', 'cap', { hatColor: '#c9a24c', beard: true }), lines: ['I weigh things. Honest things, from now on. Mostly nuts.'], barks: ['Fair weight!', 'Oh no, it’s you.'] },
      { id: 'riven-needle2', name: 'Needle', portrait: '🥷', at: 'city', dx: -300, dy: 300, activity: 'wander', after: 'riven73', look: look('#3a3048', 'hood', { hatColor: '#2a2438', hair: '#1a1a24' }), lines: ['Magpie says I’m bad at selling scarves. I say scarves are bad at being sold.', 'I said no to the Broker. I’m going to say no to everything now. It’s wonderful.'], barks: ['Scarves?', 'No!'] },
      { id: 'riven-sable', name: 'Sable', portrait: '🌑', at: 'watch', dx: 90, dy: 80, activity: 'idle', after: 'summit:riven67', until: 'riven34', look: look('#2a2438', 'hood', { hatColor: '#1a1428', hair: '#1a1a24' }), lines: ['Ilyana reads the fire. I read the smoke. Between us we’re almost a lantern.', 'It still pulls at me here, Riven. Umbra. It thinks I’ll come back if it asks nicely.'], barks: ['The smoke is moving wrong.', 'Riven.'] },
    ],
  },
  npcFor: {
    // Sable meets Riven at the Spire only once he has caught her, and waits for him at the black ice after the star rises.
    'summit:sable': { after: 'summit:riven26', lines: ['We used to race up the Lantern House stairs. You always cheated.', 'It’s quieter, with you here. The shadow, I mean.'], barks: ['…Riven.'] },
    'summit:sable2': { hidden: true },
    'summit:sable3': { hidden: true },
    // Orrin is in Cloudcrest once Riven has picked his chains, and at the gate once the ice is broken.
    'summit:orrin': { after: 'summit:riven61', until: 'summit:riven67', lines: ['I paid for her, Riven. I thought paying was the same as caring.', 'I have much to make right. Most of it is not mine to make.'], barks: ['I have much to make right.'] },
    'summit:orrin2': { after: 'summit:riven67', lines: ['Go on, both of you. The Wastes are waiting, and so is the last light.', 'I will hold this gate. Nothing follows you through it.'], barks: ['Go, and look after each other.'] },
  },
  script: {
    meadow: {
      sealed: 'Corvane hides in a cloak of smoke-feathers. Take back the three sun-crystals first.',
      pickupKey: 'Sun-crystal stolen back! {n}/3',
      tip: 'Corvane blinks and strikes from the dark. Keep moving, and shadowstep behind it when it lands. Smith Hilda in Goldenhearth can sharpen your daggers.',
      guide: { done: ['The Beacon is back, and they say a thief put it there.'] },
      finale: { locked: ['The Beacon is cold. Its three sun-crystals are still in the Hushed’s drops.'], guarded: ['Corvane perches on the Beacon, waiting to collect. Break the buyer to restore the light.'],
        done: ['You set the three sun-crystals back where the Hushed pried them out. Gold light roars up and sweeps across the valley.', 'Corvane’s mask cracks, and its cloak comes apart into a thousand black feathers. Every one of them turns to smoke.', 'Far to the east, over the dark trees of Whisperroot, the light glints on something silver. A web.'] },
      victory: { title: 'The Beacon shines again.', text: 'The crystals are home, the buyer is smoke, and Wick sleeps on Tom’s flour sacks. But the Hushed’s tunnels run east under Whisperroot, and Sable walked that way.' },
    },
    woods: {
      sealed: 'Silkmother Vesh sleeps in a cocoon of rune-silk. Wake the three root runes to cut its knots.',
      pickupKey: 'Knot-rune cut. {n}/3',
      tip: 'Silkmother Vesh spits webs that slow you and sends roots through the ground. Shade Step behind her to slip out of the silk, and never fight her from inside it.',
      guide: { done: ['The woods breathe easy, and there’s a lamp in the Lantern House window.'] },
      finale: { locked: ['The Bell hangs silent in its web. Three root runes still hold the knots.'], guarded: ['Silkmother Vesh crouches over the Bell. Cut her down to free it.'],
        done: ['You ring the Ancient Bell. Its voice rolls through every root, and the rune-web falls away like frost.', 'In the falling silk you see Sable’s runes: moon, eye, door… and one more you know. Your own name.', 'She wrote you into the web. She knew you would be the one to cut it.'] },
      victory: { title: 'The Bell rings, and the children come home.', text: 'Whisperroot breathes again and the Lantern House lamp is lit. Sable has fled up to Starfall Summit, and her runes still say your name.' },
    },
    summit: {
      sealed: 'Nullface hides behind the hollow star’s void shell. Gather the three star shards first.',
      pickupKey: 'Star shard stolen back! {n}/3',
      tip: 'Nullface blinks and strikes from behind, just like you. Watch where its shadow lands, and use Nightveil to make it lose you.',
      guide: { done: ['The star is home. Mind your face on the high roads, all the same.'] },
      finale: { locked: ['The Cradle is cold. Three star shards are needed.'], guarded: ['Nullface drifts over the Cradle, wearing your face. Break the mask!'],
        done: ['You lay the three shards into the Cradle. The star remembers its light and rises, whole, into the sky.', 'Nullface tries on your face one last time, then Sable’s. Neither fits. The mask splits down the middle.', 'But a thread of black smoke tears loose from the empty shell and streaks east, toward the Ember Wastes. Umbra is not finished.'] },
      victory: { title: 'The star rises home.', text: 'Nullface is broken and Sable is choosing for herself. Umbra fled east into the Ember Wastes, and this time Sable is coming with you.' },
    },
    ember: {
      sealed: 'The Ashen Broker hides in a shell of cooling ash. Recover the three ember cores first.',
      pickupKey: 'Ember core recovered. {n}/3',
      tip: 'The Broker strikes out of the shadows and rains fire. Keep moving, and use Stealth to make it lose you. Ash scorpions burrow: watch for moving sand.',
      guide: { done: ['The wastes are cooling, thief. Er, hero. Which is it?'] },
      finale: { locked: ['The Dawn Forge is cold. Three ember cores are needed to wake it.'], guarded: ['A shadow broods over the forge. Defeat it!'],
        done: ['You set the three ember cores into the Dawn Forge. Its fire roars up, white and gold, and a new dawn spills across the wastes.', 'Umbra’s last shadow does not burn away. It shrinks, and settles at your feet and at Sable’s: just a shadow, the shape of a person, doing nothing at all.', 'Every land, every light. And nobody owns any of them.'] },
      victory: { title: 'The dawn returns.', text: 'Umbra is gone, and the shadow it claimed is only a shadow again. Riven took no pay for any of it, and chose every step.' },
    },
  },
  cines,
};
