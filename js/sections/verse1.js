// VERSE 1 9.66-30.92 s. Owner: verse1 agent.
// Shell, salt, stone, ledger, gold, the king's face, and the first clip.
import * as THREE from 'three';
import { orbitCam, moveCam } from '../film.js';
import { clamp, lerp, smooth, easeOut, easeIn, easeInOut, easeOutBack, pulse, range, rng } from '../util.js';
import { seaStage, SETS } from '../stages/verse1-sea.js';
import { earthStage } from '../stages/verse1-earth.js';
import { forgeStage } from '../stages/verse1-forge.js';

const SEA = 'verse1-sea', EARTH = 'verse1-earth', FORGE = 'verse1-forge';

// Stage builders this section owns: { id: async (film) => stage }. Ids must be unique across the film.
export const stages = { [SEA]: seaStage, [EARTH]: earthStage, [FORGE]: forgeStage };

const BASIS = new THREE.Matrix4(), V3a = new THREE.Vector3(), V3b = new THREE.Vector3(), V3c = new THREE.Vector3();
const add = (p, x, y, z) => (Array.isArray(p) ? [p[0] + x, p[1] + y, p[2] + z] : [p.x + x, p.y + y, p.z + z]);
// Night shots: place the camera, then hang the sky, moon and sea on it.
const night = (camFn) => (ctx, cam, stage) => { camFn(ctx, cam, stage); stage.follow(cam); };

// Add shots with S(t, stageId, cam, set, fx). Every shot must start inside this section's range.
export function shots(S, T) {
  const W = (w, after = 9.6) => T.wordAfter(w, after).s;
  const tShell = W('shell'), tI2 = T.wordAfter('I', 11.3).s, tSalt = W('salt'), tStone = W('stone');

  // 1. I was a shell on a string: a cowrie turns on its cord in front of a huge moon.
  const hang = add(SETS.shell, 0, 1.45, 0);
  S(9.66, SEA, night(orbitCam({ target: add(SETS.shell, 0, 1.31, 0), dist: [1.35, 1.05], az: [-6, 4], el: [-2, 0], fov: 28, look: (c) => add(SETS.shell, -0.17 - 0.02 * c.u, 1.36, 0), ease: easeOut })),
    (s, c) => {
      s.moonAz = -14; s.moonEl = 7.5; s.moonSize = 16; s.moonGain = 1.15;
      s.skyU.uHalo.value = 0.03; s.seaU.uGlint.value = 1.0;
      s.cowrie.group.visible = true;
      s.cowrie.group.position.set(...hang);
      s.cowrie.group.rotation.set(0.03 * Math.sin(c.t * 1.7), 4.5 - c.lt * 0.42, 0.05 * Math.sin(c.t * 1.3 + 1));
      s.fill.intensity = 0.75; s.fill.color.set(0xffe6c8); s.fill.position.set(...add(SETS.shell, 2.2, 1.9, 2)); s.fill.target.position.set(...hang);
      s.moonLight.intensity = 3.2; s.moonLight.target.position.set(...hang); s.moonLight.castShadow = false;
    }, { fadeIn: 0.35, aperture: 0.00012, focus: 1.2, maxblur: 0.004, bloom: 0.3 });

  // 2. I was salt in your hand: glassy salt cubes pour through the moonlight and heap up in a cupped hand.
  const saltAt = add(SETS.shell, 3, 0.5, 0);
  S(tI2, SEA, night(orbitCam({ target: add(saltAt, -0.01, 0.02, 0), dist: [0.38, 0.31], az: [-6, 4], el: [30, 26], fov: 30, look: (c) => add(saltAt, -0.01, 0.03, 0) })),
    (s, c) => {
      s.moonAz = -55; s.moonEl = 16; s.moonSize = 10;
      s.salt.group.visible = true;
      s.salt.group.position.set(...saltAt);
      s.rock.visible = false; s.hand.visible = true;
      Object.assign(s.salt.P, { hmax: 0.03, smin: 0.0022, sadd: 0.0022, spread: 0.01, H: 0.26 });
      s.salt.pose(c.t - tI2 + 1.2);
      s.moonLight.intensity = 3.4; s.moonLight.target.position.set(...saltAt); s.moonLight.castShadow = true; s.hemi.intensity = 0.35;
      s.shadowAround({ x: saltAt[0], y: saltAt[1], z: saltAt[2] }, 1);
      s.fill.intensity = 0.6; s.fill.position.set(...add(saltAt, 1, 1.5, 2)); s.fill.target.position.set(...saltAt);
    }, { aperture: 0.004, focus: 0.37, maxblur: 0.012, bloomRadius: 0.3 });

  // 3. I was a stone they rowed home from a faraway land: a canoe carries a rai stone across the moon path.
  const tToo = W('too', 14.9), tSo = T.wordAfter('so', 16.3).s, tEvery = W('every', 17.5), tThen = W('then', 20.2);
  const C = SETS.canoe;
  const canoeX = (t) => 2.6 - 1.35 * (t - tStone);
  S(tStone, SEA, night((c, cam) => {
    const x = canoeX(c.t);
    const u = easeInOut(c.u);
    const aspectZoom = Math.pow(Math.max(1, (16 / 9) / c.aspect), 0.8);
    const d = lerp(27, 22.5, u) * aspectZoom;
    cam.position.set(C.x + x * 0.55 + lerp(1.2, -0.4, u), lerp(3.4, 3.0, u), C.z + d);
    cam.lookAt(C.x + x * 0.8, 2.3, C.z);
    cam.fov = 24;
  }), (s, c) => {
    s.moonAz = -1.5; s.moonEl = 7.2; s.moonSize = 8.5;
    s.boat.group.visible = true;
    s.boat.group.position.set(C.x + canoeX(c.t), -0.05 + 0.04 * Math.sin(c.t * 2.1), C.z);
    s.boat.group.rotation.set(0.012 * Math.sin(c.t * 1.7), 0, 0.01 * Math.sin(c.t * 2.3));
    s.boat.pose(T.beatsSince(c.t, 13.1) + 1);
    s.moonLight.intensity = 2.6; s.moonLight.target.position.set(C.x, 1, C.z); s.moonLight.castShadow = false;
    s.hemi.intensity = 0.12; s.scene.environmentIntensity = 0.25;
  }, { bloom: 0.45 });

  // 4. Too heavy to steal: the stone on the shore, the full moon framed in its hole.
  const B = SETS.beach;
  const hole = [B.x, B.y + 2.1, B.z];
  const axis = { x: 0, y: 1.55, z: 26 };
  const HOLE_R = 0.56, YAW = 0.2;
  const al = Math.hypot(axis.x, axis.y, axis.z);
  const dir = [axis.x / al, axis.y / al, axis.z / al];
  S(tToo, SEA, night((c, cam) => {
    const d = lerp(26.5, 23.5, easeOut(c.u, 1.6));
    const aspectZoom = Math.pow(Math.max(1, (16 / 9) / c.aspect), 0.5);
    cam.position.set(hole[0] - dir[0] * d * aspectZoom, hole[1] - dir[1] * d * aspectZoom, hole[2] - dir[2] * d * aspectZoom);
    cam.lookAt(hole[0], hole[1] + 0.05, hole[2]);
    cam.fov = 13;
  }), (s, c) => {
    s.moonAz = 180; s.moonEl = (Math.asin(dir[1]) * 180) / Math.PI; s.moonSize = 1.62; s.moonGain = 1.45;
    s.skyU.uHalo.value = 0.006; s.halo.visible = false;
    s.seaU.uGlint.value = 0.9;
    s.beach.visible = true;
    s.hero.material.normalScale.set(0.6, 0.6);
    s.hero.rotation.set(Math.PI / 2, YAW, 0, 'YXZ');
    s.moonLight.intensity = 3.2; s.moonLight.target.position.set(hole[0], 0, hole[2] - 14);
    s.shadowAround({ x: hole[0], y: 0, z: hole[2] - 14 }, 22);
    s.fill.intensity = 0.95; s.fill.color.set(0xe8e2d4); s.fill.position.set(hole[0] - 26, hole[1] + 9, hole[2] - 12); s.fill.target.position.set(...hole);
    s.hemi.intensity = 0.45;
  }, { bloom: 0.5, shake: 0.0015, aperture: 0.00008, focus: 25, maxblur: 0.004 });

  // 5. So the whole island kept count: rise up and back over the island and its ring of stones.
  const I = SETS.island;
  S(tSo, SEA, night(moveCam({ from: add(I, 3, 10, 27), to: add(I, 9, 31, 49), look: add(I, 0, 1.6, 0), look2: add(I, 0, 0.6, -2), fov: [34, 35], ease: easeInOut })),
    (s, c) => {
      s.moonAz = 68; s.moonEl = 24; s.moonSize = 7;
      s.island.visible = true;
      s.moonLight.intensity = 3.0; s.moonLight.color.set(0xeae4d4); s.moonLight.target.position.set(I.x, 0, I.z);
      s.shadowAround({ x: I.x, y: 0, z: I.z }, 55);
      s.hemi.intensity = 0.28;
    }, { bloom: 0.45 });

  // 6. Every name, every owner, every stone, every amount: threads of light link the stones, one set per "every".
  const hits = [tEvery];
  while (hits.length < 4) hits.push(T.wordAfter('every', hits[hits.length - 1] + 0.15).s);
  S(tEvery, SEA, night(orbitCam({ target: add(I, 0, 1.6, 0), dist: [31, 27], az: [14, 34], el: [52, 58], fov: 36, ease: easeInOut })),
    (s, c) => {
      s.moonAz = 68; s.moonEl = 24; s.moonSize = 7;
      s.island.visible = true;
      s.moonLight.intensity = 3.0; s.moonLight.color.set(0xeae4d4); s.moonLight.target.position.set(I.x, 0, I.z);
      s.shadowAround({ x: I.x, y: 0, z: I.z }, 55);
      s.hemi.intensity = 0.28;
      s.ledger(c.t, hits);
      const glow = clamp((c.t - hits[3] - 0.25) / 0.5);
      s.warm.intensity = 14 * glow; s.warm.position.set(I.x, 5, I.z);
    }, { bloom: 0.45 });

  // 7. Then they dug me up as gold from the dark underground: sink through the strata to a gold vein; the nugget flares on "gold".
  const tGold = W('gold', 21), tHard = W('hard', 22.9), tSo2 = T.wordAfter('so', 24.3).s, tKings = W('kings', 25.5);
  S(tThen, EARTH, (c, cam, st) => {
    const N = st.nuggetPos;
    const e = easeInOut(clamp((c.t - tThen) / (tGold - 0.05 - tThen)));
    const push = easeInOut(clamp((c.t - tGold) / (tHard - tGold)));
    const aspectZoom = Math.pow(Math.max(1, (16 / 9) / c.aspect), 0.8);
    const y = lerp(0.45, N.y + 0.22, e);
    cam.position.set(lerp(0.2, N.x - 0.25, e), y + push * 0.05, lerp(6.2, 2.4, push) * aspectZoom);
    cam.lookAt(lerp(0.2, N.x - 0.05, e), y - 0.12 - 0.08 * e, 0);
    cam.fov = 40;
  }, (s, c) => {
    const near = clamp((c.t - tThen) / (tGold - tThen));
    const fl = c.t >= tGold ? pulse(c.t - tGold, 2.6) : 0;
    s.U.uGlow.value = 0.25 + 0.75 * smooth(near) + 0.15 * Math.sin(c.t * 5) * (c.t > tGold ? 1 : 0);
    s.U.uFlare.value = fl;
    s.nugget.material.emissiveIntensity = 0.05 + 0.25 * smooth(near) + 3.0 * fl;
    s.glow.intensity = 1.5 + 5 * smooth(near) + 18 * fl;
  }, { bloom: 0.6 });

  // 8. Hard to make, hard to fake: molten gold pours from a crucible into a blank mould.
  S(tHard, FORGE, orbitCam({ target: [-0.42, 0.62, 0], dist: [4.7, 4.1], az: [24, 15], el: [5, 9], fov: 34, ease: easeOut }),
    (s, c) => {
      s.forge.visible = true;
      s.pour(c.t, clamp((c.t - tHard + 0.35) / 1.75), 1);
    }, { bloom: 0.55 });

  // 9. So the whole world came around: the cooled blank spins like a gold planet; coins come in from the dark to circle it.
  S(tSo2, FORGE, orbitCam({ target: [0, 0, 0], dist: [8.6, 7.4], az: [-6, 6], el: [11, 15], fov: 34, ease: easeOut }),
    (s, c) => {
      s.planet.visible = true;
      s.blank.rotation.set(0.35, c.t * 4.2, 0.2);
      s.orbit(c.t, clamp((c.t - tSo2 + 0.2) / (tKings - tSo2)));
    }, { bloom: 0.35 });

  // 10. Kings put their faces on me, stamped me: the die comes down on the blank; the king's face is struck.
  const tStamped = W('stamped', 27), tSwore = W('swore', 27.8), tBut = W('but', 28.2), tWar = W('war', 29), tMore = W('more', 30.3);
  const Z0 = 0.35;
  const dieY = (t) => {
    const contact = 1.37;
    if (t < tStamped - 0.2) return lerp(3.05, 2.75, clamp((t - tKings) / (tStamped - 0.2 - tKings)));
    if (t < tStamped) return lerp(2.75, contact, easeIn((t - tStamped + 0.2) / 0.2, 2.2));
    return contact + 1.5 * easeOut(clamp((t - tStamped - 0.06) / 0.5), 2.5);
  };
  S(tKings, 'gold', (c, cam) => {
    orbitCam({ target: (cc) => [0, lerp(0.95, 0.72, easeInOut(cc.u)), 0], dist: [5.2, 4.35], az: [32, 20], el: [2, 7], fov: 34, ease: easeInOut })(c, cam);
    const k = c.t > tStamped ? pulse(c.t - tStamped, 9) : 0;
    cam.position.y += (Math.sin(c.t * 91) * 0.03 + Math.sin(c.t * 57) * 0.02) * k;
    cam.position.x += Math.sin(c.t * 73) * 0.03 * k;
  }, (s, c) => {
    const struck = c.t >= tStamped;
    s.blankCoin.visible = !struck;
    s.blankCoin.position.set(0, 0.09, 0); s.blankCoin.rotation.set(-Math.PI / 2, 0, Z0);
    s.coin.visible = struck;
    s.coin.position.set(0, 0.09, 0); s.coin.rotation.set(-Math.PI / 2, 0, Z0);
    s.coin.setEmissive([1, 0.62, 0.25], struck ? 0.8 * pulse(c.t - tStamped, 8) : 0);
    s.die.visible = true;
    s.die.position.set(0, dieY(c.t), 0);
    s.burst(c.t, tStamped, [0, 0.18, 0], 1.0);
    s.key.position.set(-3.5, 4.5, 3.5); s.key.target.position.set(0, 0.2, 0);
  }, { bloom: 0.4 });

  // 11. ...and swore: a close, admiring look at the new face. On "but" the light turns red.
  const redAt = (t) => smooth(clamp((t - tBut) / 0.3));
  const setRed = (s, k) => {
    s.key.color.setRGB(lerp(1, 1, k), lerp(0.886, 0.16, k), lerp(0.69, 0.07, k));
    s.rim.color.setRGB(lerp(1, 1, k), lerp(0.72, 0.18, k), lerp(0.42, 0.08, k));
    s.key.intensity = lerp(6, 9, k);
    s.rim.intensity = lerp(2.5, 4.5, k);
    s.scene.environmentIntensity = lerp(1, 0.22, k);
  };
  S(tSwore, 'gold', orbitCam({ target: [0.02, 0.09, 0.08], dist: [4.2, 3.75], az: [-24, -12], el: [50, 46], fov: 30, ease: easeOut }),
    (s, c) => {
      s.coin.position.set(0, 0.09, 0); s.coin.rotation.set(-Math.PI / 2, 0, Z0 + 0.04 * c.lt);
      s.key.position.set(-3.2 + c.lt * 1.4, 1.3, -3.6); s.key.target.position.set(0, 0.1, 0);
      setRed(s, redAt(c.t));
      s.key.intensity *= 0.55; s.rim.intensity *= 0.6;
      s.coin.setRelief(0.8);
    }, { aperture: 0.00012, focus: 3.95, maxblur: 0.005, threshold: 2.2, bloom: 0.25 });

  // 12. But a king with a war always wants a little more: in red light a blade comes down and nicks the edge on "more".
  const r = rng(11);
  const a0 = r() * Math.PI * 2, w0 = 0.12 + r() * 0.25, d0 = 0.05 + r() * 0.11;
  S(tWar, 'gold', (c, cam) => {
    const phi = a0 + Z0;
    const nx = Math.cos(phi), nz = -Math.sin(phi);
    const tx = nx * 0.75, tz = nz * 0.75;
    const nAz = (Math.atan2(nx, nz) * 180) / Math.PI;
    orbitCam({ target: [tx * 0.3, 0.3, tz * 0.3], dist: [4.4, 3.8], az: [nAz + 97, nAz + 93], el: [34, 38], fov: 32, ease: easeOut })(c, cam);
    const k = c.t > tMore ? pulse(c.t - tMore, 10) : 0;
    cam.position.y += Math.sin(c.t * 83) * 0.025 * k;
  }, (s, c) => {
    setRed(s, 1);
    s.key.position.set(3.2, 3.4, 2.6); s.key.target.position.set(0, 0.1, 0);
    s.key.intensity = 14 + 2.5 * Math.sin(c.t * 9.3) * Math.sin(c.t * 5.1);
    s.scene.environmentIntensity = 0.35;
    s.coin.position.set(0, 0.09, 0); s.coin.rotation.set(-Math.PI / 2, 0, Z0);
    const cut = c.t >= tMore;
    s.coin.setClip(cut ? 0.12 : 0);
    const phi = a0 + Z0;
    const R = 1 * (1 - d0);
    const rd = [Math.cos(phi), 0, -Math.sin(phi)], tg = [Math.sin(phi), 0, Math.cos(phi)];
    s.blade.visible = true;
    const yb = c.t < tMore - 0.12 ? lerp(1.9, 1.05, easeInOut(clamp((c.t - tWar) / (tMore - 0.12 - tWar)))) : lerp(1.05, 0.46, easeIn(clamp((c.t - tMore + 0.12) / 0.12), 2));
    s.blade.position.set(rd[0] * R, yb, rd[2] * R);
    s.blade.quaternion.setFromRotationMatrix(BASIS.makeBasis(V3a.set(...tg), V3b.set(...rd), V3c.set(0, 1, 0)));
    s.burst(c.t, tMore, [rd[0] * (R + 0.04), 0.17, rd[2] * (R + 0.04)], 0.45);
  }, { bloom: 0.45, tint: [1.12, 0.9, 0.84] });
}
