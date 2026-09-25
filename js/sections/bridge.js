// BREAK + BRIDGE 102.26-121.82 s. Owner: bridge agent.
// The printer runs until the world is paper; silence; the banks shake, drink the bailout, and the savers' coins
// slide into the dark; the headline from the genesis block spins in, and an orange light rises behind it.
import { moveCam } from '../film.js';
import { clamp, lerp, smooth, easeOut, easeInOut } from '../util.js';
import { pressStage } from '../stages/bridge-press.js';
import { dropStage, notePose } from '../stages/bridge-drop.js';
import { bankStage } from '../stages/bridge-bank.js';
import { newsStage } from '../stages/bridge-news.js';

// How far a narrow (vertical) frame pulls the camera back, matching orbitCam/moveCam.
const zoomOf = (c) => Math.pow(Math.max(1, (16 / 9) / c.aspect), 0.8);

// moveCam, plus a height cap: when a narrow (vertical) frame pulls the camera back, keep it under the tube ceiling.
function moveCamCapped(o) {
  return (ctx, cam) => {
    const u = (o.ease || ((x) => x))(ctx.u);
    const L = (a, b) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
    const zoom = zoomOf(ctx);
    const p = L(o.from, o.to || o.from), l = L(o.look, o.look2 || o.look);
    cam.position.set(l[0] + (p[0] - l[0]) * zoom, Math.min(o.maxY ?? 1e9, l[1] + (p[1] - l[1]) * zoom), l[2] + (p[2] - l[2]) * zoom);
    cam.lookAt(l[0], l[1], l[2]);
    cam.fov = o.fov ?? 35;
  };
}

// Stage builders this section owns: { id: async (film) => stage }. Ids must be unique across the film.
export const stages = {
  'bridge-press': pressStage,
  'bridge-drop': dropStage,
  'bridge-bank': bankStage,
  'bridge-news': newsStage,
};

// Add shots with S(t, stageId, cam, set, fx). Every shot must start inside this section's range.
export function shots(S, T) {
  const B = (t) => T.beats[T.beatIndex(t + 0.02)]; // snap to the beat at t

  // ---- BREAK: the printer runs --------------------------------------------------------------------------
  // 1. The nip: two engraved chrome rollers spin and notes shoot out of the green line straight at the lens.
  S(102.26, 'bridge-press', moveCam({ from: [3.8, -0.7, 6.4], to: [3.0, -0.45, 5.2], look: [-1.0, 0.0, 1.6], look2: [-0.6, 0.0, 1.8], fov: 34, ease: easeInOut }),
    (s, c) => { s.jet(c.t, { others: false }); },
    { aperture: 0.0001, focus: 5.4, maxblur: 0.005 });
  // 2. From the side: the jet arcs out of the machine and pours down into the sea of paper.
  S(B(104.4), 'bridge-press', moveCam({ from: [-16, 1.5, 13], to: [-20, 3, 17], look: [0, -4, 8.5], look2: [0, -4.5, 10], fov: 38, ease: easeInOut }),
    (s, c) => { s.jet(c.t, { others: false }); });
  // 3. Crane up and back: one printer, an ocean of paper, fluorescent tubes to the horizon.
  S(B(106.37), 'bridge-press', moveCamCapped({ from: [26, 5, 36], to: [36, 9.5, 50], look: [0, -4, 10], look2: [0, -4.5, 12], fov: 40, ease: easeInOut, maxY: 11 }),
    (s, c) => { s.jet(c.t, { others: false }); s.scene.fog.density = 0.009; });
  // 4. The flood fills the world: on every hit of the drum fill the next printers down the wall switch on.
  S(B(108.33), 'bridge-press', moveCamCapped({ from: [-6, 7, 24], to: [-15, 10.5, 38], look: [26, -4.5, 3], look2: [34, -5, 5], fov: 42, ease: easeOut, maxY: 11 }),
    (s, c) => { s.jet(c.t); s.scene.fog.density = 0.009; });

  // ---- THE DROP: silence --------------------------------------------------------------------------------
  // 5. One note falls through a shaft of light and lands on the stone as the band breathes back in.
  S(109.73, 'bridge-drop', (c, cam) => {
    const q = notePose(c.t);
    const ty = Math.max(q.y, 0.03);
    const d = lerp(3.9, 2.9, smooth(c.u)) * zoomOf(c);
    const az = lerp(0.55, 0.2, c.u);
    cam.position.set(Math.sin(az) * d, ty + lerp(1.7, 1.25, c.u), Math.cos(az) * d);
    cam.lookAt(0.1 + q.x * 0.55, ty + 0.05, q.z * 0.5);
    cam.fov = 34;
  }, (s, c) => {
    // A narrow frame sits inside the shaft's projection, so it gets a softer shaft.
    s.beam.material.uniforms.uGain.value = 0.48 * Math.pow(Math.min(1, c.aspect / (16 / 9)), 0.75);
  }, { cutFlash: 0 });

  // ---- BRIDGE: the crash -----------------------------------------------------------------------------------
  const W = (w, after) => T.wordAfter(w, after).s;
  const tThe = W('the', 114.3), tAnd = W('and', 115.7), tSavers = W('savers', 115.9), tChancellor = T.word('Chancellor').s;
  // 6. "Two-thousand-eight and the big banks shook": the temple of money shudders on every hit; cracks run through its motto.
  S(B(112.23), 'bridge-bank', moveCam({ from: [0, -0.9, 18.5], to: [0, -0.5, 15.8], look: [0, 6.0, 0], look2: [0, 6.3, 0], fov: 42, ease: easeOut }),
    null, { shake: 0.006, punch: 2.5 });
  // 7. "the banks got the bailout": a torrent of fresh notes pours out of the sky into the bank; green light floods it.
  S(tThe, 'bridge-bank', moveCam({ from: [-3, 1, 22], to: [-2.5, 2, 19.5], look: [0, 14.5, -2], look2: [0, 13.5, -2], fov: 46, ease: easeInOut }),
    (s, c) => {
      s.pour(c.t, tThe - 0.8);
      const g = smooth(clamp((c.t - tThe) / 0.9));
      s.green.intensity = 700 * g;
      s.vaultLight.intensity = 30 * g;
      s.vaultMat.color.setRGB(0.1, 0.5, 0.25).multiplyScalar(0.3 + 2.5 * g);
    });
  // 8. "and the savers got took": the small coins on the bottom step slide off the edge into the dark.
  S(tAnd, 'bridge-bank', moveCam({ from: [0.9, -1.05, 7.0], to: [0.7, -1.3, 6.5], look: [0.25, -2.15, 4.75], look2: [0.3, -3.1, 5.5], fov: 38, ease: easeInOut }),
    (s, c) => {
      s.coinsAt(c.t, tSavers - 0.1);
      s.coinKey.intensity = 60;
      s.scene.environmentIntensity = lerp(0.55, 0.12, smooth(clamp((c.u - 0.35) / 0.5)));
      s.flood.intensity = 120;
    },
    { aperture: 0.00015, focus: 3.3, maxblur: 0.006 });

  // ---- THE HEADLINE ------------------------------------------------------------------------------------------
  const tStop = B(117.43);                       // the paper slams square on this beat
  const tDark = T.wordAfter('banks.', 119).e;     // end of the line: 119.80
  // 9. "Chancellor on brink of second bailout for banks.": the front page spins in and stops; slow push to the headline.
  S(tChancellor, 'bridge-news', (c, cam) => {
    const u = clamp((c.t - tStop) / (tDark - tStop));
    const d = lerp(9.2, 6.4, easeInOut(u)) * zoomOf(c);
    cam.position.set(lerp(0.3, 0.05, u), lerp(0.45, 0.75, u), d);
    cam.lookAt(0, lerp(0.55, 0.78, u), 0);
    cam.fov = 35;
  }, (s, c) => { s.spinIn(c.t, tChancellor, tStop); }, { cutFlash: 0 });
  // 10. Cut to three-quarters: the room goes dark and an orange light rises behind the page, beating like a heart.
  S(tDark, 'bridge-news', (c, cam) => {
    const u = easeInOut(c.u);
    const d = lerp(7.0, 6.1, u) * Math.pow(zoomOf(c), 1.2);
    const az = (lerp(24, 15, u) * Math.PI) / 180, el = (lerp(-3, 1, u) * Math.PI) / 180;
    cam.position.set(Math.sin(az) * Math.cos(el) * d, 0.7 + Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d);
    cam.lookAt(0.15, 0.72, 0);
    cam.fov = 35;
  }, (s, c) => {
    const off = 1 - smooth(clamp(c.lt / 0.45));
    s.key.intensity = 70 * off;
    s.fill.intensity = 0.25 * off;
    const rise = smooth(clamp((c.lt - 0.15) / 1.6));
    const surge = smooth(clamp((c.lt - 1.5) / 0.4));
    s.backlight(rise * (1.0 + 0.45 * c.kick) + 0.35 * surge + 0.04, lerp(0.1, 0.33, rise) + 0.05 * surge);
  });
}
