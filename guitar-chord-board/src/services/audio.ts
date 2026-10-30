import type { ChordShape } from "../types/chord";

/** 標準調弦，由六弦到一弦：E2 A2 D3 G3 B3 E4（MIDI 音高） */
const OPEN_STRING_MIDI = [40, 45, 50, 55, 59, 64] as const;
const STRUM_DELAY_SECONDS = 0.045;
const NOTE_SECONDS = 2.2;

type AudioContextConstructor = typeof AudioContext;

let audioContext: AudioContext | null = null;
const bufferCache = new Map<number, AudioBuffer>();

function getAudioContext(): AudioContext | null {
  if (audioContext) {
    return audioContext;
  }

  const Constructor: AudioContextConstructor | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextConstructor })
      .webkitAudioContext;

  if (!Constructor) {
    return null;
  }

  audioContext = new Constructor();
  return audioContext;
}

/** Karplus-Strong 撥弦合成：以延遲線加平均濾波模擬琴弦衰減。 */
function createPluckBuffer(audio: AudioContext, midi: number): AudioBuffer {
  const cached = bufferCache.get(midi);
  if (cached) {
    return cached;
  }

  const sampleRate = audio.sampleRate;
  const frequency = 440 * 2 ** ((midi - 69) / 12);
  const length = Math.floor(sampleRate * NOTE_SECONDS);
  const buffer = audio.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  const period = Math.max(2, Math.round(sampleRate / frequency));
  const line = new Float32Array(period);

  for (let index = 0; index < period; index += 1) {
    line[index] = Math.random() * 2 - 1;
  }

  // 先平滑一次初始雜訊，避免起音過於刺耳。
  for (let index = 0; index < period; index += 1) {
    line[index] = (line[index] + line[(index + 1) % period]) / 2;
  }

  let position = 0;
  for (let sample = 0; sample < length; sample += 1) {
    const current = line[position];
    const next = line[(position + 1) % period];
    data[sample] = current;
    line[position] = ((current + next) / 2) * 0.997;
    position = (position + 1) % period;
  }

  const fadeSamples = Math.floor(sampleRate * 0.12);
  for (let index = 0; index < fadeSamples; index += 1) {
    data[length - 1 - index] *= index / fadeSamples;
  }

  bufferCache.set(midi, buffer);
  return buffer;
}

export function isAudioSupported(): boolean {
  return typeof window !== "undefined" && (
    "AudioContext" in window || "webkitAudioContext" in window
  );
}

/** 由低音弦往高音弦掃弦播放。 */
export function playChordShape(shape: ChordShape): void {
  const audio = getAudioContext();
  if (!audio) {
    return;
  }

  void audio.resume().then(() => {
    const startTime = audio.currentTime + 0.02;
    let noteIndex = 0;

    shape.frets.forEach((fret, stringIndex) => {
      if (typeof fret !== "number") {
        return;
      }

      const source = audio.createBufferSource();
      source.buffer = createPluckBuffer(audio, OPEN_STRING_MIDI[stringIndex] + fret);

      const gain = audio.createGain();
      gain.gain.value = 0.2;

      source.connect(gain).connect(audio.destination);
      source.start(startTime + noteIndex * STRUM_DELAY_SECONDS);
      noteIndex += 1;
    });
  });
}
