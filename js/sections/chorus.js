// CHORUS x3 (0:30.92, 1:24.40, 2:34.84). The film's thesis: paper is endless, proof is finite.
// Each chorus has the same beats (pen, clock, storm, printing, the block, the 21,000,000) seen a new way:
// chorus 1 introduces them, chorus 2 escalates (the printing runs hot), chorus 3 answers with the chain.
import { orbitCam, moveCam } from '../film.js';
import { clamp, lerp, smooth, easeOut, easeIn, easeInOut, easeOutBack, pulse, range, hash1 } from '../util.js';
import { NOTE } from '../props/notes.js';
import { monumentStage } from '../stages/monument.js';
import { decreeStage, cityStage, penProofStage, hourglassStage, noteSignStage } from '../stages/chorus-extras.js';

export const stages = { monument: monumentStage, decree: decreeStage, city: cityStage, 'pen-proof': penProofStage, hourglass: hourglassStage, 'note-sign': noteSignStage };

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
    // 1. Stroke of a pen: the gold nib signs a bank note into being, in green ink, under the lamp.
    const tThey1 = T.wordAfter('they', tStroke).s;
    const signK = (t) => easeInOut(clamp((t - tStroke - 0.12) / 1.45));
    C(tStroke, 'note-sign', (c, cam) => {
      const u = easeInOut(clamp(c.lt / 1.7));
      // from the pen's side (never down the barrel), wide on the whole note, pushing in on the signature
      cam.position.set(lerp(-2.1, -1.25, u), lerp(2.1, 0.9, u), lerp(1.9, 1.18, u));
      cam.lookAt(lerp(-0.2, -0.47, u), 0.01, lerp(0.1, 0.2, u));
      cam.fov = lerp(36, 30, u);
    }, (s, c) => {
      s.note.visible = true;
      s.posePen(s.sign(signK(c.t)), PEN_AXIS);
    }, { bloom: 0.45, aperture: 0.00022, focus: 1.9, maxblur: 0.008 });
    // 2-3. They did it again: signed copies peel off the note one after another and rise into the dark.
    C(tThey1, 'note-sign', moveCam({ from: [-1.9, 2.3, 3.3], to: [-2.4, 3.3, 4.4], look: [0, 0.3, 0], look2: [0, 2.2, -0.4], fov: 38, ease: easeInOut }),
      (s, c) => {
        s.note.visible = true; s.sign(1);
        s.lamp.intensity = 22; // the rising notes would flare in the full lamp
        s.copies(c.t, tThey1 - 0.05, 0.5, 6); // two a second through any one spot, leaving room for the cut
      }, { bloom: 0.3 });
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
    const tTurned1 = w('turned'), NS = 120, PRE = 30, BASE = [3.2, 0, 0];
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
    const nibX = (t) => lerp(-0.55, 0.35, easeInOut(clamp((t - tStroke) / (tThey1 - tStroke))));
    const drops = [];
    for (let i = 0; i < 12; i++) {
      const u = (i + 0.5) / 12;
      drops.push({ t0: tStroke + u * (tThey1 - tStroke), x: lerp(-0.55, 0.35, easeInOut(u)) - 0.06, z: 0.3 + (hash1(i) - 0.5) * 0.08, r: 0.03 + hash1(i + 9) * 0.03, wait: 0.9 + hash1(i + 3) * 1.4, dx: (hash1(i + 5) - 0.3) * 0.6, dz: 0.6 + hash1(i + 7) * 0.5 });
    }
    for (let i = 0; i < 10; i++) {
      const a = hash1(i + 40) * Math.PI * 2;
      drops.push({ t0: tAgain2 + 0.02 + i * 0.01, x: 0.5 + Math.cos(a) * 0.12, z: 0.3 + Math.sin(a) * 0.12, r: 0.025 + hash1(i + 50) * 0.03, wait: 0.4 + hash1(i + 60) * 0.6, dx: Math.cos(a) * 0.8, dz: Math.sin(a) * 0.8 + 0.3 });
    }
    C(tStroke, 'pen-proof', (c, cam) => {
      // A still camera with a slow push: the nib crosses the frame, the engraved text stays put (no crawling text).
      const k = 1 - 0.05 * c.u;
      cam.position.set(-0.1 - 1.5 * k, TOP + 1.75 * k, 0.15 + 2.45 * k);
      cam.lookAt(0.2, TOP + 0.05, 0.15);
      cam.fov = 32;
    }, (s, c) => {
      const x = nibX(c.t);
      s.rim.intensity = 0.2;
      s.block.setGlow(0.55); // the engraving glows less while the camera tracks across it
      const skid = c.t > tPen ? pulse(c.t - tPen, 8) : 0;
      s.posePen([x, TOP + 0.005 + skid * 0.04, 0.3], PEN_AXIS);
      s.lay(c.t, drops);
      s.burst(c.t, tPen, [x, TOP + 0.02, 0.3], 0.6);
    }, { bloom: 0.45, aperture: 0.00018, focus: 3.5, maxblur: 0.008 });
    C(tThey1, 'pen-proof', orbitCam({ target: [0, 2.4, 0], dist: [8.2, 5.4], az: [24, 40], el: [24, 18], fov: 32 }),
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

  // 4. Turned all your hours. Choruses 1 and 2: the clock (chorus 2, a gold pocket watch) runs faster and faster,
  //    its hands capped near two turns a second so they never flicker. Chorus 3: an hourglass, its sand running out.
  const handAngle = (lt, k, cap = 13) => { const tc = cap / (2 * k); return lt < tc ? k * lt * lt : k * tc * tc + cap * (lt - tc); };
  if (n < 3) {
    const clockCam = n === 2 ? orbitCam({ target: [0, 0.6, 0], dist: [8.2, 6.6], az: [24, 14], el: [-4, 2], roll: [-8, -3], fov: 32 })
      : orbitCam({ target: [0, 0, 0], dist: [6.4, 5.4], az: [-12, -4], el: [4, 2], fov: 32 });
    C(tTurned, 'paper', clockCam,
      (s, c) => {
        s.clock.visible = true;
        if (n === 2) { s.watch.visible = true; s.clock.rotation.set(0.12, -0.25, 0.05); }
        const m = handAngle(c.lt, n === 1 ? 10.8 : 20.4);
        s.minHand.rotation.z = -m;
        s.hourHand.rotation.z = -m / 12;
      }, { aperture: 0.00012, focus: 5.6, maxblur: 0.006 });

    // 5. Into paper and wind: the clock bursts into notes that drift away on the wind.
    C(tInto, 'paper', orbitCam({ target: [0, 0, 0], dist: [6, 7.5], az: [-4, 4], el: [2, 0], fov: 34 }),
      (s, c) => {
        const burst = clamp((c.t - tPaper + 0.08) / 2.2);
        s.clock.visible = burst < 0.1;
        s.minHand.rotation.z = -(c.t - tTurned) * 12; s.hourHand.rotation.z = -(c.t - tTurned);
        s.cloud.visible = burst > 0;
        s.cloud.setTime(c.t);
        s.cloud.setFlutter(0.3);
        const N = 450, e = easeOut(burst, 2), wind = easeIn(clamp((c.t - tWind + 0.3) / 2.0), 2);
        s.cloud.layout(N, (i, d) => {
          const r = Math.sqrt((i + 0.5) / N) * 2, a = i * 2.39996;
          const x0 = Math.cos(a) * r, y0 = Math.sin(a) * r;
          d.position.set(x0 * (1 + e * 2.6) + wind * (1.4 + (i % 7) * 0.3), y0 * (1 + e * 2.6) + e * 0.4 + wind * (i % 5) * 0.1, e * (0.5 + (i % 5) * 0.35));
          d.rotation.set(e * (i % 11) * 0.3, e * (i % 13) * 0.15, a + e * 1.2);
          d.scale.setScalar(0.24 + e * 0.08);
        });
      }, { bloom: 0.45 });
  } else {
    C(tTurned, 'hourglass', orbitCam({ target: [0, 0, 0], dist: [5.4, 4.6], az: [-20, -2], el: [8, 12], fov: 30 }),
      (s, c) => {
        const k = clamp((c.t - tTurned) / (tInto - tTurned));
        s.sand(c.t, lerp(0.72, 0.3, k), lerp(0.18, 0.38, k));
      }, { bloom: 0.35, aperture: 0.00012, focus: 5.0, maxblur: 0.006 });
    // 5 (chorus 3). Into paper and wind: the sand is paper now, whirling down through the neck.
    C(tInto, 'hourglass', orbitCam({ target: [0, 0.15, 0], dist: [3.7, 3.1], az: [34, 48], el: [18, 24], fov: 30 }),
      (s, c) => {
        const k = clamp((c.t - tInto) / (tThey - tInto));
        s.paper(c.t, lerp(0.38, 0.5, k), 0.18);
      }, { bloom: 0.35, aperture: 0.00015, focus: 3.4, maxblur: 0.006 });
  }

  if (n === 1) {
    // 7. They can print the paper: above the desk the signed note splits in two, then four, eight... on every
    //    half beat, filling the air with money while the camera circles out.
    const half = (T.beats[T.beatIndex(tThey) + 1] - T.beats[T.beatIndex(tThey)]) / 2;
    const level = (t) => Math.max(0, (t - tThey) / half);
    C(tThey, 'note-sign', (c, cam, s) => {
      const x = level(c.t);
      const d = 3.5 * Math.pow(1.1, x), a = (-14 + 14 * clamp(c.u)) * Math.PI / 180, e = (16 + 4 * c.u) * Math.PI / 180;
      const m = s.centroid || [0, 1.8, 0]; // centre of the growing cloud
      cam.position.set(m[0] + Math.sin(a) * Math.cos(e) * d, m[1] + Math.sin(e) * d, m[2] + Math.cos(a) * Math.cos(e) * d);
      cam.lookAt(m[0], m[1] - 0.05, m[2]);
      cam.fov = 38;
    }, (s, c) => {
      s.split(c.t, level(c.t), [0, 1.8, 0], 0.5);
    }, { bloom: 0.4, aperture: 0.00012, focus: 4, maxblur: 0.005 });
  } else if (n === 2) {
    // 7 (chorus 2). They can print the paper: a city of cash rises in rings around the camera.
    const halfBeat = (T.beats[T.beatIndex(tThey) + 1] - T.beats[T.beatIndex(tThey)]) / 2;
    C(tThey, 'city', moveCam({ from: [0, 2.2, 9], to: [0, 15, 8], look: [0, 1.6, 0], look2: [0, 0, -12], fov: 40, ease: easeInOut }),
      (s, c) => { s.grow(c.t, tThey - 0.05, halfBeat); }, { bloom: 0.35, punch: 1.6 });
  } else {
    // 7 (chorus 3). They can print the paper: it flows past the chain like water past rocks.
    C(tThey, 'proof', moveCam({ from: [2.7, 0.6, 1.7], to: [2.0, 0.52, 1.3], look: [-4, 0.05, -0.3], look2: [-5, 0.05, -0.2], fov: 36 }),
      (s, c) => {
        // low beside the chain: the blocks stand like rocks while the paper streams past them
        s.chainGroup.visible = true;
        s.flow(c.t, { n: 1600, speed: 1.1, x1: 0.3 });
      }, { bloom: 0.5 });
  }

  // 8. They can't print the proof. Choruses 1 and 2: a printed copy of the block (two in chorus 2) slides out from
  //    behind it and collapses. Chorus 3: the camera rises over the chain standing firm in the flood of paper.
  const tMillion = w('million.');
  const tryK = (t) => clamp((t - tPrint2 + 0.18) / Math.max(0.6, tProof - tPrint2 + 0.55));
  if (n < 3) {
    C(tCant - 0.26, 'proof', orbitCam({ target: [0.55, 0.1, 0], dist: [4.1, 3.5], az: n === 2 ? [10, 2] : [-26, -14], el: [12, 9], fov: 32 }),
      (s, c) => {
        const h = s.hero(n);
        h.rotation.set(0, n === 2 ? -0.25 : 0.35, 0);
        const k = tryK(c.t);
        s.paperAt(n === 2 ? 1 : 0, k, [0, 0, -1.1], [1.5, 0, 0.5], 0.3);
        if (n === 2) s.paperAt(3, clamp(k * 1.06), [0, 0, -1.1], [-1.5, 0, 0.55], -0.3);
        h.setGlow(1 + 1.1 * (c.t > tProof ? pulse(c.t - tProof, 2.6) : 0));
      }, { bloom: 0.6, threshold: 1.0 });
  } else {
    C(tCant - 0.26, 'proof', orbitCam({ target: [0, 0.15, 0], dist: [2.6, 2.05], az: [60, 40], el: [9, 15], fov: 34 }),
      (s, c) => {
        // the head of the chain, close: paper streams around it and can't move it; on "proof" it lights up
        s.chainGroup.visible = true;
        s.flow(c.t, { n: 1600, speed: 1.1, x1: 0.3 });
        s.chainBlocks[0].setGlow(1 + 1.3 * (c.t > tProof ? pulse(c.t - tProof, 2.2) : 0));
      }, { bloom: 0.5, aperture: 0.00014, focus: 2.3, maxblur: 0.006 });
  }

  // 9-10. Twenty-one million. That's the truth. The number itself, cast in metal, over wet ground that mirrors it:
  //    night and a low moon in chorus 1, a red gale in chorus 2, sunrise in chorus 3.
  // Frame the whole number, whatever the frame's shape: distance so its width and height fit with a margin.
  // cx moves the aim (and the camera with it) along the number.
  const fitNumber = (c, cam, { scale = 1, az = 0, el = 6, margin = 1.14, fov = 32, lift = 0.95, cx = 0 } = {}) => {
    const W = c.film.stages.get('monument').numerals.userData.width * scale, H = 2.2 * scale;
    const vf = (fov * Math.PI) / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * c.aspect);
    const d = Math.max((W * margin) / 2 / Math.tan(hf / 2), (H * margin) / 2 / Math.tan(vf / 2));
    const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180, ty = lift * scale;
    cam.position.set(cx + Math.sin(a) * Math.cos(e) * d, ty + Math.sin(e) * d, Math.cos(a) * Math.cos(e) * d);
    cam.lookAt(cx, ty, 0);
    cam.fov = fov; cam.far = Math.max(3000, d * 8);
  };
  const x21 = (c) => { const p = c.film.stages.get('monument').parts; return (p[0].userData.x0 + p[1].userData.x0 + p[1].userData.w) / 2; };
  if (n === 1) {
    // "Twenty-one": 2 and 1 rise out of the still water under the moon.
    const rise = (t, t0, i) => easeOutBack(clamp((t - t0 - i * 0.12) / 0.55), 1.4);
    const night = (s) => { s.sky('night'); s.rim.color.set(0x9db8ff); s.rim.intensity = 2.6; s.dust.visible = false; };
    C(t21, 'monument', orbitCam({ target: (c) => [x21(c), 0.9, 0], dist: [6.2, 5.2], az: [-18, -8], el: [5, 3], fov: 30 }),
      (s, c) => {
        night(s);
        s.parts.forEach((p, i) => { p.visible = i < 2; });
        for (let i = 0; i < 2; i++) s.parts[i].position.y = -3.1 + 3.1 * rise(c.t, t21 - 0.05, i);
        s.syncMirror();
      }, { bloom: 0.45 });
    // "million": the ,000,000 slam down in three strikes while the camera pulls back from the 21 to the whole number.
    const beat = (T.beats[T.beatIndex(tMillion) + 1] - T.beats[T.beatIndex(tMillion)]);
    const drop = (t, t0) => { const u = clamp((t - t0) / 0.32); return 1 - u * u; };
    C(tMillion, 'monument', (c, cam) => {
      const u = easeInOut(clamp(c.lt / 1.3));
      fitNumber(c, cam, { az: lerp(-12, -4, u), el: lerp(3, 5, u), margin: lerp(0.4, 1.12, u), cx: lerp(x21(c), 0, u) });
    }, (s, c) => {
      night(s);
      const groups = [[2, 3, 4, 5], [6, 7], [8, 9]];
      groups.forEach((g, gi) => g.forEach((i) => { s.parts[i].position.y = 3.2 * drop(c.t, tMillion + gi * beat * 0.5); }));
      const shake = pulse(c.t - tMillion, 10) + pulse(c.t - tMillion - beat * 0.5, 10) + pulse(c.t - tMillion - beat, 10);
      s.numerals.position.y = s.BASE - shake * 0.02;
      s.syncMirror();
    }, { bloom: 0.4, punch: 2.5 });
    // "That's the truth": the whole number, and a light passing across its face.
    C(tTruth, 'monument', (c, cam) => fitNumber(c, cam, { az: lerp(-2, 2, c.u), el: 4, margin: lerp(1.14, 1.06, c.u) }),
      (s, c) => {
        night(s);
        const u = clamp((c.t - tTruth) / 1.1);
        s.sweep.intensity = 110; s.sweep.position.set(-9 + u * 18, 5, 7); s.sweep.target.position.set(-7 + u * 14, 0.8, 0);
        s.syncMirror();
      }, { bloom: 0.4 });
  } else if (n === 2) {
    // A red gale of paper blows past behind the number; the number doesn't move. Then the air clears.
    const storm = (s) => { s.sky('storm'); s.rim.color.setRGB(1, 0.36, 0.24); s.rim.intensity = 2.2; s.dust.visible = false; };
    C(t21, 'monument', (c, cam) => {
      const u = easeInOut(clamp(c.u)), W = c.film.stages.get('monument').numerals.userData.width;
      fitNumber(c, cam, { az: lerp(18, 6, u), el: lerp(2, 4, u), margin: lerp(0.7, 1.2, u), cx: lerp(W * 0.2, 0, u) });
    },
      (s, c) => {
        storm(s);
        s.gale(c.t, { n: 220 });
        s.syncMirror();
      }, { bloom: 0.4, tint: [1.06, 0.96, 0.94] });
    C(tTruth, 'monument', (c, cam) => fitNumber(c, cam, { az: lerp(-4, 0, c.u), el: lerp(-1, 3, c.u), margin: lerp(1.16, 1.06, c.u) }),
      (s, c) => {
        storm(s);
        s.gale(c.t, { n: Math.round(lerp(220, 40, clamp((c.t - tTruth) / 1.2))) });
        const u = clamp((c.t - tTruth) / 1.2);
        s.sweep.intensity = 110; s.sweep.position.set(9 - u * 18, 5, 7); s.sweep.target.position.set(7 - u * 14, 0.8, 0);
        s.syncMirror();
      }, { bloom: 0.42 });
  } else {
    // At world scale, at dawn: the sun comes up behind the number and the wet ground mirrors both.
    C(t21, 'monument', (c, cam) => {
      const u = easeInOut(clamp((c.t - t21) / (tEnd - t21)));
      const r = easeInOut(clamp((c.t - t21) / (tTruth + 0.4 - t21)));
      const W = c.film.stages.get('monument').numerals.userData.width * 2.4;
      fitNumber(c, cam, { scale: 2.4, az: lerp(-8, 4, r), el: lerp(0.3, 3.5, r), margin: lerp(0.5, 1.42, r), fov: 34, lift: lerp(1.3, 1.65, r), cx: lerp(W * 0.22, 0, r) });
    }, (s, c) => {
      const sc = 2.4;
      s.numerals.scale.setScalar(sc);
      s.numerals.position.y = s.BASE * sc;
      s.dawn(clamp((c.t - t21) / (tEnd - t21)), sc);
      const glow = clamp((c.t - tTruth) / 1.0);
      s.dawnLight.intensity = 1.2 + glow * 0.8;
      s.key.position.set(-18, 22, 40); s.key.target.position.set(0, 3, 0); s.key.intensity = 260; s.key.distance = 160; s.key.angle = 0.6; s.key.penumbra = 1;
      s.metal.roughness = 0.3;
      s.rim.intensity = 2.4; s.rim.position.set(3, 2.5, -8);
      s.dust.visible = false;
    }, { bloom: 0.35, threshold: 1.1, bloomRadius: 0.3, tint: [1.02, 0.99, 0.96] });
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
