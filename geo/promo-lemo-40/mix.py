"""Score, foley and ambience for the GAID 40 s promo, from the picture's events.json (TREATMENT.md §7–8).

LIB=~/assets/lemo-opuscar/3961ddb/lib uv run --no-project --with numpy==2.5.4 --with scipy==1.18.1 --with soundfile==0.14.0 \
  --with soxr==1.1.0 python geo/promo-lemo-40/mix.py <out dir with events.json>

Writes mix.wav (48 kHz stereo float) and mix-manifest.json. Uses lemo-opuscar's core/audio/sfx.py and sampler.py from the
pinned asset (read-only; VCSL samples, CC0). Two sound families: the disorder is scattered (detuned by tens of cents, random
pans, a different timbre per source); GAID's sounds are one family (D Lydian, centred). Digital zero during the freeze.
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

import numpy as np

LIB = Path(os.environ.get("LIB", Path.home() / "assets/lemo-opuscar/3961ddb/lib"))
sys.path.insert(0, str(LIB))
from core.audio import sampler as S  # noqa: E402
from core.audio import sfx as X  # noqa: E402

SR = X.SR
BEAT, BAR = 0.5, 2.0
FREEZE = (10.0, 10.5)
NEAR_SILENCE = (35.0, 35.6)
PENTA = ["D4", "E4", "F#4", "A4", "B4", "D5", "E5", "F#5", "A5", "B5"]
LEG_CHORDS = [  # vibraphone voicings per station window, all in D Lydian
    ["D4", "F#4", "A4", "C#5"], ["B3", "D4", "F#4", "A4"], ["E4", "G#4", "B4", "D5"],
    ["F#4", "A4", "C#5", "E5"], ["B3", "D4", "F#4", "A4"], ["D4", "F#4", "A4", "E5"],
]
LEG_BASS = ["D3", "B2", "E3", "F#3", "B2", "D3"]
LEG_TOP = ["C#6", "A5", "D6", "E6", "A5", "E6"]


def db(x):
    return 10 ** (x / 20)


def stereo(n):
    return np.zeros((n, 2), np.float32)


def main():
    out = Path(sys.argv[1]).resolve()
    events = json.loads((out / "events.json").read_text())
    dur = events["dur"]
    n = int(round(dur * SR))
    rng = np.random.default_rng(20261024)
    S.seed(20261024)
    music, foley, amb = stereo(n), stereo(n), stereo(n)
    ev = events["ev"]
    by = {}
    for e in ev:
        by.setdefault(e["type"], []).append(e)
    used = set()

    def note(buf, t, inst, pitch, d, vel, pan=0.0, gain=1.0, **kw):
        used.add(inst)
        X.add(buf, S.note(inst, pitch, d, vel, **kw), t, gain, pan)

    # ---------- ambience ----------
    tt = np.arange(n) / SR
    room = X.lp(X.brown(dur), 500)
    room = room / np.abs(room).max()
    fan = X.lp(X.brown(dur), 220)
    fan = fan / np.abs(fan).max() + 0.15 * np.sin(2 * np.pi * 118 * tt)
    whine = np.sin(2 * np.pi * 6800 * tt) * (1 + 0.3 * np.sin(2 * np.pi * 3.1 * tt))
    g_room = np.full(n, db(-50))
    g_fan = db(-46) * np.clip((tt - 0.0) / 6, 0, 1) * (tt < FREEZE[0])
    g_whine = (db(-58) + (db(-40) - db(-58)) * np.clip((tt - 2.0) / 8.0, 0, 1)) * (tt < FREEZE[0])
    amb[:, 0] += (room * g_room + fan * g_fan + whine * g_whine).astype(np.float32)
    amb[:, 1] += (np.roll(room, 977) * g_room + np.roll(fan, 1531) * g_fan + whine * g_whine).astype(np.float32)

    # ---------- disorder: scattered family ----------
    scattered = ["glockenspiel", "hand_chimes", "vibraphone_hard", "xylophone"]
    for e in by.get("spawn", []):
        inst = scattered[int(rng.integers(len(scattered)))]
        m = int(rng.integers(66, 90)) + rng.uniform(-0.45, 0.45)
        note(music, e["t"], inst, m, 0.25, float(rng.uniform(0.25, 0.45)), float(rng.uniform(-0.9, 0.9)), 0.5)
        if e["kind"] == 0:
            X.add(foley, X.thump(0.5, 95), e["t"], db(-25), e["pan"])
        elif e["kind"] == 1:
            X.add(foley, X.whoosh(0.16, 1.0), e["t"], db(-26), e["pan"])
        else:
            X.add(foley, X.pop(1.0), e["t"], db(-27), e["pan"])
    for e in by.get("fling", []):
        X.add(foley, X.whoosh(0.3, 1.0), e["t"], db(-18), e["pan"])
        note(music, e["t"] + 0.28, "hand_chimes", 72 + int(rng.integers(0, 14)) + rng.uniform(-0.45, 0.45), 0.4, 0.4, e["pan"], 0.55)
    for e in by.get("dash", []):
        X.add(foley, X.step(1.0), e["t"], db(-22), e["pan"])
        note(music, e["t"] + 0.35, "glockenspiel", 80 + int(rng.integers(0, 8)) + rng.uniform(-0.4, 0.4), 0.2, 0.3, e["pan"] * 0.8, 0.4)
    for k in range(5):  # low sine pulse on the downbeats of the scatter
        X.add(music, X.thump(1.0, 55), 2.0 + 2.0 * k, db(-21 + 2 * k), 0)

    # ---------- the press and the gather (GAID's one family, centred) ----------
    p = by["press"][0]["t"]
    d = 0.9
    t_ = np.arange(int(d * SR)) / SR
    drop = np.sin(2 * np.pi * np.cumsum(np.linspace(55, 40, len(t_))) / SR) * np.exp(-t_ / 0.35)
    X.add(music, drop.astype(np.float32), p, db(-9), 0)
    note(music, p, "marimba", "D3", 0.6, 0.95, 0, 1.4)
    note(music, p, "vibraphone", "A3", 1.2, 0.6, 0, 0.8)
    for pc in ["D4", "A4", "E5"]:  # L-cut: bowed chord rings over into the gather
        note(music, p + 0.05, "vibraphone_bowed", pc, 4.2, 0.5, 0, 0.55, attack=0.3)
    for e in by.get("whoosh", []):
        X.add(foley, X.whoosh(0.4, 1.0), e["t"], db(-24), e["pan"] * 0.5)
    for e in by.get("land", []):
        note(music, e["t"], "marimba", PENTA[e["slot"]], 0.5, 0.65, e["pan"] * 0.25, 0.9)
        note(music, e["t"], "glockenspiel", PENTA[e["slot"] + 2], 0.3, 0.35, e["pan"] * 0.25, 0.4)
        X.add(foley, X.thump(0.6, 80), e["t"], db(-29), 0)
    sw = by["sweep"][0]
    shimmer = X.bp(X.noise(sw["dur"] + 0.4), 5500, 9500) * np.sin(np.linspace(0, np.pi, int(round((sw["dur"] + 0.4) * SR)))) ** 2
    X.add(foley, (shimmer / np.abs(shimmer).max()).astype(np.float32), sw["t"] - 0.2, db(-34), 0)
    for k in range(12):  # quiet pulse while the window is held
        tk = 12.0 + 0.25 * k
        note(music, tk, "marimba", ["D4", "A4", "F#4", "A4"][k % 4], 0.25, 0.32, 0, 0.5)
    for e in by.get("tick", []):
        X.add(foley, X.click(0.6, 1.0), e["t"], db(-30), 0)
        note(music, e["t"], "marimba", PENTA[7 - e["slot"]], 0.2, 0.35, 0, 0.45)
    c = by["crtoff"][0]["t"]
    d = 0.22
    t_ = np.arange(int(d * SR)) / SR
    crt = np.sin(2 * np.pi * np.cumsum(np.linspace(1400, 200, len(t_))) / SR) * np.exp(-t_ / 0.08)
    X.add(foley, crt.astype(np.float32), c, db(-26), 0)

    # ---------- the ring and the cycle (additive marimba) ----------
    X.add(foley, X.whoosh(0.5, 1.0), by["fly"][0]["t"], db(-24), -0.3)
    rd = by["ringdraw"][0]
    for k in range(10):
        note(music, rd["t"] + rd["dur"] * k / 10, "glockenspiel", PENTA[k], 0.25, 0.3, 0, 0.45)
    for e in by.get("node", []):
        note(music, e["t"], "marimba", PENTA[e["k"]], 0.4, 0.6, 0, 0.8)
        X.add(foley, X.click(0.8, 1.0), e["t"], db(-30), 0)
    for e in by.get("label", []):
        X.add(foley, X.step(1.0), e["t"], db(-34), 0)
    pattern = ["D3", None, None, None, "D3", None, None, None]
    adds = [(2, "A3"), (5, "F#4"), (3, "E4"), (7, "B3"), (6, "D4"), (1, "A4")]
    cycle0 = 17.0
    for bar in range(6):
        pos, pc = adds[bar]
        pattern[pos] = pc
        for i, pc in enumerate(pattern):
            if pc:
                note(music, cycle0 + bar * BAR + i * 0.25, "marimba", pc, 0.25, 0.5 if i % 4 == 0 else 0.38, 0, 0.75)
        note(music, cycle0 + bar * BAR, "marimba", LEG_BASS[bar], 0.8, 0.6, 0, 0.7)
        X.add(music, X.thump(1.0, 55), cycle0 + bar * BAR, db(-27), 0)
    for e in by.get("open", []):
        k = e["k"]
        for j, pc in enumerate(LEG_CHORDS[k]):
            note(music, e["t"] + 0.05 + 0.03 * j, "vibraphone", pc, 1.5, 0.42, 0, 0.45)
        X.add(foley, X.whoosh(0.25, 1.0), e["t"] - 0.08, db(-28), 0.4)
        note(music, e["t"], "glockenspiel", LEG_TOP[k], 0.3, 0.3, 0.3, 0.35)
    for e in by.get("move", []):
        X.add(foley, X.whoosh(0.5, 1.0), e["t"], db(-32), 0)
    for e in by.get("close", []):
        X.add(foley, X.click(0.7, 1.0), e["t"] + 0.18, db(-32), 0.3)
    # the lap: beat divided into sixteenths
    for e in by.get("lapTick", []):
        note(music, e["t"], "glockenspiel", PENTA[e["k"] + 3], 0.25, 0.45, 0, 0.55)
        note(music, e["t"], "marimba", PENTA[e["k"]], 0.25, 0.55, 0, 0.75)
    for k in range(16):
        used.add("shaker")
        X.add(music, S.hit("shaker", "down", 0.25 + 0.02 * k), 29.0 + 0.0625 * k, 0.35, 0)

    # ---------- second brain: full pattern, spawns as one shimmer ----------
    full = ["D3", "A4", "A3", "E4", "D4", "F#4", "D4", "B3"]
    for bar in range(3):
        b0 = 30.0 + bar * BAR
        for i, pc in enumerate(full * 1):
            for half in range(1 if bar < 1 else 2):
                tq = b0 + i * 0.25 + half * 0.125
                if tq < NEAR_SILENCE[0] - 0.01:
                    note(music, tq, "marimba", pc, 0.2, 0.42 if half == 0 else 0.28, 0, 0.7)
        X.add(music, X.thump(1.0, 55), b0, db(-24), 0)
        X.add(music, X.thump(1.0, 55), b0 + 1.0, db(-28), 0)
    note(music, 30.0, "vibraphone_bowed", "F#4", 4.8, 0.45, -0.2, 0.45, attack=0.6)
    note(music, 30.0, "vibraphone_bowed", "C#5", 4.8, 0.4, 0.2, 0.4, attack=0.6)
    slots = {}
    for e in by.get("ring", []):
        slots.setdefault(e["t"], []).append(e)
    for k, (t0, group) in enumerate(sorted(slots.items())):
        pan = float(np.clip(np.mean([g["pan"] for g in group]), -0.4, 0.4))
        note(music, t0, "glockenspiel", PENTA[3 + k % 7], 0.3, min(0.5, 0.22 + 0.04 * len(group)), pan, 0.4)
    links = sorted({e["t"] for e in by.get("link", [])})
    for t0 in links:
        X.add(foley, X.click(1.2, 1.0), t0, db(-38), float(rng.uniform(-0.3, 0.3)))

    # ---------- collapse and the end chord ----------
    note(music, NEAR_SILENCE[0], "marimba", "D4", 0.5, 0.5, 0, 0.7)
    X.add(foley, X.whoosh(0.35, 1.0), NEAR_SILENCE[0] + 0.05, db(-30), 0)
    end = by["endSweep"][0]["t"] - 0.3
    sh_d = 1.6
    shimmer = X.bp(X.noise(sh_d), 4500, 9000) * np.sin(np.linspace(0, np.pi, int(round(sh_d * SR)))) ** 1.5
    X.add(foley, (shimmer / np.abs(shimmer).max()).astype(np.float32), end + 0.05, db(-30), 0)  # J-cut before the light
    chord_t = by["endChord"][0]["t"]
    for j, pc in enumerate(["D3", "A3", "E4", "F#4", "G#4", "C#5"]):
        note(music, chord_t + 0.012 * j, "vibraphone", pc, 4.0, 0.55, (j - 2.5) * 0.08, 0.6)
    for pc in ["D4", "A4", "F#5"]:
        note(music, chord_t, "vibraphone_bowed", pc, 5.0, 0.5, 0, 0.5, attack=0.5)
    note(music, chord_t, "marimba", "D3", 1.0, 0.8, 0, 1.0)
    for j, pc in enumerate(["C#6", "E6", "A6"]):
        note(music, chord_t + 0.12 * j, "glockenspiel", pc, 0.4, 0.3, 0.15, 0.35)
    sub_d = 4.5
    t_ = np.arange(int(sub_d * SR)) / SR
    sub = np.sin(2 * np.pi * 73.42 * t_) * np.minimum(1, t_ / 0.08) * np.exp(-t_ / 1.6)
    sub += 0.25 * np.sin(2 * np.pi * 146.83 * t_) * np.exp(-t_ / 1.2)
    X.add(music, sub.astype(np.float32), chord_t, db(-21), 0)
    for e in by.get("merge", []):
        note(music, e["t"], "glockenspiel", "D7", 0.3, 0.25, 0.2, 0.3)

    # ---------- mix ----------
    music = S.room(music, size=0.35, mix=0.18)
    foley = S.room(foley, size=0.2, mix=0.1)
    mix = music * db(0) + foley * db(-2) + amb * db(0)
    # digital zero in the freeze, near-silence (room only) before the end
    a, b = (int(x * SR) for x in FREEZE)
    mix[a:b] = 0.0
    a, b = (int(x * SR) for x in NEAR_SILENCE)
    ramp = int(0.03 * SR)
    keep = np.ones(n, np.float32)
    keep[a:b] = 0.0
    keep[a:a + ramp] = np.linspace(1, 0, ramp)
    mix = mix * keep[:, None] + (amb * db(-6)) * (1 - keep[:, None])
    fade = int(0.6 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 2
    peak = np.abs(mix).max()
    mix = (mix / peak * 0.7).astype(np.float32)
    mix = np.stack([X.limit(mix[:, 0], 0.9), X.limit(mix[:, 1], 0.9)], 1).astype(np.float32)
    mix[int(FREEZE[0] * SR):int(FREEZE[1] * SR)] = 0.0

    import soundfile as sf

    path = out / "mix.wav"
    sf.write(path, mix, SR, subtype="FLOAT")
    bands = band_energy(mix.mean(1))
    h = hashlib.sha256(path.read_bytes()).hexdigest()
    import scipy
    import soxr

    manifest = {
        "schema": "gaid-promo-lemo-40-mix-v1",
        "created_utc": datetime.now(UTC).isoformat(),
        "events_sha256": hashlib.sha256((out / "events.json").read_bytes()).hexdigest(),
        "lib": str(LIB),
        "instruments": sorted(used),
        "credits": S.credits(sorted(used)),
        "versions": {"numpy": np.__version__, "scipy": scipy.__version__, "soundfile": sf.__version__, "soxr": soxr.__version__},
        "seconds": n / SR, "sample_rate": SR,
        "band_db": bands,
        "wav": {"path": path.name, "sha256": h},
    }
    (out / "mix-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"instruments": manifest["instruments"], "band_db": bands}, ensure_ascii=False))


def band_energy(x):
    spec = np.abs(np.fft.rfft(x)) ** 2
    f = np.fft.rfftfreq(len(x), 1 / SR)
    out = {}
    for name, lo, hi in [("20-120", 20, 120), ("120-500", 120, 500), ("500-2k", 500, 2000), ("2k-8k", 2000, 8000), ("8k-16k", 8000, 16000)]:
        sel = (f >= lo) & (f < hi)
        out[name] = round(float(10 * np.log10(spec[sel].sum() / sel.sum() * (hi - lo) + 1e-20)), 1)
    return out


if __name__ == "__main__":
    main()
