import { spawnSync } from 'node:child_process';
import { copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const nodeMajor = Number(process.versions.node.split('.')[0]);

const env = { ...process.env };
if (nodeMajor < 20) {
  // Node 18 worker threads lack the global `crypto` object that
  // @rollup/plugin-terser needs (used by workbox-build to minify the
  // service worker). This flag exposes it.
  env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ''} --experimental-global-webcrypto`.trim();
}

// --base=/subpath/ for deployments served under a sub-path (e.g. GitHub Pages)
const baseArg = process.argv.find((a) => a.startsWith('--base='));

const isWin = process.platform === 'win32';
const bin = (name) =>
  resolve(root, 'node_modules', '.bin', isWin ? `${name}.cmd` : name);

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    env,
    stdio: 'inherit',
    shell: isWin,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(bin('tsc'), ['-b']);
run(bin('vite'), ['build', baseArg].filter(Boolean));

// GitHub Pages has no server-side SPA fallback; it serves 404.html for
// unknown paths. Copying the app shell there makes client-side routes
// (e.g. /medicines) work when navigating directly.
const indexHtml = resolve(root, 'dist', 'index.html');
try {
  copyFileSync(indexHtml, resolve(root, 'dist', '404.html'));
} catch {
  // Non-fatal: 404.html is only needed for GitHub Pages.
}
