// sound.js — generates all sound effects with the Web Audio API.
// No external audio files are used, per project requirements.

let audioCtx = null;
let enabled = true;

function ctx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

export function setSoundEnabled(value) {
  enabled = value;
}

function tone({ freq = 440, duration = 0.15, type = 'sine', gain = 0.18, delay = 0, glideTo = null }) {
  if (!enabled) return;
  try {
    const c = ctx();
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime + delay);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, c.currentTime + delay + duration);
    g.gain.setValueAtTime(0.0001, c.currentTime + delay);
    g.gain.exponentialRampToValueAtTime(gain, c.currentTime + delay + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + delay + duration);
    osc.connect(g).connect(c.destination);
    osc.start(c.currentTime + delay);
    osc.stop(c.currentTime + delay + duration + 0.05);
  } catch (err) {
    // Audio may be blocked before user interaction; fail silently.
  }
}

export const sounds = {
  flip: () => tone({ freq: 520, duration: 0.09, type: 'triangle', gain: 0.14 }),
  correct: () => {
    tone({ freq: 523.25, duration: 0.12, type: 'sine', gain: 0.2 });
    tone({ freq: 659.25, duration: 0.14, type: 'sine', gain: 0.2, delay: 0.1 });
    tone({ freq: 783.99, duration: 0.18, type: 'sine', gain: 0.2, delay: 0.2 });
  },
  wrong: () => tone({ freq: 220, duration: 0.22, type: 'sawtooth', gain: 0.14, glideTo: 140 }),
  hint: () => {
    tone({ freq: 660, duration: 0.1, type: 'sine', gain: 0.15 });
    tone({ freq: 880, duration: 0.12, type: 'sine', gain: 0.15, delay: 0.09 });
  },
  click: () => tone({ freq: 380, duration: 0.06, type: 'square', gain: 0.08 }),
  complete: () => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone({ freq: f, duration: 0.22, type: 'sine', gain: 0.2, delay: i * 0.12 }));
  },
  timerWarning: () => tone({ freq: 700, duration: 0.1, type: 'square', gain: 0.1 }),
};
