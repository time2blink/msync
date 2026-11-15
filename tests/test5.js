// Пауза при ограничении GitHub: 429 не считается поломкой, приложение ждёт и повторяет.
const puppeteer = require('puppeteer-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = [];
const check = (n, ok, x = '') => res.push((ok ? 'PASS  ' : 'FAIL  ') + n + '  ' + x);

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setRequestInterception(true);
  let hits = 0;
  page.on('request', (req) => {
    if (!req.url().startsWith('https://api.github.com/')) return req.continue();
    hits++;
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*', 'Retry-After': '120' };
    if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: cors });
    req.respond({ status: 429, headers: cors, contentType: 'application/json', body: '{"message":"rate limited"}' });
  });
  await page.goto('http://127.0.0.1:8765/');
  await page.evaluate(() => { MS.cfg.gh = { repo: 'me/notes', token: 'test-token' }; MS.store.saveCfg(); MS.sync.now(); });
  await sleep(1500);
  const st = await page.evaluate(() => ({ status: MS.sync.state.status, error: MS.sync.state.error }));
  check('429 переводит в ожидание, а не в ошибку', st.status === 'wait', st.status);
  check('пользователь видит понятную причину', st.error.includes('просит подождать'), st.error);
  check('повтор запланирован (запросы не сыпятся)', hits > 0 && hits < 10, 'запросов: ' + hits);
  check('ошибок в консоли нет', errs.length === 0, errs.join(';'));
  console.log(res.join('\n'));
  await browser.close();
})().catch((e) => { console.log(res.join('\n')); console.error('CRASH', e.message); process.exit(1); });
