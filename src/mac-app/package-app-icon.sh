#!/bin/bash
# 사용자 원본 전체를 표준 크기로 축소할 뿐 색·형태·여백을 편집하지 않는다.
set -euo pipefail
[[ $(uname -s) == Darwin ]] || { echo '앱 아이콘 패키징에는 macOS가 필요합니다.' >&2; exit 1; }
[[ $# == 1 ]] || { echo '사용법: package-app-icon.sh 새출력.icns' >&2; exit 1; }
source_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
original="$source_dir/../app/public/assets/ahcha-logo-original.jpeg"
expected=8f63f4288ba54c1a8f7cb80062305d39a30dfd244f86595620e34328e2851b20
[[ -f "$original" && ! -L "$original" ]] || { echo '원본 로고 파일을 확인해 주세요.' >&2; exit 1; }
[[ $(shasum -a 256 "$original" | awk '{print $1}') == "$expected" ]] || { echo '승인된 원본 로고와 다릅니다.' >&2; exit 1; }
[[ ! -e "$1" && ! -L "$1" ]] || { echo '기존 아이콘 파일을 보존하고 중단합니다.' >&2; exit 1; }
output_dir=$(cd "$(dirname "$1")" && pwd)
output="$output_dir/$(basename "$1")"
stage=$(mktemp -d "$output_dir/.app-icon.XXXXXX")
trap 'rm -rf "$stage"' EXIT
mkdir "$stage/Ahcha.iconset"
for points in 16 32 128 256 512; do
    for scale in 1 2; do
        pixels=$((points * scale))
        suffix=''
        [[ $scale == 1 ]] || suffix='@2x'
        /usr/bin/sips -s format png -z "$pixels" "$pixels" "$original" \
            --out "$stage/Ahcha.iconset/icon_${points}x${points}${suffix}.png" >/dev/null
    done
done
/usr/bin/iconutil -c icns "$stage/Ahcha.iconset" -o "$stage/Ahcha.icns"
# 같은 파일시스템의 배타적 링크 생성으로 기존 출력을 덮어쓰지 않는다.
ln "$stage/Ahcha.icns" "$output"
