// CHORUS x3 (0:30.92, 1:24.40, 2:34.84). The film's thesis: paper is endless, proof is finite.
// Each chorus has the same beats (pen, clock, storm, printing, the block, the 21,000,000) seen a new way:
// chorus 1 introduces them, chorus 2 escalates (the printing runs hot), chorus 3 answers with the chain.
import { orbitCam, moveCam } from '../film.js';
import { clamp, lerp, smooth, easeOut, easeIn, easeInOut, easeOutBack, pulse, range, hash1 } from '../util.js';
import { NOTE } from '../props/notes.js';
import { monumentStage } from '../stages/monument.js';
import { decreeStage, cityStage, penProofStage } from '../stages/chorus-extras.js';

export const stages = { monument: monumentStage, decree: decreeStage, city: cityStage, 'pen-proof': penProofStage };

export function shots(S, T) {
  chorus(S, T, 1, T.wordAfter('stroke', 30).s, T.wordAfter('so', 49).s);
  chorus(S, T, 2, T.wordAfter('stroke', 84).s, 102.26);
  chorus(S, T, 3, T.wordAfter('stroke', 154).s, 172.6);
}

const PEN_AXIS = [0.42, 0.82, 0.42];
// The pen's frame: A along the barrel, Z out of the nib's top face, X to its side.
const norm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
const PEN_A = norm(PEN_AXIS);
const PEN_Z = norm([0 - PEN_A[1] * PEN_A[0], 1 - PEN_A[1] * PEN_A[1], 0 - PEN_A[1] * PEN_A[2]]);
const PEN_X = norm([PEN_A[1] * PEN_Z[2] - PEN_A[2] * PEN_Z[1], PEN_A[2] * PEN_Z[0] - PEN_A[0] * PEN_Z[2], PEN_A[0] * PEN_Z[1] - PEN_A[1] * PEN_Z[0]]);

// Print grid layout for 2^k notes: a perfect rectangle whose shape alternates with k.
function gridDims(k) {
  const cols = Math.pow(2, Math.floor(k / 2)), rows = Math.pow(2, Math.ceil(k / 2));
  return { cols, rows, w: cols * (NOTE.W + 0.08), h: rows * (NOTE.H + 0.08) };
}
function gridPos(i, k) {
  const { cols, rows } = gridDims(k);
  const cx = i % cols, cy = Math.floor(i / cols);
  return [(cx - (cols - 1) / 2) * (NOTE.W + 0.08), (cy - (rows - 1) / 2) * (NOTE.H + 0.08)];
}

function chorus(S, T, n, t0, tEnd) {
  const w = (word) => T.wordAfter(word, t0).s;
  const tStroke = t0, tAgain = w('again,'), tTurned = w('turned'), tInto = w('into'), tPaper = w('paper'), tWind = w('wind.');
  const tThey = T.wordAfter('they', tWind - 0.1).s, tCant = w("can't"), tProof = w('proof.'), t21 = w('twenty-one'), tTruth = w("that's");
  const tPrint2 = T.wordAfter('print', tCant).s;
  const beatAfter = (t) => T.beats[T.beatIndex(t) + 1];

  // Collect cuts, then drop any shot too short to read (the choruses are not sung identically).
  const cuts = [];
  const C = (t, stage, cam, set, fx) => cuts.push({ t, stage, cam, set, fx });

  if (n === 1) {
    // 1. Stroke of a pen: the gold nib touches down on the desk and the signature begins in green light.
    const penK = (t) => easeInOut(clamp((t - tStroke) / 3.4)) * 0.3;
    C(tStroke, 'paper', (c, cam) => {
      // In front of the nib's top face, so we see the gold nib touch down and the green line leave it.
      const p = c.film.stages.get('paper').curve.getPointAt(penK(c.t));
      const A = PEN_A, Z = PEN_Z, X = PEN_X, side = n === 2 ? -1 : 1;
      const o = 6.2 - c.lt * 0.35;
      cam.position.set(p.x + Z[0] * o + X[0] * 2.4 * side + A[0] * 1.2, p.y + Z[1] * o + 0.4, p.z + Z[2] * o + X[2] * 2.4 * side + A[2] * 1.2);
      cam.lookAt(p.x + A[0] * 1.3 - 0.4 * side, p.y + A[1] * 1.3, p.z + A[2] * 1.3);
      cam.fov = 32;
    }, (s, c) => {
      s.desk.visible = true; s.lamp.visible = true;
      const p = s.drawInk(penK(c.t));
      s.pen.visible = true;
      s.posePen(s.pen, p, PEN_AXIS);
      s.dust.visible = false;
      s.key.intensity = 0.45; s.back.intensity = 1.6; s.lamp.intensity = 3;
      s.scene.fog.density = 0.004;
    }, { bloom: 0.5, threshold: 1.0, bloomRadius: 0.3, aperture: 0.00018, focus: 6.4, maxblur: 0.008, tint: [1.02, 1.0, 0.96] });

    // 2. Wide: the flourish races across the dark desk.
    const kWide = (t) => lerp(0.3, 1, easeInOut(clamp((t - (tStroke + 1.9)) / Math.max(0.6, tAgain - tStroke - 1.9))));
    C(beatAfter(tStroke + 1.6), 'paper', orbitCam({ target: [0, 0, -0.4], dist: [14, 12.5], az: n === 2 ? [-14, -6] : [6, -2], el: [74, 70], fov: 34 }),
      (s, c) => {
        s.desk.visible = true; s.lamp.visible = true;
        const p = s.drawInk(kWide(c.t));
        s.pen.visible = true; s.posePen(s.pen, p, PEN_AXIS); s.pen.scale.setScalar(0.62);
        s.dust.visible = false;
      }, { bloom: 0.55, threshold: 1.0, bloomRadius: 0.3 });

    // 3. They did it again: notes peel off the wet ink and lift into the air.
    C(tAgain - 0.3, 'paper', orbitCam({ target: [1.5, 0.6, -0.4], dist: [8.5, 7.2], az: n === 2 ? [-40, -30] : [30, 42], el: [16, 22], fov: 32 }),
      (s, c) => {
        s.desk.visible = true; s.lamp.visible = true;
        s.drawInk(1);
        s.dust.visible = false;
        s.cloud.visible = true;
        s.cloud.setTime(c.t);
        const N = n === 1 ? 180 : 320;
        s.cloud.layout(N, (i, d) => {
          const u = (i + 0.5) / N;
          const a = clamp((c.lt - u * 1.1) / 1.5);
          if (a <= 0) return false;
          const p = s.curve.getPointAt(u);
          d.position.set(p.x + a * 1.2, 0.06 + a * a * 3.5 + a * 0.4, p.z + a * 1.6);
          d.rotation.set(-Math.PI / 2 + a * 3 + i, a * 2.5, a * 2 + i * 0.3);
          d.scale.setScalar(0.34 * Math.min(1, a * 5));
        });
      }, { bloom: 0.5, threshold: 1.0, bloomRadius: 0.3 });
  } else if (n === 2) {
    // 1-3 (chorus 2). The pen signs a decree; then signed decrees rain down onto a stack that keeps growing.
    const tThey1 = T.wordAfter('they', tStroke).s;
    const signK = (t) => easeInOut(clamp((t - tStroke - 0.15) / 1.7));
    C(tStroke, 'decree', (c, cam) => {
      const u = easeInOut(clamp(c.lt / 1.6));
      cam.position.set(lerp(-0.5, -0.75, u), lerp(1.9, 1.15, u), lerp(2.2, 1.95, u));
      cam.lookAt(lerp(0.1, 0.25, u), 0.02, lerp(0.05, 0.62, u));
      cam.fov = lerp(32, 27, u);
    }, (s, c) => {
      s.sheet.visible = true;
      s.posePen(s.sign(signK(c.t)), PEN_AXIS);
    }, { bloom: 0.45, aperture: 0.00025, focus: 1.8, maxblur: 0.008 });
    const tTurned1 = w('turned'), NS = 380, PRE = 30, BASE = [3.2, 0, 0];
    const landAt = (i) => (i < PRE ? -Infinity : tThey1 + (tTurned1 - 0.1 - tThey1) * Math.sqrt((i - PRE + 1) / NS));
    const heightAt = (t) => { let lo = PRE, hi = PRE + NS; if (t < landAt(PRE)) return PRE * 0.014; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (landAt(m - 1) <= t) lo = m; else hi = m - 1; } return lo * 0.014; };
    C(tThey1, 'decree', (c, cam) => {
      const h = heightAt(c.t);
      cam.position.set(BASE[0] + 3.0, 0.4 + h * 0.45, 3.2);
      cam.lookAt(BASE[0], 0.2 + h * 0.8, 0);
      cam.fov = 36;
    }, (s, c) => {
      s.stack.visible = true;
      s.layoutStack(c.t, landAt, BASE);
      s.sheet.visible = true; s.sign(1);
    }, { bloom: 0.4, punch: 1.8 });
  } else {
    // 1-3 (chorus 3). The pen tries to sign the bronze block: the ink beads up and won't take; on "again" the nib snaps.
    const tThey1 = T.wordAfter('they', tStroke).s, tPen = w('pen,'), tAgain2 = w('again,');
    const TOP = 3.0;
    const nibX = (t) => lerp(-0.9, 0.5, easeInOut(clamp((t - tStroke) / (tThey1 - tStroke))));
    const drops = [];
    for (let i = 0; i < 12; i++) {
      const u = (i + 0.5) / 12;
      drops.push({ t0: tStroke + u * (tThey1 - tStroke), x: lerp(-0.9, 0.5, easeInOut(u)) - 0.06, z: 0.3 + (hash1(i) - 0.5) * 0.08, r: 0.03 + hash1(i + 9) * 0.03, wait: 0.9 + hash1(i + 3) * 1.4, dx: (hash1(i + 5) - 0.3) * 0.6, dz: 0.6 + hash1(i + 7) * 0.5 });
    }
    for (let i = 0; i < 10; i++) {
      const a = hash1(i + 40) * Math.PI * 2;
      drops.push({ t0: tAgain2 + 0.02 + i * 0.01, x: 0.5 + Math.cos(a) * 0.12, z: 0.3 + Math.sin(a) * 0.12, r: 0.025 + hash1(i + 50) * 0.03, wait: 0.4 + hash1(i + 60) * 0.6, dx: Math.cos(a) * 0.8, dz: Math.sin(a) * 0.8 + 0.3 });
    }
    C(tStroke, 'pen-proof', (c, cam) => {
      const x = nibX(c.t);
      cam.position.set(x - 1.5, TOP + 1.75, 2.6);
      cam.lookAt(x + 0.3, TOP + 0.05, 0.15);
      cam.fov = 30;
    }, (s, c) => {
      const x = nibX(c.t);
      s.rim.intensity = 0.2;
      const skid = c.t > tPen ? pulse(c.t - tPen, 8) : 0;
      s.posePen([x, TOP + 0.005 + skid * 0.04, 0.3], PEN_AXIS);
      s.lay(c.t, drops);
      s.burst(c.t, tPen, [x, TOP + 0.02, 0.3], 0.6);
    }, { bloom: 0.45, aperture: 0.00018, focus: 3.5, maxblur: 0.008 });
    C(tThey1, 'pen-proof', orbitCam({ target: [0, 2.2, 0], dist: [8.2, 7.4], az: [28, 36], el: [24, 20], fov: 32 }),
      (s, c) => {
        // presses harder, then the nib snaps and the pen lifts away
        const press = clamp((c.t - tThey1) / (tAgain2 - tThey1));
        const snapped = c.t >= tAgain2;
        const bend = snapped ? 0.55 * easeOut(clamp((c.t - tAgain2) / 0.08)) : 0;
        const lift = snapped ? easeOut(clamp((c.t - tAgain2 - 0.1) / 0.6)) * 1.6 : 0;
        s.posePen([0.5 + Math.sin(press * 18) * 0.03 * press, TOP + 0.004 + lift, 0.3 + lift * 0.3], PEN_AXIS, bend);
        s.lay(c.t, drops);
        s.burst(c.t, tAgain2, [0.5, TOP + 0.03, 0.3], 1.2);
      }, { bloom: 0.5, punch: 2 });
  }

  // 4. Turned all your hours: the clock runs faster and faster. Chorus 2 is a gold pocket watch on its chain;
  //    chorus 3 looks up at the clock from below while the storm is already rising around it.
  const clockCam = n === 2 ? orbitCam({ target: [0, 0.6, 0], dist: [8.2, 6.6], az: [24, 14], el: [-4, 2], roll: [-8, -3], fov: 32 })
    : n === 3 ? orbitCam({ target: [0, 0.4, 0], dist: [7.6, 6.2], az: [-8, 6], el: [-22, -16], fov: 34 })
      : orbitCam({ target: [0, 0, 0], dist: [6.4, 5.4], az: [-12, -4], el: [4, 2], fov: 32 });
  C(tTurned, 'paper', clockCam,
    (s, c) => {
      s.clock.visible = true;
      if (n === 2) { s.watch.visible = true; s.clock.rotation.set(0.12, -0.25, 0.05); }
      const spin = c.lt * c.lt * (n === 1 ? 1.8 : 3.4);
      s.minHand.rotation.z = -spin * 6;
      s.hourHand.rotation.z = -spin * 0.5;
      if (n === 3) { s.cloud.visible = true; s.storm(c.t, { n: 1200, radius: 9, height: 7, wind: [1.5, 1.2, 0.3], scale: 0.9, clear: { from: [0, -2.2, 7.5], to: [0, 0.4, 0], r: 2.4 } }); }
    }, { aperture: 0.00012, focus: 5.6, maxblur: 0.006 });

  // 5. Into paper and wind: the clock bursts into notes that blow away.
  C(tInto, 'paper', orbitCam({ target: [0, 0, 0], dist: [6, 7.5], az: [-4, 4], el: [2, 0], fov: 34 }),
    (s, c) => {
      const burst = clamp((c.t - tPaper + 0.08) / 1.6);
      s.clock.visible = burst < 0.15;
      s.minHand.rotation.z = -(c.t - tTurned) * 12; s.hourHand.rotation.z = -(c.t - tTurned);
      s.cloud.visible = burst > 0;
      s.cloud.setTime(c.t);
      s.cloud.layout(1400, (i, d) => {
        const r = Math.sqrt((i + 0.5) / 1400) * 2, a = i * 2.39996;
        const x0 = Math.cos(a) * r, y0 = Math.sin(a) * r;
        const e = easeOut(burst, 2);
        const windU = clamp((c.t - tWind + 0.3) / 1.2);
        d.position.set(x0 * (1 + e * 3) + windU * windU * (8 + (i % 7)), y0 * (1 + e * 3) + e * 0.5, e * (2 + (i % 5) * 0.8));
        d.rotation.set(e * (i % 11), e * (i % 13) * 0.5, a + e * 3);
        d.scale.setScalar(0.22 + e * 0.1);
      });
    });

  // 6. The storm: fly through it. (Choruses 2 and 3 cut straight from the burst to their own "print the paper".)
  if (n === 1) C(tWind + 0.3, 'paper', moveCam({ from: [0, 0.5, 9], to: [0, 0.2, -4], look: [0, 0.3, 0], look2: [0, 0.2, -14], fov: 42, roll: n === 2 ? [0, 8] : [0, 0] }),
    (s, c) => {
      s.cloud.visible = true;
      s.storm(c.t, { n: n === 1 ? 4500 : 6000, radius: 12, height: 8, wind: n === 2 ? [4.5, 0.6, 1.4] : [2.5, 0.3, 0.8], scale: 1.2 });
      if (n === 2) { s.key.color.setRGB(1, 0.55, 0.45); s.back.color.setRGB(1, 0.35, 0.25); }
    }, { bloom: 0.6, tint: n === 2 ? [1.12, 0.94, 0.9] : [0.96, 1.02, 0.98] });

  if (n === 1) {
    // 7. They can print the paper: one note becomes two, four, eight... on every half beat.
    const half = (T.beats[T.beatIndex(tThey) + 1] - T.beats[T.beatIndex(tThey)]) / 2;
    const kMax = n === 2 ? 12 : 10;
    const printK = (t) => {
      const x = (t - tThey) / half;
      const k = Math.max(0, Math.min(kMax, Math.floor(x)));
      const f = k >= kMax ? 1 : clamp((x - Math.floor(x)) / 0.55);
      return { k, f: easeOut(f, 3) };
    };
    C(tThey, 'paper', (c, cam) => {
      const { k, f } = printK(c.t);
      const a = gridDims(k), b = gridDims(Math.min(kMax, k + 1));
      const fitW = (k < kMax ? lerp(a.w, b.w, f) : a.w), fitH = (k < kMax ? lerp(a.h, b.h, f) : a.h);
      const fovR = (36 * Math.PI) / 180;
      const d = Math.max(fitH / 2 / Math.tan(fovR / 2), fitW / 2 / Math.tan(fovR / 2) / c.aspect) * 1.12 + 0.6;
      cam.position.set(0.4, -0.5 - d * 0.05, d);
      cam.lookAt(0, 0, 0);
      cam.fov = 36; cam.far = d * 4;
    }, (s, c) => {
      const { k, f } = printK(c.t);
      const cnt = Math.pow(2, Math.min(kMax, k + 1));
      const old = Math.pow(2, k);
      s.cloud.visible = true;
      s.cloud.setTime(c.t);
      s.cloud.setFlutter(0.12);
      s.cloud.layout(k >= kMax ? old : cnt, (i, d) => {
        const to = gridPos(i, Math.min(kMax, k + 1));
        const from = i < old ? gridPos(i, k) : gridPos(i - old, k);
        const e = k >= kMax ? 1 : f;
        const p = k >= kMax ? gridPos(i, k) : [lerp(from[0], to[0], e), lerp(from[1], to[1], e)];
        d.position.set(p[0], p[1], i >= old && k < kMax ? (1 - e) * 0.3 : 0);
      });
      s.dust.visible = false;
      s.scene.fog.density = 0.0;
      s.key.intensity = 2.6;
    }, { bloom: 0.35, threshold: 1.0, shake: 0.002 });
  } else if (n === 2) {
    // 7 (chorus 2). They can print the paper: a city of cash rises in rings around the camera.
    const halfBeat = (T.beats[T.beatIndex(tThey) + 1] - T.beats[T.beatIndex(tThey)]) / 2;
    C(tThey, 'city', moveCam({ from: [0, 0.7, 9], to: [0, 15, 8], look: [0, 2.4, 0], look2: [0, 0, -12], fov: 40, ease: easeInOut }),
      (s, c) => { s.grow(c.t, tThey - 0.05, halfBeat); }, { bloom: 0.35, punch: 1.6 });
  } else {
    // 7 (chorus 3). They can print the paper: it flows past the chain like water past rocks.
    C(tThey, 'proof', moveCam({ from: [5.4, 3.0, 3.4], to: [3.8, 2.3, 2.6], look: [-6, -0.4, -0.6], look2: [-9, -0.4, -0.3], fov: 38 }),
      (s, c) => {
        s.chainGroup.visible = true;
        s.flow(c.t, { n: 1600, speed: 3 });
      }, { bloom: 0.5 });
  }

  // 8. They can't print the proof. A printer's copy of the block comes out as a paper box and collapses.
  //    Chorus 1: one copy. Chorus 2: two at once. Chorus 3: the block is the head of the chain.
  const tMillion = w('million.');
  const tryK = (t) => clamp((t - tPrint2 + 0.18) / Math.max(0.6, tProof - tPrint2 + 0.55));
  if (n < 3) {
    C(tCant - 0.26, 'proof', orbitCam({ target: [0.55, 0.1, 0], dist: [4.1, 3.5], az: n === 2 ? [10, 2] : [-26, -14], el: [12, 9], fov: 32 }),
      (s, c) => {
        const h = s.hero(n);
        h.rotation.set(0, n === 2 ? -0.25 : 0.35, 0);
        const k = tryK(c.t);
        s.paperAt(n === 2 ? 1 : 0, k, [0, 0, 0], [1.4, 0, 0.1], 0.3);
        if (n === 2) s.paperAt(3, clamp(k * 1.06), [0, 0, 0], [-1.4, 0, 0.15], -0.3);
        h.setGlow(1 + 1.1 * (c.t > tProof ? pulse(c.t - tProof, 2.6) : 0));
      }, { bloom: 0.6, threshold: 1.0 });
  } else {
    C(tCant - 0.26, 'proof', moveCam({ from: [3.6, 1.5, 4.2], to: [2.3, 0.95, 3.2], look: [-2.0, 0, 0], look2: [0.6, 0, 0.3], fov: 34 }),
      (s, c) => {
        s.chainGroup.visible = true;
        s.chainGroup.rotation.y = 0.12;
        s.floor.visible = true;
        s.paperAt(2, tryK(c.t), [0, 0, 0], [1.5, 0, 0.35], 0.25);
        s.chainBlocks[0].setGlow(1 + 1.1 * (c.t > tProof ? pulse(c.t - tProof, 2.6) : 0));
      }, { bloom: 0.6, threshold: 1.0 });
  }

  // 9-10. Twenty-one million. That's the truth. The number itself, cast in metal.
  // Frame the whole number, whatever the frame's shape: distance so its width and height fit with a margin.
  const fitNumber = (c, cam, { scale = 1, az = 0, el = 6, margin = 1.14, fov = 32, lift = 0.95 } = {}) => {
    const W = c.film.stages.get('monument').numerals.userData.width * scale, H = 2.2 * scale;
    const vf = (fov * Math.PI) / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * c.aspect);
    const d = Math.max((W * margin) / 2 / Math.tan(hf / 2), (H * margin) / 2 / Math.tan(vf / 2));
    const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180, ty = lift * scale;
    cam.position.set(Math.sin(a) * Math.cos(e) * d, ty + Math.sin(e) * d, Math.cos(a) * Math.cos(e) * d);
    cam.lookAt(0, ty, 0);
    cam.fov = fov; cam.far = Math.max(3000, d * 8);
  };
  if (n === 1) {
    // "Twenty-one": 2 and 1 rise out of the floor.
    const rise = (t, t0, i) => easeOutBack(clamp((t - t0 - i * 0.12) / 0.55), 1.4);
    C(t21, 'monument', orbitCam({ target: (c) => { const p = c.film.stages.get('monument').parts; const x = (p[0].userData.x0 + p[1].userData.x0 + p[1].userData.w) / 2; return [x, 0.8, 0]; }, dist: [6.2, 5.2], az: [-18, -8], el: [6, 4], fov: 30 }),
      (s, c) => {
        s.parts.forEach((p, i) => { p.visible = i < 2; });
        for (let i = 0; i < 2; i++) s.parts[i].position.y = -3.1 + 3.1 * rise(c.t, t21 - 0.05, i);
      }, { bloom: 0.45 });
    // "million": the ,000,000 slam down in three strikes; the camera pulls back until the whole number fills the frame.
    const beat = (T.beats[T.beatIndex(tMillion) + 1] - T.beats[T.beatIndex(tMillion)]);
    const drop = (t, t0) => { const u = clamp((t - t0) / 0.32); return 1 - u * u; };
    C(tMillion, 'monument', (c, cam) => {
      const u = easeOut(clamp(c.lt / 1.2), 2);
      fitNumber(c, cam, { az: lerp(-14, -4, u), el: lerp(4, 7, u), margin: lerp(0.62, 1.12, u) });
    }, (s, c) => {
      const groups = [[2, 3, 4, 5], [6, 7], [8, 9]];
      groups.forEach((g, gi) => g.forEach((i) => { s.parts[i].position.y = 3.2 * drop(c.t, tMillion + gi * beat * 0.5); }));
      const shake = pulse(c.t - tMillion, 10) + pulse(c.t - tMillion - beat * 0.5, 10) + pulse(c.t - tMillion - beat, 10);
      s.numerals.position.y = s.BASE - shake * 0.02;
    }, { bloom: 0.4, punch: 2.5 });
    // "That's the truth": the whole number, and a light passing across its face.
    C(tTruth, 'monument', (c, cam) => fitNumber(c, cam, { az: lerp(-2, 2, c.u), el: 6, margin: lerp(1.14, 1.06, c.u) }),
      (s, c) => {
        const u = clamp((c.t - tTruth) / 1.1);
        s.sweep.intensity = 110; s.sweep.position.set(-9 + u * 18, 5, 7); s.sweep.target.position.set(-7 + u * 14, 0.8, 0);
      }, { bloom: 0.4 });
  } else if (n === 2) {
    // Paper is thrown at the number; it doesn't move. Then the air clears.
    C(t21, 'monument', (c, cam) => fitNumber(c, cam, { az: lerp(14, 6, c.u), el: 7, margin: 1.2 }),
      (s, c) => {
        s.storm(c.t, t21 - 0.6, { n: 300, speed: 12 });
        s.rim.color.setRGB(1, 0.3, 0.2); s.rim.intensity = 3;
      }, { bloom: 0.4, tint: [1.08, 0.95, 0.92] });
    C(tTruth, 'monument', (c, cam) => fitNumber(c, cam, { az: lerp(-4, 0, c.u), el: 5, margin: lerp(1.16, 1.06, c.u) }),
      (s, c) => {
        const u = clamp((c.t - tTruth) / 1.2);
        s.sweep.intensity = 110; s.sweep.position.set(9 - u * 18, 5, 7); s.sweep.target.position.set(7 - u * 14, 0.8, 0);
      }, { bloom: 0.42 });
  } else {
    // At world scale, at dawn: the camera rises as the sun comes up, and the whole number stays in frame.
    C(t21, 'monument', (c, cam) => {
      const u = easeInOut(clamp((c.t - t21) / (tEnd - t21)));
      fitNumber(c, cam, { scale: 2.4, az: lerp(-12, 6, u), el: lerp(3, 9, u), margin: lerp(1.3, 1.6, u), fov: 36, lift: lerp(0.95, 1.6, u) });
    }, (s, c) => {
      s.numerals.scale.setScalar(2.4);
      s.numerals.position.y = s.BASE * 2.4;
      s.sky.visible = true; s.sun.visible = true;
      const glow = clamp((c.t - tTruth) / 1.0);
      s.dawnLight.intensity = 1.0 + glow * 0.8;
      s.scene.fog.density = 0.004;
      s.scene.background.setRGB(0.01, 0.01, 0.03);
      s.scene.environmentIntensity = 0.9;
      s.key.position.set(-18, 22, 40); s.key.target.position.set(0, 3, 0); s.key.intensity = 300; s.key.distance = 160; s.key.angle = 0.6; s.key.penumbra = 1;
      s.metal.roughness = 0.36;
      s.floor.material.clearcoat = 0; s.floor.material.color.set(0x030202); s.floor.material.roughness = 0.9;
      s.rim.intensity = 1.8;
      s.sun.material.color.setRGB(1.3 + glow * 0.6, 1.0 + glow * 0.4, 0.75 + glow * 0.25);
      s.dust.visible = false;
    }, { bloom: 0.3, threshold: 1.3, tint: [1.03, 0.99, 0.94] });
  }

  // Keep only shots that last long enough to read, and never past the chorus end.
  cuts.sort((a, b) => a.t - b.t);
  const keep = [];
  for (let i = 0; i < cuts.length; i++) {
    const next = i + 1 < cuts.length ? cuts[i + 1].t : tEnd;
    if (cuts[i].t >= tEnd) continue;
    if (next - cuts[i].t < 0.45 && i + 1 < cuts.length) continue;
    keep.push(cuts[i]);
  }
  for (const k of keep) S(k.t, k.stage, k.cam, k.set, k.fx);
}
