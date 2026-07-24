/**
 * dev.js — start the Flask API and the Vite dev server together.
 * Usage: npm start
 * Both processes die together (Ctrl+C kills the pair).
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const isWin = process.platform === 'win32';
const python = path.join(root, 'venv', isWin ? 'Scripts' : 'bin', isWin ? 'python.exe' : 'python');

if (!existsSync(python)) {
  console.error('[dev] Python venv not found. Run first:');
  console.error('        python -m venv venv');
  console.error(isWin
    ? '        venv\\Scripts\\pip install -r requirements.txt'
    : '        venv/bin/pip install -r requirements.txt');
  process.exit(1);
}

const children = [];

function run(name, cmd, args) {
  const child = spawn(cmd, args, { cwd: root, stdio: 'inherit', shell: isWin && cmd === 'npx' });
  children.push(child);
  child.on('exit', (code) => {
    console.log(`[dev] ${name} exited (${code ?? 'signal'}) — shutting down.`);
    shutdown(code ?? 0);
  });
  return child;
}

let closing = false;
function shutdown(code) {
  if (closing) return;
  closing = true;
  for (const child of children) {
    try { child.kill(); } catch { /* already dead */ }
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('[dev] Starting Flask API (:5000) + Vite dev server (:3000)…\n');
run('flask', python, [path.join(root, 'server', 'app.py')]);
setTimeout(() => run('vite', 'npx', ['vite']), 1200);
