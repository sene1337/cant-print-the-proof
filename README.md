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

## The Sovereignty simulator

Below the film, a simulator finds your **freedom year**: the first year you could stop working and still pay
your way to 2050. The answer stands in cast metal on the film's wet mirror; the sooner it comes, the higher the sun.

- **The model** is [Bitcoin24](https://github.com/bitcoin-model/bitcoin_model) v1.0 (commit 30c97a7) by
  Michael Saylor, Shirish Jajodia and Chaitanya Jain: its bear, base and bull price cases, its macro model of
  world assets, its asset returns and its five strategies, re-implemented in JavaScript. After 2045, where
  Bitcoin24 stops, bitcoin grows with the world's other assets; that extension is ours.
- **Added here, not in Bitcoin24:**
  - the freedom-year search and the years after it, when you stop earning and live on what you own. While you
    work, your pay covers your costs; any gap comes out of your savings, then out of what you own;
  - after 2045, your inflation and bitcoin's yearly growth ease toward 2% (the gap halves every 5 years), so
    neither compounds at its early pace for ever;
  - capital gains tax on the bitcoin you sell, from your cost basis and your rate;
  - borrowing against your bitcoin instead of selling it: interest, a borrowing cap, and the lender's liquidation level;
  - a four-year cycle: bitcoin rises above its path, then falls a chosen share of its price the next year, each fall
    15% smaller than the last, so you can see what crashes do to a loan (a loan pushed past the lender's level is
    liquidated);
  - bitcoin maturing: loan rates and STRC's dividend fall in a straight line to the mortgage rate by 2050;
  - the plan ends in 2050: past that, too much will change for the numbers to mean much;
  - warnings: numbers in a risky zone turn red, with the reason listed under the results;
  - swapping part of your bitcoin for STRC, Strategy's variable-rate preferred stock: its dividend rate and
    its return-of-capital tax treatment. The sources for the STRC figures are linked on the page.
- `js/sim/model.js` is the model, with no page code. `node tools/test-sim.mjs` checks it against the Bitcoin24
  workbook figures and against hand-worked tax, loan and STRC cases.
- The simulator also lives on its own at [darbsllim/sovereignty-simulator](https://github.com/darbsllim/sovereignty-simulator),
  a fork of Bitcoin24 that keeps its history. `python3 tools/export_sim.py <folder>` writes it from this site.
- `js/sim/scene.js` draws the sunrise and `js/sim/ui.js` runs the controls. The years use Playfair Display's
  lining figures (`data/sim-glyphs.json`).

An illustration, not financial or tax advice.

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
  the 21,000,000 cast in metal.
- `js/chain.js`, `js/hud.js`: the frame chain and the strip that shows it.
- `js/sim/`: the Sovereignty simulator (model, scene, controls).
- `tools/`: local server, frame checker, renderer, verifier, and the scripts that built the data and textures.

## Credits and licences

- **Code:** MIT licence (see `LICENSE`).
- **Song** (`media/song.mp3`): not covered by the MIT licence. All rights reserved.
- **Photographs:** public domain and CC0 museum photographs from The Metropolitan Museum of Art, the
  Smithsonian and Wikimedia Commons; see `tex/CREDITS.md`.
- **Typefaces:** Cormorant Garamond, Figtree, JetBrains Mono, Playfair Display (SIL Open Font License; see `fonts/`).
- **three.js:** MIT licence (`vendor/three/LICENSE`).
- **Bitcoin24:** the simulator's model follows the open Bitcoin24 workbook by Michael Saylor, Shirish Jajodia
  and Chaitanya Jain. This project is not affiliated with them or with Strategy.
