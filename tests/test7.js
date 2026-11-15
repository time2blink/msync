// История версий через GitHub: версии с одного компьютера появляются на другом.
const puppeteer = require('puppeteer-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = [];
const check = (n, ok, x = '') => res.push((ok ? 'PASS  ' : 'FAIL  ') + n + '  ' + x);

const repo = new Map(); let shaN = 0;
async function fakeGithub(page) {
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url();
    if (!u.startsWith('https://api.github.com/')) return req.continue();
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
    if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: cors });
    const json = (status, body) => req.respond({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(body) });
    const p = decodeURIComponent(u.split('/contents/')[1]);
    if (req.method() === 'GET') {
      if (p === 'spaces' || p === 'history') {
        const pre = p + '/';
        const list = [...repo.entries()].filter(([k]) => k.startsWith(p === 'spaces' ? 'spaces/' : 'history/')).map(([k, v]) => ({ name: k.slice(k.indexOf('/') + 1), sha: v.sha }));
        return list.length ? json(200, list) : json(404, {});
      }
      const f = repo.get(p);
      return f ? json(200, { content: f.content, sha: f.sha }) : json(404, {});
    }
    if (req.method() === 'PUT') {
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
  const mk = async () => {
    const page = await (await browser.createBrowserContext()).newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await fakeGithub(page);
    await page.goto('http://127.0.0.1:8765/');
    await sleep(300);
    return { page, errs };
  };
  const cfg = (p) => p.evaluate(() => { MS.cfg.gh = { repo: 'me/notes', token: 'test-token' }; MS.store.saveCfg(); return MS.sync.now(); });

  const A = await mk();
  await A.page.evaluate(() => {
    MS.history.WINDOW_MS = 0;
    localStorage.removeItem('ms:hist');
    const d = MS.store.doc('work-1');
    const base = { id: 'hist-a', type: 'task', listId: 'inbox', title: 'Первая', note: '', due: '', done: false, doneAt: 0, pinned: false, subs: [], order: 1 };
    MS.store.put(d, { ...base });
    MS.store.put(d, { ...base, title: 'Вторая' });
  });
  await cfg(A.page); await sleep(1500);
  const B = await mk();
  await cfg(B.page); await sleep(1500);
  const seen = await B.page.evaluate(() => MS.history.list('work-1', 'hist-a').map((v) => v.item.title));
  check('версии с первого компьютера пришли на второй', seen.includes('Первая') && seen.includes('Вторая'), seen.join(' | '));
  check('в репозитории есть файл истории спейса', repo.has('history/work-1.json'));
  // Повторная синхронизация не дублирует записи.
  await cfg(B.page); await sleep(1200);
  const again = await B.page.evaluate(() => MS.history.list('work-1', 'hist-a').length);
  check('повторная синхронизация не дублирует записи', again === seen.length, 'записей: ' + again);
  check('ошибок в консоли нет', A.errs.length + B.errs.length === 0, A.errs.concat(B.errs).join(';'));
  console.log(res.join('\n'));
  await browser.close();
})().catch((e) => { console.log(res.join('\n')); console.error('CRASH', e.message); process.exit(1); });
