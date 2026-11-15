// Формат и слияние: часы с отставанием, файл новой версии, перевод старого формата.
const puppeteer = require('puppeteer-core');
const path = require('path');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = [];
const check = (n, ok, x = '') => res.push((ok ? 'PASS  ' : 'FAIL  ') + n + '  ' + x);

// Поддельный GitHub в памяти, общий для всех «компьютеров» в одном прогоне.
const repo = new Map(); let shaN = 0;
async function fakeGithub(page) {
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url();
    if (!u.startsWith('https://api.github.com/')) return req.continue();
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
    if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: cors });
    const json = (status, body) => req.respond({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(body) });
    if (req.method() === 'GET') {
      const p = decodeURIComponent(u.split('/contents/')[1]);
      if (p === 'spaces') {
        const list = [...repo.entries()].filter(([k]) => k.startsWith('spaces/')).map(([k, v]) => ({ name: k.slice(7), sha: v.sha }));
        return list.length ? json(200, list) : json(404, {});
      }
      const f = repo.get(p);
      return f ? json(200, { content: f.content, sha: f.sha }) : json(404, {});
    }
    if (req.method() === 'PUT') {
      const p = decodeURIComponent(u.split('/contents/')[1]);
      const b = JSON.parse(req.postData());
      const f = repo.get(p);
      if (f && f.sha !== b.sha) return json(409, {});
      const sha = 'sha' + (++shaN);
      repo.set(p, { content: b.content, sha });
      return json(200, { content: { sha } });
    }
    json(400, {});
  });
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
  const mk = async (clockShiftMs = 0) => {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1100, height: 700 });
    if (clockShiftMs) {
      await page.evaluateOnNewDocument((shift) => { const real = Date.now; Date.now = () => real() + shift; }, clockShiftMs);
    }
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await fakeGithub(page);
    await page.goto('http://127.0.0.1:8765/');
    await sleep(300);
    return { page, errs };
  };
  const cfg = (p) => p.evaluate(() => { MS.cfg.gh = { repo: 'me/notes', token: 'test-token' }; MS.store.saveCfg(); return MS.sync.now(); });
  const titles = (p) => p.evaluate(() => Object.values(MS.data.spaces['work-1'].items).filter((i) => i.type === 'task' && !i.deleted).map((t) => t.title).sort());

  // 1. Часы компьютера B отстают на два часа. Его правка после синхронизации должна победить.
  const A = await mk(0);
  await A.page.evaluate(() => { const d = MS.store.doc('work-1'); MS.store.put(d, { id: 'task-old', type: 'task', listId: 'inbox', title: 'Старая задача', note: '', due: '', done: false, doneAt: 0, pinned: false, subs: [], order: 1 }); });
  await cfg(A.page); await sleep(1200);
  const B = await mk(-2 * 3600 * 1000);
  await cfg(B.page); await sleep(1200);
  await B.page.evaluate(() => {
    const d = MS.store.doc('work-1');
    const t = d.items['task-old']; t.title = 'Исправлено на B'; MS.store.put(d, t);
  });
  await cfg(B.page); await sleep(1200);
  await cfg(A.page); await sleep(1200);
  const seenByA = await titles(A.page);
  check('правка с отстающими часами не теряется', seenByA.includes('Исправлено на B') && !seenByA.includes('Старая задача'), seenByA.join(' | '));

  // 2. Файл новой версии не перезаписываем и не трогаем.
  const future = { v: 3, id: 'work-1', name: 'Из будущего', items: {} };
  repo.set('spaces/work-1.json', { content: Buffer.from(JSON.stringify(future)).toString('base64'), sha: 'future1' });
  const C = await mk(0);
  await cfg(C.page); await sleep(1500);
  const err = await C.page.evaluate(() => MS.sync.state.error);
  check('файл новой версии не перезаписан', repo.get('spaces/work-1.json').sha === 'future1' && err.includes('новой версией'), err);

  // 3. Старый файл без версии переводится при загрузке.
  const v = await C.page.evaluate(() => MS.data.v);
  check('старый формат переведён в текущий', v === 2, 'v=' + v);

  check('ошибок в консоли нет (A)', A.errs.length === 0, A.errs.join(';'));
  check('ошибок в консоли нет (B)', B.errs.length === 0, B.errs.join(';'));
  console.log(res.join('\n'));
  await browser.close();
})().catch((e) => { console.log(res.join('\n')); console.error('CRASH', e.message); process.exit(1); });
