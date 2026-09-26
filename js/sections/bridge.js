// BREAK + BRIDGE 102.26-121.82 s. Owner: bridge agent.
// The printer runs and the hall fills with paper; in one shaft of light the notes are stacked into a house of cards,
// a tier on each hit, and when the music stops the whole thing collapses; the bank shakes and cracks, swallows a bundle
// of bailout money, and the floor gives way under the savers' coins; the headline from the genesis block spins in, an
// orange light rises behind it, and the page falls back into the dark for verse 3.
// Flash safety (WCAG 2.3.1): every motion here is slow or continuous and every light change is a fade, so no area of
// the frame swings in brightness more than three times a second (checked with tools/flash.py).
import { moveCam } from '../film.js';
import { clamp, lerp, smooth, easeOut, easeInOut } from '../util.js';
import { pressStage } from '../stages/bridge-press.js';
import { dropStage } from '../stages/bridge-drop.js';
import { bankStage } from '../stages/bridge-bank.js';
import { newsStage } from '../stages/bridge-news.js';

// How far a narrow (vertical) frame pulls the camera back, matching orbitCam/moveCam.
const zoomOf = (c) => Math.pow(Math.max(1, (16 / 9) / c.aspect), 0.8);

// moveCam, plus height limits: when a narrow (vertical) frame pulls the camera back, keep it under the tube ceiling
// (maxY) or above the ground (minY); zoomPow < 1 pulls back less for a subject that suits a narrow frame.
function moveCamCapped(o) {
  return (ctx, cam) => {
    const u = (o.ease || ((x) => x))(ctx.u);
    const L = (a, b) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
    const zoom = Math.pow(zoomOf(ctx), o.zoomPow ?? 1);
    const p = L(o.from, o.to || o.from), l = L(o.look, o.look2 || o.look);
    const y = Math.max(o.minY ?? -1e9, Math.min(o.maxY ?? 1e9, l[1] + (p[1] - l[1]) * zoom));
    cam.position.set(l[0] + (p[0] - l[0]) * zoom, y, l[2] + (p[2] - l[2]) * zoom);
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
  const HALL = { exposure: 1.3, contrast: 1.14, vignette: 0.4, bloom: 0.32 }; // the printing hall must read, not murk

  // ---- BREAK: the printer runs --------------------------------------------------------------------------
  // 1. The nip: two engraved chrome rollers turn and a printed sheet of money pours out over the lip and down.
  S(102.26, 'bridge-press', moveCam({ from: [3.8, -0.7, 6.4], to: [3.0, -0.45, 5.2], look: [-1.0, 0.0, 1.6], look2: [-0.6, 0.0, 1.8], fov: 34, ease: easeInOut }),
    (s, c) => {
      // The close-up keeps its darker, harder light; the brighter hall light is for the wide shots.
      s.top.intensity = 0.45; s.heroSpot.intensity = 60; s.scene.fog.density = 0.012;
    },
    { aperture: 0.0001, focus: 5.4, maxblur: 0.005 });
  // 2. Wide and high: the sheet pours into the sea of paper, and the printers down the wall switch on one after another.
  S(B(104.4), 'bridge-press', moveCamCapped({ from: [-15, 9, 21], to: [-21, 10.5, 30], look: [12, -5.5, 5], look2: [18, -6, 6], fov: 40, ease: easeInOut, maxY: 11 }),
    (s, c) => { s.scene.fog.density = 0.006; }, HALL);

  // ---- HOUSE OF CARDS -------------------------------------------------------------------------------------
  // 3. In one shaft of light the printed notes are stacked into a house of cards: a new tier lands on each hit and the
  //    camera cranes up with it.
  S(B(106.37), 'bridge-drop', moveCam({ from: [2.4, 0.7, 7.6], to: [3.1, 6.6, 10.6], look: [0, 1.6, 0], look2: [0, 5.4, 0], fov: 38, ease: easeInOut }),
    null, { cutFlash: 0 });
  // 4. The drum fill: the tower trembles on every hit; the last note is laid on top and creeps toward the edge.
  S(B(108.33), 'bridge-drop', moveCam({ from: [3.4, 8.6, 5.6], to: [2.6, 8.2, 4.7], look: [0.35, 6.9, 0], look2: [0.55, 7.2, 0], fov: 34, ease: easeInOut }),
    null, { cutFlash: 0, aperture: 0.00012, focus: 5.6, maxblur: 0.006 });

  // ---- THE COLLAPSE: silence ---------------------------------------------------------------------------------
  // 5. The music stops and the whole house of cards collapses in slow motion; the camera settles on the ruins as the
  //    last note flutters down onto them, just before the band comes back in.
  S(109.73, 'bridge-drop', (c, cam) => {
    const u = smooth(c.u);
    const d = lerp(14.5, 9.5, u) * Math.pow(zoomOf(c), 0.55); // the tall tower suits a narrow frame: less pull-back
    const az = (lerp(10, 4, u) * Math.PI) / 180, el = (lerp(12, 17, u) * Math.PI) / 180;
    const ly = lerp(3.9, 0.9, smooth(clamp((c.t - 109.95) / 1.7)));
    const lx = lerp(0.3, 0.8, u);
    cam.position.set(lx + Math.sin(az) * Math.cos(el) * d, ly + Math.sin(el) * d, 0.4 + Math.cos(az) * Math.cos(el) * d);
    cam.lookAt(lx, ly, 0.4);
    cam.fov = 36;
  }, (s, c) => {
    // A narrow frame sits inside the shaft's projection, so it gets a softer shaft.
    s.beam.material.uniforms.uGain.value = 0.36 * Math.pow(Math.min(1, c.aspect / (16 / 9)), 0.75);
  }, { cutFlash: 0 });

  // ---- BRIDGE: the crash -----------------------------------------------------------------------------------
  const W = (w, after) => T.wordAfter(w, after).s;
  const tThe = W('the', 114.3), tAnd = W('and', 115.7), tSavers = W('savers', 115.9), tChancellor = T.word('Chancellor').s;
  // 6. "Two-thousand-eight and the big banks shook": the temple of money shudders on every hit; cracks run through its motto.
  S(B(112.23), 'bridge-bank', moveCamCapped({ from: [0, -0.9, 18.5], to: [0, -0.5, 15.8], look: [0, 6.0, 0], look2: [0, 6.3, 0], fov: 42, ease: easeOut, minY: -1.4 }),
    null, { shake: 0.006, punch: 2.5 });
  // 7. "the banks got the bailout": a colossal strapped bundle of new notes comes down out of the dark and lands in the
  //    bank's roof on "bailout".
  S(tThe, 'bridge-bank', moveCamCapped({ from: [-3, 1, 22], to: [-2.5, 2, 19.5], look: [0, 14.5, -2], look2: [0, 13.5, -2], fov: 46, ease: easeInOut, minY: -1.4 }),
    (s, c) => { s.pour(c.t, W('bailout,', 115)); });
  // 8. "and the savers got took": close on the savers' coins at the bank's door. On "savers" the slab under them snaps
  //    loose and swings down like a trapdoor; the coins tip, slide down it with weight and vanish into the shaft by "took".
  S(tAnd, 'bridge-bank', moveCamCapped({ from: [0.3, 1.62, 2.55], to: [0.2, 1.42, 2.3], look: [0, 0.0, 0.85], look2: [0, -0.3, 0.8], fov: 38, ease: easeInOut, zoomPow: 0.85 }),
    (s, c) => {
      s.heapAt(c.t, tSavers - 0.02);
      // White key on the coins; the alarm red stays on the wall behind instead of tinting the metal.
      s.coinKey.intensity = 24;
      s.redL.intensity = s.redR.intensity = 4 + 7 * c.kick;
      s.rimRed.intensity = 0;
    }, { bloom: 0.25, threshold: 1.35 });   // no depth of field: the broken edges stay crisp

  // ---- THE HEADLINE ------------------------------------------------------------------------------------------
  const tStop = B(117.43);                       // the paper slams square on this beat
  const tDark = T.wordAfter('banks.', 119).e;     // end of the line: 119.80
  // 9. "Chancellor on brink of second bailout for banks.": the front page spins in (a third of a turn) and slams square on the
  //    beat; a steady push closes in on the whole headline and arrives on "banks".
  const tBanks = T.wordAfter('banks.', 119).s;
  S(tChancellor, 'bridge-news', (c, cam) => {
    const u = easeInOut(clamp((c.t - tStop) / (tBanks - tStop)));
    const d = lerp(9.4, 6.3, u) * Math.pow(zoomOf(c), 1.1);
    cam.position.set(lerp(0.25, 0.1, u), lerp(0.45, 0.62, u), d);
    cam.lookAt(0, lerp(0.5, 0.62, u), 0);
    cam.fov = 35;
  }, (s, c) => { s.spinIn(c.t, tChancellor, tStop); },
  // High-contrast type: no beat-driven camera jolt or colour fringing (they make letter edges shimmer to the beat).
  { cutFlash: 0, aperture: 0.00018, focus: 9.4, maxblur: 0.008, shake: 0.0015, punch: 0, caKick: 0 });
  // 10. The instrumental tail: from three-quarters, the whole page holds while an orange light rises behind it and
  //     shines through the paper; then the page falls back into the dark, uncovering the light, and the frame goes to
  //     black for verse 3.
  const tTip = 121.0, tVerse3 = T.wordAfter('October', 121).s;
  S(tDark, 'bridge-news', (c, cam) => {
    const u = easeInOut(c.u);
    const d = lerp(7.0, 6.7, u) * Math.pow(zoomOf(c), 1.15);
    const az = (lerp(18, 14, u) * Math.PI) / 180, el = (lerp(-2, 1, u) * Math.PI) / 180;
    cam.position.set(Math.sin(az) * Math.cos(el) * d, 0.7 + Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d);
    cam.lookAt(0.1, 0.7, 0);
    cam.fov = 35;
  }, (s, c) => {
    // The room dims but never goes black while the headline is up, so it stays readable as the light rises behind it.
    const off = smooth(clamp(c.lt / 0.5)), handover = smooth(clamp((c.lt - 0.6) / 0.8));
    const tip = clamp((c.t - tTip) / (tVerse3 - tTip));
    s.tipBack(1.3 * tip * tip);
    s.key.intensity = lerp(lerp(70, 22, off), 5, handover) * (1 - smooth(tip));
    s.fill.intensity = lerp(0.25, 0.04, off);
    const rise = smooth(clamp((c.lt - 0.1) / 1.0));
    s.backlight((0.25 + rise * (0.72 + 0.1 * c.kick)) * (1 - 0.7 * smooth(tip)), lerp(0.3, 0.44, rise));
  }, { threshold: 1.25, shake: 0.0015, punch: 0, caKick: 0, fadeOut: 0.3 });
}
