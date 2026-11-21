// Sound effects, all made in code (no sound files): short tones and bursts of
// filtered noise. Browsers only allow sound after the first click or key press,
// so nothing plays until then.
// (The gunshot, the slap and punch, and the engines are made in their own files.)
let ctx = null, master = null, noiseBuffer = null;
// Overall loudness. Filtered hiss loses most of its strength, so it needs a much bigger boost than pure notes.
const TONE_BOOST = 3, NOISE_BOOST = 9;

function wake() {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 1;
      const limiter = ctx.createDynamicsCompressor(); // stops loud moments from distorting
      master.connect(limiter).connect(ctx.destination);
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); // one second of hiss
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch {
    ctx = null; // no sound available: the game carries on silently
  }
}
// ?soundtest: start the sound straight away and report how loud the output is, for checking it works.
if (new URLSearchParams(location.search).has('soundtest')) {
  wake();
  const meter = ctx.createAnalyser();
  master.connect(meter);
  const samples = new Float32Array(meter.fftSize);
  let peak = 0;
  setInterval(() => { meter.getFloatTimeDomainData(samples); for (const s of samples) peak = Math.max(peak, Math.abs(s)); }, 30);
  setInterval(() => { console.log(`SOUNDTEST state=${ctx.state} peak=${peak.toFixed(3)}`); peak = 0; }, 2000);
}
window.addEventListener('pointerdown', wake);
window.addEventListener('keydown', wake);

// A note: starts at `freq`, optionally slides to `to`, and fades out over `length` seconds.
function tone(freq, length, { type = 'sine', volume = 0.2, to = null, delay = 0, attack = 0.005 } = {}) {
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + length);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume * TONE_BOOST, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + length + 0.03);
}

// A burst of hiss pushed through a filter: thumps, whooshes, crunches and splashes.
function noise(length, { filter = 'lowpass', freq = 1000, to = null, q = 0.7, volume = 0.2, delay = 0, attack = 0.004 } = {}) {
  const t = ctx.currentTime + delay;
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;
  source.loop = true;
  const shape = ctx.createBiquadFilter();
  shape.type = filter;
  shape.frequency.setValueAtTime(freq, t);
  if (to) shape.frequency.exponentialRampToValueAtTime(to, t + length);
  shape.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume * NOISE_BOOST, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  source.connect(shape).connect(gain).connect(master);
  source.start(t, Math.random() * 0.9);
  source.stop(t + length + 0.03);
}

const SOUNDS = {
  step: () => noise(0.09, { freq: 500 + Math.random() * 250, volume: 0.16 }),                       // a footstep on a hard floor
  softStep: () => noise(0.12, { filter: 'bandpass', freq: 1400 + Math.random() * 600, q: 0.5, volume: 0.07 }), // ...and on grass
  jump: () => noise(0.16, { filter: 'bandpass', freq: 500, to: 1500, volume: 0.1 }),
  land: () => { noise(0.14, { freq: 260, volume: 0.3 }); tone(90, 0.12, { to: 50, volume: 0.25 }); },
  whoosh: () => noise(0.14, { filter: 'bandpass', freq: 900, to: 2600, q: 1.2, volume: 0.13 }),     // a punch cutting the air
  door: () => noise(0.5, { filter: 'bandpass', freq: 700, to: 1700, q: 0.8, volume: 0.09, attack: 0.15 }), // a sliding door
  shot: () => { noise(0.22, { freq: 3800, to: 500, volume: 0.22 }); tone(150, 0.2, { to: 45, volume: 0.28 }); }, // someone else's gun
  click: () => tone(1500, 0.04, { type: 'square', volume: 0.06 }),
  coin: () => { tone(1320, 0.12, { volume: 0.16 }); tone(1980, 0.3, { volume: 0.16, delay: 0.08 }); },
  buy: () => {                                                                                       // an old cash register
    noise(0.05, { filter: 'highpass', freq: 3000, volume: 0.12 });
    tone(1760, 0.5, { volume: 0.14, delay: 0.06 });
    tone(2640, 0.5, { volume: 0.1, delay: 0.06 });
  },
  pickup: () => tone(520, 0.12, { to: 900, volume: 0.15 }),
  error: () => { tone(160, 0.16, { type: 'square', volume: 0.08 }); tone(120, 0.2, { type: 'square', volume: 0.08, delay: 0.14 }); },
  lighter: () => { tone(2600, 0.03, { type: 'square', volume: 0.07 }); noise(0.45, { filter: 'bandpass', freq: 2200, q: 0.4, volume: 0.05, delay: 0.05, attack: 0.05 }); },
  drink: () => { for (let gulp = 0; gulp < 3; gulp++) tone(300, 0.11, { to: 150, volume: 0.16, delay: gulp * 0.24 }); },
  eat: () => { for (let bite = 0; bite < 4; bite++) noise(0.07, { filter: 'bandpass', freq: 2400 + Math.random() * 1200, q: 1.5, volume: 0.14, delay: bite * 0.17 }); },
  splash: () => { noise(0.5, { filter: 'bandpass', freq: 1800, to: 500, q: 0.6, volume: 0.22 }); noise(0.25, { freq: 300, volume: 0.15 }); },
  swim: () => noise(0.3, { filter: 'bandpass', freq: 1300, to: 600, q: 0.6, volume: 0.09, attack: 0.05 }),
  sleep: () => [660, 550, 440, 330].forEach((note, i) => tone(note, 0.7, { volume: 0.1, delay: i * 0.22, attack: 0.05 })),
  levelup: () => [523, 659, 784, 1047].forEach((note, i) => tone(note, 0.28, { type: 'triangle', volume: 0.16, delay: i * 0.09 })),
  cell: () => {                                                                                      // a barred door slamming shut
    noise(0.18, { freq: 900, volume: 0.35 });
    for (const pitch of [212, 389, 517, 761]) tone(pitch, 1.1, { type: 'triangle', volume: 0.07 });
  },
  growl: () => {                                                                                     // an alligator
    noise(0.9, { freq: 220, volume: 0.35, attack: 0.08 });
    tone(62, 0.9, { type: 'sawtooth', to: 40, volume: 0.22, attack: 0.08 });
    noise(0.5, { filter: 'bandpass', freq: 1500, to: 500, volume: 0.2 });                            // and the splash as it surfaces
  },
  bird: () => {
    const pitch = 2200 + Math.random() * 1600, notes = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < notes; i++) tone(pitch * (1 + Math.random() * 0.2), 0.09, { to: pitch * (0.8 + Math.random() * 0.5), volume: 0.025, delay: i * 0.13 });
  },
  cricket: () => { for (let i = 0; i < 3; i++) tone(4300, 0.035, { volume: 0.012, delay: i * 0.055 }); },
};

// Play a sound effect by name.
export function sfx(name) {
  if (!ctx || ctx.state !== 'running') return;
  try { SOUNDS[name]?.(); } catch { /* never let a sound break the game */ }
}

// --- Sounds that follow what is going on ---------------------------------------------

let last = null, travelled = 0, swum = 0, wasOnGround = true, wasWading = false;
let doorsBefore = [], birdTimer = 2, cricketTimer = 0, siren = null;

// state: { position, onFoot, onGround, swimming, wading, indoors, night, wanted, doors: [how open each door is, 0 to 1] }
export function updateSound(dt, state) {
  if (!ctx || ctx.state !== 'running') return;
  const p = state.position;

  // Footsteps, jumping and landing, and splashing about in the lake.
  const moved = last ? Math.hypot(p.x - last.x, p.z - last.z) : 0;
  last = { x: p.x, z: p.z };
  if (state.onFoot && moved < 2) { // (a bigger jump than that is a teleport, not a step)
    if (state.swimming) {
      swum += moved;
      if (swum > 1.5) { swum = 0; sfx('swim'); }
    } else if (state.onGround) {
      travelled += moved;
      if (travelled > 0.85) { travelled = 0; sfx(state.wading ? 'swim' : state.hardFloor ? 'step' : 'softStep'); }
    }
    if (wasOnGround && !state.onGround) sfx('jump');
    if (!wasOnGround && state.onGround) sfx('land');
    if (state.wading && !wasWading) sfx('splash');
  }
  wasOnGround = state.onGround;
  wasWading = state.wading;

  // A whoosh whenever a door near him slides open or shut.
  state.doors.forEach((open, i) => {
    const before = doorsBefore[i] ?? open;
    if ((before < 0.5) !== (open < 0.5)) sfx('door');
  });
  doorsBefore = state.doors.slice();

  // Outdoors: birdsong by day and crickets at night.
  if (!state.indoors) {
    birdTimer -= dt;
    cricketTimer -= dt;
    if (!state.night && birdTimer <= 0) { birdTimer = 1.5 + Math.random() * 5; sfx('bird'); }
    if (state.night && cricketTimer <= 0) { cricketTimer = 0.45 + Math.random() * 0.25; sfx('cricket'); }
  }

  // The police siren wails for as long as he is wanted.
  if (state.wanted && !siren) {
    const osc = ctx.createOscillator(), wobble = ctx.createOscillator(), depth = ctx.createGain(), gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 780;
    wobble.frequency.value = 0.45;     // how fast it rises and falls
    depth.gain.value = 240;            // how far
    gain.gain.value = 0.13;
    wobble.connect(depth).connect(osc.frequency);
    osc.connect(gain).connect(master);
    osc.start();
    wobble.start();
    siren = { osc, wobble };
  } else if (!state.wanted && siren) {
    siren.osc.stop();
    siren.wobble.stop();
    siren = null;
  }
}
