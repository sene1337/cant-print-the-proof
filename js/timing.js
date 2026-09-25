// Song timing: beat grid, word times, and audio envelopes, all measured from the approved master.

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9-]/g, '');

export class Timing {
  constructor(d) {
    const { env, ...rest } = d;
    Object.assign(this, rest);
    this.envData = env;
    this.wordIndex = new Map();
    for (const w of d.words) {
      const k = norm(w.t);
      if (!this.wordIndex.has(k)) this.wordIndex.set(k, []);
      this.wordIndex.get(k).push(w);
    }
  }

  static async load(url) {
    const r = await fetch(url);
    return new Timing(await r.json());
  }

  // Index of the last beat at or before t (or -1).
  beatIndex(t) {
    const b = this.beats;
    let lo = 0, hi = b.length - 1, ans = -1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (b[m] <= t) { ans = m; lo = m + 1; } else hi = m - 1;
    }
    return ans;
  }

  lastBeat(t) {
    const i = this.beatIndex(t);
    return i < 0 ? -1e9 : this.beats[i];
  }

  // Exponential kick that fires on every beat.
  kick(t, decay = 7) {
    const dt = t - this.lastBeat(t);
    return Math.exp(-decay * dt);
  }

  // Beats since time a (fractional).
  beatsSince(t, a) {
    const i = this.beatIndex(t), j = this.beatIndex(a);
    if (i < 0) return 0;
    const b = this.beats;
    const frac = i + 1 < b.length ? (t - b[i]) / (b[i + 1] - b[i]) : 0;
    return i - j + frac;
  }

  // Nth sung occurrence of a word ("pen", 0).
  word(text, n = 0) {
    const list = this.wordIndex.get(norm(text));
    if (!list || !list[n]) throw new Error(`word not found: ${text}#${n}`);
    return list[n];
  }

  // First word at or after time t matching text.
  wordAfter(text, t) {
    const w = (this.wordIndex.get(norm(text)) || []).find((x) => x.s >= t - 0.05);
    if (!w) throw new Error(`word not found after ${t}: ${text}`);
    return w;
  }

  // Envelope sampled per frame, linearly interpolated.
  env(name, t) {
    const arr = this.envData[name];
    const x = t * this.fps;
    const i = Math.max(0, Math.min(arr.length - 2, Math.floor(x)));
    const f = Math.min(1, Math.max(0, x - i));
    return arr[i] + (arr[i + 1] - arr[i]) * f;
  }
}
