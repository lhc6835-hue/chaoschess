# 카오스체스 전용 웨이브 시작 팡파르 (직접 작곡, 8비트 합성): 펄스파 멜로디 + 삼각파 베이스 + 노이즈 스네어 롤
import wave, struct, math, random, sys

SR = 44100
BPM = 150
BEAT = 60 / BPM
random.seed(7)

def freq(n):  # n: MIDI 노트
    return 440 * 2 ** ((n - 69) / 12)

def pulse(t, f, duty):
    return 1.0 if (t * f) % 1 < duty else -1.0

def tri(t, f):
    x = (t * f) % 1
    return 4 * abs(x - 0.5) - 1

def env(t, dur, a=0.005, d=0.08, s=0.6, r=0.06):
    if t < a: return t / a
    if t < a + d: return 1 - (1 - s) * (t - a) / d
    if t < dur - r: return s
    return max(0.0, s * (dur - t) / r)

# (시작 박, 길이 박, 노트) — D 단조 느낌의 행진 호출
lead = [
    (0, 0.5, 62), (0.5, 0.25, 62), (0.75, 0.25, 62), (1, 0.5, 69), (1.5, 0.5, 67),
    (2, 0.5, 65), (2.5, 0.25, 67), (2.75, 0.25, 69), (3, 1.0, 74),
    (4, 0.25, 72), (4.25, 0.25, 74), (4.5, 0.25, 76), (4.75, 0.25, 77), (5, 2.0, 74),
]
harm = [(0, 1, 57), (1, 1, 62), (2, 1, 60), (3, 1, 65), (4, 1, 64), (5, 2, 65)]
bass = [(0, 1, 38), (1, 1, 38), (2, 1, 34), (3, 1, 36), (4, 1, 33), (5, 2, 38)]
snare = [0, 1, 2, 2.5, 3, 4, 4.25, 4.5, 4.75, 5]
roll = [4 + i * 0.0625 for i in range(16)]

total = 7.2 * BEAT
n = int(total * SR)
buf = [0.0] * n

def add_note(start, length, note, kind, vol):
    s0, dur, f = start * BEAT, length * BEAT, freq(note)
    for i in range(int(s0 * SR), min(n, int((s0 + dur + 0.08) * SR))):
        t = i / SR - s0
        e = env(t, dur + 0.06, s=0.55 if kind != "bass" else 0.8)
        vib = 1 + (0.006 * math.sin(2 * math.pi * 6 * t) if t > 0.15 else 0)
        if kind == "lead": v = pulse(t, f * vib, 0.25)
        elif kind == "harm": v = pulse(t, f, 0.125)
        else: v = tri(t, f)
        buf[i] += v * e * vol

def add_noise(start, vol, length=0.09):
    s0 = start * BEAT
    for i in range(int(s0 * SR), min(n, int((s0 + length) * SR))):
        t = i / SR - s0
        buf[i] += (random.random() * 2 - 1) * vol * math.exp(-t * 35)

for s, l, nn in lead: add_note(s, l, nn, "lead", 0.22)
for s, l, nn in harm: add_note(s, l, nn, "harm", 0.10)
for s, l, nn in bass: add_note(s, l, nn, "bass", 0.30)
for s in snare: add_noise(s, 0.35)
for s in roll: add_noise(s, 0.12 + 0.2 * (s - 4), 0.05)
add_noise(5, 0.5, 0.4)  # 마지막 심벌 느낌

peak = max(abs(x) for x in buf) or 1
with wave.open(sys.argv[1], "w") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, x / peak * 0.9)) * 32767)) for x in buf))
print("ok", round(total, 2), "s")
