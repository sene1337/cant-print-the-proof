// VERSE 1 9.66-30.92 s. Owner: verse1 agent.
// Shell, salt, stone, ledger, gold, the king's face, and the first clip.
import * as THREE from 'three';
import { orbitCam, moveCam } from '../film.js';
import { clamp, lerp, smooth, easeOut, easeIn, easeInOut, easeOutBack, pulse, range, rng } from '../util.js';
import { seaStage, SETS } from '../stages/verse1-sea.js';
import { earthStage } from '../stages/verse1-earth.js';
import { forgeStage } from '../stages/verse1-forge.js';
import { mintStage } from '../stages/verse1-mint.js';

const SEA = 'verse1-sea', EARTH = 'verse1-earth', FORGE = 'verse1-forge', MINT = 'verse1-mint';

// Stage builders this section owns: { id: async (film) => stage }. Ids must be unique across the film.
export const stages = { [SEA]: seaStage, [EARTH]: earthStage, [FORGE]: forgeStage, [MINT]: mintStage };

const BASIS = new THREE.Matrix4(), V3a = new THREE.Vector3(), V3b = new THREE.Vector3(), V3c = new THREE.Vector3();
const add = (p, x, y, z) => (Array.isArray(p) ? [p[0] + x, p[1] + y, p[2] + z] : [p.x + x, p.y + y, p.z + z]);
// Night shots: place the camera, then hang the sky, moon and sea on it.
const night = (camFn) => (ctx, cam, stage) => { camFn(ctx, cam, stage); stage.follow(cam); };

// Add shots with S(t, stageId, cam, set, fx). Every shot must start inside this section's range.
export function shots(S, T) {
  const W = (w, after = 9.6) => T.wordAfter(w, after).s;
  const tShell = W('shell'), tI2 = T.wordAfter('I', 11.3).s, tSalt = W('salt'), tStone = W('stone');

  // 1. I was a shell on a string: a cowrie pendant turns slowly on its cord in front of a huge moon.
  //    Seen from a little below, so the toothed aperture on its flat underside reads from the first frame.
  const hang = add(SETS.shell, 0, 1.45, 0);
  S(9.66, SEA, night(orbitCam({ target: add(SETS.shell, 0, 1.345, 0), dist: [1.0, 0.8], az: [-10, 2], el: [-14, -11], fov: 30,
    look: (c) => add(SETS.shell, -0.11 - 0.02 * c.u, 1.37, 0), ease: easeOut })),
    (s, c) => {
      s.moonAz = -15; s.moonEl = 8.6; s.moonSize = 16; s.moonGain = 1.15;
      s.skyU.uHalo.value = 0.03; s.seaU.uGlint.value = 1.0;
      s.cowrie.group.visible = true;
      s.cowrie.group.position.set(...hang);
      s.cowrie.group.rotation.set(0.02 * Math.sin(c.t * 1.7), 0, 0.03 * Math.sin(c.t * 1.3 + 1));
      s.cowrie.holder.rotation.set(-0.34, 0, 0); // underside tipped toward us
      s.cowrie.spinner.rotation.set(0, -0.95 + c.lt * 0.26, 0);
      // moonlight bouncing up off the sea lights the white underside and the teeth
      s.fill.intensity = 1.1; s.fill.color.set(0xdfe8e6); s.fill.position.set(...add(SETS.shell, 0.4, 0.2, 1.6)); s.fill.target.position.set(...hang);
      s.moonLight.intensity = 3.2; s.moonLight.target.position.set(...hang); s.moonLight.castShadow = false;
    }, { fadeIn: 0.35, aperture: 0.00012, focus: 0.95, maxblur: 0.004, bloom: 0.3 });

  // 2. I was salt in your hand: irregular translucent salt crystals pour into a cupped hand,
  //    a dark silhouette against the moon's glitter path, rim-lit, the crystals glowing with the backlight.
  const saltAt = add(SETS.shell, 3, 0.5, 0);
  // (narrow frames: frame the palm and the stream, not the whole arm, so the camera barely pulls back)
  const saltCam = orbitCam({ target: add(saltAt, -0.01, 0.025, 0), dist: [0.36, 0.3], az: [26, 18], el: [13, 11], fov: 30, look: (c) => add(saltAt, -0.008, 0.04, 0), ease: easeOut });
  S(tI2, SEA, night((c, cam, st) => {
    const narrow = Math.max(1, (16 / 9) / c.aspect);
    saltCam({ ...c, aspect: (16 / 9) / Math.pow(narrow, 0.45) }, cam, st);
  }),
    (s, c) => {
      s.moonAz = -20; s.moonEl = 15; s.moonSize = 9;
      s.seaU.uGlint.value = c.aspect < 1 ? 0.7 : 1.2;
      s.salt.group.visible = true;
      s.salt.group.position.set(...saltAt);
      s.rock.visible = false; s.hand.visible = true;
      Object.assign(s.salt.P, { hmax: 0.028, smin: 0.0022, sadd: 0.0026, spread: 0.01, H: 0.26 });
      s.salt.pose(c.t - tI2 + 1.2);
      s.moonLight.intensity = 3.6; s.moonLight.target.position.set(...saltAt); s.moonLight.castShadow = false;
      s.hemi.intensity = 0.18;
      s.fill.intensity = 0.22; s.fill.position.set(...add(saltAt, 0.6, 0.8, 1.2)); s.fill.target.position.set(...saltAt);
    }, { aperture: 0.0045, focus: 0.38, maxblur: 0.014, bloomRadius: 0.35, bloom: 0.5 });

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

  // 5. So the whole island kept count: from eye level among the big stones, rise up and back over the ring.
  const I = SETS.island;
  S(tSo, SEA, night(moveCam({ from: add(I, 3.5, 3.4, 18.5), to: add(I, 6.5, 10.5, 27), look: add(I, -0.5, 2.6, 0), look2: add(I, 0, 1.2, -1.5), fov: [40, 38], ease: easeInOut })),
    (s, c) => {
      s.moonAz = 118; s.moonEl = 17; s.moonSize = 7;
      s.island.visible = true;
      s.moonLight.intensity = 4.4; s.moonLight.color.set(0xefe8d8); s.moonLight.target.position.set(I.x, 0, I.z);
      s.shadowAround({ x: I.x, y: 0, z: I.z }, 40);
      s.hemi.intensity = 0.12;
    }, { bloom: 0.4, contrast: 1.12 });

  // 6. Every name, every owner, every stone, every amount: threads of light link the stones, one set per "every".
  const hits = [tEvery];
  while (hits.length < 4) hits.push(T.wordAfter('every', hits[hits.length - 1] + 0.15).s);
  S(tEvery, SEA, night(orbitCam({ target: add(I, 0, 1.8, 0), dist: [33, 29], az: [14, 34], el: [50, 56], fov: 38, ease: easeInOut })),
    (s, c) => {
      s.moonAz = 118; s.moonEl = 22; s.moonSize = 7;
      s.island.visible = true;
      s.moonLight.intensity = 4.0; s.moonLight.color.set(0xefe8d8); s.moonLight.target.position.set(I.x, 0, I.z);
      s.shadowAround({ x: I.x, y: 0, z: I.z }, 40);
      s.hemi.intensity = 0.14;
      s.ledger(c.t, hits);
      const glow = clamp((c.t - hits[3] - 0.25) / 0.5);
      s.warm.intensity = 14 * glow; s.warm.position.set(I.x, 5, I.z);
    }, { bloom: 0.45 });

  // 7. Then they dug me up as gold from the dark underground: from the grass line, sink down the cut face
  //    through soil, clay and broken rock into dark bedrock and a quartz seam; the nugget flares on "gold".
  const tGold = W('gold', 21), tHard = W('hard', 22.9), tSo2 = T.wordAfter('so', 24.3).s, tKings = W('kings', 25.5);
  S(tThen, EARTH, (c, cam, st) => {
    const N = st.nuggetPos;
    const e = easeInOut(clamp((c.t - tThen) / (tGold - 0.05 - tThen)));
    const push = easeInOut(clamp((c.t - tGold) / (tHard - tGold)));
    const aspectZoom = Math.pow(Math.max(1, (16 / 9) / c.aspect), 0.8);
    const y = lerp(-1.25, N.y + 0.2, e);
    cam.position.set(lerp(0.1, N.x - 0.3, e), y + push * 0.02, lerp(5.6, 2.2, push) * aspectZoom);
    cam.lookAt(lerp(0.1, N.x - 0.08, e), y - 0.1 - 0.1 * e, 0);
    cam.fov = 40;
  }, (s, c) => {
    const near = clamp((c.t - tThen) / (tGold - tThen));
    const fl = c.t >= tGold ? pulse(c.t - tGold, 2.6) : 0;
    s.U.uGlow.value = 0.2 + 0.8 * smooth(near) + 0.15 * Math.sin(c.t * 5) * (c.t > tGold ? 1 : 0);
    s.U.uFlare.value = fl;
    s.nugget.material.emissiveIntensity = 0.03 + 0.1 * smooth(near) + 2.6 * fl;
    s.glow.intensity = 1 + 3.5 * smooth(near) + 16 * fl;
  }, { bloom: 0.55 });

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

  // 10. Kings put their faces on me: the coin's own view. Looking up from the blank, the die comes down,
  //     the king's portrait cut into its steel face in mirror relief, filling the frame.
  const tStamped = W('stamped', 27), tSwore = W('swore', 27.8), tBut = W('but', 28.2), tWar = W('war', 29), tMore = W('more', 30.3);
  const tStrikeCut = T.beats[T.beatIndex(tStamped)]; // the last beat before "stamped"
  const Z0 = 0.35;
  const faceY = (u) => lerp(3.95, 3.0, u);
  S(tKings, MINT, (c, cam) => {
    const u = easeInOut(c.u);
    const aspectZoom = Math.pow(Math.max(1, (16 / 9) / c.aspect), 0.8);
    cam.position.set(0.0, 0.25, 0.85);
    cam.up.set(0, 0, -1);
    cam.lookAt(0, faceY(u), 0.05);
    cam.fov = (2 * Math.atan(Math.tan((40 * Math.PI) / 360) * aspectZoom) * 180) / Math.PI;
  }, (s, c) => {
    const u = easeInOut(c.u);
    const fy = faceY(u);
    s.blankCoin.visible = false;
    s.die.position.set(0, fy + 1.2, 0);
    s.die.rotation.set(0, Math.PI + 0.12 - 0.12 * u, 0);
    // one broad raking light from the top of the frame, grazing the face
    s.rake.intensity = 70; s.rake.angle = 0.7; s.rake.penumbra = 0.9; s.rake.color.set(0xe6ecf2);
    s.rake.position.set(0.4, fy - 1.1, -3.4); s.rake.target.position.set(0, fy, 0);
    s.key.intensity = 0;
    s.scene.environmentIntensity = 0.6;
  }, { bloom: 0.3, shake: 0.002, vignette: 0.6 });

  // 10b. ...stamped me: a close side view; the die slams down on "stamped", sparks fly, and it lifts off
  //      the new face.
  const dieY = (t) => {
    const contact = 1.37;
    if (t < tStamped - 0.2) return lerp(2.4, 2.15, clamp((t - tStrikeCut) / (tStamped - 0.2 - tStrikeCut)));
    if (t < tStamped) return lerp(2.15, contact, easeIn((t - tStamped + 0.2) / 0.2, 2.2));
    return contact + 1.8 * easeOut(clamp((t - tStamped - 0.06) / 0.55), 2.5);
  };
  S(tStrikeCut, MINT, (c, cam) => {
    const after = easeInOut(clamp((c.t - tStamped - 0.1) / 0.55));
    orbitCam({ target: [0, lerp(0.42, 0.2, after), 0], dist: lerp(3.0, 2.85, after), az: lerp(26, 20, after), el: lerp(14, 34, after), fov: 34 })(c, cam);
    const k = c.t > tStamped ? pulse(c.t - tStamped, 9) : 0;
    cam.position.y += (Math.sin(c.t * 91) * 0.03 + Math.sin(c.t * 57) * 0.02) * k;
    cam.position.x += Math.sin(c.t * 73) * 0.03 * k;
  }, (s, c) => {
    const struck = c.t >= tStamped;
    s.blankCoin.visible = !struck;
    s.blankCoin.rotation.set(-Math.PI / 2, 0, Z0);
    s.coin.visible = struck;
    s.coin.rotation.set(-Math.PI / 2, 0, Z0);
    s.coin.setEmissive([1, 0.62, 0.25], struck ? 0.8 * pulse(c.t - tStamped, 8) : 0);
    s.die.position.set(0, dieY(c.t), 0);
    s.burst(c.t, tStamped, [0, 0.18, 0], 1.0);
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
  S(tSwore, MINT, orbitCam({ target: [0.02, 0.09, 0.08], dist: [4.2, 3.75], az: [-24, -12], el: [50, 46], fov: 30, ease: easeOut }),
    (s, c) => {
      s.die.visible = false; s.blankCoin.visible = false;
      s.coin.visible = true; s.coin.rotation.set(-Math.PI / 2, 0, Z0 + 0.04 * c.lt);
      s.key.position.set(-3.2 + c.lt * 1.4, 2.0, -3.6); s.key.target.position.set(0, 0.1, 0);
      setRed(s, redAt(c.t));
      s.key.intensity *= 0.55; s.rim.intensity *= 0.6;
      s.coin.setRelief(0.8);
    }, { aperture: 0.00012, focus: 3.95, maxblur: 0.005, threshold: 2.2, bloom: 0.25 });

  // 12. But a king with a war always wants a little more: in red light a steel blade comes down past the
  //     coin's edge; on "more" it shears off a sliver of gold, which flies with the sparks. Verse 2 continues.
  const tLittle = W('little', 30.2);
  // camera azimuth (degrees) for the blade shot: 3/4 on to the blade, which stands at the notch
  const notchDir = (n) => { const phi = n.a + Z0; return [Math.cos(phi), 0, -Math.sin(phi)]; };
  const warAz = (c, n) => { const rd = notchDir(n); return (Math.atan2(rd[0], rd[2]) * 180) / Math.PI + lerp(58, 50, easeOut(c.u)); };
  S(tWar, MINT, (c, cam) => {
    const n = c.film.stages.get(MINT).notch;
    const rd = notchDir(n);
    const az = warAz(c, n);
    orbitCam({ target: [rd[0] * 0.3, 0.3, rd[2] * 0.3], dist: [4.6, 4.0], az, el: [34, 38], fov: 32, ease: easeOut })(c, cam);
    const k = c.t > tMore ? pulse(c.t - tMore, 10) : 0;
    cam.position.y += Math.sin(c.t * 83) * 0.025 * k;
  }, (s, c, cam) => {
    setRed(s, 1);
    s.die.visible = false; s.blankCoin.visible = false;
    const azr = (warAz(c, s.notch) * Math.PI) / 180;
    const camDir = [Math.sin(azr), 0, Math.cos(azr)];
    // key from above, a little right of the camera (its mirror bounce misses the lens); weak rim from the side
    const ka = azr + (22 * Math.PI) / 180, ke = (40 * Math.PI) / 180;
    s.key.position.set(5.3 * Math.sin(ka) * Math.cos(ke), 5.3 * Math.sin(ke), 5.3 * Math.cos(ka) * Math.cos(ke));
    s.key.target.position.set(0, 0.1, 0);
    s.key.intensity = 12 + 2 * Math.sin(c.t * 9.3) * Math.sin(c.t * 5.1);
    const ra = azr + (105 * Math.PI) / 180;
    s.rim.position.set(5 * Math.sin(ra), 1.8, 5 * Math.cos(ra));
    s.rim.intensity = 2.2;
    s.scene.environmentIntensity = 0.3;
    // the red haze stands behind the blade, facing us
    {
      const n0 = s.notch, rd0 = notchDir(n0), ch = 1 - n0.d;
      s.haze.visible = true;
      s.haze.position.set(rd0[0] * ch - camDir[0] * 2.2, 0.004, rd0[2] * ch - camDir[2] * 2.2);
      s.haze.scale.set(6, 6, 1);
    }
    s.coin.visible = true;
    s.coin.rotation.set(-Math.PI / 2, 0, Z0);
    const cut = c.t >= tMore;
    s.coin.setClip(cut ? 0.12 : 0);
    const n = s.notch;
    const phi = n.a + Z0;
    const rd = [Math.cos(phi), 0, -Math.sin(phi)], tg = [Math.sin(phi), 0, Math.cos(phi)];
    const chord = 1 - n.d;
    // the blade hangs, then drops on "little" and shears through on "more"
    const yb = c.t < tLittle ? lerp(1.1, 0.8, easeInOut(clamp((c.t - tWar) / (tLittle - tWar))))
      : lerp(0.8, 0.0, easeIn(clamp((c.t - tLittle) / (tMore - tLittle)), 2.4));
    s.blade.visible = true;
    s.blade.position.set(rd[0] * chord, yb, rd[2] * chord);
    s.blade.quaternion.setFromRotationMatrix(BASIS.makeBasis(V3a.set(...tg), V3b.set(0, 1, 0), V3c.set(...rd)));
    // a bright back light on the steel, and the red key on the coin
    s.bladeLight.intensity = 0;
    s.bladeLight.position.set(rd[0] * 3.5 - tg[0] * 1.5, 2.6, rd[2] * 3.5 - tg[2] * 1.5);
    s.bladeLight.target.position.set(rd[0] * chord, 0.6, rd[2] * chord);
    // the sliver: part of the coin until the cut, then it flies off, tumbling
    s.sliver.visible = cut;
    if (cut) {
      const dt = c.t - tMore;
      const mid = n.mid;
      // centre of the sliver in world space (coin lies flat, its local xy maps to world x, -z after Z0 turn)
      const la = Math.atan2(mid.y, mid.x) + Z0, lr = Math.hypot(mid.x, mid.y);
      const cx = Math.cos(la) * lr, cz = -Math.sin(la) * lr;
      s.sliver.position.set(cx + rd[0] * 1.6 * dt, 0.09 + 1.1 * dt - 4.9 * dt * dt, cz + rd[2] * 1.6 * dt);
      s.sliver.rotation.set(-Math.PI / 2, 0, Z0);
      s.sliver.rotateOnWorldAxis(V3a.set(...tg), -9 * dt);
    }
    s.burst(c.t, tMore, [rd[0] * (chord + 0.04), 0.17, rd[2] * (chord + 0.04)], 0.5);
  }, { bloom: 0.45, tint: [1.12, 0.9, 0.84] });
}
