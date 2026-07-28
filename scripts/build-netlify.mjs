import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const clientDist = path.join(rootDir, 'client', 'dist');
const rootDist = path.join(rootDir, 'dist');

console.log('[Netlify Build] Step 1: Building client with Vite from root...');
execSync('npx vite build', { cwd: rootDir, stdio: 'inherit' });

console.log('[Netlify Build] Step 2: Syncing build output to root dist...');
if (fs.existsSync(clientDist) && rootDist !== clientDist) {
  if (fs.existsSync(rootDist)) {
    fs.rmSync(rootDist, { recursive: true, force: true });
  }
  fs.cpSync(clientDist, rootDist, { recursive: true });
}

console.log('[Netlify Build] Build successful! Dist ready at /dist.');
