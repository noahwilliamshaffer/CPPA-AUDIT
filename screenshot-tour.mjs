import puppeteer from 'puppeteer';
import { mkdir } from 'fs/promises';
import { existsSync, rmSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'screenshots');
const BASE = 'http://localhost:3000';

const SHOTS = [
  { name: '01-assessment',     url: `${BASE}/dashboard/assessment`,   full: true  },
  { name: '02-component-4',    url: `${BASE}/dashboard/assessment/4`, full: true  },
  { name: '03-scoring-top',    url: `${BASE}/dashboard/scoring`,      full: false },
  { name: '04-scoring-full',   url: `${BASE}/dashboard/scoring`,      full: true  },
  { name: '05-reports',        url: `${BASE}/dashboard/reports`,      full: false },
  { name: '06-settings',       url: `${BASE}/dashboard/settings`,     full: false },
];

async function main() {
  if (!existsSync(OUT)) await mkdir(OUT, { recursive: true });
  const tmp = path.join(OUT, '_chrome');
  if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    userDataDir: tmp,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();

  for (const { name, url, full } of SHOTS) {
    console.log(`→ ${name}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));
    console.log(`  ${page.url()}`);
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
    console.log(`  saved (fullPage=${full})`);
  }

  await browser.close();
  console.log('\nDone:', OUT);
}

main().catch(e => { console.error(e); process.exit(1); });
