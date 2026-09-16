import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
const major = Number(process.versions.node.split('.')[0]);
console.log(`Node.js: ${process.version} ${major === 24 ? '✓' : '— Node 24.x가 필요합니다'}`);
console.log(`화면 빌드: ${existsSync('dist/client/index.html') ? '✓' : 'npm run build가 필요합니다'}`);
for (const [name, bin, args] of [
  ['Garmin Python (선택)', process.env.GARMIN_PYTHON || '.venv/bin/python', ['-c', 'import sys, garminconnect; assert sys.version_info >= (3,12); print("ready")']],
  ['Codex CLI (선택)', process.env.CODEX_BIN || 'codex', ['--version']],
]) {
  const result = spawnSync(bin, args, { encoding:'utf8', timeout:10000 });
  console.log(`${name}: ${result.status === 0 ? '✓' : '미설치 또는 실행 불가 — 설치 가이드 참고'}`);
}
if (major !== 24) process.exitCode = 1;
