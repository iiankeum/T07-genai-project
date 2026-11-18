#!/bin/bash
set -euo pipefail

if [[ $(uname -s) != Darwin ]]; then
    echo 'macOS에서 빌드해 주세요.' >&2
    exit 1
fi

source_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
repo=$(cd "$source_dir/../.." && pwd)
node_source=$(NODE_OPTIONS= NODE_PATH= "${AHMATDA_NODE_BINARY:-node}" -p 'process.execPath')
node_major=$(NODE_OPTIONS= NODE_PATH= "$node_source" -p 'process.versions.node.split(".")[0]')
if [[ "$node_major" != 24 ]]; then
    echo 'Node 24 바이너리를 설치하고 AHMATDA_NODE_BINARY를 지정해 주세요.' >&2
    exit 1
fi

node_license=${AHMATDA_NODE_LICENSE:-"$(dirname "$(dirname "$node_source")")/LICENSE"}
if [[ ! -f "$node_license" ]]; then
    echo 'Node 배포본의 LICENSE 경로를 AHMATDA_NODE_LICENSE에 지정해 주세요.' >&2
    exit 1
fi

# 다른 컴퓨터의 Homebrew 라이브러리에 의존하는 바이너리는 복사 후에 실행할 수 없다.
linked_libraries=$(otool -L "$node_source" | awk '/^[[:space:]]/ { print $1 }')
while IFS= read -r library; do
    case "$library" in
        /usr/lib/*|/System/Library/*) ;;
        *) echo "독립 실행 가능한 Node 24 공식 바이너리를 사용해 주세요. 연결 라이브러리: $library" >&2; exit 1 ;;
    esac
done <<< "$linked_libraries"

mkdir -p "$repo/out"
stage=$(mktemp -d "$repo/out/.mac-app.XXXXXX")
trap 'rm -rf "$stage"' EXIT
bundle="$stage/Ahmatda.app"
macos="$bundle/Contents/MacOS"
resources="$bundle/Contents/Resources"
mkdir -p "$macos" "$resources/app" "$resources/pc-agent"

cp "$source_dir/Info.plist" "$bundle/Contents/"
cp "$node_source" "$macos/node"
cp "$node_license" "$resources/Node-LICENSE.txt"
cp "$repo/LICENSE" "$resources/Project-LICENSE.txt"
cp "$repo/THIRD_PARTY_NOTICES.md" "$resources/"
cp "$source_dir/parent-lifetime.mjs" "$resources/"
cp "$source_dir/setup-local-model.mjs" "$resources/"
cp "$source_dir/setup-whisper-model.mjs" "$resources/"
cp "$source_dir/local-runtime.mjs" "$resources/"
cp "$repo/src/pc-agent/callnote_agent.py" "$resources/pc-agent/"

# 런타임 소스만 복사한다. Git이 무시하는 .env, .data, 로컬 녹음은 대상에 없다.
git -C "$repo" ls-files --cached --others --exclude-standard -z -- \
    src/app/server.mjs src/app/package.json src/app/package-lock.json \
    src/app/lib/ src/app/routes/ src/app/public/ src/app/seed/ > "$stage/source-files"
while IFS= read -r -d '' relative; do
    source="$repo/$relative"
    [[ -f "$source" && ! -L "$source" ]] || continue
    dest="$resources/app/${relative#src/app/}"
    mkdir -p "$(dirname "$dest")"
    cp "$source" "$dest"
done < "$stage/source-files"

# 번들에서 브라우저의 외부 폰트 사전 연결과 스타일 요청을 제거한다.
sed -E -i '' '/^<link.*href="https:\/\/(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)/d' \
    "$resources/app/public/index.html" "$resources/app/public/intro/index.html"

# 선택 개발 패키지: 이미 준비된 공식 런타임만 검증해 넣는다. 네트워크 다운로드는 하지 않는다.
if [[ "${AHMATDA_BUNDLE_OLLAMA:-0}" == 1 ]]; then
    runtime_source=${AHMATDA_OLLAMA_RUNTIME:-"$HOME/Library/Application Support/Ahmatda/runtime/ollama-v0.40.16"}
    NODE_OPTIONS= NODE_PATH= "$node_source" --input-type=module - "$source_dir/local-runtime.mjs" "$runtime_source" "$resources/runtime/ollama-v0.40.16" <<'JS'
import {pathToFileURL} from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
const {verifyRuntime,RUNTIME_FILES}=await import(pathToFileURL(process.argv[2]));
await verifyRuntime(process.argv[3]);
for (const entry of RUNTIME_FILES) {
    const dest=path.join(process.argv[4],entry.path);
    await fs.mkdir(path.dirname(dest),{recursive:true,mode:0o755});
    if(entry.link) await fs.symlink(entry.link,dest);
    else await fs.copyFile(path.join(process.argv[3],entry.path),dest);
}
await verifyRuntime(process.argv[4]);
JS
    # vendor의 원본 서명/바이너리 해시를 보존한다. 아래에서 최상위 앱만 ad hoc 서명한다.
fi

NODE_OPTIONS= NODE_PATH= "$macos/node" "$source_dir/copy-dependencies.mjs" "$repo/src/app" "$resources/app"
git -C "$repo" rev-parse HEAD > "$resources/app/REVISION"
if [[ -n $(git -C "$repo" status --porcelain -- src/app src/mac-app) ]]; then
    printf '%s-dirty\n' "$(cut -c1-12 "$resources/app/REVISION")" > "$resources/app/REVISION"
fi

swiftc -target "$(uname -m)-apple-macosx14.0" -module-cache-path "$stage/module-cache" \
    -O "$source_dir/Ahmatda.swift" "$source_dir/LocalModelStatus.swift" -o "$macos/Ahmatda"
plutil -lint "$bundle/Contents/Info.plist" >/dev/null
codesign --force --sign - "$macos/node"
codesign --force --sign - "$bundle"
codesign --verify --deep --strict "$bundle"

output="$repo/out/Ahmatda.app"
if [[ -e "$output" ]]; then
    mv "$output" "$stage/previous.app"
fi
if ! mv "$bundle" "$output"; then
    if [[ -e "$stage/previous.app" ]]; then
        mv "$stage/previous.app" "$output"
    fi
    exit 1
fi
printf '%s\n' "$output"
