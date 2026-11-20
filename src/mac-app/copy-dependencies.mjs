import { cpSync, lstatSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const [source, target] = process.argv.slice(2);
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const lock = readJson(path.join(source, 'package-lock.json'));

for (const [relative, pkg] of Object.entries(lock.packages)) {
  if (!relative || pkg.dev) continue;
  const installed = path.join(source, relative);
  const output = path.join(target, relative);
  try {
    if (!relative.startsWith('node_modules/') || !lstatSync(installed).isDirectory() ||
        readJson(path.join(installed, 'package.json')).version !== pkg.version) {
      throw new Error('lockfile mismatch');
    }
    mkdirSync(path.dirname(output), { recursive: true });
    cpSync(installed, output, {
      recursive: true,
      filter(file) {
        const name = path.basename(file);
        return !lstatSync(file).isSymbolicLink() && name !== 'node_modules' &&
          name !== '.git' && name !== '.npmrc' && name !== '.env' && !name.startsWith('.env.');
      },
    });
  } catch {
    console.error(`${relative} ${pkg.version} 의존성을 복사할 수 없습니다. src/app에서 npm ci를 먼저 실행해 주세요.`);
    process.exit(1);
  }
}
