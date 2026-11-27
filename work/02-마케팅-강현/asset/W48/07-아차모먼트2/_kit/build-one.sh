#!/bin/bash
# 실사 아차 모먼트 한 편 만들기 (Flow 원본 → 네 판)
# 사용: bash build-one.sh <id> <flow 원본.mp4> "<첫 자막(줄바꿈은 <br>)>" "<끝 자막>" "<큰 글씨>" <출력 폴더>
# 예:  bash build-one.sh a6-handmemo flow.mp4 "메모지 없을 때 국룰 ✍️<br>손등에 적기" "…근데 뭐라고<br>적었더라?" "아차…!" ..
set -e
K="$(cd "$(dirname "$0")" && pwd)"; ID=$1; SRC=$(realpath "$2"); C1=$3; C2=$4; BIG=$5; OUT=$(realpath "$6")
A="$K/../.."   # asset/W48
W=$(mktemp -d); cd "$W"; cp "$K"/rt.js "$K"/make_bgm2.py .
{ cat "$K/ov-head.html"
  echo "<div class=\"slide\"><div class=\"cap\" style=\"top:200px\">$C1</div></div>"
  echo "<div class=\"slide\"><div class=\"cap\" style=\"top:200px\">$C2</div><div class=\"big\" style=\"top:1330px\">$BIG</div></div>"
  echo "</body></html>"; } > ov.html
cp ov.html "$OUT/ov-$ID.html"
node rt.js ov.html .
V="scale=1080:1920:flags=lanczos,fps=25,format=yuv420p,setsar=1"
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SRC"); T=$(python3 -c "print(min($D,8.0)-0.05)"); S2=$(python3 -c "print(round($T*0.58,2))")
if ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$SRC" | grep -q .; then AIN="[0:a]volume=0.6,aresample=44100,aformat=channel_layouts=stereo[a]"; else AIN="anullsrc=r=44100:cl=stereo,atrim=0:$T[a]"; fi
ffmpeg -v error -y -i "$SRC" -i o1.png -i o2.png -filter_complex "[0:v]$V[b];[b][1:v]overlay=0:0:enable='between(t,0,3.2)'[x];[x][2:v]overlay=0:0:enable='gte(t,$S2)'[v];$AIN" -map "[v]" -map "[a]" -t $T -c:v libx264 -preset veryfast -crf 20 -c:a aac -b:a 160k -ar 44100 -ac 2 segP.mp4
for p in insta yt; do ffmpeg -v error -y -loop 1 -t 3 -i "$A/04-릴스묶음/end-$p.png" -f lavfi -t 3 -i anullsrc=r=44100:cl=stereo -filter_complex "[0:v]$V[v]" -map "[v]" -map 1:a -c:v libx264 -preset veryfast -crf 20 -c:a aac -b:a 160k -ar 44100 -ac 2 -shortest end-$p.mp4; done
cp "$K/segS-demo.mp4" segS.mp4
assemble(){ name=$1; shift; n=$#; inputs=""; fc=""; k=0; dur=0
 for s in "$@"; do inputs="$inputs -i $s"; fc="$fc[$k:v][$k:a]"; k=$((k+1)); d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 $s); dur=$(python3 -c "print($dur+$d)"); done
 python3 -I make_bgm2.py bgm.wav $dur >/dev/null
 ffmpeg -v error -y $inputs -i bgm.wav -filter_complex "${fc}concat=n=$n:v=1:a=1[v][a];[a]asplit=2[o][sc];[$n:a]volume=0.2[bg];[bg][sc]sidechaincompress=threshold=0.03:ratio=5:attack=40:release=500:makeup=1[d];[o][d]amix=inputs=2:duration=first:normalize=0[m];[m]loudnorm=I=-16:TP=-1.5[an]" -map "[v]" -map "[an]" -c:v libx264 -preset veryfast -crf 20 -c:a aac -b:a 192k -movflags +faststart "$OUT/$name.mp4"; echo "$name ${dur}s"; }
assemble $ID-yt segP.mp4 end-yt.mp4
assemble $ID-insta segP.mp4 end-insta.mp4
assemble $ID-solve-insta segP.mp4 segS.mp4 end-insta.mp4
assemble $ID-solve-yt segP.mp4 segS.mp4 end-yt.mp4
rm -rf "$W"
