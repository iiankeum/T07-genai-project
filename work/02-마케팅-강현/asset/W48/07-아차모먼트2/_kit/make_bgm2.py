# 경쾌한 소개영상용 배경음 직접 합성 (저작권 걱정 없음). 사용: python3 make_bgm2.py out.wav 길이초
import sys, numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR = 44100
out, dur = sys.argv[1], float(sys.argv[2])
N = int(SR * dur)
bpm = 116
beat = 60 / bpm
bar = beat * 4
rng = np.random.default_rng(3)
def hz(m): return 440 * 2 ** ((m - 69) / 12)
def put(buf, s, x):
    s = int(s * SR)
    if s >= N: return
    L = min(len(x), N - s); buf[s:s + L] += x[:L]
def lp(x, f): return sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x)
def hp(x, f): return sosfilt(butter(2, f, 'high', fs=SR, output='sos'), x)

# G - D - Em - C (밝은 장조)
roots = [43, 38, 40, 36]
chords = [[67, 71, 74, 78], [66, 69, 74, 76], [67, 71, 74, 76], [64, 67, 72, 74]]

drums = np.zeros(N); bass = np.zeros(N); keys = np.zeros(N); lead = np.zeros(N)

def kick():
    L = int(.35 * SR); tt = np.arange(L) / SR
    f = 50 + 90 * np.exp(-tt * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9)
def clap():
    L = int(.22 * SR); tt = np.arange(L) / SR
    n = hp(rng.standard_normal(L), 900)
    env = np.exp(-tt * 18) + 0.6 * np.exp(-np.maximum(0, tt - .012) * 40) * (tt > .012)
    return 0.5 * n * env
def hat(open_=False):
    L = int((.18 if open_ else .05) * SR); tt = np.arange(L) / SR
    return 0.25 * hp(rng.standard_normal(L), 7000) * np.exp(-tt * (14 if open_ else 70))
def pluck(m, length=.35, bright=1.0):
    L = int(length * SR); tt = np.arange(L) / SR; f = hz(m)
    saw = sum(np.sin(2 * np.pi * f * k * tt) / k for k in range(1, 7))
    return lp(saw * np.exp(-tt * 9) * np.minimum(1, tt / .003), 2500 * bright)
def bassnote(m, length):
    L = int(length * SR); tt = np.arange(L) / SR; f = hz(m)
    x = np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(2 * np.pi * 2 * f * tt)
    return x * np.minimum(1, tt / .005) * np.minimum(1, (length - tt) / .03)

nbars = int(np.ceil(dur / bar)) + 1
intro_bars = 1  # 첫 마디는 북 없이 가볍게
for b in range(nbars):
    t0 = b * bar; c = chords[b % 4]; r = roots[b % 4]
    full = b >= intro_bars
    for q in range(4):
        tb = t0 + q * beat
        if full: put(drums, tb, 0.9 * kick())
        if full and q in (1, 3): put(drums, tb, 0.55 * clap())
        put(drums, tb + beat / 2, 0.5 * hat(open_=(q == 3)))
        if full: put(drums, tb + beat / 4, 0.18 * hat()); put(drums, tb + 3 * beat / 4, 0.18 * hat())
    # 베이스: 8분 음표, 옥타브 통통
    for e in range(8):
        m = r + (12 if e % 2 else 0)
        if full: put(bass, t0 + e * beat / 2, 0.5 * bassnote(m, beat / 2 * .85))
    # 신스 화음: 당김음 리듬 (1, 1.75, 2.5, 3.25, 4)
    for pos in [0, .75, 1.5, 2.5, 3.25]:
        x = sum(pluck(m, .32) for m in c) / len(c)
        put(keys, t0 + pos * beat, 0.55 * x)
    # 위쪽 짧은 멜로디 훅 (16분 아르페지오)
    for s16 in range(16):
        if s16 % 3 == 0 or s16 in (14,):
            m = c[(s16 // 2) % 4] + 12
            put(lead, t0 + s16 * beat / 4, 0.22 * pluck(m, .18, 1.6))

# 사이드체인 느낌: 킥마다 화음 · 베이스를 살짝 눌러 통통 튀게
pump = np.ones(N)
for b in range(nbars):
    for q in range(4):
        s = int((b * bar + q * beat) * SR)
        if s >= N: break
        L = min(N - s, int(beat * SR)); tt = np.arange(L) / SR
        if b >= intro_bars: pump[s:s + L] = 0.45 + 0.55 * np.minimum(1, tt / (beat * .6))
keys *= pump; bass *= pump

mix = drums * 0.9 + bass * 0.9 + keys * 1.0 + lead * 0.8
rev = np.zeros(N)
for d, g in [(0.029, .25), (0.043, .2), (0.067, .15), (0.101, .1)]:
    o = int(d * SR); rev[o:] += g * (keys + lead)[:-o]
mix += 0.5 * rev
fade = np.ones(N); fi, fo = int(.3 * SR), int(1.5 * SR)
fade[:fi] = np.linspace(0, 1, fi); fade[-fo:] = np.linspace(1, 0, fo)
mix *= fade
mix = np.tanh(1.3 * mix / (np.max(np.abs(mix)) + 1e-9)) * 0.85
L_ = mix; R_ = np.roll(mix, int(.008 * SR))
wavfile.write(out, SR, (np.stack([L_, R_], 1) * 32767).astype(np.int16))
print('ok', dur)
