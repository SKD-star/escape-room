import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const clientDir = path.join(rootDir, 'client');
const rootDist = path.join(rootDir, 'dist');
const clientDist = path.join(clientDir, 'dist');

console.log('[Netlify Build] Step 1: Building client with Vite...');
execSync('npx vite build', { cwd: clientDir, stdio: 'inherit' });

console.log('[Netlify Build] Step 2: Syncing build output to root dist...');
if (fs.existsSync(rootDist)) {
  fs.rmSync(rootDist, { recursive: true, force: true });
}
fs.cpSync(clientDist, rootDist, { recursive: true });

console.log('[Netlify Build] Build successful! Dist ready at /dist and /client/dist.');
