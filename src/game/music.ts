// Procedural score for Starfall Grove: a lookahead sequencer playing hand-composed pieces on synthesized harp, flute,
// string pads, bass, bells, drums and brass. Crossfades between tracks, a combat-intensity layer on chapter tracks, and
// optional audio-file overrides via public/music/manifest.json. Shares the context and mixer of audio.ts.
import { audioCore } from './audio';

export type TrackId = 'menu' | 'meadow' | 'woods' | 'summit' | 'ember' | 'boss' | 'victory';
type Core = NonNullable<ReturnType<typeof audioCore>>;

// ───────────────────────────── notes, chords, melodies
const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const acc = (s: string) => (s === '#' ? 1 : s === 'b' ? -1 : 0);
const midi = (n: string) => { const m = /^([A-G])([#b]?)(\d)$/.exec(n)!; return 12 * (+m[3] + 1) + PC[m[1]] + acc(m[2]); };
const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);
type Chord = { r: number; iv: number[] };
const QUAL: Record<string, number[]> = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], sus4: [0, 5, 7], sus2: [0, 2, 7], dim: [0, 3, 6] };
const chord = (s: string): Chord => { const m = /^([A-G])([#b]?)(.*)$/.exec(s)!; return { r: (PC[m[1]] + acc(m[2]) + 12) % 12, iv: QUAL[m[3]] ?? QUAL[''] }; };
const wrap = (pc: number, lo: number) => lo + (((pc - lo) % 12) + 12) % 12;
/** Chord tones in close position within [lo, lo + 12). */
const tones = (c: Chord, lo: number) => c.iv.map(i => wrap(c.r + i, lo)).sort((a, b) => a - b);
const root = (c: Chord, lo: number) => wrap(c.r, lo);
type Note = [number | null, number]; // midi (null = rest), beats
const melCache = new Map<string, Note[]>();
const mel = (s: string) => {
  let v = melCache.get(s);
  if (!v) { v = s.split(/\s+/).filter(Boolean).map(tok => { const [n, d] = tok.split(':'); return [n === 'r' ? null : midi(n), +d] as Note; }); melCache.set(s, v); }
  return v;
};
type Alt = string | string[];
const pick = (x: Alt, occ: number) => (typeof x === 'string' ? x : x[occ % x.length]);
const rng = (s: number) => () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// ───────────────────────────── instruments
let C: Core | null = null;
let W: { harp: PeriodicWave; bright: PeriodicWave; flute: PeriodicWave } | null = null;
let voices = 0;
const MAXV = 40;
const take = (pri = 0) => (voices < MAXV + pri * 8 ? (voices++, true) : false);
const free = () => { voices = Math.max(0, voices - 1); };
const pw = (ac: AudioContext, h: number[]) => { const im = new Float32Array([0, ...h]); return ac.createPeriodicWave(new Float32Array(im.length), im); };

function osc(ac: AudioContext, type: OscillatorType | PeriodicWave, f: number, t: number, end: number, det = 0) {
  const o = ac.createOscillator();
  if (typeof type === 'string') o.type = type as OscillatorType; else o.setPeriodicWave(type);
  o.frequency.value = f; o.detune.value = det; o.start(t); o.stop(end);
  return o;
}
function amp(ac: AudioContext, out: AudioNode) { const g = ac.createGain(); g.gain.value = 0; g.connect(out); return g; }
function pluck(g: GainNode, t: number, v: number, d: number, a = .004) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + d); }
/** Attack, gently falling hold, then a release tail. */
function sus(g: GainNode, t: number, v: number, a: number, d: number, rel: number, fall = 1) {
  const h = t + Math.max(a, d);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.linearRampToValueAtTime(v * fall, h); g.gain.setTargetAtTime(0, h, rel / 4);
}
function nsrc(ac: AudioContext, buf: AudioBuffer, t: number, dur: number) { const s = ac.createBufferSource(); s.buffer = buf; s.start(t, Math.random() * 1.5, dur + .05); return s; }

type Ins = (o: AudioNode, t: number, f: number, d: number, v: number) => void;
/** Harp / pluck: warm harmonic body plus a short bright transient. d = decay seconds. */
const harp: Ins = (o, t, f, d, v) => {
  if (!take()) return; const { ac } = C!, g1 = amp(ac, o), g2 = amp(ac, o);
  const a = osc(ac, W!.harp, f, t, t + d + .05); a.connect(g1); a.onended = free;
  osc(ac, W!.bright, f, t, t + .4).connect(g2);
  pluck(g1, t, v, d); pluck(g2, t, v * .4, .3);
};
/** Flute / ocarina: soft attack with a pitch scoop, breath chiff, delayed vibrato. */
const flute: Ins = (o, t, f, d, v) => {
  if (!take(1)) return; const { ac, white } = C!, g = amp(ac, o), end = t + Math.max(.075, d) + .35;
  const x = osc(ac, W!.flute, f, t, end); x.connect(g); x.onended = free;
  x.detune.setValueAtTime(-16, t); x.detune.linearRampToValueAtTime(0, t + .07);
  sus(g, t, v, .075, d, .25, .8);
  if (d > .4) {
    const l = osc(ac, 'sine', 5.2 + Math.random() * .7, t, end), lg = ac.createGain();
    lg.gain.value = 0; lg.gain.setValueAtTime(0, t + .24); lg.gain.linearRampToValueAtTime(12, t + .65); l.connect(lg); lg.connect(x.detune);
  }
  const n = nsrc(ac, white, t, .2), bp = ac.createBiquadFilter(), ng = amp(ac, o);
  bp.type = 'bandpass'; bp.frequency.value = Math.min(9000, f * 2.5); bp.Q.value = 1.4; n.connect(bp); bp.connect(ng); pluck(ng, t, v * .22, .16, .02);
};
/** Warm pad / strings: detuned saws (the bus lowpasses them), slow attack and release. */
function pad(o: AudioNode, t: number, f: number, d: number, v: number, att = .9) {
  if (!take()) return; const { ac } = C!, g = amp(ac, o), end = t + Math.max(att, d) + 1.3;
  for (const det of [-7, 7]) { const s = osc(ac, 'sawtooth', f, t, end, det + (Math.random() - .5) * 3); s.connect(g); if (det < 0) s.onended = free; }
  sus(g, t, v * .5, att, d, 1.2);
}
const bass: Ins = (o, t, f, d, v) => {
  if (!take(1)) return; const { ac } = C!, g = amp(ac, o), end = t + d + .35, tg = ac.createGain();
  const s = osc(ac, 'sine', f, t, end); s.connect(g); s.onended = free;
  tg.gain.value = .35; osc(ac, 'triangle', f, t, end).connect(tg); tg.connect(g);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .012); g.gain.setTargetAtTime(v * .55, t + .012, .18); g.gain.setTargetAtTime(0, t + d, .06);
};
/** Bell / celesta: inharmonic partials, higher ones fading first. */
const bell: Ins = (o, t, f, d, v) => {
  if (!take()) return; const { ac } = C!;
  ([[1, 1], [2.76, .35], [5.4, .15]] as const).forEach(([m, a], j) => {
    if (j && f * m > 14000) return;
    const dd = d / Math.sqrt(m), g = amp(ac, o), x = osc(ac, 'sine', f * m, t, t + dd + .05);
    x.connect(g); if (!j) x.onended = free; pluck(g, t, v * a, dd, .003);
  });
};
/** Brass-ish: two saws through a lowpass with a quick filter envelope. */
function brass(o: AudioNode, t: number, f: number, d: number, v: number, bright = 2400) {
  if (!take(1)) return; const { ac } = C!, g = amp(ac, o), lp = ac.createBiquadFilter(), end = t + Math.max(.03, d) + .35;
  lp.type = 'lowpass'; lp.Q.value = 1.6; lp.frequency.setValueAtTime(Math.max(300, f), t);
  lp.frequency.linearRampToValueAtTime(bright, t + .05); lp.frequency.setTargetAtTime(bright * .4 + f, t + .06, .22); lp.connect(g);
  for (const det of [-6, 6]) { const s = osc(ac, 'sawtooth', f, t, end, det); s.connect(lp); if (det < 0) s.onended = free; }
  sus(g, t, v * .5, .03, d, .25, .8);
}
function kick(o: AudioNode, t: number, v: number) {
  if (!take(1)) return; const { ac } = C!, g = amp(ac, o), x = osc(ac, 'sine', 120, t, t + .45);
  x.frequency.setValueAtTime(120, t); x.frequency.exponentialRampToValueAtTime(45, t + .13); x.connect(g); x.onended = free; pluck(g, t, v, .4, .002);
}
function tom(o: AudioNode, t: number, f: number, v: number) {
  if (!take(1)) return; const { ac, brown } = C!, g = amp(ac, o), x = osc(ac, 'sine', f, t, t + .45), ng = amp(ac, o);
  x.frequency.setValueAtTime(f, t); x.frequency.exponentialRampToValueAtTime(f * .62, t + .25); x.connect(g); x.onended = free; pluck(g, t, v, .4, .002);
  nsrc(ac, brown, t, .15).connect(ng); pluck(ng, t, v * .5, .13, .002);
}
function shaker(o: AudioNode, t: number, v: number, d = .045) {
  if (!take()) return; const { ac, white } = C!, g = amp(ac, o), s = nsrc(ac, white, t, d);
  s.connect(g); s.onended = free; pluck(g, t, v, d, .008);
}
function clap(o: AudioNode, t: number, v: number) {
  if (!take()) return; const { ac, white } = C!, g = amp(ac, o), s = nsrc(ac, white, t, .2);
  s.connect(g); s.onended = free;
  const p = g.gain; p.setValueAtTime(v, t); p.exponentialRampToValueAtTime(v * .2, t + .01); p.setValueAtTime(v * .9, t + .012);
  p.exponentialRampToValueAtTime(v * .2, t + .022); p.setValueAtTime(v * .8, t + .024); p.exponentialRampToValueAtTime(.0001, t + .17);
}
const LEAD: Record<'flute' | 'brass', Ins> = { flute, brass };

// ───────────────────────────── mixer buses: [volume, reverb send, pan, filter, filter Hz, combat layer]
type BusId = 'harp' | 'lead' | 'pad' | 'bass' | 'bell' | 'drum' | 'shk' | 'clap' | 'brass' | 'cDrum' | 'cShk' | 'cBass';
const BUS: Record<BusId, [number, number, number, BiquadFilterType | '', number, boolean?]> = {
  harp: [.11, .38, -.25, 'lowpass', 4200], lead: [.13, .42, 0, 'lowpass', 6000], pad: [.06, .35, 0, 'lowpass', 1400],
  bass: [.15, .06, 0, 'lowpass', 1000], bell: [.06, .5, .3, '', 0], drum: [.2, .1, 0, '', 0], shk: [.05, .08, .25, 'highpass', 7000],
  clap: [.09, .18, -.1, 'bandpass', 1600], brass: [.08, .2, -.15, '', 0],
  cDrum: [.19, .1, 0, '', 0, true], cShk: [.045, .08, .25, 'highpass', 7000, true], cBass: [.11, .04, 0, 'lowpass', 420, true],
};

// ───────────────────────────── scheduling types
type Sec = { ch: Alt[]; mel: Alt[] };
type Groove = { k: number[]; t: number[]; s: number; p: number }; // kick beats, tom beats, shaker step, pulse step
type Def = { bpm: number; swing?: number; scale: number[]; lead: 'flute' | 'brass'; oct?: number; form: string; sec: Record<string, Sec>; parts(b: Bar): void; groove?: Groove; once?: boolean; next?: TrackId; mix?: Partial<Record<BusId, number>> };
type Ev = { t: number; f: (t: number) => void; c?: boolean };
type Player = { id: TrackId; lvl: number; out: GainNode; wet: GainNode; cmb?: GainNode; cmbW?: GainNode; kill(): void };
type Proc = Player & { def: Def; bus: Record<BusId, AudioNode> };
type Bar = { x: Proc; i: number; sec: string; occ: number; spb: number; segs: Chord[]; rnd: () => number; ch(beat: number): Chord; at(beat: number, f: (t: number) => void, combat?: boolean): void };

// ───────────────────────────── part helpers
const segLen = (b: Bar) => 4 / b.segs.length;
function padBar(b: Bar, lo: number, v: number) {
  b.segs.forEach((c, j) => b.at(j * segLen(b), t => { for (const m of tones(c, lo)) pad(b.x.bus.pad, t, hz(m), segLen(b) * b.spb + .1, v); }));
}
function roots(b: Bar, lo: number, v: number) {
  b.segs.forEach((c, j) => b.at(j * segLen(b), t => bass(b.x.bus.bass, t, hz(root(c, lo)), segLen(b) * b.spb * .95, v)));
}
/** Chord-tone pattern: indices into the voiced chord, repeating an octave up past its size; -1 = rest. */
function arp(b: Bar, pat: number[], step: number, lo: number, v: number, dec: number, bus: BusId = 'harp', ins: Ins = harp) {
  pat.forEach((p, j) => {
    if (p < 0) return; const beat = j * step, vel = v * (.82 + b.rnd() * .28);
    b.at(beat, t => { const ts = tones(b.ch(beat), lo); ins(b.x.bus[bus], t, hz(ts[p % ts.length] + 12 * Math.floor(p / ts.length)), dec, vel); });
  });
}
function bassLine(b: Bar, pat: Array<[number, number, number]>, lo: number, v: number) {
  for (const [beat, semi, len] of pat) b.at(beat, t => bass(b.x.bus.bass, t, hz(root(b.ch(beat), lo) + semi), len * b.spb, v));
}
function sparkle(b: Bar, n: number, lo: number, v: number) {
  for (let j = 0; j < n; j++) {
    const beat = Math.floor(b.rnd() * 8) / 2, p = Math.floor(b.rnd() * 5);
    b.at(beat, t => { const ts = tones(b.ch(beat), lo); bell(b.x.bus.bell, t, hz(ts[p % ts.length] + (p >= ts.length ? 12 : 0)), 2.6, v); });
  }
}
function lead(b: Bar, m: Alt | undefined) {
  if (!m) return; const def = b.x.def, ins = LEAD[def.lead], o = def.oct ?? 0; let pos = 0;
  for (const [n, beats] of mel(pick(m, b.occ))) {
    if (n !== null) {
      const p = pos, f = hz(n + o), d = beats * b.spb * .96, vel = .85 + b.rnd() * .15;
      if (beats >= 1 && p > 0 && b.rnd() < .14) { // occasional grace note from the scale tone above
        const g = def.scale.includes((n + 1) % 12) ? n + 1 : n + 2;
        b.at(p - .085 / b.spb, t => ins(b.x.bus.lead, t, hz(g + o), .09, vel * .6));
      }
      b.at(p, t => ins(b.x.bus.lead, t, f, d, vel));
    }
    pos += beats;
  }
}
function groove(b: Bar, g: Groove) {
  const { cDrum, cShk, cBass } = b.x.bus;
  g.k.forEach(q => b.at(q, t => kick(cDrum, t, .9), true));
  g.t.forEach((q, j) => b.at(q, t => tom(cDrum, t, j % 2 ? 105 : 140, .7), true));
  if (b.i % 4 === 3) [3, 3.25, 3.5, 3.75].forEach((q, j) => b.at(q, t => tom(cDrum, t, 175 - j * 22, .55 + j * .08), true));
  for (let q = 0; q < 4; q += g.s) { const f = q % 1, v = f === .5 ? 1 : f === 0 ? .7 : .45; b.at(q, t => shaker(cShk, t, v), true); }
  for (let q = 0; q < 4; q += g.p) { const v = q % 1 ? .6 : .9; b.at(q, t => bass(cBass, t, hz(root(b.ch(q), 33)), g.p * b.spb * .55, v), true); }
}

// ───────────────────────────── the compositions
const MAJ = (r: number) => [0, 2, 4, 5, 7, 9, 11].map(i => (r + i) % 12);
const TRACKS: Record<TrackId, Def> = {
  // "Starfall Grove": wistful night-sky theme, D major with lydian G#.
  menu: {
    bpm: 74, scale: MAJ(2), lead: 'flute', form: 'AAB',
    sec: {
      A: {
        ch: ['D', 'Bm', 'G', 'A', ['D', 'Bm'], ['F#m', 'G'], ['G', 'Em7 A'], ['Gm', 'D']],
        mel: ['F#5:1.5 E5:.5 D5:1 A4:1', 'B4:1.5 C#5:.5 D5:1 F#5:1', 'G5:1.5 F#5:.5 E5:1 D5:.5 E5:.5', ['E5:3 r:1', 'E5:1 F#5:.5 E5:.5 C#5:2', 'E5:2 A4:1 C#5:1'],
          ['F#5:1.5 E5:.5 D5:1 A5:1', 'D5:1 F#5:1 B5:2'], ['C#6:1.5 B5:.5 A5:1 G#5:.5 F#5:.5', 'A5:1 G5:.5 F#5:.5 E5:2'],
          ['B5:1.5 A5:.5 G5:1 E5:1', 'G5:1 F#5:1 E5:1 C#5:1'], ['Bb5:1 A5:1 G5:1 E5:1', 'D5:4']],
      },
      B: {
        ch: ['Gmaj7', 'A', 'F#m', 'Bm', 'Em7', 'G', 'Gm', 'A'],
        mel: ['B4:2 D5:1 F#5:1', 'E5:3 C#5:1', 'A4:1 C#5:1 F#5:1.5 E5:.5', ['D5:4', 'D5:2 r:1 F#5:1'], 'G5:1.5 F#5:.5 E5:1 B4:1',
          'D5:1 C#5:.5 B4:.5 C#5:1 D5:1', 'D5:1 Bb4:1 D5:1 G5:1', ['A5:2 G#5:1 E5:1', 'A5:3 r:1']],
      },
    },
    parts: b => {
      padBar(b, 54, .5); roots(b, 38, .5);
      arp(b, b.sec === 'B' ? [0, 1, 2, 3, 4, 3, 2, 1] : [0, 2, 3, 4, 5, 4, 3, 2], .5, 50, .5, 2.2);
      if (b.rnd() < .65) sparkle(b, b.sec === 'B' ? 2 : 1, 81, .32);
    },
  },
  // "Sunpetal Meadow": sunny, swung, sing-along in G major.
  meadow: {
    bpm: 104, swing: .09, scale: MAJ(7), lead: 'flute', form: 'AABA',
    sec: {
      A: {
        ch: ['G', 'C', 'G', 'D', 'G', 'C', 'Am D', 'G'],
        mel: ['D5:.5 G5:.5 G5:.5 A5:.5 B5:1 G5:1', 'E5:.5 G5:.5 G5:.5 A5:.5 G5:1 E5:1', 'D5:.5 G5:.5 B5:.5 A5:.5 G5:1 B4:1',
          ['A4:.5 B4:.5 C5:.5 D5:.5 A4:2', 'A4:.5 B4:.5 C5:.5 D5:.5 F#5:1 A5:1'], 'D5:.5 G5:.5 G5:.5 A5:.5 B5:1 D6:1',
          'C6:.5 B5:.5 A5:.5 G5:.5 E5:1 G5:1', 'A5:.5 G5:.5 E5:1 F#5:.5 E5:.5 D5:1', ['G5:2 r:2', 'G5:1 D5:.5 B4:.5 G4:2', 'G5:2 r:1 D5:1']],
      },
      B: {
        ch: ['Em', 'C', 'G', 'D', 'Em', 'C', 'Am', 'D'],
        mel: ['B5:1.5 A5:.5 G5:1 E5:1', 'E5:1.5 F#5:.5 G5:1 C6:1', 'B5:1.5 A5:.5 G5:1 D5:1', 'F#5:1 E5:.5 F#5:.5 A5:2',
          'G5:1 E5:.5 G5:.5 B5:1 G5:1', 'A5:1 G5:.5 E5:.5 G5:2', 'E5:1 A5:1 C6:1 B5:.5 A5:.5', ['A5:2 F#5:1 D5:1', 'A5:1 B5:.5 A5:.5 F#5:1 D5:1']],
      },
    },
    parts: b => {
      padBar(b, 55, .3);
      arp(b, [0, 2, 1, 2, 3, 2, 1, 2], .5, 55, .5, 1.1);
      bassLine(b, [[0, 0, 1], [1.5, 0, .4], [2, 7, 1], [3.5, -5, .4]], 38, .8);
      if (b.i === 7) b.at(2, t => tones(b.ch(2), 79).forEach((m, j) => bell(b.x.bus.bell, t + j * .12, hz(m), 1.8, .35)));
      else if (b.rnd() < .25) sparkle(b, 1, 79, .25);
    },
    groove: { k: [0, 2], t: [1.5, 3, 3.5], s: .5, p: .5 },
  },
  // "Whisperroot Woods": E dorian mystery with a harmonic-minor B for tension.
  woods: {
    bpm: 80, scale: [4, 6, 7, 9, 11, 1, 2], lead: 'flute', form: 'ABAB',
    sec: {
      A: {
        ch: ['Em', 'A', 'Em', 'D', 'Cmaj7', 'G', 'Am', 'Bsus4 B'],
        mel: ['B4:2 E5:1 F#5:1', 'G5:1.5 F#5:.5 E5:1 C#5:1', ['B4:3 r:1', 'B4:1 A4:.5 B4:.5 E5:2'], 'A4:1 B4:1 D5:1 F#5:1',
          'E5:2 G5:1 B5:1', 'A5:1.5 G5:.5 F#5:1 D5:1', 'E5:1 C5:1 A4:1 C5:1', ['E5:2 D#5:2', 'F#5:1 E5:1 D#5:2']],
      },
      B: {
        ch: ['C', 'D', 'Bm', 'Em', 'C', 'A', 'Bsus4', 'B'],
        mel: ['G5:2 E5:1 G5:1', 'F#5:2 A5:1 F#5:1', 'D5:1.5 E5:.5 F#5:1 B4:1', ['E5:4', 'E5:2 r:1 B4:1'],
          'E5:1 G5:1 C6:1 B5:1', 'A5:1.5 G5:.5 E5:1 C#5:1', 'E5:2 F#5:2', 'D#5:3 r:1'],
      },
    },
    parts: b => {
      if (b.i % 2 === 0) b.at(0, t => { for (const m of [40, 47]) pad(b.x.bus.pad, t, hz(m), 8 * b.spb + .2, .55, 1.5); });
      padBar(b, 52, .26);
      arp(b, [0, -1, 2, 1, -1, 2, 3, -1], .5, 52, .5, .45);
      if (b.i % 2) [2, 2.5, 3].forEach((q, j) => b.at(q, t => bell(b.x.bus.bell, t, hz(tones(b.ch(q), 76)[2 - j]), 2.6, .3)));
    },
    groove: { k: [0, 2.5], t: [1, 1.75, 3, 3.5], s: .25, p: .5 },
  },
  // "Starfall Summit": C lydian, glassy bells and a slow soaring line.
  summit: {
    bpm: 68, scale: [0, 2, 4, 6, 7, 9, 11], lead: 'flute', form: 'ABA',
    sec: {
      A: {
        ch: ['Cmaj7', 'D', 'Em', 'D', 'Am7', 'Bm', 'Cmaj7', 'D'],
        mel: ['E5:2 G5:1 B5:1', 'A5:3 F#5:1', 'G5:2 B5:1 E6:1', ['D6:3 r:1', 'D6:2 C6:1 A5:1'], 'C6:2 B5:1 A5:1', 'B5:1 A5:1 F#5:2',
          'G5:2 E5:1 G5:1', ['F#5:4', 'A5:2 F#5:2']],
      },
      B: {
        ch: ['Am', 'G', 'Cmaj7', 'D', 'Em', 'Bm', 'Am', 'D'],
        mel: ['A4:2 C5:1 E5:1', 'D5:2 B4:2', 'E5:1.5 F#5:.5 G5:2', 'A5:4', 'B5:2 G5:1 E5:1', 'F#5:2 D5:1 B4:1', 'C5:1 E5:1 A5:1 G5:1',
          ['F#5:3 r:1', 'F#5:2 A5:1 B5:1']],
      },
    },
    parts: b => {
      padBar(b, 52, .5); roots(b, 36, .42);
      arp(b, b.sec === 'B' ? [3, 1, 2, 0] : [0, 2, 1, 3], 1, 72, .3, 3.2, 'bell', bell);
      if (b.rnd() < .5) sparkle(b, 2, 84, .16);
      if (b.i % 4 === 0) b.at(0, t => pad(b.x.bus.pad, t, hz(root(b.ch(0), 36)), 16 * b.spb, .9, 3.5));
    },
    groove: { k: [0, 2.5], t: [0, 1.5, 3], s: .5, p: 1 },
  },
  // "The Ember Wastes": E phrygian dominant over a drone, hand drums and a winding desert flute.
  ember: {
    bpm: 92, scale: [4, 5, 8, 9, 11, 0, 2], lead: 'flute', form: 'AABA',
    sec: {
      A: {
        ch: ['E', 'F', 'E', 'Dm', 'Am', 'G', 'F', 'E'],
        mel: ['E5:1 F5:.5 G#5:.5 A5:1 G#5:1', 'F5:1.5 E5:.5 D5:1 C5:1', 'B4:.5 C5:.5 B4:.5 G#4:.5 E4:2', ['F4:1 A4:1 D5:1 F5:1', 'A4:1 D5:1 F5:1.5 E5:.5'],
          'E5:1.5 C5:.5 A4:1 C5:1', 'D5:1 B4:.5 G4:.5 B4:1 D5:1', 'C5:1 A4:.5 F4:.5 A4:1 C5:.5 B4:.5', ['G#4:3 r:1', 'B4:1 G#4:1 E4:2']],
      },
      B: {
        ch: ['Am', 'Dm', 'G', 'C', 'F', 'Dm', 'F', 'E7'],
        mel: ['A5:1.5 G#5:.5 A5:1 E5:1', 'F5:1.5 E5:.5 D5:1 A4:1', 'B4:1 D5:1 G5:1.5 F5:.5', 'E5:3 r:1', 'F5:1 A5:1 C6:1 A5:1', 'F5:1.5 E5:.5 D5:2',
          'C5:1 D5:1 E5:1 F5:1', ['G#5:2 F5:1 E5:1', 'E5:3 r:1']],
      },
    },
    parts: b => {
      if (b.i % 2 === 0) b.at(0, t => { for (const m of [40, 47]) pad(b.x.bus.pad, t, hz(m), 8 * b.spb + .2, .5, 1.2); });
      padBar(b, 52, .24);
      arp(b, [0, 1, 2, 1, 0, 2, 3, 2], .5, 55, .45, .8);
      bassLine(b, [[0, 0, 1], [1.5, 0, .4], [2.5, 7, .5], [3, 0, 1]], 36, .75);
      if (b.rnd() < .3) sparkle(b, 1, 76, .22);
    },
    groove: { k: [0, 1.5, 2.5], t: [1, 2, 3.5], s: .5, p: .5 },
  },
  // Boss: D harmonic minor, driving drums, 8th-note bass, brass stabs and an urgent brass lead.
  boss: {
    bpm: 144, scale: [2, 4, 5, 7, 9, 10, 1], lead: 'brass', oct: -12, form: 'AABA', mix: { pad: .8 },
    sec: {
      A: {
        ch: ['Dm', 'Dm', 'Bb', 'A', 'Dm', 'Dm', 'Gm', 'A'],
        mel: ['D5:.5 E5:.5 F5:.5 A5:1.5 G5:.5 F5:.5', 'E5:1 C#5:1 D5:2', 'F5:.5 G5:.5 A5:.5 Bb5:1.5 A5:.5 G5:.5', 'A5:2 E5:1 C#5:1',
          'D5:.5 E5:.5 F5:.5 A5:1.5 D6:.5 C6:.5', 'Bb5:1 A5:1 F5:1 D5:1', 'G5:.5 A5:.5 Bb5:1 A5:.5 G5:.5 F5:1', ['E5:1 F5:.5 E5:.5 C#5:2', 'A5:1 G5:.5 F5:.5 E5:2']],
      },
      B: {
        ch: ['Bb', 'C', 'Dm', 'Dm', 'Bb', 'Gm', 'Eb', 'A7'],
        mel: ['F5:1.5 D5:.5 F5:1 Bb5:1', 'C6:2 G5:2', 'A5:1.5 G5:.5 F5:1 D5:1', 'E5:1 F5:1 D5:2', 'F5:1.5 D5:.5 F5:1 Bb5:1', 'D6:2 Bb5:1 G5:1',
          'Bb5:1.5 G5:.5 Eb5:2', 'C#5:1 E5:1 G5:1 A5:1'],
      },
    },
    parts: b => {
      const { drum, shk, clap: cl, brass: br } = b.x.bus;
      [0, 1.5, 2].forEach(q => b.at(q, t => kick(drum, t, 1)));
      [1, 3].forEach(q => b.at(q, t => clap(cl, t, .8)));
      for (let q = 0; q < 4; q += .5) { const v = q % 1 ? .9 : .5; b.at(q, t => shaker(shk, t, v, .04)); }
      if (b.i % 4 === 3) [3, 3.25, 3.5, 3.75].forEach((q, j) => b.at(q, t => tom(drum, t, 170 - j * 25, .8)));
      bassLine(b, [0, 0, 12, 0, 7, 0, 12, 7].map((s, j) => [j * .5, s, .42] as [number, number, number]), 38, .85);
      padBar(b, 50, .35);
      const stab = (q: number, len: number, v: number) => b.at(q, t => { for (const m of tones(b.ch(q), 55)) brass(br, t, hz(m), len * b.spb, v, 1800); });
      if (b.sec === 'B') { stab(0, 2, .7); stab(2.5, .4, .8); stab(3, .4, .8); } else { stab(0, .4, .9); stab(1.5, .4, .8); }
    },
  },
  // Victory fanfare: plays once (about 10s), then hands off to the menu theme.
  victory: {
    bpm: 112, scale: MAJ(0), lead: 'brass', form: 'A', once: true, next: 'menu',
    sec: { A: { ch: ['C', 'F G', 'F Fm', 'C'], mel: ['G4:.333 G4:.333 G4:.334 C5:1 E5:1 G5:1', 'A5:1 F5:.5 A5:.5 G5:1.5 D5:.5', 'C6:1 A5:1 Ab5:1.5 G5:.5', 'C6:6'] } },
    parts: b => {
      const { harp: hp, bell: bl, brass: br, pad: pd, bass: bs, drum } = b.x.bus, last = b.i === 3, S = MAJ(0);
      if (b.i === 0) for (let j = 0; j < 15; j++) b.at(j / 16, t => harp(hp, t, hz(60 + 12 * Math.floor(j / 7) + S[j % 7]), 1.6, .5));
      b.segs.forEach((c, j) => b.at(j * segLen(b), t => {
        const len = (last ? 6 : segLen(b) * .9) * b.spb;
        for (const m of tones(c, 55)) { brass(br, t, hz(m), len, .7, 2000); pad(pd, t, hz(m), len, .45, .3); }
        bass(bs, t, hz(root(c, 36)), len, .8);
      }));
      b.at(0, t => tones(b.ch(0), 72).forEach((m, j) => bell(bl, t + j * .06, hz(m + 12), 2.8, .3)));
      b.at(0, t => tom(drum, t, 85, last ? 1 : .7));
      if (b.i === 2) [3, 3.25, 3.5, 3.75].forEach((q, j) => b.at(q, t => tom(drum, t, 80 + j * 6, .4 + j * .1)));
    },
  },
};

// ───────────────────────────── players
let cur: Player | null = null, want: TrackId | null = null, intensity = 0, poll = 0;
const LOOK = .2, XF = 1.8;

function startProc(c: Core, id: TrackId): Player {
  const def = TRACKS[id], { ac } = c, out = ac.createGain(), wet = ac.createGain();
  let timer = 0;
  out.gain.value = wet.gain.value = 0; out.connect(c.music); wet.connect(c.reverb);
  const me: Proc = { id, def, lvl: 1, out, wet, bus: {} as Record<BusId, AudioNode>, kill: () => { clearInterval(timer); out.disconnect(); wet.disconnect(); } };
  if (def.groove) {
    me.cmb = ac.createGain(); me.cmbW = ac.createGain(); me.cmb.gain.value = me.cmbW.gain.value = intensity;
    me.cmb.connect(out); me.cmbW.connect(wet);
  }
  for (const k of Object.keys(BUS) as BusId[]) {
    const [vol, rev, pan, ft, fq, combat] = BUS[k];
    if (combat && !me.cmb) continue;
    const g = ac.createGain(), s = ac.createGain();
    g.gain.value = vol * (def.mix?.[k] ?? 1); s.gain.value = rev;
    let tail: AudioNode = g;
    if (pan) { const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); tail = p; }
    tail.connect(combat ? me.cmb! : out); tail.connect(s); s.connect(combat ? me.cmbW! : wet);
    let input: AudioNode = g;
    if (ft) { const f = ac.createBiquadFilter(); f.type = ft; f.frequency.value = fq; f.connect(g); input = f; }
    me.bus[k] = input;
  }
  // Flatten the form into bars; `o` counts earlier occurrences of the same section so repeats pick alternate phrases.
  const plan: { s: string; i: number; o: number }[] = [], cnt: Record<string, number> = {};
  for (const s of def.form) { const o = cnt[s] ?? 0; cnt[s] = o + 1; def.sec[s].ch.forEach((_, i) => plan.push({ s, i, o })); }
  const spb = 60 / def.bpm, barLen = 4 * spb, seed = id.length * 131 + id.charCodeAt(0);
  let k = 0, t0 = ac.currentTime + .08, q: Ev[] = [], ended = false, handed = false;

  const expand = () => {
    if (def.once && k >= plan.length) { ended = true; return; }
    const p = plan[k % plan.length], sec = def.sec[p.s], occ = Math.floor(k / plan.length) * cnt[p.s] + p.o, base = t0;
    const segs = pick(sec.ch[p.i], occ).split(' ').map(chord), n = segs.length;
    const b: Bar = {
      x: me, i: p.i, sec: p.s, occ, spb, segs, rnd: rng(k * 7919 + seed),
      ch: beat => segs[Math.max(0, Math.min(n - 1, Math.floor(beat * n / 4)))],
      at: (beat, f, c) => { let bt = beat; if (def.swing && Math.abs((bt % 1) - .5) < .001) bt += def.swing; q.push({ t: base + bt * spb, f, c }); },
    };
    lead(b, sec.mel[p.i]); def.parts(b); if (def.groove) groove(b, def.groove);
    q.sort((a, z) => a.t - z.t); k++; t0 += barLen;
  };
  const tick = () => {
    try {
      const now = ac.currentTime, ahead = now + (document.hidden ? 1.2 : LOOK);
      if (t0 < now - .3) { // fell behind (throttled tab): skip whole bars rather than burst-scheduling
        let skip = Math.ceil((now - t0) / barLen);
        if (def.once) skip = Math.min(skip, Math.max(0, plan.length - k));
        k += skip; t0 += skip * barLen;
      }
      while (!ended && t0 < ahead) expand();
      while (q.length && q[0].t < ahead) {
        const e = q.shift()!;
        if (e.t < now - .3 || (e.c && intensity < .02 && me.cmb!.gain.value < .01)) continue;
        e.f(Math.max(e.t, now));
      }
      if (ended && !handed && def.next && now > t0 + 1.2) { handed = true; if (cur === me && want === id) { want = def.next; sync(); } }
    } catch { /* audio is optional */ }
  };
  timer = window.setInterval(tick, 25); tick();
  return me;
}

function startFile(c: Core, id: TrackId, buf: AudioBuffer): Player {
  const { ac } = c, out = ac.createGain(), wet = ac.createGain(), src = ac.createBufferSource(), next = TRACKS[id].next;
  out.gain.value = 0; src.buffer = buf; src.loop = !TRACKS[id].once; src.connect(out); out.connect(c.music);
  const p: Player = { id, lvl: .5, out, wet, kill: () => { try { src.stop(); } catch { /* already stopped */ } out.disconnect(); } };
  src.onended = () => { if (next && cur === p && want === id) { want = next; sync(); } };
  src.start();
  return p;
}

function fade(p: Player, to: number, dur: number) {
  const t = C!.ac.currentTime;
  for (const n of [p.out, p.wet]) { const g = n.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(to, t + dur); }
}
function retire(p: Player) { fade(p, 0, XF); window.setTimeout(() => { try { p.kill(); } catch { /* ignore */ } }, XF * 1000 + 300); }

// ───────────────────────────── optional file overrides
let manifest: Record<string, string> | null | undefined, mfBusy = false;
const bufs = new Map<TrackId, AudioBuffer | 'loading' | 'fail'>();
async function loadManifest() {
  if (mfBusy) return; mfBusy = true;
  window.setTimeout(() => { if (manifest === undefined) { manifest = null; sync(); } }, 2500);
  let m: Record<string, string> | null = null;
  try {
    if (!navigator.onLine) throw new Error('offline'); // played offline: the built-in music is used
    const r = await fetch(`${import.meta.env.BASE_URL}music/manifest.json`);
    const j: unknown = r.ok ? JSON.parse(await r.text()) : null; // the dev server may answer with index.html: parse fails -> procedural
    if (j && typeof j === 'object' && !Array.isArray(j)) m = Object.fromEntries(Object.entries(j).filter(([key, v]) => key in TRACKS && typeof v === 'string'));
  } catch { m = null; }
  if (manifest === undefined) { manifest = m; sync(); } else if (m) manifest = m;
}
async function loadFile(c: Core, id: TrackId, file: string) {
  bufs.set(id, 'loading');
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}music/${file}`);
    if (!r.ok) throw new Error(String(r.status));
    bufs.set(id, await c.ac.decodeAudioData(await r.arrayBuffer()));
  } catch { bufs.set(id, 'fail'); }
  sync();
}

// ───────────────────────────── control
const stopPoll = () => { if (poll) { clearInterval(poll); poll = 0; } };
/** Brings the playing track in line with `want`, deferring while the context is locked or files load. */
function sync() {
  try {
    if (want === (cur?.id ?? null)) { stopPoll(); return; }
    if (want === null) { stopPoll(); if (cur) retire(cur); cur = null; return; }
    const c = audioCore();
    if (!c || c.ac.state !== 'running') { if (!poll) poll = window.setInterval(sync, 500); return; }
    stopPoll();
    if (c !== C) { C = c; const { ac } = c; W = { harp: pw(ac, [1, .45, .22, .12, .06, .03]), bright: pw(ac, [.3, .6, .5, .4, .3, .2, .15, .1]), flute: pw(ac, [1, .16, .06, .025]) }; }
    if (manifest === undefined) { void loadManifest(); return; }
    let buf: AudioBuffer | undefined;
    const file = manifest?.[want];
    if (file) {
      const b = bufs.get(want);
      if (!b) { void loadFile(c, want, file); return; }
      if (b === 'loading') return;
      if (b !== 'fail') buf = b;
    }
    const p = buf ? startFile(c, want, buf) : startProc(c, want);
    if (cur) retire(cur);
    cur = p; fade(p, p.lvl, want === 'victory' ? .4 : XF);
  } catch { /* audio is optional */ }
}

export const music = {
  /** Crossfades to a track; the same track is a no-op, null fades out. Safe to call before the audio is unlocked. */
  play(track: TrackId | null) { want = track; sync(); },
  /** 0..1 combat intensity: fades the percussion/pulse layer of the chapter tracks. Cheap to call every frame. */
  setIntensity(v: number) {
    try {
      const x = Math.max(0, Math.min(1, v || 0));
      if (Math.abs(x - intensity) > .005) {
        intensity = x;
        if (cur?.cmb && C) { const t = C.ac.currentTime; cur.cmb.gain.setTargetAtTime(x, t, .5); cur.cmbW!.gain.setTargetAtTime(x, t, .5); }
      }
      if (want !== (cur?.id ?? null) && !poll) sync();
    } catch { /* audio is optional */ }
  },
  current: (): TrackId | null => want,
};
