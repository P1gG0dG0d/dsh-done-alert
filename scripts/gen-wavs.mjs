// Generates the two shipped chimes (assets/done.wav, assets/attention.wav).
//
//   done.wav      : WeChat-like rising two-tone  G5 (784 Hz) -> C6 (1046.5 Hz)
//   attention.wav : brighter rising two-tone     B5 (987.8 Hz) -> E6 (1318.5 Hz)
//
// Pure-node PCM synthesis: 44.1 kHz, 16-bit mono, soft 5 ms attack,
// exponential decay. Run once via `pnpm run gen:wavs` (or `node scripts/gen-wavs.mjs`);
// the rendered files are committed with the package.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RATE = 44100;

function tone(freq, seconds, { gain = 0.45, tau = 0.14, attack = 0.005 } = {}) {
  const n = Math.round(seconds * RATE);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const attackEnv = Math.min(1, t / attack);
    const decay = Math.exp(-t / tau);
    // A touch of the second harmonic keeps the chime from sounding like a beep.
    const sample = Math.sin(2 * Math.PI * freq * t) + 0.25 * Math.sin(4 * Math.PI * freq * t);
    out[i] = gain * attackEnv * decay * sample;
  }
  return out;
}

function render(segments) {
  const total = segments.reduce((sum, [, samples]) => sum + samples.length, 0);
  const mix = new Float64Array(total);
  let cursor = 0;
  for (const [, samples] of segments) {
    for (let i = 0; i < samples.length; i++) mix[cursor + i] += samples[i];
    cursor += samples.length;
  }
  // 12 ms of trailing room so the release never clicks.
  const tail = Math.round(0.012 * RATE);
  const pcm = new Int16Array(total + tail);
  for (let i = 0; i < total; i++) {
    const v = Math.max(-1, Math.min(1, mix[i]));
    pcm[i] = Math.round(v * 32767);
  }
  return pcm;
}

function wav(pcm) {
  const header = Buffer.alloc(44);
  const dataBytes = pcm.length * 2;
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + dataBytes, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(dataBytes, 40);
  return Buffer.concat([header, Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength)]);
}

const gap = (seconds) => new Float64Array(Math.round(seconds * RATE));

const done = render([
  ["g5", tone(784, 0.16, { gain: 0.4, tau: 0.09 })],
  ["gap", gap(0.02)],
  ["c6", tone(1046.5, 0.34, { gain: 0.46, tau: 0.17 })],
]);

const attention = render([
  ["b5", tone(987.8, 0.14, { gain: 0.4, tau: 0.08 })],
  ["gap", gap(0.02)],
  ["e6", tone(1318.5, 0.3, { gain: 0.44, tau: 0.15 })],
]);

const here = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(here, "..", "assets", "done.wav"), wav(done));
writeFileSync(join(here, "..", "assets", "attention.wav"), wav(attention));
console.log("wrote assets/done.wav and assets/attention.wav");
