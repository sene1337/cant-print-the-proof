// VERSE 2 49.96-84.40 s. Owner: verse2 agent.
// Gold gets clipped and cut with tin, the emperors debase, China prints and burns paper, Morgan's gold
// slams down, 1933 locks the gold away, 1971 closes the window, and the dollar bleeds out on a guillotine.
import { orbitCam, moveCam } from '../film.js';
import { clamp, lerp, smooth, easeOut, easeIn, easeInOut, easeOutBack, pulse, range } from '../util.js';
import { coinsStage, COIN_Y, rigPoint } from '../stages/verse2-coins.js';
import { mingStage, SEAL_POS } from '../stages/verse2-ming.js';
import { barStage } from '../stages/verse2-bar.js';
import { vaultStage, DOOR } from '../stages/verse2-vault.js';
import { tvStage, SCREEN } from '../stages/verse2-tv.js';
import { fiatStage, CUT_X, TABLE_Y } from '../stages/verse2-fiat.js';
import { impactShake } from '../props/verse2-kit.js';

// Stage builders this section owns: { id: async (film) => stage }. Ids must be unique across the film.
export const stages = {
  'verse2-coins': coinsStage,
  'verse2-ming': mingStage,
  'verse2-bar': barStage,
  'verse2-vault': vaultStage,
  'verse2-tv': tvStage,
  'verse2-fiat': fiatStage,
};

// Wrap a camera move with a deterministic impact shake at song time t0.
const shaken = (camFn, t0, amp = 0.012, decay = 9) => (ctx, cam, stage) => {
  camFn(ctx, cam, stage);
  const [dx, dy] = impactShake(ctx.t, t0, amp, decay);
  cam.rotateX(dy);
  cam.rotateY(dx);
};

// Add shots with S(t, stageId, cam, set, fx). Every shot must start inside this section's range.
export function shots(S, T) {
  const W = (w, after = 49.9) => T.wordAfter(w, after).s;
  const B = (t) => T.beats[T.beatIndex(t + 0.02)]; // the beat at (or just before) t

  // 1. "So..." The nicked coin waits on its riser; the shears slide in and take the first bite on the beat.
  // Calmer light than the tin shot: less key and environment, softer relief, so the king and the cut read, not glitter.
  const calm = (s) => { s.key.intensity = 5; s.scene.environmentIntensity = 0.7; s.coin.setRelief(0.85); s.coin.faceMat.roughness = 0.26; };
  S(49.96, 'verse2-coins', orbitCam({ target: [0.12, COIN_Y - 0.05, -0.2], dist: [4.5, 3.8], az: [-36, -27], el: [46, 41], fov: 30 }),
    (s, c) => { s.key.intensity = 6; s.scene.environmentIntensity = 0.5; s.coin.setRelief(0.9); s.coin.faceMat.roughness = 0.22; s.clipAt(c.t); },
    { bloom: 0.25 });

  // 2. "they clipped off my edges": close on the rim, two more bites on "clipped" and "edges".
  S(B(51.567), 'verse2-coins', orbitCam({ target: rigPoint(0.9, COIN_Y - 0.06, -0.35), dist: [2.6, 2.2], az: [140, 152], el: [24, 20], fov: 32 }),
    (s, c) => { calm(s); s.clipAt(c.t); });

  // 3. "and they cut me with tin": grey base metal creeps out of the wounds across the king's face.
  const tCut = W('cut', 53), tTin = W('tin,', 53);
  S(W('they', 53.2), 'verse2-coins', orbitCam({ target: [0, COIN_Y, 0], dist: [3.1, 2.6], az: [172, 188], el: [72, 78], fov: 30 }),
    (s, c) => {
      s.rim.position.set(2.5, 7.9, -4.5); // the approved tin look
      s.clipAt(c.t, { shearsOn: false });
      for (const m of s.chunks) m.visible = false; // floor debris is outside this frame; its glints only distract
      s.shav.visible = false;
      s.floor.material.clearcoat = 0; // no soft-box reflection disc in the floor
      s.tinU.uTin.value = lerp(-0.3, 2.2, easeInOut(clamp((c.t - tCut + 0.05) / (tTin - tCut + 0.15))));
    });

  // 4. "every emperor swore it would never happen again": a line of emperors' denarii, each smaller, more clipped
  //    and greyer than the last. The camera trucks down the reigns.
  const rowX = [0, 2.21, 4.28, 6.21, 7.99, 9.64, 11.15];
  S(B(54.833), 'verse2-coins', orbitCam({ target: (c) => [-lerp(1.4, 9.6, easeInOut(c.u)), 0.05, -0.1], dist: [5.0, 4.4], az: [172, 186], el: [62, 67], fov: 32 }),
    (s) => { s.rowAt(); s.rim.intensity = 0; s.floor.material.clearcoat = 0; s.key.position.set(3, 6, -3); s.key.target.position.set(-5, 0, 0); s.key.angle = 1.0; s.key.intensity = 8; },
    { tint: [0.97, 1.0, 1.04] });

  // 5. "Then in China they printed me, the first fiat to fall": the Ming note on a lacquer table.
  //    A jade seal slams down on "printed" and lifts off a fresh red seal.
  const tPrinted = W('printed', 57);
  S(W('then', 56.5), 'verse2-ming', shaken(orbitCam({ target: [0, 0, 0.12], dist: [3.4, 2.8], az: [-16, -7], el: [56, 63], fov: 32 }), tPrinted, 0.01),
    (s, c) => { s.sealAt(c.t, tPrinted); });

  // 6. "paper by decree, and it didn't last at all": the note burns in from its edges and is gone on "all".
  const tPaper = W('paper', 59), tAll = W('all.', 61);
  const tIgnite = tPaper - 0.2;
  const bOf = (t) => -0.05 + 1.42 * Math.pow(clamp((t - tIgnite) / (tAll - tIgnite)), 1.35);
  S(tPaper, 'verse2-ming', orbitCam({ target: [0, 0.05, 0.05], dist: [3.4, 2.8], az: [18, 30], el: [44, 37], fov: 32 }),
    (s, c) => { s.burnAt(c.t, bOf, tIgnite, tAll); },
    { bloom: 0.8, threshold: 0.85 });

  // 7. "Nineteen-twelve, J.P. Morgan said it plain to the man": the vault lamp bangs on over one gold bar
  //    hanging in the beam, stamped 1912.
  const t1912 = W('nineteen-twelve', 62);
  S(t1912, 'verse2-bar', orbitCam({ target: [0, 1.3, 0], dist: [3.6, 3.0], az: [-30, -16], el: [34, 29], fov: 32 }),
    (s, c) => { s.lightOn(c.t, t1912); s.floatAt(c.t, t1912); });

  // 8. "Gold is money": it slams down on the table on the hit. Dust rings out.
  const tHit = B(64.6);
  S(W('gold', 64.4), 'verse2-bar', shaken(orbitCam({ target: [0, 0.28, 0], dist: [3.3, 3.0], az: [16, 22], el: [9, 12], fov: 32 }), tHit, 0.02, 7),
    (s, c) => { s.slamAt(c.t, tHit); });

  // 9. "Everything else is credit. Understand?": a paper IOU drifts down onto the bar and slides off into the dark.
  const tCredit = W('credit', 66), tUnd = W('understand', 66.5), tIou = B(65.933);
  S(tIou, 'verse2-bar', orbitCam({ target: [0.05, 0.4, 0.1], dist: [2.9, 2.5], az: [-12, -2], el: [40, 46], fov: 32 }),
    (s, c) => { s.iouAt(c.t, tIou, tCredit, tUnd); });

  // 10. "Thirty-three, bring your gold to the bank by May": a line of Liberty double eagles rolls into the open vault.
  const t33 = W('thirty-three', 67);
  S(t33, 'verse2-vault', moveCam({ from: [2.5, 0.55, 8.2], to: [2.0, 0.85, 2.9], look: [0, 0.45, 6.6], look2: [-0.2, 0.95, -0.6], fov: 34, ease: easeInOut }),
    (s, c) => { s.rollAt(c.t, t33 - 0.3); s.coinKey.intensity = 45; });

  // 11. "or it's ten years": the door swings shut and slams on "ten"; the bolts shoot home.
  const tTen = W('ten', 70.3);
  S(B(69.833), 'verse2-vault', shaken(moveCam({ from: [1.3, 1.45, 7.4], to: [1.0, 1.6, 6.5], look: [-0.4, 1.95, 0.4], fov: 34 }), tTen, 0.025, 6),
    (s, c) => {
      const u = clamp((c.t - (tTen - 0.62)) / 0.62);
      s.setDoor(DOOR.openAngle * (1 - easeIn(u, 2.4)), clamp((c.t - tTen - 0.06) / 0.1));
      s.wheel.rotation.z = -easeOut(clamp((c.t - tTen - 0.12) / 0.5), 2) * 1.6;
      const lit = 1 - clamp((c.t - tTen + 0.15) / 0.15);
      s.warm.intensity = 16 * lit; s.glow.intensity = 22 * lit;
      s.slamDust(c.t, tTen);
    });

  // 12. "in a cell, and they called it okay": cell bars drop in front of the lens on "cell" and hold.
  const tCell = W('cell,', 71);
  S(B(71.133), 'verse2-vault', shaken(moveCam({ from: [0.3, 1.55, 7.7], to: [0.22, 1.6, 7.25], look: [-0.1, 1.95, 0.4], fov: 34 }), tCell, 0.012, 8),
    (s, c) => {
      s.setDoor(0, 1);
      s.wheel.rotation.z = -1.6;
      s.warm.intensity = 0; s.glow.intensity = 0;
      s.cell.visible = true;
      // above the frame at the cut, slams down on "cell", bounces
      const dt = c.t - tCell;
      const y = dt < 0 ? lerp(2.3, 0, Math.pow(clamp((c.t - c.shot.t) / (tCell - c.shot.t)), 1.3)) : Math.abs(Math.sin(dt * 26)) * 0.05 * Math.exp(-dt * 9);
      s.cell.position.set(0.05, y, 6.2);
    }, { aperture: 0.00022, focus: 1.5, maxblur: 0.009 });

  // 13. "Seventy-one, Sunday night on TV": a dark 1970s living room; the set flicks on to a window full of gold light.
  //     The wall calendar reads SUNDAY 15 AUGUST 1971.
  const t71 = W('seventy-one', 73);
  S(t71, 'verse2-tv', moveCam({ from: [-0.8, 1.32, 4.5], to: [-0.6, 1.24, 3.7], look: [0.28, 1.15, 0], fov: 34 }),
    (s, c) => { s.tvAt(c.t, { on: clamp((c.t - t71 - 0.04) / 0.34) }); });

  // 14. "Nixon closed the window": close on the screen. A shutter slams over the window on "closed";
  //     the gold dies and the picture and the room go cold blue by "window".
  const tClosed = W('closed', 75.5), tWindow = W('window', 76);
  S(B(75.067), 'verse2-tv', moveCam({ from: [0.4, 1.14, 2.45], to: [0.12, 1.07, 1.8], look: [SCREEN.x, SCREEN.y, SCREEN.z], fov: 32 }),
    (s, c) => {
      s.tvAt(c.t, {
        shut: easeIn(clamp((c.t - tClosed + 0.06) / 0.16), 2),
        cold: clamp((c.t - tClosed - 0.12) / (tWindow - tClosed + 0.05)),
      });
    });

  // 15. "and the dollar broke free": the bank note, chained to a gold bar, strains upward; the chain snaps on
  //     "broke" and the note rises away, free.
  const tBroke = W('broke', 77);
  // The camera frames bar, chain and note, then tilts up and follows the note after the snap.
  const followNote = (c, cam) => {
    const n = c.film.stages.get('verse2-fiat').note.position;
    const k = easeOut(clamp((c.t - tBroke) / 0.55), 2);
    const zoom = Math.pow(Math.max(1, (16 / 9) / c.aspect), 0.8);
    const d = lerp(5.9, 5.3, c.u) * zoom;
    const ly = lerp(1.45, n.y - 0.15, k);
    cam.position.set(n.x * 0.4 + d * 0.42, ly + 0.25 - k * 0.45, d * 0.9);
    cam.lookAt(n.x * 0.4, ly, 0);
    cam.fov = 36;
  };
  S(B(76.367), 'verse2-fiat', followNote, (s, c) => { s.chainAt(c.t, tBroke); });

  // 16. "Now the strongest of currencies lost ninety-five percent": the note alone. From "lost" to "percent" it
  //     erodes away into cold flakes until only a sliver is left.
  const tLost = W('lost', 79), tPct = W('percent,', 79.5);
  const eOf = (t) => lerp(-0.12, 0.95, easeInOut(clamp((t - tLost) / (tPct - tLost))));
  S(B(78.3), 'verse2-fiat', moveCam({ from: [0.35, 1.32, 3.25], to: [0.18, 1.26, 2.75], look: [0.05, 1.2, 0], fov: 34 }),
    (s, c) => { s.cool.intensity = 1.2; s.erodeAt(c.t, eOf, tLost, tPct); });

  // 17. "and they call it two percent": the same shears that clipped the gold now trim a sliver off a bank note
  //     on the beat.
  const cuts = [B(80.933), B(81.567), B(82.233), B(82.9)];
  const tAnd = W('and', 80.3);
  const trimLight = (s) => { s.fluor.intensity = 9; s.cool.intensity = 0.8; s.rimG.intensity = 2.0; };
  S(tAnd, 'verse2-fiat', moveCam({ from: [CUT_X + 2.8, TABLE_Y + 1.35, 0.55], to: [CUT_X + 2.35, TABLE_Y + 1.18, 0.4], look: [CUT_X - 0.3, TABLE_Y + 0.05, -0.1], fov: 34 }),
    (s, c) => { trimLight(s); s.trimAt(c.t, cuts, tAnd); });

  // 18. "like it's rent": closer. Snip on the beat, snip on "rent"; the slivers fall; the shears hang open. Fade out
  //     for chorus 2.
  S(W('like', 81.7), 'verse2-fiat', moveCam({ from: [CUT_X + 1.55, TABLE_Y + 0.6, 1.35], to: [CUT_X + 1.3, TABLE_Y + 0.52, 1.12], look: [CUT_X - 0.05, TABLE_Y + 0.02, 0.05], fov: 34 }),
    (s, c) => { trimLight(s); s.rimG.intensity = 0.6; s.trimAt(c.t, cuts, tAnd); },
    { fadeOut: 0.35, bloom: 0.35 });
}
