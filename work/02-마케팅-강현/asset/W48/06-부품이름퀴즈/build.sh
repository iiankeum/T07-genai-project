#!/bin/bash
# 부품 이름 퀴즈 쇼츠 만들기. 사용: bash build.sh <png 폴더> <출력 폴더>
set -e
cd "$(dirname "$0")"
P="$1"; OUT="$2"; mkdir -p "$OUT"
D=(2.6 1 1 1 2.6 3.6)   # 문제 · 3 · 2 · 1 · 정답 · 끝
T=$(python3 -c "print(sum([2.6,1,1,1,2.6,3.6]))")
# 효과음: 째깍(카운트다운) · 딩동(정답) — 직접 합성
ffmpeg -v error -y -f lavfi -i "aevalsrc='0.6*sin(2*PI*1400*t)*exp(-40*t)':d=0.25:s=44100" -ac 2 tick.wav
ffmpeg -v error -y -f lavfi -i "aevalsrc='0.5*(sin(2*PI*880*t)*exp(-6*t)*lt(t,0.25)+sin(2*PI*1320*(t-0.18))*exp(-5*(t-0.18))*gte(t,0.18))':d=0.9:s=44100" -ac 2 ding.wav
for q in q1 q2 q3; do for p in insta yt; do
  args=""; fc=""; for i in 1 2 3 4 5 6; do args="$args -loop 1 -t ${D[$((i-1))]} -i $P/$q-$p-0$i.png"; fc="$fc[$((i-1)):v]scale=1080:1920,setsar=1,fps=30[v$i];"; done
  python3 -I make_bgm2.py bgm.wav $T >/dev/null
  ffmpeg -v error -y $args -i bgm.wav -i tick.wav -i tick.wav -i tick.wav -i ding.wav -filter_complex \
  "${fc}[v1][v2][v3][v4][v5][v6]concat=n=6:v=1:a=0,format=yuv420p[v];\
   [6:a]volume=0.55[b];[7:a]adelay=2600|2600[t1];[8:a]adelay=3600|3600[t2];[9:a]adelay=4600|4600[t3];[10:a]adelay=5600|5600[dg];\
   [b][t1][t2][t3][dg]amix=inputs=5:duration=first:normalize=0,loudnorm=I=-16:TP=-1.5[a]" \
  -map "[v]" -map "[a]" -t $T -c:v libx264 -preset veryfast -crf 20 -c:a aac -b:a 160k -movflags +faststart "$OUT/$q-$p.mp4"
  echo "$q-$p"
done; done
rm -f tick.wav ding.wav bgm.wav
