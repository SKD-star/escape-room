/**
 * py.js — run a Python script with the project's venv interpreter,
 * cross-platform. Used by the npm scripts so `venv/Scripts/python` paths
 * don't break in Windows cmd (which mis-parses the forward slashes).
 *
 * Usage:  node scripts/py.js server/app.py [args…]
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const isWin = process.platform === 'win32';
const python = path.join(root, 'venv', isWin ? 'Scripts' : 'bin', isWin ? 'python.exe' : 'python');

if (!existsSync(python)) {
  console.error('[py] venv Python not found at:', python);
  console.error('     Create it first:');
  console.error('       python -m venv venv');
  console.error(isWin
    ? '       venv\\Scripts\\pip install -r requirements.txt'
    : '       venv/bin/pip install -r requirements.txt');
  process.exit(1);
}

const child = spawn(python, process.argv.slice(2), { cwd: root, stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 0));
child.on('error', (err) => { console.error('[py]', err.message); process.exit(1); });
