"""Synthesise the promo40 soundtrack: 120 BPM, 4/4, D major, 20 bars (40 s), music and effects as one mix.

uv run --no-project --with numpy==2.5.4 --with scipy==1.18.1 \
  python geo/promo/brag/promo40/soundtrack.py --cues <cues.json> --out <dir>

Same instruments and shared reverb as the v4_brag soundtrack (../soundtrack.py: oscillators, filtered noise, synthetic
reverb; no samples or recordings), arranged tighter and louder for the 40-second cut. Cues come from the scene
(window.motion.cues), snapped to the sixteenth-note grid and pitched to the chord of their bar.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import soundtrack as base  # noqa: E402
from soundtrack import SR, bell, clap, hat, highpass, impact, kick, lead_note, pluck, riser, tom, whoosh  # noqa: E402

BPM = 120
BEAT = 60 / BPM  # 0.5 s = 15 frames
BAR = 4 * BEAT
BARS = 20
SIXTEENTH = BEAT / 4
DURATION = BARS * BAR
N = round(DURATION * SR)

CHORDS = base.CHORDS
PROG = ["Bm", "G", "Em", "Asus", "D", "A", "Bm", "G", "D", "A", "Bm", "G", "D", "A", "Bm", "G", "Gmaj7", "Asus", "Dadd9", "Dadd9"]
assert len(PROG) == BARS
SECTIONS = [
    # name, a, b, pad, bright, bass, kick, hat, clap, arp, lead
    ("hook", 0, 2, 0.7, 1600, 0.9, 1.0, 0.5, 0.0, 0.0, 0.0),
    ("scatter", 2, 4, 0.7, 1300, 0.85, 0.9, 0.6, 0.6, 0.0, 0.0),
    ("reveal", 4, 6, 1.0, 3000, 1.0, 1.0, 0.6, 0.0, 0.6, 0.0),
    ("cycle", 6, 8, 0.85, 2400, 0.95, 1.0, 0.65, 0.65, 0.65, 0.0),
    ("library", 8, 9, 0.8, 2400, 1.0, 1.0, 0.7, 0.7, 0.6, 0.0),
    ("hub", 9, 12, 0.85, 2800, 1.0, 1.0, 0.7, 0.7, 0.6, 0.6),
    ("system", 12, 16, 0.85, 2600, 1.0, 1.0, 0.8, 0.7, 0.65, 0.0),
    ("brain", 16, 18, 1.0, 3200, 1.0, 1.0, 0.7, 0.7, 0.7, 0.5),
    ("outro", 18, 20, 0.9, 2000, 0.6, 0.0, 0.0, 0.0, 0.35, 0.0),
]
KEYS = ("pad", "bright", "bass", "kick", "hat", "clap", "arp", "lead")


def section(bar: int) -> dict:
    for name, a, b, *vals in SECTIONS:
        if a <= bar < b:
            return {"name": name, **dict(zip(KEYS, vals))}
    raise ValueError(bar)


def tone_at(t: float, octave: int, step: int = 0) -> float:
    pcs, root = CHORDS[PROG[min(BARS - 1, int(t / BAR + 1e-9))]]
    ivs = sorted({(p - root) % 12 for p in [root, *pcs[:3]]})
    return 12 * (octave + 1) + root + ivs[step % len(ivs)] + 12 * (step // len(ivs))


def compose(cues: list[dict]):
    B = lambda: base.Bus(N)  # noqa: E731
    pad, bass, drums, arp, lead, fx = B(), B(), B(), B(), B(), B()
    kick_times = []
    centre = 62
    for b in range(BARS):
        s = section(b)
        t0 = b * BAR
        pcs, root = CHORDS[PROG[b]]
        voicing = base.voice(pcs, centre)
        base.pad_chord(pad, t0, BAR, voicing, s["pad"], s["bright"])
        rootm = 36 + root % 12
        if rootm > 43:
            rootm -= 12
        for e in range(8):
            if s["name"] == "outro" and e:
                continue
            m = rootm + (12 if e in (3, 7) and s["name"] not in ("hook", "scatter", "outro") else 0)
            dur = BAR * 0.95 if s["name"] == "outro" else BEAT / 2 * 0.9
            base.bass_note(bass, t0 + e * BEAT / 2, dur, m, s["bass"] * (1.0 if e % 2 == 0 else 0.8))
        for q in range(4):
            tq = t0 + q * BEAT
            if s["kick"] > 0:
                kick(drums, tq, s["kick"] * (1 if q == 0 else 0.88))
                kick_times.append(tq)
            if s["hat"] > 0:
                hat(drums, tq + BEAT / 2, s["hat"])
                if s["name"] in ("scatter", "system", "brain"):
                    hat(drums, tq + BEAT / 4, s["hat"] * 0.45)
                    hat(drums, tq + 3 * BEAT / 4, s["hat"] * 0.45)
            if s["clap"] > 0 and q in (1, 3):
                clap(drums, tq, s["clap"])
        # snare build into the reveal (last two beats of bar 3) and into the outro (bar 17)
        if b in (3, 17):
            for k in range(8):
                clap(drums, t0 + 2 * BEAT + k * SIXTEENTH, 0.18 + 0.07 * k)
        if s["arp"] > 0:
            order = [0, 1, 2, 3, 2, 1, 2, 3] if s["name"] != "outro" else [0, 2, 3, 5]
            step = BEAT / 2 if len(order) == 8 else BEAT
            for k, d in enumerate(order):
                pluck(arp, t0 + k * step, tone_at(t0, 4, d + 1), s["arp"] * (1 if k % 2 == 0 else 0.7), pan=0.35 * np.sin(k), decay=0.3)
        if s["lead"] > 0:
            motif = [(0, 1, 2), (1, 1, 1), (2, 2, 3)] if b % 2 == 0 else [(0, 2, 4), (2, 1, 3), (3, 1, 2)]
            for beat, length, stp in motif:
                lead_note(lead, t0 + beat * BEAT, length * BEAT * 0.95, tone_at(t0, 5, stp), s["lead"])
        centre = voicing[len(voicing) // 2] if abs(voicing[len(voicing) // 2] - 62) < 6 else 62

    riser(fx, 4 * BAR, 2 * BEAT, 1.0, 50)
    riser(fx, 18 * BAR, 2 * BEAT, 0.6, 55)
    log = []
    for c in cues:
        t = round(c["t"] / SIXTEENTH) * SIXTEENTH
        k, step = c["kind"], c.get("step", 0)
        if t >= DURATION - 0.2:
            continue
        log.append({"kind": k, "t_scene": c["t"], "t": round(t, 4)})
        if k == "slam":
            for i in range(3):
                bell(fx, t, tone_at(t, 4, i + step), 0.5, pan=(i - 1) * 0.4, ratio=2.0, decay=0.7, index=1.2)
            tom(fx, t, tone_at(t, 2, 0), 0.6)
        elif k == "hop":
            pluck(fx, t, tone_at(t, 5, step), 0.4, pan=0.4 * np.sin(step * 2), decay=0.2)
        elif k == "pop":
            pluck(fx, t, tone_at(t, 5, step), 0.55, pan=0.7 * np.sin(step * 2.1), decay=0.3)
        elif k == "hit":
            impact(fx, t, 1.0)
            for i in range(4):
                bell(fx, t, tone_at(t, 4, i), 0.5, pan=(i - 1.5) * 0.3, ratio=2.0, decay=1.8, index=1.4)
        elif k == "logo":
            for i in range(6):
                bell(fx, t + i * SIXTEENTH, tone_at(t, 5, i), 0.4 - 0.04 * i, pan=(i - 2.5) * 0.25, ratio=2.0, decay=1.8, index=1.0)
        elif k == "soft":
            bell(fx, t, tone_at(t, 4, 2), 0.35, ratio=2.0, decay=1.4, index=0.8)
        elif k == "station":
            pluck(fx, t, tone_at(t, 5, step), 0.6, pan=0.5 * np.cos(step * 1.3), decay=0.45)
        elif k in ("bump", "join"):
            bell(fx, t, tone_at(t, 5, 4 if k == "bump" else 2), 0.7, ratio=3.5, decay=1.4)
        elif k == "item":
            tom(fx, t, tone_at(t, 2, 0), 0.6)
            if c.get("hub"):
                bell(fx, t, tone_at(t, 5, 0), 0.4, ratio=3.5, decay=1.0)
        elif k == "window":
            whoosh(fx, t, 0.45, length=0.3)
        elif k == "tag":
            bell(fx, t, tone_at(t, 5, (len(log) * 2) % 4), 0.42, pan=0.3 * np.sin(len(log)), ratio=3.5, decay=0.8, index=1.6)
        elif k == "tick":
            pluck(fx, t, tone_at(t, 5, step), 0.45, pan=0.7 * np.sin(step * 2.1), decay=0.25)
        elif k == "swoosh":
            whoosh(fx, round(c["end"] / SIXTEENTH) * SIXTEENTH, 0.9, length=0.45)
        else:
            raise ValueError(f"unknown cue kind {k}")
    stems = {name: bus.x for name, bus in (("pad", pad), ("bass", bass), ("drums", drums), ("arp", arp), ("lead", lead), ("fx", fx))}
    return stems, log, kick_times


def mix(stems: dict, kick_times: list[float]):
    ir = base.reverb_ir(2.0, 0.42)
    g = np.ones(N + SR * 4)
    tt = np.arange(round(0.25 * SR)) / SR
    shape = 1 - 0.32 * np.exp(-tt / 0.08) * np.minimum(1, tt / 0.004 + 0.4)
    for k in kick_times:
        i = round(k * SR)
        g[i: i + len(shape)] = np.minimum(g[i: i + len(shape)], shape[: len(g) - i])
    levels = {"pad": 1.15, "bass": 0.5, "drums": 0.95, "arp": 2.0, "lead": 2.8, "fx": 1.4}
    sends = {"pad": 0.3, "bass": 0.0, "drums": 0.08, "arp": 0.35, "lead": 0.35, "fx": 0.45}
    dry = np.zeros_like(stems["pad"])
    wet_in = np.zeros_like(stems["pad"])
    for name, x in stems.items():
        y = x * levels[name] * (g if name in ("pad", "arp", "lead") else 1)
        dry += y
        wet_in += y * sends[name]
    out = dry + 0.5 * base.reverb(highpass(wet_in, 180), ir)
    out = highpass(out, 28, 2)[:, :N]
    t = np.arange(N) / SR
    out *= np.clip((DURATION - t) / 1.6, 0, 1) ** 1.5 * np.clip(t / 0.004, 0, 1)
    a, b = round(12 * BAR * SR), round(16 * BAR * SR)
    out *= 10 ** (-15 / 20) / np.sqrt(np.mean(out[:, a:b] ** 2))
    out = np.tanh(out * 1.05) / 1.05
    out = base.limiter(out, 10 ** (-1 / 20))
    db = lambda v: round(float(20 * np.log10(v + 1e-12)), 2)  # noqa: E731
    stats = {
        "peak_dbfs": db(np.max(np.abs(out))), "rms_dbfs": db(np.sqrt(np.mean(out ** 2))),
        "sections": {n: db(np.sqrt(np.mean(out[:, round(a_ * BAR * SR): round(b_ * BAR * SR)] ** 2))) for n, a_, b_, *_ in SECTIONS},
        "stem_rms_dbfs": {n: db(np.sqrt(np.mean((x[:, :N] * levels[n]) ** 2))) for n, x in stems.items()},
    }
    return out, stats


def render(cues: list[dict], out_dir: Path, stems_dir: Path | None = None) -> dict:
    stems, log, kick_times = compose(cues)
    master, stats = mix(stems, kick_times)
    out_dir.mkdir(parents=True, exist_ok=True)
    wav = out_dir / "soundtrack.wav"
    base.write_wav(wav, master)
    if stems_dir:
        stems_dir.mkdir(parents=True, exist_ok=True)
        peak = max(np.max(np.abs(x)) for x in stems.values())
        for name, x in stems.items():
            base.write_wav(stems_dir / f"{name}.wav", x[:, :N] / peak * 0.9)
    info = {
        "schema": "gaid-promo-soundtrack-v1",
        "path": wav.name, "sha256": hashlib.sha256(wav.read_bytes()).hexdigest(), "sample_rate": SR, "channels": 2,
        "samples": N, "seconds": DURATION, "bpm": BPM, "bars": BARS, "key": "D major", "progression": PROG,
        "provenance": "Synthesised by geo/promo/brag/promo40/soundtrack.py with the instruments of geo/promo/brag/soundtrack.py "
                      "(oscillators, filtered noise, synthetic reverb); no samples or recordings; seed 20261024.",
        "cues": log, "levels": stats,
    }
    (out_dir / "soundtrack.json").write_text(json.dumps(info, ensure_ascii=False, indent=1) + "\n")
    return info


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--cues", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    info = render(json.loads(args.cues.read_text()), args.out)
    print(json.dumps({k: info[k] for k in ("path", "sha256", "seconds", "levels")}, indent=1))


if __name__ == "__main__":
    main()
