// Tiny procedural sound effects (no audio assets needed).
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export type SoundKind = "dig" | "place" | "hurt" | "eat" | "click" | "pop" | "step";

export function playSound(kind: SoundKind, pitch = 1) {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  const gain = ac.createGain();
  gain.connect(ac.destination);

  if (kind === "dig" || kind === "place" || kind === "step") {
    // short filtered noise burst
    const length = Math.floor(ac.sampleRate * 0.12);
    const buffer = ac.createBuffer(1, length, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = kind === "place" ? 1400 : 900 * pitch;
    src.connect(filter);
    filter.connect(gain);
    gain.gain.setValueAtTime(kind === "step" ? 0.08 : 0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    src.start(now);
    src.stop(now + 0.13);
    return;
  }

  const osc = ac.createOscillator();
  osc.connect(gain);
  if (kind === "hurt") {
    osc.type = "square";
    osc.frequency.setValueAtTime(220 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.22);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.start(now);
    osc.stop(now + 0.26);
  } else if (kind === "eat") {
    osc.type = "triangle";
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.linearRampToValueAtTime(180, now + 0.18);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.21);
  } else if (kind === "pop") {
    osc.type = "sine";
    osc.frequency.setValueAtTime(520 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(880 * pitch, now + 0.08);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.start(now);
    osc.stop(now + 0.13);
  } else {
    osc.type = "square";
    osc.frequency.setValueAtTime(660 * pitch, now);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.09);
  }
}
