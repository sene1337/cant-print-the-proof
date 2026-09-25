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
  player(film, chain, hg, hud, W, H);
}

function player(film, chain, hg, hud, W, H) {
  const audio = new Audio(`${BASE}media/song.mp3`);
  audio.preload = 'auto';
  const playBtn = document.getElementById('play');
  const label = document.getElementById('playLabel');
  const cover = document.getElementById('cover');
  const ui = document.getElementById('ui');
  const pauseBtn = document.getElementById('pause');
  const scrub = document.getElementById('scrub');
  const fill = document.getElementById('scrubFill');
  const clock = document.getElementById('clock');
  const dur = film.T.duration;
  let started = false;
  let lastAudioT = 0, lastWall = performance.now();

  playBtn.disabled = false;
  label.textContent = 'Play';
  film.render(0.5);

  const now = () => {
    if (audio.paused) return audio.currentTime;
    if (audio.currentTime !== lastAudioT) { lastAudioT = audio.currentTime; lastWall = performance.now(); }
    return Math.min(dur, lastAudioT + (performance.now() - lastWall) / 1000);
  };
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  function frame() {
    const t = now();
    film.render(t);
    const shot = film.shotAt(t);
    drawHud(hg, hud.width, hud.height, chain, t, { alpha: shot.fx?.hud ?? 1 });
    fill.style.width = `${(t / dur) * 100}%`;
    scrub.setAttribute('aria-valuenow', Math.round(t));
    clock.textContent = fmt(t);
    if (!audio.paused || started) requestAnimationFrame(frame);
  }

  playBtn.addEventListener('click', async () => {
    await audio.play();
    started = true;
    cover.classList.add('gone');
    ui.hidden = false;
    requestAnimationFrame(frame);
  });
  pauseBtn.addEventListener('click', () => {
    if (audio.paused) { audio.play(); pauseBtn.classList.remove('paused'); pauseBtn.setAttribute('aria-label', 'Pause'); }
    else { audio.pause(); pauseBtn.classList.add('paused'); pauseBtn.setAttribute('aria-label', 'Play'); }
  });
  const seek = (e) => {
    const r = scrub.getBoundingClientRect();
    audio.currentTime = Math.max(0, Math.min(dur, ((e.clientX - r.left) / r.width) * dur));
    lastAudioT = audio.currentTime; lastWall = performance.now();
  };
  scrub.addEventListener('pointerdown', (e) => { seek(e); scrub.setPointerCapture(e.pointerId); });
  scrub.addEventListener('pointermove', (e) => { if (e.buttons) seek(e); });
  scrub.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') audio.currentTime = Math.min(dur, audio.currentTime + 5);
    if (e.key === 'ArrowLeft') audio.currentTime = Math.max(0, audio.currentTime - 5);
  });
  audio.addEventListener('ended', () => { cover.classList.remove('gone'); label.textContent = 'Play again'; });

  window.addEventListener('resize', () => {
    const el = document.getElementById('stage');
    const pr = Math.min(window.devicePixelRatio || 1, 1.5);
    film.setSize(el.clientWidth, el.clientHeight, pr);
    hud.width = Math.round(el.clientWidth * pr); hud.height = Math.round(el.clientHeight * pr);
  });

  document.getElementById('nBlocks').textContent = fmtInt(chain.n);
  document.getElementById('nHashes').textContent = fmtInt(chain.total_hashes);
  const vb = document.getElementById('verifyBtn');
  const vo = document.getElementById('verifyOut');
  vb.addEventListener('click', async () => {
    vb.disabled = true;
    vo.textContent = 'Hashing the song…';
    const r = await chain.verifyAll(`${BASE}media/song.mp3`, (d, n) => { vo.textContent = `Checking block ${fmtInt(d)} of ${fmtInt(n)}…`; });
    vo.textContent = [
      `Song SHA-256 ${r.songOk ? 'matches' : 'DOES NOT match'} the commitment: ${r.songHex.slice(0, 16)}…`,
      r.bad < 0 ? `All ${fmtInt(r.n)} blocks verified: every header hashes below the target and links to the one before.` : `Block ${r.bad} failed.`,
      `Work: ${fmtInt(r.hashes)} SHA-256d attempts. First block links to Bitcoin's genesis block ${chain.genesis.slice(0, 16)}…`,
    ].join('\n');
    vb.disabled = false;
  });
}

boot().catch((e) => {
  console.error(e);
  window.__error = String(e && e.stack || e);
});
