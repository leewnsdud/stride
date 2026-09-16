// Inspect only the Git index; never print matched secrets or scan private runtime files.
import { execFileSync } from 'node:child_process';
const files = execFileSync('git', ['ls-files', '-z'], { encoding:'utf8' }).split('\0').filter(Boolean);
const problems = [];
const forbidden = /(^|\/)(data|node_modules|dist|\.venv|\.openai|\.codex|__pycache__)(\/|$)|\.(sqlite[^/]*|db|log|fit|gpx|tcx|har|pem|key)$|(^|\/)(auth|integrations|remote-access|garmin_tokens)\.json$|(^|\/)\.env(?!\.example$)/;
const patterns = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/],
  ['API key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/],
  ['personal home path', /\/(?:Users|home)\/[A-Za-z0-9._-]+\//],
  ['private tailnet address', /https?:\/\/(?![^/\s]*example\.)[a-z0-9.-]+\.ts\.net\b/i],
];
for (const file of files) {
  if (forbidden.test(file)) problems.push(`${file}: private artifact path`);
  const content = execFileSync('git', ['show', `:${file}`], { maxBuffer:20*1024*1024 }).toString('utf8');
  for (const [label, pattern] of patterns) if (pattern.test(content)) problems.push(`${file}: ${label}`);
}
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(`Public file checks passed (${files.length} staged/tracked files). Also review content and run a secret scanner before publishing.`);
