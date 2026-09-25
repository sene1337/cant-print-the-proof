# Can't Print the Proof — direction for scene builders

You are building one section of a 3:04 music video that renders live in the browser with three.js.
The same code plays on the website and renders the MP4, so every frame must be a pure function of song time.

## The film in one line

Money tells its own story in first person: shell, stone, gold, paper, proof. One hero object transforms
through the ages. Paper is endless and cheap; proof is finite and costs work.

## Why the last version failed (do not repeat)

The first attempt drew every shot as a dim ASCII mosaic of a stock photo, then stamped caption boxes over it.
It was clever but hard to watch: one texture everywhere, dark and small subjects, and meaning that needed
captions. The audience could not see the idea. Rules that follow from that:

1. **Legible on a phone in one second.** Big, bold, simple subject. Fill the frame. High contrast.
2. **One action per shot.** 1.3 to 3 seconds per shot at this tempo (a beat is 0.652 s). Cut on beats or sung words.
3. **The camera always moves** (slow push, orbit, or drift), and it moves with purpose.
4. **No caption boxes, ever.** Words may only appear as physical things in the world: engraved in metal,
   printed on paper, lit on a screen, carved in stone. If a shot needs a caption to be understood, fix the shot.
5. **Show, don't diagram.** Real-looking objects, lit like a product shot or a film scene. No UI, no charts, no HUD.
   (The chain bar at the very bottom of the frame is drawn by the engine; never draw your own overlays.)
6. **Be specific to the lyric.** Every line has a concrete image. Find the image that only this song could have.

## Look

- Dark stages. Hard, motivated light. Black is a colour; use it.
- Eras have palettes: sea/stone = moonlit teal and bone; gold = warm black and gold; paper/fiat = cold green-grey
  with sickly fluorescent light; crisis = red; Bitcoin/proof = black and Bitcoin orange (#F7931A).
- Metals get their look from the studio environment map (`studioEnv` in `js/film.js`): a soft gradient dome plus
  bright soft boxes. Never light metal with only point lights on a black environment; it will look like black plastic.
- Surface detail: use normal maps (`normalFromHeight` in `js/tex.js`) or colour maps. **Do not use bumpMap**
  (it sparkles and aliases). Keep normal strength modest (1 to 3).
- Bloom is for real light sources and hot highlights. The stage `fx` sets it; keep `threshold` near 1.0 and
  `bloom` 0.3 to 0.9. If a frame washes out to cream, your emissive or env intensity is too high.
- Photos: the museum photos in `tex/` (coins, moon, Ming note, stone) are public domain. Use them as colour maps.
  If you add a new photo source, it must be public domain or CC0, and you must add it to `tex/CREDITS.md`.
- No real people's faces rendered as likenesses. Silhouettes, hands, objects and rooms are fine.

## Code rules

- **Time-pure.** No `Math.random()`, no `Date`, no `performance.now()` in anything that affects a frame.
  Use `hash1`, `rng(seed)`, `noise1` from `js/util.js`. Particles and flocks are functions of `t`.
- **Your files only.** You own your section file (`js/sections/<yours>.js`) and any new files you create under
  `js/stages/<prefix>-*.js`, `js/props/<prefix>-*.js`, and `tex/<prefix>-*`. Your prefix is your section name.
  Do not edit shared files (`film.js`, `tex.js`, `util.js`, `timing.js`, `main.js`, `story.js`, `props/*.js`,
  `stages/gold.js`, `stages/paper.js`, `stages/proof.js`, other sections). If you need a change there, copy the
  code into your own file, or describe the change in your report.
- **Stages.** A stage is `{ scene, fx, update(ctx) }` returned by an async builder registered in your section's
  `stages` export (`{ 'verse1-sea': seaStage }`). `update(ctx)` runs every frame before your shot's `set`;
  it must reset every object to a default state, so shots only override what they change and a shot never
  depends on which shot came before (frames render in any order).
- **Shots.** `S(t, stageId, cam, set, fx)`:
  - `t`: start time in song seconds. Must be inside your section's range. Use word and beat times:
    `T.word('stamped').s`, `T.wordAfter('so', 49).s`, `T.beats[i]`, `T.beatIndex(t)`, `T.kick(t)` (beat pulse).
  - `cam(ctx, camera, stage)`: position the camera. Helpers: `orbitCam({target, dist, az, el, fov, look})`
    and `moveCam({from, to, look, look2, fov})` from `js/film.js`; array values tween across the shot.
  - `set(stage, ctx, camera)`: pose objects. `ctx` has `t` (song time), `lt` (seconds into the shot),
    `u` (0 to 1 through the shot), `dur`, `kick` (beat pulse), `aspect`.
  - `fx`: per-shot overrides: `bloom, threshold, bloomRadius, exposure, aperture, focus, maxblur` (depth of
    field; aperture ~0.0002), `tint [r,g,b], lift, sat, contrast, vignette, grain, ca, fadeIn, fadeOut,
    cutFlash, shake` (default 0.004 rad handheld drift), `flashColor`.
- **Shared props you may use** (import, don't edit): `Coin` (`props/coin.js`: gold/silver/tin/orange metals,
  clip, relief, lettered edge), `NoteCloud` (`props/notes.js`: thousands of fluttering bank notes), `Block`
  (`props/block.js`: the orange proof block with a real hash), `Grid21` (`props/grid21.js`), `Dust`
  (`props/dust.js`), texture makers in `tex.js` (`coinFace`, `banknote`, `newspaper`, `blockFace`,
  `whitepaperPage`, `terminal`, `textCard`, `normalFromHeight`, `loadImage`/`preload`).
  Shared stages you may place shots on: `gold` (coin studio), `paper` (notes, pen, clock), `proof` (block, grid).
- **The chain.** `film.chain.block(i)` gives `{ i, hash, nonce, prev }` for the real mined art chain
  (one block per frame). Use real hashes when a block shows one.
- **Performance.** It must also run live on a laptop. Keep instanced counts under ~8,000, textures at or under
  2048 px, and never rebuild geometry every frame (cache by quantised value if it must change).

## How to check your work

From the project root:

    node tools/check.mjs <sheet-name> <t1> <t2> ...        # renders those song times at 960x540

It writes `out/check/<sheet-name>.jpg` (labelled contact sheet) and the frames in `out/check/<sheet-name>/`.
Look at every sheet yourself. Render at least: the first frame of every shot, the middle of every action,
and the frame right after every cut. For motion, render 4 to 6 frames across one action (e.g. every 0.1 s)
and check that the motion reads (contact, follow-through, no popping). Iterate until each shot passes the
rules above. Then render your whole range every 0.5 s and look for broken frames.

Also run `node tools/check.mjs <name> <t> --w 1080 --h 1920` on two or three shots: the film will also be
cut vertical, so keep the subject readable when the frame is narrow (orbitCam/moveCam already pull back
for narrow frames).

## Report back

- Your shot list: start time, lyric, what we see (one line each).
- The contact sheets you consider final (paths).
- Anything you could not solve, any shared-file change you need, and any new image source with its licence.
