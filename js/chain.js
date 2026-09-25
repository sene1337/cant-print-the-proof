// The art chain: one proof-of-work block per video frame, linked from Bitcoin's real genesis block,
// each header committing to the SHA-256 of the song. Anyone can re-check it here with WebCrypto.

const hexToBytes = (h) => {
  const b = new Uint8Array(h.length / 2);
  for (let i = 0; i < b.length; i++) b[i] = parseInt(h.substr(i * 2, 2), 16);
  return b;
};
const bytesToHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

export class Chain {
  constructor(d) {
    Object.assign(this, d);
    this.cum = new Float64Array(d.n);
    let s = 0;
    for (let i = 0; i < d.n; i++) { s += d.nonces[i] + 1; this.cum[i] = s; }
  }
  static async load(url) {
    const r = await fetch(url);
    return new Chain(await r.json());
  }
  hash(i) { return this.hashes.substr(i * 64, 64); }
  block(i) {
    i = Math.max(0, Math.min(this.n - 1, i));
    return { i, nonce: this.nonces[i], hash: this.hash(i), prev: i ? this.hash(i - 1) : this.genesis, t_ms: Math.round((i / this.fps) * 1000) };
  }
  frameAt(t) { return Math.max(0, Math.min(this.n - 1, Math.floor(t * this.fps + 1e-6))); }
  hashesUpTo(i) { return this.cum[Math.max(0, Math.min(this.n - 1, i))]; }

  header(i) {
    const b = this.block(i);
    const h = new Uint8Array(80);
    h.set(hexToBytes(b.prev), 0);
    h.set(hexToBytes(this.song_sha256), 32);
    const v = new DataView(h.buffer);
    v.setUint32(64, i, true);
    v.setUint32(68, b.t_ms, true);
    v.setBigUint64(72, BigInt(b.nonce), true);
    return h;
  }

  async sha256d(bytes) {
    const a = await crypto.subtle.digest('SHA-256', bytes);
    return new Uint8Array(await crypto.subtle.digest('SHA-256', a));
  }

  async verifyBlock(i) {
    const h = await this.sha256d(this.header(i));
    const hex = bytesToHex(h);
    let zeros = 0;
    for (const x of h) { if (x === 0) zeros += 8; else { zeros += Math.clz32(x) - 24; break; } }
    return { ok: hex === this.hash(i) && zeros >= this.bits, hex, zeros };
  }

  // Checks the song file against the commitment, then every block. onProgress(done, n).
  async verifyAll(songUrl, onProgress) {
    const buf = await (await fetch(songUrl)).arrayBuffer();
    const songHex = bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', buf)));
    const songOk = songHex === this.song_sha256;
    let bad = -1;
    for (let i = 0; i < this.n; i++) {
      const r = await this.verifyBlock(i);
      if (!r.ok) { bad = i; break; }
      if (onProgress && (i % 97 === 0 || i === this.n - 1)) onProgress(i + 1, this.n);
    }
    return { songOk, songHex, bad, n: this.n, hashes: this.cum[this.n - 1] };
  }
}
