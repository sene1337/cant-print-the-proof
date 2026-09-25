// CHORUS x3 (0:30.92, 1:24.40, 2:34.84). The film's thesis: paper is endless, proof is finite.
// Each chorus has the same beats (pen, clock, storm, printing, the block, the 21,000,000) seen a new way:
// chorus 1 introduces them, chorus 2 escalates (the printing runs hot), chorus 3 answers with the chain.
import { orbitCam, moveCam } from '../film.js';
import { clamp, lerp, smooth, easeOut, easeIn, easeInOut, easeOutBack, pulse, range, hash1 } from '../util.js';
import { NOTE } from '../props/notes.js';

export const stages = {};

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
  const cols = Math.pow(2, Math.ceil(k / 2)), rows = Math.pow(2, Math.floor(k / 2));
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
      s.pen.visible = true; s.posePen(s.pen, p, PEN_AXIS); s.pen.scale.setScalar(0.42);
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

  // 4. Turned all your hours: the clock runs faster and faster.
  C(tTurned, 'paper', orbitCam({ target: [0, 0, 0], dist: [6.4, 5.4], az: n === 2 ? [10, 4] : [-12, -4], el: [4, 2], roll: n === 2 ? [-6, -2] : 0, fov: 32 }),
    (s, c) => {
      s.clock.visible = true;
      const spin = c.lt * c.lt * (n === 2 ? 3.2 : 1.8);
      s.minHand.rotation.z = -spin * 6;
      s.hourHand.rotation.z = -spin * 0.5;
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

  // 6. The storm: fly through it.
  C(tWind + 0.3, 'paper', moveCam({ from: [0, 0.5, 9], to: [0, 0.2, -4], look: [0, 0.3, 0], look2: [0, 0.2, -14], fov: 42, roll: n === 2 ? [0, 8] : [0, 0] }),
    (s, c) => {
      s.cloud.visible = true;
      s.storm(c.t, { n: n === 1 ? 4500 : 6000, radius: 12, height: 8, wind: n === 2 ? [4.5, 0.6, 1.4] : [2.5, 0.3, 0.8], scale: 1.2 });
      if (n === 2) { s.key.color.setRGB(1, 0.55, 0.45); s.back.color.setRGB(1, 0.35, 0.25); }
    }, { bloom: 0.6, tint: n === 2 ? [1.12, 0.94, 0.9] : [0.96, 1.02, 0.98] });

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

  // 8. They can't print the proof. Chorus 1: one block, one failed copy. Chorus 2: two copies fail at once.
  //    Chorus 3: the chain itself, and the copy fails at its head.
  if (n < 3) {
    C(tCant - 0.26, 'proof', orbitCam({ target: [0.45, 0, 0], dist: [3.6, 3.0], az: n === 2 ? [18, 6] : [-24, -8], el: [14, 10], fov: 32 }),
      (s, c) => {
        s.block.rotation.set(0.2, c.t * 0.25, 0);
        const k = clamp((c.t - tPrint2 + 0.1) / 0.9);
        s.ghostAt(k, [1.35, 0, 0], 1);
        if (n === 2) s.ghostAt(clamp(k * 1.08), [-1.35, 0.1, 0], 2);
        s.block.setGlow(1 + 1.2 * pulse(c.t - tProof, 3) * (c.t > tProof ? 1 : 0));
      }, { bloom: 0.9, threshold: 0.8 });
  } else {
    C(tCant - 0.26, 'proof', moveCam({ from: [3.2, 1.6, 4.2], to: [1.8, 1.0, 3.4], look: [-3, 0, 0], look2: [-1.2, 0, 0], fov: 34 }),
      (s, c) => {
        s.block.visible = false;
        s.chainGroup.visible = true;
        s.chainGroup.rotation.y = 0.12;
        s.chainBlocks[0].setGlow(1 + 1.2 * pulse(c.t - tProof, 3) * (c.t > tProof ? 1 : 0));
        s.ghostAt(clamp((c.t - tPrint2 + 0.1) / 0.9), [1.5, 0, 0], 1);
      }, { bloom: 0.9, threshold: 0.8 });
  }

  // 9. Twenty-one million: pull back from one light to all of them.
  const pull = (c) => clamp((c.t - t21) / (tTruth - t21 + 0.2));
  C(t21, 'proof', (c, cam) => {
    const g = c.film.stages.get('proof');
    const u = easeInOut(pull(c));
    const [hx, hy] = g.lightPos(2500, 2100);
    const d = Math.exp(lerp(Math.log(5), Math.log(n === 2 ? 5200 : 7600), u));
    const tx = lerp(hx, 0, u), ty = lerp(hy, 0, u);
    if (n === 2) {
      // Chorus 2: skim low over the lights before rising.
      cam.position.set(tx + d * 0.1, ty - d * 0.9, d * 0.45 + 2);
      cam.lookAt(tx, ty + d * 0.15, 0);
    } else {
      cam.position.set(tx + d * 0.08, ty - d * 0.22, d);
      cam.lookAt(tx, ty, 0);
    }
    cam.fov = 40; cam.near = Math.max(0.05, d * 0.01); cam.far = d * 6;
  }, (s, c) => {
    s.block.visible = false;
    s.grid.visible = true;
    s.edge.visible = pull(c) > 0.5;
    s.grid.set(c.t, { hero: 3 * (1 - pull(c)), gain: 1.4, far: 0.7 });
    s.dust.visible = false;
  }, { bloom: 0.45, threshold: 1.0, bloomRadius: 0.25, shake: 0.001 });

  // 10. That's the truth: the whole supply, finite, with an edge.
  C(tTruth, 'proof', (c, cam) => {
    const d = 7900 + c.lt * 250;
    cam.position.set(d * 0.08, -d * 0.22 - 750, d);
    cam.lookAt(0, -750, 0);
    cam.fov = 40; cam.near = 10; cam.far = 60000;
  }, (s, c) => {
    s.block.visible = false;
    s.grid.visible = true; s.edge.visible = true; s.label.visible = true;
    s.label.material.opacity = clamp(c.lt / 0.5);
    s.grid.set(c.t, { hero: 0, gain: 2.0, far: 0.5 });
    s.dust.visible = false;
  }, { bloom: 0.7, threshold: 0.9, shake: 0.001 });

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
