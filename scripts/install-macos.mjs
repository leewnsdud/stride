import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
if (process.platform !== "darwin") {
  console.error("macos:install은 macOS 전용입니다. 다른 환경에서는 npm start를 사용하세요.");
  process.exit(1);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = path.join(os.homedir(), "Library", "LaunchAgents");
const label = "local.stride.runner";
const file = path.join(directory, `${label}.plist`);
const uid = process.getuid();
if (process.argv.includes("--uninstall")) {
  try {
    execFileSync("/bin/launchctl", ["bootout", `gui/${uid}/${label}`]);
  } catch {}
  rmSync(file, { force: true });
  console.log("Stride 자동 실행을 중지했습니다. 데이터는 유지됩니다.");
  process.exit(0);
}
const xml = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
mkdirSync(directory, { recursive: true });
mkdirSync(path.join(root, "data"), { recursive: true, mode: 0o700 });
const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>${xml(process.execPath)}</string><string>${xml(path.join(root, "server/index.mjs"))}</string></array>
<key>WorkingDirectory</key><string>${xml(root)}</string>
<key>EnvironmentVariables</key><dict><key>PATH</key><string>${xml(process.env.PATH)}</string><key>HOME</key><string>${xml(os.homedir())}</string><key>AUTO_SYNC</key><string>true</string></dict>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>15</integer>
<key>StandardOutPath</key><string>${xml(path.join(root, "data", "server.log"))}</string>
<key>StandardErrorPath</key><string>${xml(path.join(root, "data", "server-error.log"))}</string>
</dict></plist>`;
writeFileSync(file, plist, { mode: 0o600 });
try {
  execFileSync("/bin/launchctl", ["bootout", `gui/${uid}/${label}`], {
    stdio: "ignore",
  });
} catch {}
execFileSync("/bin/launchctl", ["bootstrap", `gui/${uid}`, file], {
  stdio: "inherit",
});
console.log("Stride 자동 실행을 설치했습니다: http://127.0.0.1:4318");
console.log("Mac 로그인 시 실행되며 1시간마다 최근 30일 활동을 동기화합니다.");
