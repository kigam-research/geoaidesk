"""Synthesise the v4_brag soundtrack: music and sound effects as one mixed stereo piece (brag-slim "Sound").

uv run --no-project --with numpy==2.5.4 --with scipy==1.18.1 \
  python geo/promo/brag/soundtrack.py --cues <cues.json> --out <dir>

Everything is generated here from oscillators and noise (no samples, no recordings): 100 BPM, 4/4, D major, 42 bars
(100.8 s). The arrangement follows the sections of brag-plan.md; the effects come from the scene's cues
(window.motion.cues), snapped to the sixteenth-note grid, pitched to the chord of their bar and sent to the same reverb
as the music. The noise generators use a fixed seed, so the same cues give the same file.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import wave
from pathlib import Path

import numpy as np
from scipy import signal

SR = 48_000
BPM = 100
BEAT = 60 / BPM  # 0.6 s = 18 frames at 30 fps
BAR = 4 * BEAT
BARS = 42
SIXTEENTH = BEAT / 4
DURATION = BARS * BAR
N = round(DURATION * SR)
RNG = np.random.default_rng(20261024)

# ---------- harmony ----------
CHORDS = {  # pitch classes (top voices) and bass pitch class
    "D": ([2, 6, 9, 4], 2), "A": ([9, 1, 4, 11], 9), "Bm": ([11, 2, 6, 1], 11), "G": ([7, 11, 2, 9], 7),
    "Em": ([4, 7, 11, 2], 4), "Gmaj7": ([7, 11, 2, 6], 7), "Em7": ([4, 7, 11, 2], 4), "Asus": ([9, 2, 4, 11], 9),
    "Dadd9": ([2, 6, 9, 4], 2),
}
PROG = ["Bm", "G", "Em", "Asus", "D", "A", "Bm", "G", "D", "A", "Bm"]
PROG += [["D", "A", "Bm", "G"][(b - 11) % 4] for b in range(11, 37)]
PROG += ["Gmaj7", "Em7", "Asus", "Dadd9", "Dadd9"]
assert len(PROG) == BARS

# sections (bars, inclusive start, exclusive end) and the instrument levels per section
SECTIONS = [
    # name,      a,  b,  pad, bright, bass, kick, hat, clap, arp, lead
    ("hook", 0, 2, 0.75, 1100, 0.7, 0.7, 0.0, 0.0, 0.0, 0.0),
    ("scatter", 2, 4, 0.75, 1300, 0.7, 0.7, 0.4, 0.0, 0.0, 0.0),
    ("reveal", 4, 6, 1.0, 2600, 1.0, 1.0, 0.6, 0.0, 0.55, 0.0),
    ("title", 6, 8, 1.0, 2200, 0.7, 0.55, 0.0, 0.0, 0.45, 0.0),
    ("cycle", 8, 11, 0.85, 2000, 0.9, 0.9, 0.6, 0.5, 0.6, 0.0),
    ("library", 11, 14, 0.75, 1900, 0.9, 0.9, 0.6, 0.55, 0.5, 0.0),
    ("hub", 14, 23, 0.8, 2400, 0.95, 0.95, 0.65, 0.6, 0.55, 0.55),
    ("analysis", 23, 30, 0.8, 2300, 1.0, 1.0, 0.75, 0.65, 0.6, 0.0),
    ("note", 30, 33, 0.7, 1500, 0.6, 0.45, 0.3, 0.0, 0.5, 0.0),
    ("return", 33, 37, 0.85, 2300, 0.95, 0.95, 0.65, 0.6, 0.6, 0.35),
    ("brain", 37, 40, 1.0, 2800, 1.0, 1.0, 0.65, 0.6, 0.6, 0.45),
    ("closing", 40, 42, 0.9, 1800, 0.6, 0.0, 0.0, 0.0, 0.35, 0.0),
]
KEYS = ("pad", "bright", "bass", "kick", "hat", "clap", "arp", "lead")


def section(bar: int) -> dict:
    for name, a, b, *vals in SECTIONS:
        if a <= bar < b:
            return {"name": name, **dict(zip(KEYS, vals))}
    raise ValueError(bar)


def hz(midi: float) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


def voice(pcs: list[int], centre: int) -> list[int]:
    """Closest voicing of the pitch classes around a centre note (smooth pad movement)."""
    notes = []
    for pc in pcs:
        k = round((centre - pc) / 12)
        notes.append(pc + 12 * k)
    return sorted(notes)


def chord_at(t: float) -> tuple[list[int], int]:
    return CHORDS[PROG[min(BARS - 1, int(t / BAR + 1e-9))]]


def tone_at(t: float, octave: int, step: int = 0) -> float:
    """A chord tone of the bar at time t, `step` up the chord from its root, in MIDI (octave 4 = from D4 for a D chord)."""
    pcs, root = chord_at(t)
    ivs = sorted({(p - root) % 12 for p in [root, *pcs[:3]]})
    return 12 * (octave + 1) + root + ivs[step % len(ivs)] + 12 * (step // len(ivs))


# ---------- buffers ----------
class Bus:
    def __init__(self, n: int | None = None):
        self.x = np.zeros((2, (n or N) + SR * 4))

    def add(self, start: float, mono: np.ndarray, gain: float = 1.0, pan: float = 0.0):
        i = round(start * SR)
        if i < 0:
            mono, i = mono[-i:], 0
        j = min(i + len(mono), self.x.shape[1])
        left, right = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        self.x[0, i:j] += gain * left * mono[: j - i] * np.sqrt(2)
        self.x[1, i:j] += gain * right * mono[: j - i] * np.sqrt(2)

    def add2(self, start: float, st: np.ndarray, gain: float = 1.0):
        i = round(start * SR)
        j = min(i + st.shape[1], self.x.shape[1])
        self.x[:, i:j] += gain * st[:, : j - i]


def tt(seconds: float) -> np.ndarray:
    return np.arange(round(seconds * SR)) / SR


def env_adsr(n: int, a: float, d: float, s: float, r: float, hold: float) -> np.ndarray:
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    rel = np.clip((t - hold) / max(r, 1e-4), 0, 1)
    return e * (1 - rel) ** 2


def lowpass(x: np.ndarray, fc: float, order: int = 2) -> np.ndarray:
    sos = signal.butter(order, min(fc, SR * 0.45), "low", fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=-1)


def highpass(x: np.ndarray, fc: float, order: int = 2) -> np.ndarray:
    sos = signal.butter(order, fc, "high", fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=-1)


def bandpass(x: np.ndarray, lo: float, hi: float, order: int = 2) -> np.ndarray:
    sos = signal.butter(order, [lo, hi], "band", fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=-1)


_TABLES: dict[int, np.ndarray] = {}


def saw_table(max_h: int) -> np.ndarray:
    if max_h not in _TABLES:
        ph = np.arange(4096) / 4096
        _TABLES[max_h] = sum(np.sin(2 * np.pi * k * ph) / k * (1 - k / (max_h + 1)) for k in range(1, max_h + 1))
    return _TABLES[max_h]


def osc_saw(f: float, n: int, phase0: float = 0.0) -> np.ndarray:
    max_h = int(max(1, min(40, 7000 // f)))
    tab = saw_table(max_h)
    ph = (phase0 + f * np.arange(n) / SR) % 1.0
    return np.interp(ph * 4096, np.arange(4097), np.append(tab, tab[0]))


# ---------- instruments ----------
def pad_chord(bus: Bus, start: float, dur: float, midi: list[int], level: float, bright: float):
    n = round((dur + 1.2) * SR)
    st = np.zeros((2, n))
    for vi, m in enumerate(midi):
        f = hz(m)
        for side, cents in ((0, -6), (1, 6)):
            x = osc_saw(f * 2 ** (cents / 1200), n, RNG.random()) + 0.6 * osc_saw(f * 2 ** (-cents / 2400), n, RNG.random())
            st[side] += x * (0.9 if vi else 1.0)
    st = lowpass(st, bright, 2)
    e = env_adsr(n, 0.35, 0.8, 0.8, 1.0, dur)
    bus.add2(start, st * e * level * 0.05)


def bass_note(bus: Bus, start: float, dur: float, midi: float, level: float):
    n = round((dur + 0.08) * SR)
    t = np.arange(n) / SR
    f = hz(midi)
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) + 0.25 * lowpass(osc_saw(f, n), 380)
    e = env_adsr(n, 0.006, 0.18, 0.55, 0.06, dur)
    bus.add(start, x * e * level * 0.28)


def kick(bus: Bus, start: float, level: float):
    t = tt(0.42)
    f = 46 + 70 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t / 0.22)
    click = lowpass(RNG.standard_normal(len(t)) * np.exp(-t / 0.002), 2500)
    bus.add(start, (x + 0.15 * click) * level * 0.55)


def hat(bus: Bus, start: float, level: float, open_: bool = False):
    t = tt(0.2 if open_ else 0.06)
    x = highpass(RNG.standard_normal(len(t)), 7500, 2) * np.exp(-t / (0.06 if open_ else 0.018))
    bus.add(start, x * level * 0.075, pan=0.3)


def clap(bus: Bus, start: float, level: float):
    t = tt(0.3)
    noise = bandpass(RNG.standard_normal(len(t)), 900, 4500) * np.exp(-t / 0.09)
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.04)
    bus.add(start, (noise + 0.35 * body) * level * 0.13, pan=-0.1)


def pluck(bus: Bus, start: float, midi: float, level: float, pan: float = 0.0, decay: float = 0.45):
    t = tt(decay * 3)
    f = hz(midi)
    x = np.zeros_like(t)
    for k in range(1, 9):
        if k * f > 9000:
            break
        x += np.sin(2 * np.pi * k * f * t) / k ** 1.3 * np.exp(-t * (1 / decay) * (1 + 0.6 * (k - 1)))
    x *= np.minimum(1, t / 0.003)
    bus.add(start, x * level * 0.12, pan=pan)


def bell(bus: Bus, start: float, midi: float, level: float, pan: float = 0.0, ratio: float = 3.5, decay: float = 1.4, index: float = 2.2):
    t = tt(decay * 3)
    f = hz(midi)
    imod = index * np.exp(-t / 0.25)
    x = np.sin(2 * np.pi * f * t + imod * np.sin(2 * np.pi * f * ratio * t)) * np.exp(-t / decay)
    x *= np.minimum(1, t / 0.004)
    bus.add(start, x * level * 0.09, pan=pan)


def lead_note(bus: Bus, start: float, dur: float, midi: float, level: float):
    n = round((dur + 0.4) * SR)
    t = np.arange(n) / SR
    f = hz(midi) * (1 + 0.004 * np.sin(2 * np.pi * 5.2 * t) * np.clip((t - 0.25) / 0.3, 0, 1))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) + 0.18 * np.sin(2 * ph) + 0.08 * np.sin(3 * ph)
    e = env_adsr(n, 0.05, 0.4, 0.75, 0.35, dur)
    bus.add(start, x * e * level * 0.075, pan=-0.15)


def whoosh(bus: Bus, end: float, level: float, length: float = 0.6):
    t = tt(length + 0.25)
    n = len(t)
    noise = RNG.standard_normal(n)
    lo, hi = bandpass(noise, 250, 900), bandpass(noise, 1200, 5000)
    u = np.clip(t / length, 0, 1)
    swell = np.where(t < length, u ** 2, np.exp(-(t - length) / 0.06))
    x = (lo * (1 - u) + hi * u * 0.6) * swell
    bus.add(end - length, x * level * 0.05, pan=0.0)


def tom(bus: Bus, start: float, midi: float, level: float):
    t = tt(0.5)
    f = hz(midi) * (1 + 0.5 * np.exp(-t / 0.03))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.18)
    bus.add(start, x * level * 0.22)


def riser(bus: Bus, end: float, length: float, level: float, midi0: float):
    t = tt(length)
    u = t / length
    noise = RNG.standard_normal(len(t))
    lo = bandpass(noise, 300, 1500)
    hi = bandpass(noise, 2000, 8000)
    f = hz(midi0) * 2 ** u
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.4
    x = ((1 - u) * lo + u * hi * 0.7 + tone) * u ** 2.2
    bus.add(end - length, x * level * 0.07)


def impact(bus: Bus, start: float, level: float):
    t = tt(2.5)
    f = 58 * np.exp(-t / 1.5) + 34
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.7)
    burst = lowpass(RNG.standard_normal(len(t)), 1400) * np.exp(-t / 0.18)
    bus.add(start, (sub * 0.9 + burst * 0.35) * level * 0.5)


# ---------- reverb (one shared space) ----------
def reverb_ir(seconds: float = 2.4, decay: float = 0.5) -> np.ndarray:
    t = tt(seconds)
    ir = RNG.standard_normal((2, len(t))) * np.exp(-t / decay)
    ir = lowpass(ir, 5500, 2)
    pre = round(0.018 * SR)
    ir = np.concatenate([np.zeros((2, pre)), ir], axis=1)
    for d, g in ((0.011, 0.5), (0.023, 0.35), (0.037, 0.3), (0.051, 0.2)):
        i = round(d * SR)
        ir[0, i] += g
        ir[1, i + round(0.003 * SR)] += g
    return ir / np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True))


def reverb(x: np.ndarray, ir: np.ndarray) -> np.ndarray:
    return np.stack([signal.fftconvolve(x[c], ir[c])[: x.shape[1]] for c in range(2)])


# ---------- composition ----------
def compose(cues: list[dict]) -> dict[str, np.ndarray]:
    pad, bass, drums, arp, lead, fx = Bus(), Bus(), Bus(), Bus(), Bus(), Bus()
    kick_times = []
    centre = 62
    for b in range(BARS):
        s = section(b)
        t0 = b * BAR
        pcs, root = CHORDS[PROG[b]]
        voicing = voice(pcs, centre)
        pad_chord(pad, t0, BAR, voicing, s["pad"], s["bright"])
        # bass: eighths on the root; octave on the last off-beat of the bar in groove sections
        rootm = 36 + ((root - 0) % 12)
        if rootm > 43:
            rootm -= 12
        for e in range(8):
            if s["bass"] <= 0:
                break
            if s["name"] in ("title", "closing") and e % 4:
                continue
            if s["name"] == "note" and e % 2:
                continue
            m = rootm + (12 if e == 7 and s["kick"] >= 0.9 else 0)
            accent = 1.0 if e % 2 == 0 else 0.75
            dur = BEAT * (2 if s["name"] in ("title", "closing") else 0.5) * 0.92
            bass_note(bass, t0 + e * BEAT / 2, dur, m, s["bass"] * accent)
        # drums
        for q in range(4):
            tq = t0 + q * BEAT
            four = s["kick"] >= 0.9 and s["name"] not in ("title",)
            if s["kick"] > 0 and (four or q in ((0, 2) if s["name"] in ("hook", "scatter") else (0,))):
                kick(drums, tq, s["kick"] * (1 if q == 0 else 0.85))
                kick_times.append(tq)
            if s["hat"] > 0:
                hat(drums, tq + BEAT / 2, s["hat"])
                if s["name"] == "analysis":
                    hat(drums, tq + BEAT / 4, s["hat"] * 0.4)
                    hat(drums, tq + 3 * BEAT / 4, s["hat"] * 0.4)
            if s["clap"] > 0 and q in (1, 3):
                clap(drums, tq, s["clap"])
        # arp: chord tones up and down on eighths, octave 4–5
        if s["arp"] > 0:
            order = [0, 1, 2, 3, 2, 1, 2, 3] if s["name"] not in ("title", "closing") else [0, 2, 3, 5]
            step = BEAT / 2 if len(order) == 8 else BEAT
            for k, d in enumerate(order):
                pluck(arp, t0 + k * step, tone_at(t0, 4, d + 1), s["arp"] * (1 if k % 2 == 0 else 0.7), pan=0.35 * np.sin(k), decay=0.35)
        # lead motif (hub, return, brain): third → fifth → octave root, half notes
        if s["lead"] > 0:
            motif = [(0, 2, 2), (2, 1, 1), (3, 1, 3)]  # (beat, length, chord step)
            if b % 2:
                motif = [(0, 3, 4), (3, 1, 2)]
            for beat, length, stp in motif:
                lead_note(lead, t0 + beat * BEAT, length * BEAT * 0.95, tone_at(t0, 5, stp), s["lead"])
        centre = voicing[len(voicing) // 2] if abs(voicing[len(voicing) // 2] - 62) < 6 else 62

    # risers into the reveal, the demo and the second brain
    riser(fx, 4 * BAR, 2 * BEAT, 0.9, 50)
    riser(fx, 11 * BAR, BEAT, 0.45, 57)
    riser(fx, 37 * BAR, 2 * BEAT, 0.7, 55)
    # cues from the scene, snapped to the sixteenth grid
    log = []
    for c in cues:
        t = round(c["t"] / SIXTEENTH) * SIXTEENTH
        k = c["kind"]
        step = c.get("step", 0)
        if t >= DURATION - 0.2:
            continue
        log.append({"kind": k, "t_scene": c["t"], "t": round(t, 4)})
        if k == "pop":
            pluck(fx, t, tone_at(t, 5, step * 2), 0.9, pan=(step - 1) * 0.5, decay=0.5)
            bell(fx, t, tone_at(t, 4, step), 0.35, pan=(step - 1) * 0.5, ratio=2.0, decay=0.8)
        elif k == "tick":
            pluck(fx, t, tone_at(t, 5, step), 0.45, pan=0.7 * np.sin(step * 2.1), decay=0.25)
        elif k == "hit":
            impact(fx, t, 1.0)
            for i in range(4):
                bell(fx, t, tone_at(t, 4, i), 0.5, pan=(i - 1.5) * 0.3, ratio=2.0, decay=1.8, index=1.4)
        elif k == "fly":
            pluck(fx, t, tone_at(t, 4, step), 0.55, pan=0.4 * np.cos(step), decay=0.4)
        elif k in ("join", "bump"):
            bell(fx, t, tone_at(t, 5, 2 if k == "join" else 4), 0.7, ratio=3.5, decay=1.6)
        elif k == "logo":
            for i in range(6):
                bell(fx, t + i * SIXTEENTH, tone_at(t, 5, i), 0.42 - 0.04 * i, pan=(i - 2.5) * 0.25, ratio=2.0, decay=2.0, index=1.0)
        elif k == "soft":
            bell(fx, t, tone_at(t, 4, 2), 0.35, ratio=2.0, decay=1.5, index=0.8)
        elif k == "station":
            pluck(fx, t, tone_at(t, 5, step), 0.6, pan=0.5 * np.cos(step * 1.3), decay=0.5)
        elif k == "chapter":
            whoosh(fx, t, 0.9)
            tom(fx, t, tone_at(t, 2, 0), 0.7)
            if c.get("hub"):
                bell(fx, t, tone_at(t, 5, 0), 0.4, ratio=3.5, decay=1.2)
        elif k == "shot":
            hat(fx, t, 0.6)
            tom(fx, t, tone_at(t, 2, 0), 0.25)
        elif k == "tag":
            bell(fx, t, tone_at(t, 5, (len(log) * 2) % 4), 0.42, pan=0.3 * np.sin(len(log)), ratio=3.5, decay=0.9, index=1.6)
        else:
            raise ValueError(f"unknown cue kind {k}")

    stems = {name: bus.x for name, bus in (("pad", pad), ("bass", bass), ("drums", drums), ("arp", arp), ("lead", lead), ("fx", fx))}
    return stems, log, kick_times


def duck(kick_times: list[float], depth: float = 0.3) -> np.ndarray:
    g = np.ones(N + SR * 4)
    t = tt(0.3)
    shape = 1 - depth * np.exp(-t / 0.09) * np.minimum(1, t / 0.004 + 0.4)
    for k in kick_times:
        i = round(k * SR)
        g[i : i + len(shape)] = np.minimum(g[i : i + len(shape)], shape[: len(g) - i])
    return g


def limiter(x: np.ndarray, ceiling: float) -> np.ndarray:
    from scipy.ndimage import maximum_filter1d, uniform_filter1d

    peak = np.max(np.abs(x), axis=0)
    look = round(0.004 * SR)
    env = maximum_filter1d(peak, size=2 * look + 1)
    hard = np.minimum(1.0, ceiling / np.maximum(env, 1e-9))
    gain = np.minimum(uniform_filter1d(hard, size=look), hard)
    return x * gain


def mix(stems: dict[str, np.ndarray], kick_times: list[float]) -> tuple[np.ndarray, dict]:
    ir = reverb_ir()
    g = duck(kick_times)
    levels = {"pad": 1.25, "bass": 0.5, "drums": 0.9, "arp": 2.2, "lead": 3.0, "fx": 1.4}
    sends = {"pad": 0.3, "bass": 0.0, "drums": 0.08, "arp": 0.35, "lead": 0.35, "fx": 0.45}
    dry = np.zeros_like(stems["pad"])
    wet_in = np.zeros_like(stems["pad"])
    for name, x in stems.items():
        y = x * levels[name]
        if name in ("pad", "arp", "lead"):
            y = y * g
        dry += y
        wet_in += y * sends[name]
    wet = reverb(highpass(wet_in, 180), ir)
    out = dry + 0.55 * wet
    out = highpass(out, 28, 2)
    out = out[:, :N]
    # end: the final chord fades to silence on the last frame; tiny fade-in on the first samples
    t = np.arange(N) / SR
    fade = np.clip((DURATION - t) / 2.0, 0, 1) ** 1.5
    fade *= np.clip(t / 0.004, 0, 1)
    out *= fade
    # loudness: RMS of the busiest section to -16 dBFS, then a soft peak limiter at -1 dBFS
    a, b = round(23 * BAR * SR), round(30 * BAR * SR)
    rms = np.sqrt(np.mean(out[:, a:b] ** 2))
    out *= 10 ** (-16 / 20) / rms
    out = np.tanh(out * 1.05) / 1.05
    out = limiter(out, 10 ** (-1 / 20))
    stats = {
        "peak_dbfs": round(20 * np.log10(np.max(np.abs(out))), 2),
        "rms_dbfs": round(20 * np.log10(np.sqrt(np.mean(out ** 2))), 2),
        "sections": {
            name: round(20 * np.log10(np.sqrt(np.mean(out[:, round(a_ * BAR * SR) : round(b_ * BAR * SR)] ** 2)) + 1e-12), 2)
            for name, a_, b_, *_ in SECTIONS
        },
        "stem_rms_dbfs": {
            name: round(20 * np.log10(np.sqrt(np.mean((x[:, :N] * levels[name]) ** 2)) + 1e-12), 2) for name, x in stems.items()
        },
    }
    return out, stats


def write_wav(path: Path, x: np.ndarray):
    pcm = np.clip(np.round(x.T * 32767), -32768, 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def render(cues: list[dict], out_dir: Path, stems_dir: Path | None = None) -> dict:
    stems, log, kick_times = compose(cues)
    master, stats = mix(stems, kick_times)
    out_dir.mkdir(parents=True, exist_ok=True)
    wav = out_dir / "soundtrack.wav"
    write_wav(wav, master)
    if stems_dir:
        stems_dir.mkdir(parents=True, exist_ok=True)
        peak = max(np.max(np.abs(x)) for x in stems.values())
        for name, x in stems.items():
            write_wav(stems_dir / f"{name}.wav", x[:, :N] / peak * 0.9)
    h = hashlib.sha256(wav.read_bytes()).hexdigest()
    info = {
        "schema": "gaid-promo-soundtrack-v1",
        "path": wav.name, "sha256": h, "sample_rate": SR, "channels": 2, "samples": N, "seconds": DURATION,
        "bpm": BPM, "bars": BARS, "key": "D major", "progression": PROG,
        "provenance": "Synthesised by geo/promo/brag/soundtrack.py (oscillators, filtered noise, synthetic reverb); "
                      "no samples or recordings; seed 20261024.",
        "cues": log, "levels": stats,
    }
    (out_dir / "soundtrack.json").write_text(json.dumps(info, ensure_ascii=False, indent=1) + "\n")
    return info


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--cues", type=Path, required=True, help="JSON list of {t, kind, ...} (window.motion.cues)")
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--stems", action="store_true")
    args = ap.parse_args()
    info = render(json.loads(args.cues.read_text()), args.out, args.out / "stems" if args.stems else None)
    print(json.dumps({k: info[k] for k in ("path", "sha256", "seconds", "levels")}, indent=1))


if __name__ == "__main__":
    main()
