"""Score and sound effects for the GAID promo film, lemo edition -> mix.wav (48 kHz stereo float).

uv run --no-project --with numpy==2.3.4 --with scipy==1.16.3 --with soundfile==0.13.1 --with soxr==1.0.0 \
  python geo/promo-lemo/mix.py --events <render out>/events.json --out <dir> [--lemo ~/assets/lemo-opuscar/3961ddb/lib]

Everything sits on the film's own event list (window.EV exported by render.py), so each sound lands on its frame.
Original score in D Lydian at 120 bpm from VCSL samples (CC0) via lemo-opuscar's core/audio/sampler.py, and procedural
foley from core/audio/sfx.py (lemo-opuscar, MIT). Sound design: TREATMENT.md sections 6-7 (two families: the scattered
mess is detuned, panned at random, one timbre per source; GAID's sounds are one in-key family, centred).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import numpy as np

DEFAULT_LEMO = Path(os.environ.get("TASK_ASSETS_DIR", Path.home() / "assets")) / "lemo-opuscar/3961ddb/lib"

# D Lydian: D E F# G# A B C#
LYD = [0, 2, 4, 6, 7, 9, 11]


def deg(d: int, base: int = 62) -> int:
    """Scale degree d (0 = D) above MIDI base 62 (D4)."""
    o, k = divmod(d, 7)
    return base + 12 * o + LYD[k]


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--events", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--lemo", type=Path, default=DEFAULT_LEMO)
    args = ap.parse_args()
    sys.path.insert(0, str(args.lemo))
    from core.audio import sampler as S
    from core.audio import sfx as X
    import soundfile as sf

    S.seed(20261024)
    rng = np.random.default_rng(20261024)
    E = json.loads(args.events.read_text())
    DUR, EV, CU = E["dur"], E["ev"], E["cues"]
    SR = X.SR
    N = int((DUR + 0.5) * SR)
    music = np.zeros((N, 2), np.float32)
    fx = np.zeros((N, 2), np.float32)
    amb = np.zeros((N, 2), np.float32)
    used: set[str] = set()

    def note(buf, inst, pitch, dur, vel, at, gain=1.0, pan=0.0, release=None, attack=0.0):
        used.add(inst)
        x = S.note(inst, pitch, dur, vel=vel, release=release, attack=attack)
        X.add(buf, x, at, gain, pan)

    def hit(buf, inst, var, vel, at, gain=1.0, pan=0.0, dur=None):
        used.add(inst)
        X.add(buf, S.hit(inst, var, vel=vel, dur=dur), at, gain, pan)

    def sine(f0, f1, d, tau):
        t = X.t_(d)
        f = np.geomspace(f0, f1, len(t))
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * X.env_exp(d, tau)

    def shimmer(d=0.9, v=1.0):
        n = X.hp(X.noise(d), 5000) * np.sin(np.pi * X.t_(d) / d) ** 2
        return X.norm(n) * v

    beat = 60 / CU["bpm"]
    eighth = beat / 2
    hook0, tools1 = CU["hook"][0], CU["tools"][1]
    fz0, fz1 = CU["freeze"]
    press, chord = CU["press"], CU["chord"]
    title0, title1 = CU["title"]
    cyc0, cyc1 = CU["cycle"]
    demo0, demo1 = CU["demo"]
    sil0, sil1 = CU["silence"]
    br0, br1 = CU["brain"]
    end0, end1 = CU["end"]

    # ---------- ambience: room tone, fan and coil whine growing through the mess ----------
    room = X.hp(X.lp(X.brown(DUR + 0.5), 700), 90)[:N] * 0.010
    amb[:, 0] += room
    amb[:, 1] += np.roll(room, 997)
    t = np.arange(N) / SR
    grow = np.clip((t - hook0) / (tools1 - hook0), 0, 1) * (t < fz0)
    fan = X.bp(X.noise(DUR + 0.5), 120, 420)[:N] * 0.006 * (0.4 + grow)
    whine = np.sin(2 * np.pi * 6800 * t) * 0.0016 * grow ** 2
    amb[:, 0] += (fan + whine).astype(np.float32)
    amb[:, 1] += (np.roll(fan, 1301) + whine).astype(np.float32)

    # ---------- the mess: scattered family ----------
    timbre = {"map": "marimba", "pdf": "xylophone", "code": "mbira"}
    pool = [deg(d) for d in (0, 1, 2, 4, 5, 7, 8, 9)]
    # low sine pulse on eighths, growing, cut at the freeze
    k = 0
    while hook0 + 0.5 + k * eighth < fz0 - 1e-6:
        at = hook0 + 0.5 + k * eighth
        g = 0.03 + 0.10 * min(1.0, at / tools1)
        X.add(music, sine(73.4, 72.0, 0.22, 0.07) * g, at, 1.0, 0.0)
        k += 1
    for e in EV:
        tt = e["t"]
        if e["type"] == "spawn":
            inst = timbre[e["kind"]]
            p = pool[rng.integers(len(pool))] + (12 if inst == "xylophone" else 0) + rng.uniform(-0.4, 0.4)
            vel = 0.3 + 0.25 * rng.random()
            note(music, inst, float(p), 0.4, vel, tt, 0.35 + 0.25 * tt / tools1, float(np.clip(e["pan"] * 1.2, -1, 1)))
            X.add(fx, X.pop(0.12) * 0.6, tt, 0.25, float(e["pan"]))
        elif e["type"] == "scatter":
            X.add(fx, X.whoosh(0.32), tt - 0.12, 0.35, float(e["pan"]))
            hit(fx, "woodblock", "abc"[e["i"] % 3], 0.5, tt + 0.18, 0.35, float(e["pan"]))
        elif e["type"] == "miss":
            X.add(fx, sine(900, 520, 0.35, 0.12), tt, 0.10, float(e["pan"]) * 0.6)
            note(music, "glockenspiel", float(deg(9, 74) + rng.uniform(-0.45, 0.45)), 0.3, 0.3, tt + 0.05, 0.25, float(e["pan"]))

    # ---------- press: felt mallet + sine drop; landings in one key, centred; one chord ----------
    note(music, "marimba", "D3", 1.2, 0.95, press, 1.0, 0.0)
    X.add(fx, sine(55, 38, 0.8, 0.25), press, 0.55, 0.0)
    X.add(fx, X.thump(0.8, 60), press, 0.4, 0.0)
    X.add(fx, shimmer(1.4), press + 0.05, 0.12, 0.0)
    X.add(fx, X.whoosh(0.9), press + 0.1, 0.25, 0.0)
    shelf_pitch = {0: [deg(7, 62)], 1: [deg(9), deg(11)], 2: [deg(8)], 3: [deg(10)], 4: [deg(13)]}
    li = 0
    for e in EV:
        if e["type"] != "land":
            continue
        ps = shelf_pitch[e["shelf"]]
        p = ps[li % len(ps)]
        li += 1
        if e["kind"] == "tool":
            note(music, "vibraphone_hard", p, 0.6, 0.62, e["t"], 0.55, e["pan"] * 0.25)
            X.add(fx, X.click(0.8, 1.0), e["t"], 0.12, e["pan"] * 0.25)
        else:
            note(music, "vibraphone", p + 12, 0.4, 0.38, e["t"], 0.22, e["pan"] * 0.2)
    for p, v in [(deg(0, 50), 0.7), (deg(4, 50), 0.6), (deg(6, 50), 0.55), (deg(1), 0.55), (deg(2), 0.55), (deg(3), 0.5)]:
        note(music, "vibraphone_bowed", p, 2.6, v, chord, 0.42, 0.0, attack=0.02)
    note(music, "glockenspiel", deg(7, 74), 1.5, 0.55, chord, 0.35, 0.0)
    note(music, "vibraphone", deg(0, 50), 2.0, 0.7, chord, 0.5, 0.0)

    # ---------- title: CRT off, light sweep shimmer (J-cut), pad ----------
    for e in EV:
        if e["type"] == "crt":
            X.add(fx, sine(2400, 180, 0.25, 0.08), e["t"] + 0.05, 0.10, 0.0)
            X.add(fx, X.click(0.6, 1.0), e["t"] + 0.33, 0.10, 0.0)
        elif e["type"] == "sweep":
            X.add(fx, shimmer(1.5), e["t"], 0.16, -0.2)
            for j, d in enumerate((7, 9, 11, 14)):
                note(music, "glockenspiel", deg(d, 74), 0.6, 0.35, e["t"] + 0.3 + j * eighth / 2, 0.25, -0.5 + j * 0.33)
        elif e["type"] == "title":
            note(music, "hand_chimes", deg(7, 74), 2.5, 0.6, e["t"], 0.7, -0.1)
            note(music, "hand_chimes", deg(4, 74), 2.5, 0.5, e["t"] + beat, 0.6, 0.1)
    for p in (deg(0, 50), deg(4, 50), deg(1), deg(3)):
        note(music, "vibraphone_bowed", p, title1 - title0 + 0.6, 0.5, title0 + 0.5, 0.55, 0.0, attack=0.6)

    # ---------- cycle: additive marimba ostinato (one note added per bar) ----------
    PAT = [0, 4, 8, 4, 9, 4, 8, 6]  # scale degrees from D4
    bar = 4 * beat
    nb = 0
    b0 = np.ceil(cyc0 / bar) * bar
    tb = b0
    while tb < cyc1 - 0.01:
        n_on = min(8, 3 + 2 * nb)
        for j in range(8):
            if j < n_on and tb + j * eighth < cyc1:
                note(music, "marimba", deg(PAT[j]), 0.3, 0.45 + 0.1 * (j == 0), tb + j * eighth, 0.30, -0.25 + 0.5 * (j % 2))
        nb += 1
        tb += bar
    for e in EV:
        if e["type"] == "station":
            note(music, "glockenspiel", deg(7 + e["i"], 74), 0.8, 0.45, e["t"], 0.32, e["pan"] * 0.5)
            X.add(fx, X.click(1.2, 0.8), e["t"], 0.06, e["pan"] * 0.5)
        elif e["type"] == "arc":
            note(music, "vibraphone_bowed", deg(4), 2.0, 0.5, e["t"], 0.3, 0.3, attack=0.3)
        elif e["type"] == "version":
            note(music, "hand_chimes", deg(11, 62), 1.2, 0.5, e["t"], 0.35, 0.4)
        elif e["type"] == "expand":
            X.add(fx, X.whoosh(0.5), e["t"], 0.3, 0.2)

    # ---------- demo: the process. Ostinato per chapter on its own chord root, shaker, sine bass ----------
    chapters = CU["chapters"]
    ROOTS = [0, 5, 2, 1, 4, 0]  # D, B, F#, E, A, D (diatonic in D Lydian)
    for ci, ch in enumerate(chapters):
        r = ROOTS[ci % len(ROOTS)]
        a, b = ch["a"], ch["b"]
        k0 = int(np.ceil(a / eighth - 1e-6))
        k1 = int(np.floor(b / eighth + 1e-6))
        for k in range(k0, k1):
            at = k * eighth
            j = k % 8
            vel = 0.40 + 0.08 * (j == 0)
            note(music, "marimba", deg(PAT[j] + r), 0.28, vel, at, 0.26, -0.3 + 0.6 * (j % 2))
            # shaker: eighths; sixteenths in the analysis chapter; none in the notes chapter (breath)
            if ci != 4:
                X.add(fx, X.hp(X.noise(0.04), 6000) * X.env_exp(0.04, 0.012), at, 0.035, 0.35)
                if ci == 3:
                    X.add(fx, X.hp(X.noise(0.03), 7000) * X.env_exp(0.03, 0.008), at + eighth / 2, 0.022, -0.35)
            if j % 4 == 0:
                bass = deg(r, 38)
                tb_ = X.t_(2 * beat)
                f = 440 * 2 ** ((bass - 69) / 12)
                x = (np.sin(2 * np.pi * f * tb_) + 0.3 * np.sin(4 * np.pi * f * tb_) + 0.12 * np.sin(6 * np.pi * f * tb_)) * X.env_exp(2 * beat, 0.6)
                X.add(music, x * 0.028, at, 1.0, 0.0)
        # chapter stab on the downbeat
        chord_p = [deg(r, 50), deg(r + 2, 50), deg(r + 4, 50), deg(r + 6, 50)]
        for p in chord_p:
            note(music, "vibraphone", p, 1.6, 0.5, a, 0.22, 0.0)
        if ci == len(chapters) - 1:  # resolve
            for p in (deg(0, 50), deg(4, 50), deg(1), deg(2)):
                note(music, "vibraphone_bowed", p, b - a, 0.35, a, 0.18, 0.0, attack=1.0)
    for e in EV:
        tt = e["t"]
        if e["type"] == "chapter":
            X.add(fx, X.whoosh(0.32), tt, 0.28, 0.25)
        elif e["type"] == "collapse":
            X.add(fx, sine(1600, 300, 0.2, 0.06), tt, 0.07, 0.0)
        elif e["type"] == "cut":
            X.add(fx, shimmer(0.5), tt, 0.10 if not e.get("example") else 0.16, 0.3)
        elif e["type"] == "tag":
            ci = next((i for i, c in enumerate(chapters) if c["a"] - 0.01 <= tt < c["b"] + 0.01), 0)
            r = ROOTS[ci % len(ROOTS)]
            note(music, "hand_chimes", deg(r + 7 + (int(tt * 8) % 3) * 2, 62), 0.9, 0.42, tt, 0.30, 0.15)
            X.add(fx, X.click(1.4, 0.7), tt, 0.05, 0.15)

    # ---------- near-silence before the second brain; first sound after it: low bell + chord ----------
    mask = np.ones(N, np.float32)

    def zero(a, b, floor=0.0, fade=0.01):
        i0, i1 = int(a * SR), int(b * SR)
        f = int(fade * SR)
        mask[i0:i1] = np.minimum(mask[i0:i1], floor)
        mask[max(0, i0 - f):i0] = np.minimum(mask[max(0, i0 - f):i0], np.linspace(1, floor, i0 - max(0, i0 - f)))
        mask[i1:i1 + f] = np.minimum(mask[i1:i1 + f], np.linspace(floor, 1, len(mask[i1:i1 + f])))

    # ---------- second brain: build in one family ----------
    note(music, "tubular_bells", "D4", 3.0, 0.6, br0, 0.45, 0.0)
    for p in (deg(0, 50), deg(4, 50), deg(6, 50), deg(1), deg(3)):
        note(music, "vibraphone_bowed", p, br1 - br0 + 0.8, 0.45, br0, 0.25, 0.0, attack=1.2)
    k = 0
    while br0 + 1.0 + k * beat < br1 - 0.2:
        at = br0 + 1.0 + k * beat
        X.add(music, sine(73.4, 72.5, 0.3, 0.1) * 0.05, at, 1.0, 0.0)
        k += 1
    ri = 0
    for e in EV:
        if e["type"] == "ring":
            note(music, "vibraphone", deg(7 + (ri * 2) % 9, 62), 1.0, 0.45, e["t"], 0.30, float(np.clip(e["pan"] * 2, -0.8, 0.8)))
            note(music, "glockenspiel", deg(7 + (ri * 2) % 9, 74), 0.6, 0.3, e["t"] + 0.02, 0.15, float(np.clip(e["pan"] * 2, -0.8, 0.8)))
            ri += 1
        elif e["type"] == "retract":
            for j in range(14):
                X.add(fx, X.click(1.6 - j * 0.05, 0.6), e["t"] + j * 0.08, 0.05, 0.6 - j * 0.09)
        elif e["type"] == "final":
            note(music, "glockenspiel", deg(7, 74), 2.5, 0.6, e["t"], 0.45, 0.0)
            note(music, "hand_chimes", deg(0, 74), 3.0, 0.5, e["t"], 0.35, 0.0)
        elif e["type"] == "logo":
            for p in (deg(0, 50), deg(4, 50), deg(1)):
                note(music, "vibraphone_bowed", p, end1 - e["t"], 0.4, e["t"], 0.25, 0.0, attack=0.4)

    # ---------- bus, silences, master ----------
    music = S.room(music, size=0.38, mix=0.16)
    for c in range(2):
        music[:, c] = X.hp(music[:, c], 60)
    mix = music * 0.9 + fx * 0.8 + amb
    zero(fz0, press - 0.002, 0.0, 0.004)         # digital zero during the freeze
    zero(sil0, sil1, 10 ** (-60 / 20), 0.12)     # near-silence before the second brain
    mix *= mask[:, None]
    # music tail before the near-silence must not ring through it
    fade_out = np.clip((np.arange(N) / SR - (DUR - 1.2)) / 1.2, 0, 1)
    mix *= (1 - fade_out ** 2)[:, None]
    # level for mastering: about -21 dBFS RMS over the sounding parts, peaks held 12.5 dB lower so the -14 LUFS loudnorm
    # stays linear (the press and the chord are the hottest moments)
    mix = mix[: int(DUR * SR)]
    m = mix.mean(1)
    sounding = np.abs(m) > 1e-4
    rms = float(np.sqrt(np.mean(m[sounding] ** 2)))
    mix *= 10 ** (-21 / 20) / max(rms, 1e-9)
    for c in range(2):
        mix[:, c] = X.limit(mix[:, c], 10 ** (-12.5 / 20), look=0.004)
        mix[:, c] = X.limit(mix[:, c], 10 ** (-12.5 / 20), look=0.002)
    args.out.mkdir(parents=True, exist_ok=True)
    sf.write(args.out / "mix.wav", mix.astype(np.float32), SR, subtype="FLOAT")
    (args.out / "instruments.json").write_text(json.dumps(sorted(used)) + "\n")
    (args.out / "CREDITS-instruments.txt").write_text("\n".join(S.credits(sorted(used))) + "\n")
    print(args.out / "mix.wav", sorted(used), flush=True)


if __name__ == "__main__":
    main()
