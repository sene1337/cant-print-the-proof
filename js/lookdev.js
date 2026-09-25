// Look-development shots: ?capture&look=coin renders these instead of the film (see tools/check.mjs --look).
import { orbitCam } from './film.js';
export function lookShots() {
  const S = [];
  const add = (stage, cam, set, fx) => S.push({ t: S.length, stage, cam, set, fx });
  add('gold', orbitCam({ target: [0, 1.1, 0], dist: 3.0, az: 18, el: 6, fov: 30 }), (s) => { s.coin.position.set(0, 1.1, 0); s.coin.rotation.set(0, 0.35, 0); });
  add('gold', orbitCam({ target: [0, 0.09, 0], dist: 2.6, az: 10, el: 70, fov: 30 }), (s) => { s.coin.position.set(0, 0.09, 0); s.coin.rotation.set(-Math.PI / 2, 0, -0.3); });
  add('gold', orbitCam({ target: [0, 0.09, 0], dist: 1.2, az: 5, el: 6, fov: 28 }), (s) => { s.coin.position.set(0, 0.09, 0); s.coin.rotation.set(-Math.PI / 2, 0, 0.4); });
  add('gold', orbitCam({ target: [0.1, 1.3, 0], dist: 1.2, az: -25, el: 4, fov: 26 }), (s) => { s.coin.position.set(0, 1.1, 0); s.coin.rotation.set(0, -0.5, 0); });
  return S;
}
