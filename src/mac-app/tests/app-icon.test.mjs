// 사용자 원본 로고의 표준 macOS 리소스 패키징만 검증한다. 앱 설치·실행 시험이 아니다.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const native = fileURLToPath(new URL('..', import.meta.url));
const source = path.join(native, '../app/public/assets/ahcha-logo-original.jpeg');
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
test('원본 보존, 10종 ICNS 크기, plist 연결, 기존 출력 보존', {skip: process.platform !== 'darwin'}, t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ahcha-icon-'));
  t.after(() => fs.rmSync(root, {recursive:true, force:true}));
  const originalHash = sha(source);
  assert.equal(originalHash, '8f63f4288ba54c1a8f7cb80062305d39a30dfd244f86595620e34328e2851b20');
  const icon = path.join(root, 'Ahcha.icns');
  execFileSync('bash', [path.join(native, 'package-app-icon.sh'), icon]);
  assert.equal(fs.readFileSync(icon).subarray(0,4).toString(), 'icns');
  const extracted = path.join(root, 'restored.iconset');
  execFileSync('/usr/bin/iconutil', ['-c', 'iconset', icon, '-o', extracted]);
  const files = fs.readdirSync(extracted);
  assert.equal(files.length, 10);
  for (const points of [16,32,128,256,512]) for (const scale of [1,2]) {
    const file = path.join(extracted, `icon_${points}x${points}${scale===2?'@2x':''}.png`);
    const info = execFileSync('/usr/bin/sips', ['-g','pixelWidth','-g','pixelHeight',file], {encoding:'utf8'});
    assert.match(info, new RegExp(`pixelWidth: ${points*scale}\\b`));
    assert.match(info, new RegExp(`pixelHeight: ${points*scale}\\b`));
  }
  const iconHash = sha(icon);
  assert.notEqual(spawnSync('bash', [path.join(native,'package-app-icon.sh'),icon]).status,0);
  assert.equal(sha(icon),iconHash);
  const link = path.join(root,'existing-link.icns');
  fs.symlinkSync(icon,link);
  assert.notEqual(spawnSync('bash',[path.join(native,'package-app-icon.sh'),link]).status,0);
  assert.equal(sha(source),originalHash);
  assert.equal(fs.readdirSync(root).filter(name => name.startsWith('.app-icon.')).length,0);
  // 별도 fixture 트리에서 원본 불일치 거절을 확인한다. 실제 원본은 수정하지 않는다.
  const fixtureNative = path.join(root,'fixture','mac-app');
  const fixtureAssets = path.join(root,'fixture','app','public','assets');
  fs.mkdirSync(fixtureNative,{recursive:true});
  fs.mkdirSync(fixtureAssets,{recursive:true});
  fs.copyFileSync(path.join(native,'package-app-icon.sh'),path.join(fixtureNative,'package-app-icon.sh'));
  fs.writeFileSync(path.join(fixtureAssets,'ahcha-logo-original.jpeg'),'invalid fixture');
  assert.notEqual(spawnSync('bash',[path.join(fixtureNative,'package-app-icon.sh'),path.join(root,'invalid.icns')]).status,0);
  assert.equal(fs.existsSync(path.join(root,'invalid.icns')),false);
  const plist = execFileSync('/usr/libexec/PlistBuddy',['-c','Print :CFBundleIconFile',path.join(native,'Info.plist')],{encoding:'utf8'}).trim();
  assert.equal(plist,path.basename(icon));
  assert.match(fs.readFileSync(path.join(native,'build.sh'),'utf8'), /package-app-icon\.sh.*\$resources\/Ahcha\.icns/);
});
