// История сейфа: лежит внутри зашифрованного сейфа и приходит на второй компьютер вместе с ним.
const puppeteer = require('puppeteer-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = [];
const check = (n, ok, x = '') => res.push((ok ? 'PASS  ' : 'FAIL  ') + n + '  ' + x);
const PASS = 'четыре слова про синий чайник';

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
        const list = [...repo.entries()].filter(([k]) => k.startsWith(p + '/')).map(([k, v]) => ({ name: k.slice(p.length + 1), sha: v.sha }));
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
  await A.page.evaluate(async (pass) => {
    MS.history.WINDOW_MS = 0;
    await MS.vaultApi.create(pass);
    const base = { id: 'vh1', type: 'task', listId: 'inbox', title: 'Пароль 1', note: '', due: '', done: false, doneAt: 0, pinned: false, subs: [], order: 1 };
    MS.store.put(MS.vault.doc, { ...base });
    MS.store.put(MS.vault.doc, { ...base, title: 'Пароль 2' });
  }, PASS);
  await cfg(A.page); await sleep(1500);
  const remote = repo.get('vault.json');
  check('в облаке сейф зашифрован, история не видна', remote && !Buffer.from(remote.content, 'base64').toString().includes('Пароль 1'));

  const B = await mk();
  await cfg(B.page); await sleep(1500);
  await B.page.evaluate(async (pass) => { await MS.vaultApi.unlock(pass); }, PASS);
  const seen = await B.page.evaluate(() => MS.history.list('vault', 'vh1').map((v) => v.item.title));
  check('история сейфа пришла на второй компьютер', seen.includes('Пароль 1') && seen.includes('Пароль 2'), seen.join(' | '));
  check('на диске история сейфа не лежит отдельно', await B.page.evaluate(() => !localStorage.getItem('ms:hist') || !localStorage.getItem('ms:hist').includes('Пароль')));
  check('ошибок в консоли нет', A.errs.length + B.errs.length === 0, A.errs.concat(B.errs).join(';'));
  console.log(res.join('\n'));
  await browser.close();
})().catch((e) => { console.log(res.join('\n')); console.error('CRASH', e.message); process.exit(1); });
