// VERSE 2 49.96-84.40 s. Owner: verse2 agent.
import { orbitCam, moveCam } from '../film.js';
import { clamp, lerp, smooth, easeOut, easeIn, easeInOut, easeOutBack, pulse, range } from '../util.js';

// Stage builders this section owns: { id: async (film) => stage }. Ids must be unique across the film.
export const stages = {};

// Add shots with S(t, stageId, cam, set, fx). Every shot must start inside this section's range.
export function shots(S, T) {
  S(49.96, 'proof', orbitCam({ target: [0, 0, 0], dist: [3, 2.5], az: [-20, 20], el: [10, 5] })); // placeholder
}
