// CHORUS x3 (0:30.92, 1:24.40, 2:34.84). The film's thesis: paper is endless, proof is finite.
import { orbitCam, moveCam } from '../film.js';
import { clamp, lerp, smooth, easeOut, easeIn, easeInOut, easeOutBack, pulse, range } from '../util.js';

export const stages = {};

export function shots(S, T) {
  chorus(S, T, 1, T.wordAfter('stroke', 30).s);
  chorus(S, T, 2, T.wordAfter('stroke', 84).s);
  chorus(S, T, 3, T.wordAfter('stroke', 154).s);
}

// The chorus is the film's thesis: paper is endless, proof is finite. n = 1, 2, 3.
function chorus(S, T, n, t0) {
  const w = (word) => T.wordAfter(word, t0).s;
  const tStroke = t0, tAgain = w('again,'), tTurned = w('turned'), tPaper = w('paper'), tWind = w('wind.');
  const tThey = T.wordAfter('they', tWind).s, tPrint = w('print'), tCant = w("can't"), tProof = w('proof.'), t21 = w('twenty-one'), tTruth = w("that's");
  const tPrint2 = T.wordAfter('print', tCant).s;

  // Stroke of a pen: the nib touches down and the signature begins.
  S(tStroke, 'paper', (c, cam) => {
    const p = c.film.stages.get('paper').drawInk(easeInOut(clamp(c.lt / 3.2)) * 0.32);
    cam.position.set(p.x - 1.2, p.y + 1.0, p.z + 3.1);
    cam.lookAt(p.x + 0.2, p.y + 0.2, p.z);
    cam.fov = 32;
  }, (s, c) => {
    const p = s.drawInk(easeInOut(clamp(c.lt / 3.2)) * 0.32);
    s.pen.visible = true;
    s.pen.position.set(p.x, p.y, p.z + 0.05);
    s.pen.rotation.set(-0.5, 0.35, -0.55);
  }, { bloom: 0.9, aperture: 0.0002, focus: 3.3, maxblur: 0.008 });
  // Wide: the flourish races across the dark.
  S(T.beats[T.beatIndex(tStroke + 1.6) + 1], 'paper', orbitCam({ target: [0, 0.2, 0], dist: [13, 11.5], az: [-8, 6], el: [6, 4], fov: 34 }),
    (s, c) => {
      const k = lerp(0.32, 1, easeInOut(clamp((c.t - tStroke - 1.7) / (tAgain - tStroke - 1.4))));
      const p = s.drawInk(k);
      s.pen.visible = true; s.pen.position.set(p.x, p.y, p.z + 0.05); s.pen.rotation.set(-0.5, 0.35, -0.55);
      s.pen.scale.setScalar(0.9);
    }, { bloom: 1.0 });
  // Did it again: notes peel off the ink line.
  S(tAgain - 0.3, 'paper', orbitCam({ target: [2, 0.4, 0], dist: [7, 6], az: [30, 42], el: [12, 16], fov: 32 }),
    (s, c) => {
      s.drawInk(1);
      const born = c.lt;
      s.cloud.visible = true;
      s.cloud.setTime(c.t);
      s.cloud.layout(160, (i, d) => {
        const u = (i + 0.5) / 160;
        const start = u * 1.2;
        const a = clamp((born - start) / 1.4);
        if (a <= 0) return false;
        const p = s.curve.getPointAt(u);
        d.position.set(p.x + a * 1.5, p.y + a * a * 3 + a * 0.6, p.z + a * 2);
        d.rotation.set(a * 4 + i, a * 3, a * 2 + i * 0.3);
        d.scale.setScalar(0.35 * Math.min(1, a * 4));
      });
    }, { bloom: 0.9 });
  // Turned all your hours: the clock runs.
  S(tTurned, 'paper', orbitCam({ target: [0, 0, 0], dist: [6.2, 5.4], az: [-12, -4], el: [4, 2], fov: 32 }),
    (s, c) => {
      s.clock.visible = true;
      const spin = c.lt * c.lt * 1.8;
      s.minHand.rotation.z = -spin * 6;
      s.hourHand.rotation.z = -spin * 0.5;
    }, { aperture: 0.00012, focus: 5.6, maxblur: 0.006 });
  // Into paper and wind: the clock bursts into notes that blow away.
  S(w('into'), 'paper', orbitCam({ target: [0, 0, 0], dist: [6, 7.5], az: [-4, 4], el: [2, 0], fov: 34 }),
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
    }, { cutFlash: 0 });
  // The storm: fly through it.
  S(tWind + 0.35, 'paper', moveCam({ from: [0, 0.5, 9], to: [0, 0.2, -4], look: [0, 0.3, 0], look2: [0, 0.2, -14], fov: 42 }),
    (s, c) => { s.cloud.visible = true; s.storm(c.t, { n: 5000, radius: 12, height: 8, wind: [2.5, 0.3, 0.8], scale: 1.2 }); },
    { bloom: 0.6 });
  // They can print the paper: one note becomes two, four, eight... on every half beat.
  S(tThey, 'paper', (c, cam) => {
    const k = Math.floor((c.t - tThey) / 0.3255);
    const cnt = Math.pow(2, Math.min(11, Math.max(0, k)));
    const cols = Math.ceil(Math.sqrt(cnt * 1.6)), rows = Math.ceil(cnt / cols);
    const span = Math.max(cols * 2.43, rows * 1.08 * 16 / 9);
    const d = lerp(3.2, span * 1.25 + 2, easeOut(clamp((c.t - tThey) / (tCant - tThey)), 1.4));
    cam.position.set(0.3, -0.4, d);
    cam.lookAt(0, 0, 0);
    cam.fov = 36;
  }, (s, c) => {
    const k = Math.floor((c.t - tThey) / 0.3255);
    const cnt = Math.pow(2, Math.min(11, Math.max(0, k)));
    s.cloud.visible = true;
    s.printGrid(c.t, cnt);
    s.dust.visible = false;
    s.scene.fog.density = 0.002;
  }, { bloom: 0.45, flash: undefined });
  // They can't print the proof: the block alone. A copy slides out and falls apart.
  S(tCant - 0.26, 'proof', orbitCam({ target: [0.3, 0, 0], dist: [4.2, 3.6], az: [-24, -8], el: [14, 10], fov: 32 }),
    (s, c) => {
      s.block.rotation.set(0.2, c.t * 0.25, 0);
      s.ghostAt(clamp((c.t - tPrint2 + 0.1) / 0.9));
      s.block.setGlow(1 + 1.2 * pulse(c.t - tProof, 3) * (c.t > tProof ? 1 : 0));
    }, { bloom: 1.0 });
  // Twenty-one million: pull back from one light to all of them.
  S(t21, 'proof', (c, cam) => {
    const u = clamp((c.t - t21) / (tTruth - t21 + 0.2));
    const d = Math.exp(lerp(Math.log(6), Math.log(9000), easeInOut(u)));
    const g = c.film.stages.get('proof');
    const hx = g.grid.material.uniforms.uHero.value;
    const hxw = hx.x - 2500 + 0.5, hyw = hx.y - 2100 + 0.5;
    const tx = lerp(hxw, 0, easeInOut(u)), ty = lerp(hyw, 0, easeInOut(u));
    cam.position.set(tx + d * 0.08, ty - d * 0.22, d);
    cam.lookAt(tx, ty, 0);
    cam.fov = 40; cam.near = Math.max(0.05, d * 0.01); cam.far = d * 4;
  }, (s, c) => {
    s.block.visible = false;
    s.grid.visible = true;
    s.edge.visible = true;
    s.grid.set(c.t, { hero: 4, gain: 2.6 });
    s.dust.visible = false;
  }, { bloom: 0.9, threshold: 0.3, shake: 0.001 });
  S(tTruth, 'proof', (c, cam) => {
    const d = 9000 + c.lt * 300;
    cam.position.set(d * 0.08, -d * 0.22 - 200, d);
    cam.lookAt(0, -250, 0);
    cam.fov = 40; cam.near = 10; cam.far = 40000;
  }, (s, c) => {
    s.block.visible = false;
    s.grid.visible = true; s.edge.visible = true; s.label.visible = true;
    s.label.material.opacity = clamp(c.lt / 0.5);
    s.grid.set(c.t, { hero: 0, gain: 2.6 });
    s.dust.visible = false;
  }, { bloom: 0.9, threshold: 0.3, shake: 0.001 });
}
