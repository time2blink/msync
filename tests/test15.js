// Синхронизация не чаще раза в минуту: много правок подряд не дают много коммитов на GitHub.
const puppeteer = require('puppeteer-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = [];
const check = (n, ok, x = '') => res.push((ok ? 'PASS  ' : 'FAIL  ') + n + '  ' + x);

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
  const page = await (await browser.createBrowserContext()).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  let listings = 0, puts = 0;
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url();
    if (!u.startsWith('https://api.github.com/')) return req.continue();
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
    if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: cors });
    if (req.method() === 'PUT') { puts++; return req.respond({ status: 200, headers: cors, contentType: 'application/json', body: '{"content":{"sha":"x"}}' }); }
    if (u.endsWith('/contents/spaces')) listings++;
    req.respond({ status: 404, headers: cors, contentType: 'application/json', body: '{}' });
  });
  await page.goto('http://127.0.0.1:8765/');
  await sleep(300);
  await page.evaluate(() => { MS.cfg.gh = { repo: 'me/notes', token: 'test-token' }; MS.store.saveCfg(); });
  // Восемь правок подряд с короткими паузами.
  for (let i = 0; i < 8; i++) {
    await page.evaluate((k) => { const d = MS.store.doc('work-1'); MS.store.put(d, { id: 'thr', type: 'task', listId: 'inbox', title: 'Правка ' + k, note: '', due: '', done: false, doneAt: 0, pinned: false, subs: [], order: 1 }); }, i);
    await sleep(700);
  }
  await sleep(6000);
  check('много правок подряд дают не больше двух синхронизаций', listings <= 2, 'синхронизаций: ' + listings);
  check('коммитов на GitHub мало', puts <= 12, 'запросов записи: ' + puts);
  check('ошибок в консоли нет', errs.length === 0, errs.join(';'));
  console.log(res.join('\n'));
  await browser.close();
})().catch((e) => { console.log(res.join('\n')); console.error('CRASH', e.message); process.exit(1); });
