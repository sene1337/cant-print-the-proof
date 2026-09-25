// The shot list, assembled from sections. Each section owns a time range and its own stages.
// Sections load independently: a broken section is replaced by a placeholder instead of stopping the film.
const NAMES = ['intro', 'verse1', 'chorus', 'verse2', 'bridge', 'verse3', 'outro'];
export const FAILED = {};

export async function loadSections() {
  const out = {};
  for (const name of NAMES) {
    try {
      out[name] = await import(`./sections/${name}.js`);
    } catch (e) {
      console.error(`section ${name} failed to load:`, e);
      FAILED[name] = String(e && e.stack || e);
      out[name] = { stages: {}, shots: (S) => S(RANGES[name][0][0], 'proof', null) };
    }
  }
  return out;
}

// Time ranges each section may place shots in (chorus has three ranges).
export const RANGES = {
  intro: [[0, 9.66]],
  verse1: [[9.66, 30.92]],
  chorus: [[30.92, 49.96], [84.4, 102.26], [154.84, 172.6]],
  verse2: [[49.96, 84.4]],
  bridge: [[102.26, 121.82]],
  verse3: [[121.82, 154.84]],
  outro: [[172.6, 184.1]],
};

export function buildStory(T, sections) {
  const shots = [];
  for (const [name, mod] of Object.entries(sections)) {
    const S = (t, stage, cam, set, fx) => {
      const ok = RANGES[name].some(([a, b]) => t >= a - 1e-6 && t < b - 1e-6);
      if (!ok) throw new Error(`section ${name}: shot at ${t.toFixed(2)} s is outside its range`);
      shots.push({ t, stage, cam, set, fx, section: name });
    };
    try {
      mod.shots(S, T);
    } catch (e) {
      console.error(`section ${name} shots failed:`, e);
      FAILED[name] = String(e && e.stack || e);
      for (const [a] of RANGES[name]) shots.push({ t: a, stage: 'proof', section: name });
    }
  }
  return shots;
}
