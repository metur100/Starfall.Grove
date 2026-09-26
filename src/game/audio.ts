// Tiny synthesized sound effects: no audio files needed.
export type Sfx = 'spark' | 'sunfire' | 'boom' | 'leaf' | 'shield' | 'reflect' | 'starfall' | 'dash' | 'hit' | 'crit' | 'kill' | 'pickup' | 'key' | 'orb' | 'hurt' | 'roar' | 'learn' | 'pod' | 'bossDie' | 'victory' | 'slam' | 'talk' | 'nope';

const MUTE_KEY = 'starfall-grove-muted';
let ac: AudioContext | null = null;
let master: GainNode | null = null;
let muted = (() => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } })();
const lastPlayed = new Map<Sfx, number>();

function ctx() {
  if (!ac) {
    try {
      ac = new AudioContext();
      master = ac.createGain(); master.gain.value = .5; master.connect(ac.destination);
    } catch { return null; }
  }
  if (ac.state === 'suspended') void ac.resume();
  return ac;
}

type ToneOpts = { type?: OscillatorType; to?: number; vol?: number; delay?: number; attack?: number };
function tone(freq: number, dur: number, { type = 'sine', to, vol = .16, delay = 0, attack = .005 }: ToneOpts = {}) {
  const a = ctx(); if (!a || !master) return;
  const t = a.currentTime + delay, osc = a.createOscillator(), g = a.createGain();
  osc.type = type; osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  osc.connect(g); g.connect(master); osc.start(t); osc.stop(t + dur + .05);
}
function noise(dur: number, { vol = .2, freq = 1200, q = 1, delay = 0, type = 'lowpass' as BiquadFilterType, to }: { vol?: number; freq?: number; q?: number; delay?: number; type?: BiquadFilterType; to?: number } = {}) {
  const a = ctx(); if (!a || !master) return;
  const t = a.currentTime + delay, len = Math.ceil(a.sampleRate * dur), buf = a.createBuffer(1, len, a.sampleRate), data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = buf; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(master); src.start(t);
}
const chord = (notes: number[], step: number, dur: number, opts: ToneOpts = {}) => notes.forEach((n, i) => tone(n, dur, { ...opts, delay: (opts.delay || 0) + i * step }));

const SOUNDS: Record<Sfx, () => void> = {
  spark: () => tone(880 + Math.random() * 120, .12, { type: 'triangle', to: 1500, vol: .07 }),
  sunfire: () => { tone(300, .35, { type: 'sawtooth', to: 90, vol: .08 }); noise(.3, { vol: .08, freq: 900, to: 300 }); },
  boom: () => { noise(.55, { vol: .3, freq: 700, to: 80 }); tone(120, .4, { type: 'sine', to: 40, vol: .2 }); },
  leaf: () => { noise(.45, { vol: .12, freq: 2500, type: 'bandpass', q: 2, to: 600 }); chord([660, 880, 1100], .05, .25, { type: 'triangle', vol: .05 }); },
  shield: () => chord([330, 440, 660], .04, .5, { type: 'sine', vol: .09 }),
  reflect: () => tone(1400, .1, { type: 'square', to: 2200, vol: .04 }),
  starfall: () => chord([1320, 1100, 880, 660, 550], .07, .5, { type: 'triangle', vol: .06 }),
  dash: () => noise(.2, { vol: .12, freq: 3000, type: 'bandpass', q: 1.5, to: 800 }),
  hit: () => tone(220, .08, { type: 'square', to: 120, vol: .06 }),
  crit: () => { tone(520, .12, { type: 'square', to: 1040, vol: .07 }); noise(.08, { vol: .08, freq: 4000, type: 'highpass' }); },
  kill: () => chord([660, 990, 1320], .05, .2, { type: 'triangle', vol: .07 }),
  pickup: () => chord([660, 990], .06, .2, { type: 'sine', vol: .1 }),
  key: () => chord([523, 659, 784, 1046], .08, .45, { type: 'triangle', vol: .09 }),
  orb: () => tone(1200 + Math.random() * 300, .08, { type: 'sine', vol: .05 }),
  hurt: () => { tone(200, .25, { type: 'sawtooth', to: 90, vol: .1 }); noise(.15, { vol: .1, freq: 600 }); },
  roar: () => { tone(90, .9, { type: 'sawtooth', to: 55, vol: .14, attack: .1 }); noise(.8, { vol: .12, freq: 400, to: 120 }); },
  learn: () => chord([392, 523, 659, 784, 1046, 1318], .09, .8, { type: 'triangle', vol: .08 }),
  pod: () => { tone(420, .15, { type: 'triangle', to: 200, vol: .08 }); noise(.12, { vol: .08, freq: 1600 }); },
  bossDie: () => { noise(1.4, { vol: .35, freq: 900, to: 60 }); chord([262, 330, 392, 523, 659, 784], .12, 1, { type: 'triangle', vol: .08, delay: .3 }); },
  victory: () => chord([523, 659, 784, 1046, 784, 1046, 1318], .13, .6, { type: 'triangle', vol: .09 }),
  slam: () => { noise(.4, { vol: .28, freq: 300, to: 60 }); tone(70, .35, { to: 35, vol: .2 }); },
  talk: () => tone(520 + Math.random() * 80, .05, { type: 'triangle', vol: .04 }),
  nope: () => tone(180, .12, { type: 'square', to: 150, vol: .05 }),
};

export const sfx = {
  play(name: Sfx) {
    if (muted) return;
    const now = performance.now();
    if (now - (lastPlayed.get(name) || 0) < 45) return;
    lastPlayed.set(name, now);
    try { SOUNDS[name](); } catch { /* audio is optional */ }
  },
  unlock() { if (!muted) ctx(); },
  isMuted: () => muted,
  setMuted(value: boolean) { muted = value; try { localStorage.setItem(MUTE_KEY, value ? '1' : '0'); } catch { /* ignore */ } },
};
