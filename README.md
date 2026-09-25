# Can't Print the Proof

A music video about the history of money, from shells and stone to gold, paper and Bitcoin.
It plays **live in your browser**: there is no video file on the page. Every frame is drawn with
three.js as the song plays, and **every frame is a mined proof-of-work block** you can verify.

**Watch it:** https://sene1337.github.io/cant-print-the-proof/

## Every frame is a block

The film runs at 30 frames a second for 3:04, so it has 5,521 frames. Each frame has its own block:

```
header (80 bytes) = previous block hash (32) | SHA-256 of the song (32) | frame index (u32 LE) | time in ms (u32 LE) | nonce (u64 LE)
block hash        = SHA-256(SHA-256(header)), which must start with 18 zero bits
```

Block 0 points to Bitcoin's real genesis block (`000000000019d6…8ce26f`). Finding the 5,521 nonces took
1,444,915,378 double-SHA-256 attempts. The strip along the bottom of the film shows the block for the frame
you are watching; its orange leading zeros are the work.

This is an art chain, not Bitcoin. It earns nothing. It shows the one thing a printer can't make.

### Verify it yourself

- **In the browser:** press "Verify every block in your browser" on the site. It hashes the song file, then
  re-checks all 5,521 headers with WebCrypto.
- **With Python** (standard library only), from this folder:

  ```
  python3 tools/verify.py
  ```

## Run it locally

```
node tools/serve.mjs 8787        # then open http://127.0.0.1:8787
```

No build step. three.js and the fonts are in `vendor/` and `fonts/`.

## Render the video file

```
npm install                      # Playwright, used to drive Chrome
node tools/render.mjs            # writes out/film-1920x1080-master.mp4
node tools/render.mjs --w 1080 --h 1920 --name vertical   # a vertical cut
```

The renderer opens the same page in headless Chrome, asks it for each frame by song time, and joins the frames
with the song using ffmpeg. The audio in the video file is the approved master with a peak limiter at -1 dBTP.

## How the film is built

- `js/film.js`: the engine. One renderer, many stages, a shot list; `render(t)` draws song time `t`.
  Nothing reads the clock, so the browser can play it live and the renderer can draw frames in any order.
- `js/sections/`: the film in sections (intro, verses, choruses, bridge, outro). Each shot starts on a beat or
  a sung word, from timing measured on the song (`data/timing.json`).
- `js/stages/`, `js/props/`: the sets and objects: the gold coin, the pen, the storm of notes, the proof block,
  the grid of exactly 21,000,000 lights.
- `js/chain.js`, `js/hud.js`: the frame chain and the strip that shows it.
- `tools/`: local server, frame checker, renderer, verifier, and the scripts that built the data and textures.

## Credits and licences

- **Code:** MIT licence (see `LICENSE`).
- **Song** (`media/song.mp3`): not covered by the MIT licence. All rights reserved.
- **Photographs:** public domain and CC0 museum photographs from The Metropolitan Museum of Art, the
  Smithsonian and Wikimedia Commons; see `tex/CREDITS.md`.
- **Typefaces:** Cormorant Garamond, Figtree, JetBrains Mono, Playfair Display (SIL Open Font License; see `fonts/`).
- **three.js:** MIT licence (`vendor/three/LICENSE`).
