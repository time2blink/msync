// Ссылки между заметками, обратные ссылки и оглавление.
const puppeteer = require('puppeteer-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = [];
const check = (n, ok, x = '') => res.push((ok ? 'PASS  ' : 'FAIL  ') + n + '  ' + x);

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
  const page = await (await browser.createBrowserContext()).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewport({ width: 1200, height: 800 });
  await page.goto('http://127.0.0.1:8765/');
  await sleep(300);
  const r = await page.evaluate(() => {
    const F = MS.features;
    const d = MS.store.doc('work-1');
    const a = MS.store.put(d, { id: 'wa', type: 'note', title: 'Сервер', body: '# Доступы\n\nтекст\n\n## Пароли\n\nсм. [[Пароли]]', pinned: false });
    MS.store.put(d, { id: 'wb', type: 'note', title: 'Пароли', body: 'ссылка на [[сервер]] и [[Нет такой]]', pinned: false });
    return {
      links: F.wikiLinksOf('см. [[Сервер]] и [[Другое]]'),
      found: (F.findByTitle(d, 'сервер') || {}).id,
      back: F.backlinksOf(d, d.items.wa).map((x) => x.id),
      backB: F.backlinksOf(d, d.items.wb).map((x) => x.id),
      html: F.mdToHtml('Есть [[Пароли]] здесь'),
      toc: F.headingsOf(a.body).map((h) => h.level + ':' + h.text),
      tocHtmlIds: F.mdToHtml(a.body).includes('id="h0"') && F.mdToHtml(a.body).includes('id="h1"'),
    };
  });
  check('ссылки [[...]] распознаются', JSON.stringify(r.links) === JSON.stringify(['Сервер', 'Другое']));
  check('поиск по названию без учёта регистра', r.found === 'wa', r.found);
  check('обратная ссылка для «Сервер» есть из «Пароли»', r.back.includes('wb'), 'back=' + r.back);
  check('обратная ссылка для «Пароли» есть из «Сервер»', r.backB.includes('wa'), 'backB=' + r.backB);
  check('в тексте ссылка становится кликабельной', r.html.includes('class="wikilink"') && r.html.includes('data-wiki="Пароли"'));
  check('оглавление строится из заголовков', r.toc.join(' | ') === '1:Доступы | 2:Пароли', r.toc.join(' | '));
  check('заголовки получают якоря для перехода', r.tocHtmlIds);

  // Интерфейс: открыть заметку, перейти по ссылке, создать недостающую.
  await page.evaluate(() => { MS.store.doc('work-1').items.wa && document.querySelector('[data-view="notes"]').click(); });
  await sleep(150);
  await page.evaluate(() => { [...document.querySelectorAll('.note')].find((n) => n.textContent.includes('Сервер')).querySelector('[data-act="open-note"]').click(); });
  await sleep(200);
  await page.evaluate(() => document.querySelector('[data-mode="read"]').click());
  await sleep(100);
  check('оглавление видно в режиме чтения', await page.evaluate(() => !!document.querySelector('#ns-view .toc')));
  await page.evaluate(() => document.querySelector('#ns-view .wikilink').click());
  await sleep(250);
  check('клик по ссылке открывает заметку «Пароли»', await page.evaluate(() => document.querySelector('#sheet .sheet-title').value === 'Пароли'));
  await page.evaluate(() => { document.querySelector('[data-mode="read"]').click(); });
  await sleep(100);
  await page.evaluate(() => { const el = [...document.querySelectorAll('#ns-view .wikilink')].find((x) => x.dataset.wiki === 'Нет такой'); el.click(); });
  await sleep(250);
  check('ссылка на несуществующую заметку создаёт её', await page.evaluate(() => !!MS.features.findByTitle(MS.store.doc('work-1'), 'Нет такой')));
  check('ошибок в консоли нет', errs.length === 0, errs.join(';'));
  console.log(res.join('\n'));
  await browser.close();
})().catch((e) => { console.log(res.join('\n')); console.error('CRASH', e.message); process.exit(1); });
