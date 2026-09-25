// INTRO 0:00-0:09.66. The coin, before anyone knew what it would become.
import { orbitCam, moveCam } from '../film.js';
import { clamp, lerp, smooth, easeOut, easeIn, easeInOut, easeOutBack, pulse, range } from '../util.js';

export const stages = {};

export function shots(S, T) {
  const W = (w, n = 0) => T.word(w, n).s;
  // 1. The edge, lying flat: the title runs past as engraved lettering while light slides along it.
  S(0, 'gold', orbitCam({ target: [0, 0.09, 1.0], dist: [0.72, 0.6], az: [-38, -22], el: [5, 7], fov: 26, look: [0.05, 0.09, 0.98] }),
    (s, c) => {
      s.coin.position.set(0, 0.09, 0);
      s.coin.rotation.set(-Math.PI / 2, 0, 0.9 - c.t * 0.16);
      s.key.position.set(-1.2 + c.t * 0.9, 0.35, 2.6);
      s.key.target.position.set(0, 0.09, 1.0);
      s.key.intensity = 1.6;
    },
    { fadeIn: 0.5, aperture: 0.00015, focus: 0.66, maxblur: 0.008, bloom: 0.3 });
  // 2. Raking light crosses the king's face: the relief comes up out of the dark.
  S(2.0, 'gold', orbitCam({ target: [0, 0.09, 0], dist: [2.5, 2.2], az: [-8, 6], el: [62, 66], fov: 30 }),
    (s, c) => {
      s.coin.position.set(0, 0.09, 0);
      s.coin.rotation.set(-Math.PI / 2, 0, -0.35 + c.lt * 0.05);
      s.scene.environmentIntensity = 0.35 + 0.5 * smooth(c.lt / 1.2);
      s.key.position.set(-4, 0.9, -1 + c.lt * 1.6);
      s.key.target.position.set(0, 0.09, 0);
      s.key.intensity = 7;
    },
    { bloom: 0.25, threshold: 1.2 });
  // 3. It rises on its edge and spins, catching every light in the room.
  S(3.3, 'gold', orbitCam({ target: [0, 1.1, 0], dist: [3.4, 2.9], az: [-10, 10], el: [3, 5], fov: 30 }),
    (s, c) => { s.coin.position.set(0, 1.1, 0); s.coin.rotation.set(0, easeOut(c.u, 3) * Math.PI * 4 + 0.35, 0); s.floor.visible = false; });
  // 4. Macro: laurel and eye.
  S(4.6, 'gold', orbitCam({ target: [0, 1.1, 0], dist: [2.7, 2.35], az: [-20, 10], el: [4, 2], fov: 28 }),
    (s, c) => { s.coin.position.set(0, 1.1, 0); s.coin.rotation.set(0, 0.25 - c.lt * 0.3, 0); s.floor.visible = false; },
    { aperture: 0.00012, focus: 2.5, maxblur: 0.006 });
  // 5. It drops onto black lacquer and bounces.
  S(5.933, 'gold', orbitCam({ target: [0, 0.3, 0], dist: [4.4, 4.0], az: [30, 38], el: [8, 10], fov: 30 }),
    (s, c) => {
      const u = c.lt / 1.3;
      const y = u < 0.55 ? lerp(1.3, 0.09, easeIn(u / 0.55, 2)) : 0.09 + Math.abs(Math.sin((u - 0.55) * 14)) * 0.12 * Math.exp(-(u - 0.55) * 6);
      s.coin.position.set(0, y, 0);
      s.coin.rotation.set(-Math.PI / 2 * clamp(u / 0.55) + Math.sin(u * 20) * 0.05 * Math.exp(-u * 3), 0, 0);
    });
  // 6. Spinning down like a coin on a table.
  S(7.233, 'gold', orbitCam({ target: [0, 0.08, 0], dist: [3.0, 2.6], az: [0, 40], el: [62, 56], fov: 32 }),
    (s, c) => {
      const wob = 0.2 * Math.exp(-c.lt * 0.8);
      s.coin.position.set(0, 0.09 + wob * 0.8, 0);
      s.coin.rotation.set(-Math.PI / 2 + Math.sin(c.lt * 9) * wob, 0, c.lt * 5);
    });
  // 7. Settled. Push in, then black.
  S(8.533, 'gold', orbitCam({ target: [0, 0.09, 0], dist: [2.6, 2.0], az: [0, 20], el: [80, 88], fov: 30 }),
    (s, c) => { s.coin.position.set(0, 0.09, 0); s.coin.rotation.set(-Math.PI / 2, 0, -0.3 - c.lt * 0.1); },
    { fadeOut: 0.3 });

}
