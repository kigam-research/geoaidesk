"""Music and sound effects for the GAID 45-second film, synthesised as one piece (plan: PLAN.md, "Sound").

96 BPM, D major, bars D – A – Bm – G; every note and effect sits on the 16th grid counted from frame 0. Effects share the
key and the reverb of the music and sit under it. render(path, seconds) writes a 48 kHz stereo 16-bit WAV and returns
level readings (peak and RMS in dBFS).

uv run --no-project --with numpy==2.3.4 python geo/promo/day45/soundtrack.py <out.wav>
"""

from __future__ import annotations

import sys
import wave
from pathlib import Path

import numpy as np

SR = 48000
BEAT = 60 / 96
BAR = 4 * BEAT
S16 = BEAT / 4
CHORDS = [  # per bar: bass root, chord tones (MIDI)
    (38, [62, 66, 69]),  # D
    (45, [61, 64, 69]),  # A
    (47, [59, 62, 66]),  # Bm
    (43, [59, 62, 67]),  # G
]
SCALE = [62, 64, 66, 67, 69, 71, 73, 74]  # D major from D4


def hz(m: float) -> float:
    return 440.0 * 2 ** ((m - 69) / 12)


class Mix:
    def __init__(self, seconds: float):
        self.n = int(round(seconds * SR))
        self.dry = np.zeros((self.n, 2))
        self.wet = np.zeros((self.n, 2))
        self.times: list[float] = []

    def add(self, t: float, sig: np.ndarray, gain=1.0, pan=0.0, send=0.0):
        self.times.append(t)
        i = int(round(t * SR))
        if i >= self.n or len(sig) == 0:
            return
        sig = sig[: self.n - i] * gain
        left, right = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        st = np.stack([sig * left, sig * right], axis=1)
        self.dry[i:i + len(sig)] += st
        if send:
            self.wet[i:i + len(sig)] += st * send


rng = np.random.default_rng(96)


def env(n, a=0.005, d=0.3):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)


def lp(x, cut):
    """Cheap low-pass for long signals: moving average whose width follows the cut-off."""
    w = max(1, int(SR / cut / 2))
    return np.convolve(x, np.ones(w) / w, mode="same")


def kick(level=1.0):
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 45 + 85 * np.exp(-t / 0.03)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return level * np.sin(ph) * np.exp(-t / 0.16) + 0.15 * level * rng.standard_normal(n) * np.exp(-t / 0.004)


def noise_hit(dur, decay, hp=True):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    if hp:
        x = x - lp(x, 2500)
    return x * env(n, 0.001, decay)


def clap():
    out = np.zeros(int(0.3 * SR))
    for k, d in enumerate([0, 0.009, 0.018]):
        hit = noise_hit(0.3, 0.012 if k < 2 else 0.09)
        hit = lp(hit, 6000)
        i = int(d * SR)
        out[i:] += hit[: len(out) - i]
    return out


def tone(m, dur, decay, harm=(1.0, 0.25, 0.08), a=0.004):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = hz(m)
    x = sum(h * np.sin(2 * np.pi * f * (k + 1) * t) for k, h in enumerate(harm))
    return x * env(n, a, decay)


def bass(m, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = hz(m)
    x = sum(np.sin(2 * np.pi * f * k * t) / k for k in range(1, 7))
    x = lp(x, 900)
    e = np.minimum(1, t / 0.006) * (0.55 + 0.45 * np.exp(-t / 0.12)) * np.minimum(1, (dur - t) / 0.03)
    return 0.6 * x * e


def pad(ms, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for m in ms:
        for det in (-0.08, 0.0, 0.08):
            x += np.sin(2 * np.pi * hz(m + det) * t) + 0.18 * np.sin(2 * np.pi * hz(m + det) * 2 * t)
    e = np.minimum(1, t / 0.35) * np.minimum(1, (dur - t) / 0.4)
    return x * e / (len(ms) * 3)


def bell(m, dur=1.6, decay=0.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = hz(m)
    return (np.sin(2 * np.pi * f * t) * np.exp(-t / decay) + 0.35 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / (decay / 3))
            + 0.15 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t / (decay / 6)))


def impact():
    n = int(2.2 * SR)
    t = np.arange(n) / SR
    low = np.sin(2 * np.pi * (40 + 30 * np.exp(-t / 0.08)) * t) * np.exp(-t / 0.7)
    body = lp(rng.standard_normal(n), 400) * np.exp(-t / 0.25) * 2.5
    return 0.9 * low + body


def whoosh(dur=0.5, rise=True):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = rng.standard_normal(n)
    lo, hi = lp(x, 600), lp(x, 4000)
    k = t / dur if rise else 1 - t / dur
    x = (1 - k) * lo + k * (hi - lo)
    shape = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2
    return x * shape


def riser(dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = rng.standard_normal(n)
    x = x - lp(x, 1500)
    sweep = np.sin(2 * np.pi * np.cumsum(300 + 1500 * (t / dur) ** 2) / SR)
    return (0.6 * x + 0.25 * sweep) * (t / dur) ** 2.2


def reverb(wet: np.ndarray, length=1.4) -> np.ndarray:
    n = int(length * SR)
    t = np.arange(n) / SR
    out = np.zeros_like(wet)
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-t / (length / 5))
        ir = lp(ir, 5000)
        ir /= np.sqrt(np.sum(ir ** 2))
        size = 1 << int(np.ceil(np.log2(len(wet) + n)))
        y = np.fft.irfft(np.fft.rfft(wet[:, ch], size) * np.fft.rfft(ir, size), size)[: len(wet)]
        out[:, ch] = y
    return out


def compose(seconds: float) -> Mix:
    mx = Mix(seconds)
    bars = int(round(seconds / BAR))
    END = 16.5 * BAR  # 41.25 s: the end chord
    for b in range(bars):
        t0 = b * BAR
        root, ch = CHORDS[b % 4]
        hook = b < 2
        hub = b in (11, 12)
        outro = t0 >= END
        if outro:
            continue
        # pad from bar 1 (quiet in the hook)
        mx.add(t0, pad(ch, BAR + 0.3), gain=0.10 if hook else 0.16, send=0.5)
        # hats: 16ths clock in the hook, 8ths later, open on the off-beats in the hub
        for s in range(16):
            ts = t0 + s * S16
            if hook:
                mx.add(ts, noise_hit(0.06, 0.012), gain=0.05 + (0.03 if s % 4 == 0 else 0), pan=0.3)
            elif s % 2 == 0:
                mx.add(ts, noise_hit(0.08, 0.018), gain=0.07 if s % 4 else 0.05, pan=0.25)
            if hub and s % 4 == 2:
                mx.add(ts, noise_hit(0.3, 0.09), gain=0.06, pan=-0.2)
        if hook:
            # muted plucks: a nervous pattern on the chord tones, low-passed
            pat = [0, 2, 3, 6, 7, 9, 12, 14]
            for k, s in enumerate(pat):
                m = (ch + [c + 12 for c in ch])[(k * 2 + b) % 6]
                mx.add(t0 + s * S16, lp(tone(m, 0.25, 0.05), 1800), gain=0.16, pan=(-0.4 if k % 2 else 0.4), send=0.2)
            continue
        # kick on 1 and 3; clap on 2 and 4 from bar 5 except the evening and the night
        for beat in (0, 2):
            mx.add(t0 + beat * BEAT, kick(), gain=0.55)
        if 4 <= b < 13:
            for beat in (1, 3):
                mx.add(t0 + beat * BEAT, clap(), gain=0.22, send=0.25)
        # bass: root on 1, the 8th before 3, 3, and 4&
        for pos, dur in ((0, 0.55), (1.5, 0.28), (2, 0.55), (3.5, 0.28)):
            mx.add(t0 + pos * BEAT, bass(root, dur), gain=0.42)
        # arpeggio from bar 4: 8ths over the chord, an octave up, alternating sides
        if b >= 3:
            order = [0, 1, 2, 1, 0, 2, 1, 2]
            for k in range(8):
                m = ch[order[k]] + 12
                mx.add(t0 + k * BEAT / 2, tone(m, 0.4, 0.14, (1.0, 0.3, 0.12)), gain=0.13 if b < 13 else 0.10,
                       pan=-0.35 if k % 2 else 0.35, send=0.35)
        if hub:
            mel = [74, 78, 81, 78] if b == 11 else [81, 83, 85, 86]
            for k, m in enumerate(mel):
                mx.add(t0 + k * BEAT, bell(m, 1.2, 0.45), gain=0.09, pan=0.15, send=0.5)

    # ---- effects (same key, under the music) ----
    def tick(t, m, g=0.12, pan=0.0):
        mx.add(t, tone(m, 0.25, 0.06, (1.0, 0.4)), gain=g, pan=pan, send=0.3)

    mx.add(1.5 * BAR, riser(0.5 * BAR), gain=0.10, send=0.2)                         # into the stamp
    mx.add(5.0 - S16, whoosh(0.45), gain=0.10, send=0.3)                              # blue wipe
    mx.add(5.0, impact(), gain=0.32, send=0.25)                                        # stamp
    mx.add(5.0, pad([62, 66, 69, 74], 1.6), gain=0.22, send=0.6)                       # chord stab
    mx.add(5.0, tone(86, 1.2, 0.35, (1.0, 0.3)), gain=0.08, send=0.6)
    mx.add(6.5625, whoosh(0.6, rise=False), gain=0.06, send=0.3)                       # field folds into the orbit
    for i in range(5):                                                                  # pieces land on the shelves
        tick(8.4375 + i * S16, SCALE[(i * 2) % 8] + 12, 0.07, pan=-0.3 + 0.15 * i)
    for j, t in enumerate((11.25, 11.875, 12.5, 13.125)):                              # highlights
        tick(t, [69, 71, 73, 74][j] + 12, 0.08)
    for j in range(4):                                                                  # lines become steps
        tick(13.75 + j * BEAT / 2 + BEAT, [62, 66, 69, 74][j] + 12, 0.09, pan=0.3)
    for j, t in enumerate((15.625, 16.25, 16.875, 17.5)):                              # the AI agent passes a step
        mx.add(t, bell([74, 78, 81, 86][j], 1.0, 0.35), gain=0.07, pan=0.25, send=0.4)
    mx.add(21.25, kick(0.6), gain=0.25)                                                 # 내 자료 drops in
    tick(21.25, 81, 0.09)
    for j, t in enumerate((23.75, 24.375, 25.0, 25.625)):                              # the map fills, step by step
        mx.add(t, bell([74, 76, 78, 81][j], 1.0, 0.3), gain=0.06, pan=-0.2, send=0.4)
    mx.add(27.5 - S16, whoosh(0.45), gain=0.10, send=0.3)                               # into the hub
    for i in range(4):                                                                  # colleagues appear
        tick(28.125 + i * BEAT / 2, [74, 78, 81, 86][i], 0.07, pan=[-0.5, -0.2, 0.2, 0.5][i])
    for m in (86, 90, 93):                                                              # version 0.1.1
        mx.add(30.625, bell(m, 1.8, 0.7), gain=0.07, pan=0.1, send=0.6)
    mx.add(32.5 - 2 * S16, whoosh(0.35, rise=False), gain=0.08, send=0.3)                # back to the desk
    tick(33.75, 81, 0.08); tick(34.0625, 85, 0.08)                                      # evidence marks
    tick(35.9375, 74, 0.10)                                                             # the note is home
    for i in range(8):                                                                  # the loop closes
        tick(36.25 + i * S16, SCALE[i] + 12, 0.045, pan=-0.4 + 0.1 * i)
    for i in range(8):                                                                  # rings of colleagues
        tick(37.5 + i * BEAT / 4, SCALE[(i * 3) % 8] + 12, 0.04, pan=-0.6 + 0.15 * i)
    mx.add(39.0625, riser(END - 39.0625), gain=0.11, send=0.2)                         # into the end card
    mx.add(END, impact(), gain=0.26, send=0.3)
    mx.add(END, pad([50, 62, 66, 69, 76], seconds - END), gain=0.30, send=0.7)         # Dadd9
    mx.add(END, bell(86, 3.5, 1.2), gain=0.08, send=0.6)
    mx.add(END, bass(38, 1.8), gain=0.40)
    return mx


def render(path: Path, seconds: float) -> dict:
    mx = compose(seconds)
    y = mx.dry + 0.6 * reverb(mx.wet)
    rms = np.sqrt(np.mean(y ** 2))
    y *= 10 ** (-16 / 20) / max(rms, 1e-9)                  # overall RMS about −16 dBFS
    y = np.tanh(y * 1.1) / np.tanh(1.1)                        # gentle soft clip
    fade = int(0.4 * SR)
    y[-fade:] *= np.linspace(1, 0, fade)[:, None]
    peak = np.max(np.abs(y))
    if peak > 10 ** (-1 / 20):
        y *= 10 ** (-1 / 20) / peak
    pcm = (np.clip(y, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    return {
        "samples": int(len(y)), "rate": SR, "bpm": 96,
        "events": len(mx.times),
        "events_off_grid": [round(t, 4) for t in mx.times if abs(t / S16 - round(t / S16)) * S16 > 0.001],
        "peak_dbfs": round(float(20 * np.log10(np.max(np.abs(y)))), 2),
        "rms_dbfs": round(float(20 * np.log10(np.sqrt(np.mean(y ** 2)))), 2),
    }


if __name__ == "__main__":
    print(render(Path(sys.argv[1]), 45.0))
