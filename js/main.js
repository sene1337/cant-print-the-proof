// Boot: load the song timing and the chain, build the stages, then either play live or serve frames to the renderer.
import { Film } from './film.js';
import { Timing } from './timing.js';
import { Chain } from './chain.js';
import { preload } from './tex.js';
import { drawHud } from './hud.js';
import { buildStory, loadSections, FAILED } from './story.js';
import { lookShots } from './lookdev.js';
import { goldStage } from './stages/gold.js';
import { paperStage } from './stages/paper.js';
import { proofStage } from './stages/proof.js';
import { fmtInt } from './util.js';

const params = new URLSearchParams(location.search);
const CAPTURE = params.has('capture');
const BASE = './';

async function boot() {
  if (CAPTURE) document.body.classList.add('capture');
  const [timing, chain] = await Promise.all([Timing.load(`${BASE}data/timing.json`), Chain.load(`${BASE}data/chain.json`)]);
  const dbg = (m) => { if (params.has('debug')) console.log('[boot]', m, (performance.now() / 1000).toFixed(2)); };
  dbg('data');
  await preload(BASE);
  dbg('preload');

  const gl = document.getElementById('gl');
  const hud = document.getElementById('hud');
  const stageEl = document.getElementById('stage');
  const W = CAPTURE ? Number(params.get('w') || 1920) : stageEl.clientWidth;
  const H = CAPTURE ? Number(params.get('h') || 1080) : stageEl.clientHeight;
  const quality = CAPTURE ? 'offline' : (params.get('q') || 'high');
  const pr = CAPTURE ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
  const film = new Film({ canvas: gl, timing, chain, width: W, height: H, quality, pixelRatio: pr });
  film.addStage('gold', await goldStage(film)); dbg('gold');
  film.addStage('paper', await paperStage(film)); dbg('paper');
  film.addStage('proof', await proofStage(film)); dbg('proof');
  const sections = await loadSections();
  for (const [name, mod] of Object.entries(sections)) {
    try {
      for (const [id, build] of Object.entries(mod.stages || {})) {
        if (film.stages.has(id)) throw new Error(`stage id ${id} from ${name} is already taken`);
        film.addStage(id, await build(film));
      }
    } catch (e) {
      console.error(`section ${name} stages failed:`, e);
      FAILED[name] = String(e && e.stack || e);
      sections[name] = { stages: {}, shots: () => {} };
    }
    dbg(name);
  }
  film.setShots(params.has('look') ? lookShots() : buildStory(timing, sections)); dbg('story');
  window.__failed = FAILED;

  const hg = hud.getContext('2d');
  const sizeHud = () => { hud.width = Math.round(W * (CAPTURE ? 1 : pr)); hud.height = Math.round(H * (CAPTURE ? 1 : pr)); };
  sizeHud();

  // Warm every stage once so shaders compile before the first real frame.
  for (const s of film.shots.filter((s, i, a) => a.findIndex((x) => x.stage === s.stage) === i)) film.render(s.t + 0.01);

  dbg('warm');
  if (CAPTURE) {
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const og = out.getContext('2d');
    window.__film = film;
    window.__frame = (t, q = 0.92, withHud = true) => {
      film.render(t, Math.round(t * 30));
      og.drawImage(gl, 0, 0, W, H);
      if (withHud) {
        const shot = film.shotAt(t);
        const a = shot.fx?.hud ?? 1;
        drawHud(hg, hud.width, hud.height, chain, t, { alpha: a });
        og.drawImage(hud, 0, 0, W, H);
      }
      return out.toDataURL('image/jpeg', q);
    };
    window.__ready = true;
    return;
  }
  window.__film = film;
  player(film, chain, hg, hud, W, H);
}

function player(film, chain, hg, hud, W, H) {
  const $ = (id) => document.getElementById(id);
  const audio = new Audio(`${BASE}media/song.mp3`);
  audio.preload = 'auto';
  const playBtn = $('play'), label = $('playLabel'), cover = $('cover'), poster = $('poster'), ui = $('ui');
  const pauseBtn = $('pause'), scrub = $('scrub'), fill = $('scrubFill'), clock = $('clock');
  const dur = film.T.duration;
  let running = false;
  let lastAudioT = 0, lastWall = performance.now();

  playBtn.disabled = false;
  label.textContent = 'Play';

  // Song time, smoothed between the audio element's coarse updates.
  const now = () => {
    if (audio.paused) return audio.currentTime;
    if (audio.currentTime !== lastAudioT) { lastAudioT = audio.currentTime; lastWall = performance.now(); }
    return Math.min(dur, lastAudioT + (performance.now() - lastWall) / 1000);
  };
  const fmt = (x) => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}`;

  // Adaptive quality: if frames are slow, drop resolution, then depth of field.
  let pr = Math.min(window.devicePixelRatio || 1, 1.5);
  let slow = 0, level = 0, lastFrame = 0;
  function adapt(dt) {
    if (dt > 0 && dt < 250) slow = slow * 0.95 + (dt > 26 ? 1 : 0) * 0.05;
    if (slow > 0.6 && level < 3) {
      level++;
      slow = 0;
      if (level === 1) pr = Math.min(pr, 1);
      if (level === 2) film.bokeh.enabled = false, film.quality = 'low';
      if (level === 3) pr = 0.75;
      resize();
    }
  }
  function resize() {
    const el = $('stage');
    film.setSize(el.clientWidth, el.clientHeight, pr);
    hud.width = Math.round(el.clientWidth * pr); hud.height = Math.round(el.clientHeight * pr);
  }
  window.addEventListener('resize', resize);
  resize();

  function draw() {
    const t = now();
    film.render(t);
    const shot = film.shotAt(t);
    drawHud(hg, hud.width, hud.height, chain, t, { alpha: shot.fx?.hud ?? 1 });
    fill.style.width = `${(t / dur) * 100}%`;
    scrub.setAttribute('aria-valuenow', Math.round(t));
    clock.textContent = fmt(t);
  }
  function loop(ts) {
    if (!running) return;
    adapt(ts - lastFrame);
    lastFrame = ts;
    draw();
    requestAnimationFrame(loop);
  }
  function start() {
    if (running) return;
    running = true;
    lastFrame = performance.now();
    requestAnimationFrame(loop);
  }

  async function play() {
    try { await audio.play(); } catch (e) { label.textContent = 'Tap to play'; return; }
    cover.classList.add('gone');
    poster.classList.add('gone');
    ui.hidden = false;
    pauseBtn.classList.remove('paused'); pauseBtn.setAttribute('aria-label', 'Pause');
    start();
  }
  function toggle() {
    if (audio.paused) play();
    else { audio.pause(); pauseBtn.classList.add('paused'); pauseBtn.setAttribute('aria-label', 'Play'); }
  }
  playBtn.addEventListener('click', play);
  pauseBtn.addEventListener('click', toggle);
  const seekTo = (x) => {
    audio.currentTime = Math.max(0, Math.min(dur - 0.05, x));
    lastAudioT = audio.currentTime; lastWall = performance.now();
    if (!running) { cover.classList.add('gone'); poster.classList.add('gone'); ui.hidden = false; start(); }
    if (audio.paused) draw();
  };
  const seekEvent = (e) => { const r = scrub.getBoundingClientRect(); seekTo(((e.clientX - r.left) / r.width) * dur); };
  scrub.addEventListener('pointerdown', (e) => { seekEvent(e); scrub.setPointerCapture(e.pointerId); });
  scrub.addEventListener('pointermove', (e) => { if (e.buttons) seekEvent(e); });
  scrub.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { seekTo(audio.currentTime + 5); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { seekTo(audio.currentTime - 5); e.preventDefault(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === ' ' && !['BUTTON', 'INPUT', 'A'].includes(document.activeElement?.tagName)) { e.preventDefault(); toggle(); }
  });
  audio.addEventListener('ended', () => {
    running = false;
    cover.classList.remove('gone');
    label.textContent = 'Play again';
    $('fine').textContent = 'Every frame you just watched is a mined block. Scroll down to verify them.';
  });
  // "0:44 in the film" links jump the film to the scene that shows the idea.
  document.querySelectorAll('[data-seek]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    $('stage').scrollIntoView({ behavior: 'smooth', block: 'start' });
    seekTo(Number(a.dataset.seek));
    if (audio.paused) play();
  }));

  // Print or prove.
  let printed = 0;
  $('printBtn').addEventListener('click', () => {
    const t0 = performance.now();
    printed += 1e9;
    const ms = performance.now() - t0;
    $('printOut').textContent = `${fmtInt(printed)} notes`;
    $('printNote').textContent = `Took ${(ms / 1000).toFixed(3)} seconds and cost nothing. Each note you already had is now worth a little less.`;
  });
  let worker = null;
  $('proveBtn').addEventListener('click', () => {
    if (worker) return;
    const btn = $('proveBtn'), list = $('mined');
    btn.disabled = true;
    list.innerHTML = '';
    worker = new Worker(new URL('./miner.js', import.meta.url), { type: 'module' });
    const last = chain.hash(chain.n - 1);
    worker.postMessage({ prevHex: last, songHex: chain.song_sha256, index: chain.n, count: 21, fps: chain.fps, bits: chain.bits });
    worker.onmessage = async (e) => {
      const m = e.data;
      if (m.tries) $('proveOut').textContent = `${fmtInt(m.tries)} hashes`;
      if (m.block) {
        const li = document.createElement('li');
        const z = m.block.hash.match(/^0*/)[0];
        li.innerHTML = `<span>#${fmtInt(m.block.i)}</span><span class="h"><span class="z">${z}</span>${m.block.hash.slice(z.length, 40)}…</span>`;
        list.appendChild(li);
        list.scrollTop = list.scrollHeight;
      }
      if (m.done) {
        worker.terminate(); worker = null;
        btn.disabled = false; btn.textContent = 'Mine them again';
        const secs = m.ms / 1000, rate = m.tries / Math.max(secs, 1e-3);
        let text = `Your browser tried ${fmtInt(m.tries)} nonces in ${secs.toFixed(2)} s to add 21 blocks. Anyone who presses this button finds exactly these 21 blocks: proof has one answer.`;
        $('proveNote').textContent = text;
        try {
          const ctl = new AbortController();
          const timer = setTimeout(() => ctl.abort(), 4000);
          const r = await fetch('https://mempool.space/api/v1/mining/hashrate/3d', { signal: ctl.signal });
          clearTimeout(timer);
          const d = (await r.json()).currentDifficulty;
          if (d > 0) {
            const years = (d * 4294967296) / rate / 31557600;
            const words = years > 1e9 ? `${(years / 1e9).toFixed(1)} billion years` : years > 1e6 ? `${(years / 1e6).toFixed(1)} million years` : `${fmtInt(years)} years`;
            text += ` Bitcoin's own puzzle is far harder: at this speed, your browser alone would need about ${words} to find one Bitcoin block.`;
            $('proveNote').textContent = text;
          }
        } catch (err) { /* offline or blocked: skip the comparison */ }
      }
    };
  });

  $('nBlocks').textContent = fmtInt(chain.n);
  $('nHashes').textContent = fmtInt(chain.total_hashes);
  const vb = $('verifyBtn'), vo = $('verifyOut');
  vb.addEventListener('click', async () => {
    vb.disabled = true;
    vo.textContent = 'Hashing the song file…';
    const t0 = performance.now();
    const r = await chain.verifyAll(`${BASE}media/song.mp3`, (d, n) => { vo.textContent = `Checking block ${fmtInt(d)} of ${fmtInt(n)}…`; });
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    vo.innerHTML = '';
    const line = (txt, ok) => { const s = document.createElement('span'); if (ok) s.className = 'ok'; s.textContent = txt + '\n'; vo.appendChild(s); };
    line(`${r.songOk ? '✓' : '✗'} The song file's SHA-256 ${r.songOk ? 'matches' : 'does not match'} the commitment in every block: ${r.songHex.slice(0, 16)}…`, r.songOk);
    line(r.bad < 0 ? `✓ All ${fmtInt(r.n)} blocks hash below the target and link to the block before (${secs} s).` : `✗ Block ${r.bad} failed.`, r.bad < 0);
    line(`✓ The first block links to Bitcoin's genesis block ${chain.genesis.slice(0, 20)}…`, true);
    line(`Work behind this film: ${fmtInt(r.hashes)} SHA-256d attempts.`);
    vb.disabled = false;
  });
}

boot().catch((e) => {
  console.error(e);
  window.__error = String(e && e.stack || e);
});
