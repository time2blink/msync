// История версий: записи, откат, обратимость. Окно записи отключаем, чтобы проверить каждую правку.
const puppeteer = require('puppeteer-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = [];
const check = (n, ok, x = '') => res.push((ok ? 'PASS  ' : 'FAIL  ') + n + '  ' + x);

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
  const page = await (await browser.createBrowserContext()).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8765/');
  await sleep(300);
  const r = await page.evaluate(() => {
    localStorage.removeItem('ms:hist');
    MS.history.WINDOW_MS = 0;
    const d = MS.store.doc('work-1');
    const base = { id: 'h1', type: 'task', listId: 'inbox', title: 'Версия 1', note: '', due: '', done: false, doneAt: 0, pinned: false, subs: [], order: 1 };
    MS.store.put(d, { ...base });
    MS.store.put(d, { ...base, title: 'Версия 2' });
    MS.store.put(d, { ...base, title: 'Версия 3' });
    const list = MS.history.list('work-1', 'h1');
    const titles = list.map((v) => v.item.title);
    const oldest = list[list.length - 1].t;
    MS.store.restore(d, 'h1', oldest);
    const after = MS.store.doc('work-1').items.h1.title;
    const listAfter = MS.history.list('work-1', 'h1').map((v) => v.item.title);
    MS.history.WINDOW_MS = 120000;
    // Окно: быстрые правки подряд сливаются в одну запись.
    localStorage.removeItem('ms:hist');
    MS.store.put(d, { ...base, title: 'Быстро 1' });
    MS.store.put(d, { ...base, title: 'Быстро 2' });
    const merged = MS.history.list('work-1', 'h1').length;
    // Лимит: не больше 50 записей.
    MS.history.WINDOW_MS = 0;
    for (let i = 0; i < 60; i++) MS.store.put(d, { ...base, title: 'Шаг ' + i });
    const capped = MS.history.list('work-1', 'h1').length;
    return { titles, after, listAfter, merged, capped };
  });
  check('каждая правка попадает в историю, новые сверху', JSON.stringify(r.titles) === JSON.stringify(['Версия 3', 'Версия 2', 'Версия 1']), r.titles.join(' | '));
  check('откат возвращает старую версию', r.after === 'Версия 1', r.after);
  check('откат обратим: текущая версия осталась в истории', r.listAfter[0] === 'Версия 1' && r.listAfter.includes('Версия 3'), r.listAfter.join(' | '));
  check('быстрые правки сливаются в одну запись', r.merged === 1, 'записей: ' + r.merged);
  check('история не больше 50 записей', r.capped === 50, 'записей: ' + r.capped);
  check('ошибок в консоли нет', errs.length === 0, errs.join(';'));
  console.log(res.join('\n'));
  await browser.close();
})().catch((e) => { console.log(res.join('\n')); console.error('CRASH', e.message); process.exit(1); });
