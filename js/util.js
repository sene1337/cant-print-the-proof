// Small math helpers. Everything in the film is a pure function of song time,
// so randomness is always seeded and never read from the clock.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => clamp((x - a) / (b - a));
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const smoother = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
export const easeOut = (t, p = 3) => 1 - Math.pow(1 - clamp(t), p);
export const easeIn = (t, p = 3) => Math.pow(clamp(t), p);
export const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const easeOutBack = (t, s = 1.7) => { t = clamp(t) - 1; return 1 + t * t * ((s + 1) * t + s); };
export const easeOutElastic = (t) => {
  t = clamp(t);
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
};
export const range = (t, a, b) => clamp((t - a) / (b - a));
export const pulse = (dt, decay = 8) => (dt < 0 ? 0 : Math.exp(-decay * dt));
export const TAU = Math.PI * 2;
export const deg = (d) => (d * Math.PI) / 180;

// Deterministic PRNG (mulberry32).
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hash of integers to [0,1). Stable across runs and machines.
export function hash1(n) {
  let x = (n | 0) * 374761393;
  x = (x ^ (x >>> 13)) * 1274126177;
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

// Smooth 1D value noise.
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const a = hash1(i + seed * 7919), b = hash1(i + 1 + seed * 7919);
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}

// Interpolate [a, b] pairs or pass numbers through.
export function tween(v, t, ease = smooth) {
  if (Array.isArray(v)) {
    if (v.length === 2) return lerp(v[0], v[1], ease(t));
    const seg = clamp(t) * (v.length - 1);
    const i = Math.min(v.length - 2, Math.floor(seg));
    return lerp(v[i], v[i + 1], ease(seg - i));
  }
  return v;
}

export function fmtInt(n) {
  return Math.round(n).toLocaleString('en-US');
}
