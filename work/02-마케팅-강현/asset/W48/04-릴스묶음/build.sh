#!/bin/bash
# 릴스 · 쇼츠 묶음 만들기. 사용: bash build.sh <출력 폴더>
set -e
cd "$(dirname "$0")"
OUT="$1"; mkdir -p "$OUT"
A=/mnt/user-data/attachments/e6cb1374-4263-534c-951d-cdb847c5d1c8
TOON=/home/claude/t07-genai-project/work/02-마케팅-강현/asset/toon/ep01-real
CARD=/home/claude/t07-genai-project/work/02-마케팅-강현/asset/W47/02-공감카드뉴스
V="scale=1080:1920:flags=lanczos,fps=25,format=yuv420p,setsar=1"
ENC="-c:v libx264 -preset veryfast -crf 20 -c:a aac -b:a 160k -ar 44100 -ac 2"

# 끝 카드 3초 (무음)
for p in insta yt; do
  ffmpeg -v error -y -loop 1 -t 3 -i end-$p.png -f lavfi -t 3 -i anullsrc=r=44100:cl=stereo -filter_complex "[0:v]$V[v]" -map "[v]" -map 1:a $ENC -shortest end-$p.mp4
done

# 사진 한 장 → 세로 영상 조각 (뒤는 흐린 확대본, 가운데 원본, 살짝 확대되는 움직임)
slide () { # in out sec
  ffmpeg -v error -y -loop 1 -t $3 -i "$1" -f lavfi -t $3 -i anullsrc=r=44100:cl=stereo -filter_complex \
  "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=30:2,eq=brightness=-0.08[bg];\
   [0:v]scale=1080:-2,zoompan=z='min(1+0.0012*on,1.06)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1350:fps=25[fg];\
   [bg][fg]overlay=(W-w)/2:(H-h)/2,fps=25,format=yuv420p,setsar=1[v]" -map "[v]" -map 1:a $ENC -shortest "$2"
}
i=0; for f in $TOON/ep01-0{1..7}.jpg; do i=$((i+1)); slide "$f" toon$i.mp4 2.4; done
i=0; for f in $CARD/card-0{1..6}.png; do i=$((i+1)); slide "$f" card$i.mp4 2.4; done

# 조각들 + BGM → 완성본.  사용: assemble 이름 조각...
assemble () {
  name=$1; shift
  n=$#; inputs=""; fc=""; k=0
  for s in "$@"; do inputs="$inputs -i $s"; fc="$fc[$k:v][$k:a]"; k=$((k+1)); done
  dur=0; for s in "$@"; do d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 $s); dur=$(python3 -c "print($dur+$d)"); done
  python3 -I make_bgm2.py bgm-$name.wav $dur >/dev/null
  ffmpeg -v error -y $inputs -i bgm-$name.wav -filter_complex \
  "${fc}concat=n=$n:v=1:a=1[v][a];[a]asplit=2[o][sc];[$n:a]volume=0.2[bg];[bg][sc]sidechaincompress=threshold=0.03:ratio=5:attack=40:release=500:makeup=1[d];[o][d]amix=inputs=2:duration=first:normalize=0[m];[m]loudnorm=I=-16:TP=-1.5[an]" \
  -map "[v]" -map "[an]" -c:v libx264 -preset veryfast -crf 20 -c:a aac -b:a 192k -movflags +faststart "$OUT/$name.mp4"
  echo "$name $(printf %.1f $dur)s"
}

for p in insta yt; do
  assemble r2-acha-moment-$p segA.mp4 end-$p.mp4
  assemble r3-toon-ep01-$p toon1.mp4 toon2.mp4 toon3.mp4 toon4.mp4 toon5.mp4 toon6.mp4 toon7.mp4 end-$p.mp4
  assemble r4-empathy-cards-$p card1.mp4 card2.mp4 card3.mp4 card4.mp4 card5.mp4 card6.mp4 end-$p.mp4
  assemble r5-proof-ask-$p segC.mp4 segD.mp4 end-$p.mp4
  assemble r6-demo-intro-$p segB.mp4 end-$p.mp4
done
