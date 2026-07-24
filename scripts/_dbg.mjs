import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
const exe = existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = process.env.U || 'http://localhost:4173';
const b = await puppeteer.launch({ executablePath: exe, headless: true, args:['--use-gl=angle','--enable-webgl','--enable-unsafe-swiftshader','--no-sandbox','--mute-audio'] });
const p = await b.newPage();
const errs=[]; p.on('console',m=>{if(m.type()==='error')errs.push(m.text())}); p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
p.on('requestfailed',r=>errs.push('REQFAIL '+r.url().slice(-50)));
await p.goto(URL,{waitUntil:'domcontentloaded',timeout:30000});
await new Promise(r=>setTimeout(r,14000));
const state = await p.evaluate(()=>({
  loading: document.querySelector('#loading-screen')?.classList.contains('visible'),
  menu: document.querySelector('#main-menu')?.classList.contains('visible'),
  game: !!window.__game, state: window.__game?.state,
}));
console.log('STATE', JSON.stringify(state));
console.log('ERRORS', [...new Set(errs)].slice(0,12).join('\n  '));
await b.close();
