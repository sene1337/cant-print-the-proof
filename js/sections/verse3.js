// VERSE 3 121.82-154.84 s. The birth of Bitcoin: the paper era ends and proof arrives.
import * as THREE from 'three';
import { orbitCam, moveCam } from '../film.js';
import { clamp, lerp, smooth, easeOut, easeInOut } from '../util.js';
import { verse3PaperStage } from '../stages/verse3-paper.js';
import { verse3CoinStage, RISER_H, CT } from '../stages/verse3-coin.js';
import { verse3BankStage } from '../stages/verse3-bank.js';
import { verse3GenesisStage, GS } from '../stages/verse3-genesis.js';
import { verse3RoomStage, LINE } from '../stages/verse3-room.js';
import { verse3ChainStage } from '../stages/verse3-chain.js';
import { verse3HalvingStage, HT, PLINTH, TANK } from '../stages/verse3-halving.js';
import { verse3MoonStage, KEY_AT } from '../stages/verse3-moon.js';

// Stage builders this section owns: { id: async (film) => stage }. Ids must be unique across the film.
export const stages = {
  'verse3-paper': verse3PaperStage,
  'verse3-coin': verse3CoinStage,
  'verse3-bank': verse3BankStage,
  'verse3-genesis': verse3GenesisStage,
  'verse3-room': verse3RoomStage,
  'verse3-chain': verse3ChainStage,
  'verse3-halving': verse3HalvingStage,
  'verse3-moon': verse3MoonStage,
};

// Narrow frames pull the camera back, like orbitCam and moveCam do.
const aspectZoom = (c) => Math.pow(Math.max(1, (16 / 9) / c.aspect), 0.8);
const _a = new THREE.Vector3(), _n = new THREE.Vector3(), _x = new THREE.Vector3();

export function shots(S, T) {
  const W = (w, after = 121.5) => T.wordAfter(w, after).s;
  const beatAfter = (t) => T.beats[T.beatIndex(t) + 1];

  // ---- 121.82 "October oh-eight, Satoshi, a name nobody knew": one white page in the beam.
  // A slow push from the whole page to the title and the name.
  S(121.82, 'verse3-paper', (c, cam, s) => {
    const u = easeOut(clamp(c.lt / 2.8), 2.2);
    const h = s.hero;
    _a.set(0, lerp(0.02, 0.43, u), 0); h.localToWorld(_a);
    _n.set(0, 0, 1).applyQuaternion(h.quaternion);
    _x.set(1, 0, 0).applyQuaternion(h.quaternion);
    const d = lerp(2.75, 1.0, u) * aspectZoom(c);
    const side = lerp(0.35, -0.08, u);
    cam.position.copy(_a).addScaledVector(_n, d).addScaledVector(_x, side * d * 0.25);
    cam.lookAt(_a);
    cam.fov = 32;
  }, (s, c) => { s.float(c.t); }, { fadeIn: 0.2, bloom: 0.4, threshold: 1.05 });

  // ---- The paper-to-proof choreography (shared by the next two shots).
  const tm = {
    drop0: 124.25, dropStep: 0.118, fall: 0.42,
    burn0: 126.98, burnDur: 0.34, proof: W('proof.', 127),
    fly: [],
  };
  const BASE = [1, 3, 5, 6], WALLS = [8, 2, 7, 4]; // walls fly back to front
  BASE.forEach((k, j) => { tm.fly[k] = { t0: 125.94 + j * 0.05, dur: 0.26, lift: 0.25 + j * 0.12 }; });
  WALLS.forEach((k, j) => { tm.fly[k] = { t0: 126.06 + j * 0.09, dur: 0.4, lift: 0.7 }; });
  tm.fly[0] = { t0: 126.56, dur: 0.36, lift: 0.8 };

  // ---- 124.62 "dropped nine pages": they fall out of the dark and land in a ring.
  S(W('dropped'), 'verse3-paper', orbitCam({ target: [0, 0.35, 0], dist: [9.4, 9.0], az: [14, 30], el: [36, 60], fov: 38, ease: easeInOut }),
    (s, c) => { s.pagesAt(c.t, tm); });

  // ---- 125.93 "no pitch, no promise, just proof": the pages fold into a cube; the paper burns off; proof.
  S(beatAfter(W('pages,')), 'verse3-paper', orbitCam({ target: [0, 0.5, 0], dist: [6.4, 2.7], az: [30, 16], el: [44, 17], fov: 34, ease: easeOut }),
    (s, c) => { s.pagesAt(c.t, tm); s.cone.visible = false; },
    { bloom: 0.6 });

  // ---- 127.48 "Solved the double-spend": the coin tries to be two; one copy shatters, one holds.
  S(W('Solved'), 'verse3-coin', orbitCam({ target: [0, 1.5, 0], dist: [6.0, 4.9], az: [-10, 4], el: [7, 3], fov: 32 }),
    (s, c) => { s.doubleSpend(c.t, { tSplit: beatAfter(W('Solved')), tFail: W('double-spend,') }); });

  // ---- 128.74 "took the bank out the middle": a marble bank stands on a trapdoor; the floor drops it into the dark,
  // slams shut on "middle", and the orange coin rolls over to stop where the bank stood.
  S(W('took'), 'verse3-bank', orbitCam({ target: [0, 0.85, 0], dist: [6.9, 6.1], az: [-10, 4], el: [9, 7], fov: 32 }),
    (s, c) => { s.play(c.t, { tDrop: W('bank', 128.8) + 0.02, tShut: W('middle,') - 0.02 }); });

  // ---- 129.90 "no king and no council to shave me a little": the shears that clipped the gold bite and bounce off.
  const tShave = W('shave');
  S(W('no', 129.8), 'verse3-coin', orbitCam({ target: [0.3, RISER_H + CT / 2, 0.55], dist: [3.9, 3.1], az: [28, 38], el: [26, 21], fov: 32 }),
    (s, c) => { s.shearsAt(c.t, { tIn: 129.95, tBite: tShave, tOut: 132.15 }); });

  // ---- 132.48 "January oh-nine, Genesis, block zero": a spark in the dark traces block zero, and it lights.
  const tJan = W('January');
  S(tJan, 'verse3-genesis', orbitCam({ target: [0, 0.05, 0], dist: [5.6, 4.3], az: [50, 22], el: [21, 9], fov: 32, ease: easeInOut }),
    (s, c) => { s.birth(c.t, { tSpark: tJan - 0.5, tEdges: tJan - 0.3, tFaces: W('Genesis,') - 0.15, tGlow: W('block', 134) }); });

  // ---- 135.10 "stamped the bailout headline, a receipt, not a hero": the coinbase text slams into the side.
  const tStamp = W('stamped');
  const tHit = tStamp + 0.1;
  const headCam = orbitCam({ target: [GS / 2, 0, 0], dist: [2.55, 2.1], az: [104, 84], el: [5, 1], fov: 32 });
  S(tStamp, 'verse3-genesis', (c, cam, s) => {
    headCam(c, cam, s);
    // the camera takes the blow: a short damped jolt at the impact
    const d = c.t - tHit;
    if (d > 0) {
      const j = Math.exp(-d * 14) * Math.sin(d * 55) * 0.012;
      cam.position.y += j; cam.position.x += j * 0.6;
    }
  }, (s, c) => { s.stamp(c.t, tHit); },
    { shake: 0.004 });

  // ---- 137.94 "Hal Finney was running it the very next day": an old monitor in a dark room types "Running bitcoin".
  const typeTimes = [];
  { let x = 138.3; for (let i = 0; i < LINE.length; i++) { typeTimes.push(x); x += i < 7 ? 0.095 : 0.082; } }
  S(W('Hal'), 'verse3-room', moveCam({ from: [1.55, 1.3, 2.9], to: [0.3, 1.06, 1.75], look: [0, 0.98, 0.2], look2: [0, 1.02, 0.24], fov: [32, 30], ease: easeInOut }),
    (s, c) => { s.type(c.t, typeTimes); });

  // ---- 140.30 "block after block, and it's still ticking away": a block lands on every beat; the chain runs to the horizon.
  S(W('block', 140.2), 'verse3-chain', (c, cam, s) => {
    const hx = s.headX(c.t);
    const z = aspectZoom(c);
    const look = [hx - 4.6, 0.3, 0];
    const pos = [hx + 3.4, 1.45 + 0.25 * c.u, 4.1];
    cam.position.set(look[0] + (pos[0] - look[0]) * z, look[1] + (pos[1] - look[1]) * z, look[2] + (pos[2] - look[2]) * z);
    cam.lookAt(...look);
    cam.fov = 38;
  }, null, { bloom: 0.6 });

  // ---- 142.88 "Every four years the new coins get cut in half": a stack of 50 is cut to 25, 12.5, 6.25 on the beats.
  const tEvery = W('Every');
  const cuts = [beatAfter(W('years') - 0.1), beatAfter(W('coins') - 0.1), beatAfter(W('cut') - 0.2)];
  const stackH = (t) => {
    const hs = [5, 2.5, 1.25, 0.625].map((x) => x * HT * 10);
    let h = hs[0];
    cuts.forEach((c, i) => { h = lerp(h, hs[i + 1], smooth(clamp((t - c - 0.15) / 0.6))); });
    return h;
  };
  S(tEvery, 'verse3-halving', (c, cam) => {
    const h = stackH(c.t);
    const z = aspectZoom(c);
    const target = [0, PLINTH + h * 0.5 - 0.3 - 0.15 * (1 - h / 5), 0];
    const d = (3.2 + h * 1.75) * z;
    const az = ((20 + c.lt * 4) * Math.PI) / 180, el = ((10 + (1 - h / 5) * 12) * Math.PI) / 180;
    cam.position.set(target[0] + d * Math.sin(az) * Math.cos(el), target[1] + d * Math.sin(el), target[2] + d * Math.cos(az) * Math.cos(el));
    cam.lookAt(...target);
    cam.fov = 32;
  }, (s, c) => { s.stack(c.t, cuts); });

  // ---- 146.00 "twenty-one million, go on, do the math": a glass vessel etched 21,000,000 fills with molten orange,
  // each pour half of what is left (1/2, 3/4, 7/8...). It never reaches the brim.
  const tTwenty = W('twenty-one', 145.5);
  const pours = [beatAfter(tTwenty), W('million,', 146), W('go', 146.5), W('on,', 147), W('do', 147.5), 148.0, W('the', 148), W('math.')];
  S(tTwenty, 'verse3-halving', (c, cam) => {
    const k = easeInOut(c.u), k2 = Math.pow(c.u, 1.5);
    const z = aspectZoom(c);
    // end looking down at the brim: the molten surface a sliver below it, the etching just beneath
    const target = [0, lerp(1.72, TANK.y0 + TANK.h - 0.12, k2), 0.15 * k2];
    const d = lerp(7.4, 2.7, k2) * z;
    const az = (lerp(24, 14, k) * Math.PI) / 180, el = (lerp(14, 24, k) * Math.PI) / 180;
    cam.position.set(target[0] + d * Math.sin(az) * Math.cos(el), target[1] + d * Math.sin(el), target[2] + d * Math.cos(az) * Math.cos(el));
    cam.lookAt(...target);
    cam.fov = 32;
  }, (s, c) => { s.vesselAt(c.t, pours); }, { bloom: 0.35 });

  // ---- 148.62 "Property in cyberspace, keys you can carry": an orange key on a string turns in front of the moon.
  // (Verse 1 opens on a cowrie on a string in front of this moon; same framing, new money.)
  S(W('Property'), 'verse3-moon', (c, cam, s) => {
    const u = easeOut(c.u, 2);
    const z = aspectZoom(c);
    const tgt = [KEY_AT[0], KEY_AT[1] - 0.12, KEY_AT[2]];
    const d = lerp(1.3, 1.0, u) * z;
    // a touch below the key, looking up: the horizon sits low, like verse 1's
    const az = (lerp(-6, 4, u) * Math.PI) / 180, el = (lerp(-4, -3, u) * Math.PI) / 180;
    cam.position.set(tgt[0] + d * Math.sin(az) * Math.cos(el), tgt[1] + d * Math.sin(el), tgt[2] + d * Math.cos(az) * Math.cos(el));
    // narrow frames: the moon rides higher and nearer the key so both stay in the picture
    const wide = clamp((c.aspect - 0.5625) / (16 / 9 - 0.5625));
    cam.lookAt(tgt[0] - (0.16 + 0.02 * c.u) * wide, tgt[1] + 0.04 + 0.1 * (1 - wide), tgt[2]);
    cam.fov = 28;
    s.moonAz = lerp(-3, -14, wide); s.moonEl = lerp(15, 10, wide); s.moonSize = lerp(12, 15, wide);
    cam.updateMatrixWorld();
    s.place(cam, c.t, c.film.height);
  }, (s, c) => { s.hang(c.t, c.lt, W('keys', 149)); });

  // ---- 151.00 "granite at the bottom, and the rules never vary": tilt down past the chain to the bedrock and its carved rule.
  const tGranite = W('granite');
  S(tGranite, 'verse3-chain', (c, cam, s) => {
    const X = s.xOf(s.headAt(tGranite)) - 1.0;
    const u = easeInOut(c.u);
    const z = aspectZoom(c);
    const look = [X - 0.4, lerp(0.45, -2.9, u), lerp(0, 1.3, u)];
    const pos = [X + lerp(2.2, 1.0, u), lerp(0.9, -1.6, u), lerp(3.6, 9.8, u)];
    cam.position.set(look[0] + (pos[0] - look[0]) * z, look[1] + (pos[1] - look[1]) * z, look[2] + (pos[2] - look[2]) * z);
    cam.lookAt(...look);
    cam.fov = 36;
  }, null, { bloom: 0.55 });

  // ---- 153.58 breath before the chorus: the whole monolith, the chain still landing on top, fading down.
  const tBreath = W('vary.') + 0.35;
  S(tBreath, 'verse3-chain', (c, cam, s) => {
    const X = s.xOf(s.headAt(tGranite)) - 1.0;
    const z = aspectZoom(c);
    const look = [X - 3, lerp(-1.6, -1.0, c.u), 0];
    const pos = [X + lerp(8, 9.5, c.u), lerp(-7.5, -7.0, c.u), lerp(15.5, 17.5, c.u)];
    cam.position.set(look[0] + (pos[0] - look[0]) * z, look[1] + (pos[1] - look[1]) * z, look[2] + (pos[2] - look[2]) * z);
    cam.lookAt(...look);
    cam.fov = 36;
  }, null, { bloom: 0.55, fadeOut: 0.45 });
}
