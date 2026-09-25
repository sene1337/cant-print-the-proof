// One printed note texture shared by every bridge stage (drawn once at boot).
import { banknote } from '../tex.js';

let cached = null;
export function bridgeNote() {
  if (!cached) cached = banknote({ seed: 8, serial: 'F 20080915 L' });
  return cached;
}
