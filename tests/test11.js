// Экраны очередь 1 и 2: сегодня, доска, теги, закрепление, нерабочие дни, перенос, версии, шаблоны.
const puppeteer = require('puppeteer-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = [];
const check = (n, ok, x = '') => res.push((ok ? 'PASS  ' : 'FAIL  ') + n + '  ' + x);

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
  const page = await (await browser.createBrowserContext()).newPage();
  await page.setViewport({ width: 1200, height: 800 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8765/');
  await sleep(400);
  const click = (sel) => page.evaluate((s) => { const el = document.querySelector(s); if (!el) throw new Error('нет элемента ' + s); el.click(); }, sel);
  const text = (sel) => page.evaluate((s) => { const el = document.querySelector(s); return el ? el.textContent : null; }, sel);
  const exists = (sel) => page.evaluate((s) => !!document.querySelector(s), sel);
  const todayIso = await page.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });

  // Подготовка: задача с тегом и сроком сегодня, закреплённая заметка.
  await page.evaluate((t) => {
    const d = MS.store.doc('work-1');
    MS.store.put(d, { id: 'ui1', type: 'task', listId: 'inbox', title: 'Вход на сервер #сервер/доступы', note: '', due: t, done: false, doneAt: 0, pinned: true, subs: [], order: 1 });
    MS.store.put(d, { id: 'uinote', type: 'note', title: 'Закреплённая', body: '# Заголовок\n\n**жирный** и [ссылка](https://example.com)', pinned: true });
    MS.store.render ? 0 : 0;
  }, todayIso);
  await page.evaluate(() => { MS.onChange = null; });
  await page.evaluate(() => location.reload());
  await sleep(500);

  // Сегодня
  await click('[data-view="today"]'); await sleep(150);
  check('экран «Сегодня» показывает задачу на сегодня', (await text('#content')).includes('Вход на сервер'));

  // Быстрый доступ в боковой панели
  check('закреплённое попадает в быстрый доступ', await exists('.quick-item'));

  // Теги
  await click('[data-view="tags"]'); await sleep(150);
  check('теги показаны чипами', (await text('#content')).includes('#сервер/доступы'));
  await click('[data-tag="сервер/доступы"]'); await sleep(150);
  check('по тегу показываются задачи с ним', (await text('#content')).includes('Вход на сервер'));

  // Доска
  await click('[data-view="board"]'); await sleep(150);
  check('доска с тремя колонками', (await page.$$('.board .col')).length === 3);
  await page.evaluate(() => document.querySelector('.card [data-to="doing"]').click());
  await sleep(150);
  const st = await page.evaluate(() => MS.features.statusOf(MS.store.doc('work-1').items.ui1));
  check('карточка переходит в «В работе»', st === 'doing', st);
  await page.evaluate(() => document.querySelector('[data-act="move-status"][data-to="done"]').click());
  await sleep(150);
  check('карточка отмечена «Готово» и становится выполненной', await page.evaluate(() => MS.store.doc('work-1').items.ui1.done === true));
  await page.evaluate(() => { const t = MS.store.doc('work-1').items.ui1; t.done = false; MS.store.put(MS.store.doc('work-1'), { ...t, status: 'todo' }); });

  // Закрепление заметки и Markdown-просмотр
  await click('[data-view="notes"]'); await sleep(150);
  check('закреплённая заметка сверху', (await page.$$eval('.note h3', (e) => e[0] && e[0].textContent)) === 'Закреплённая');
  await page.evaluate(() => document.querySelector('.note [data-act="open-note"]').click());
  await sleep(200);
  await page.evaluate(() => document.querySelector('[data-mode="read"]').click());
  await sleep(100);
  const html = await page.evaluate(() => document.querySelector('#ns-view').innerHTML);
  check('Markdown в режиме «Читать»: жирный, заголовок, ссылка', html.includes('<strong>жирный</strong>') && html.includes('<h3>') && html.includes('href="https://example.com"'));
  await page.evaluate(() => document.querySelector('#ns-pin').click());
  await sleep(150);
  check('закрепление из окна заметки работает', await page.evaluate(() => MS.store.doc('work-1').items.uinote.pinned === false));
  await page.evaluate(() => document.querySelector('[data-close]').click());
  await sleep(150);

  // Перенос заметки в другую работу
  await page.evaluate(() => document.querySelector('.note [data-act="open-note"]').click());
  await sleep(200);
  await page.evaluate(() => { const s = document.querySelector('#ns-move'); s.value = 'work-2'; document.querySelector('#ns-move-go').click(); });
  await sleep(150);
  check('заметка перенесена в другую работу', await page.evaluate(() => !!MS.store.doc('work-2').items.uinote && MS.store.doc('work-1').items.uinote.deleted === true));

  // Нерабочие дни в календаре
  await page.evaluate(() => { MS.cfg.space = 'work-1'; MS.store.saveCfg(); });
  await page.evaluate(() => { location.reload(); });
  await sleep(500);
  await click('[data-view="calendar"]'); await sleep(150);
  await page.evaluate(() => {
    const ta = document.querySelector('[data-off-import] textarea');
    const f = (k) => { const x = new Date(); x.setDate(x.getDate() + k); return String(x.getDate()).padStart(2, '0') + '.' + String(x.getMonth() + 1).padStart(2, '0') + '.' + x.getFullYear(); };
    ta.value = f(2) + ' выход\n31.02.2027 выход\n' + f(3);
    document.querySelector('[data-off-import] button').click();
  });
  await sleep(200);
  const offCount = await page.evaluate(() => MS.days.listDays(MS.store.doc('work-1')).length);
  check('импорт дней через окно календаря', offCount === 2, 'дней: ' + offCount);
  check('дни отмечаются в сетке календаря', await page.evaluate(() => !!document.querySelector('.cell.off')));
  const icsOk = await page.evaluate(() => { const iso = MS.days.listDays(MS.store.doc('work-1'))[0].date.replace(/-/g, ''); return MS.days.toIcs(MS.store.doc('work-1')).includes('DTSTART;VALUE=DATE:' + iso); });
  check('выгрузка календаря содержит отмеченный день', icsOk);

  // Версии задачи с возвратом
  await page.evaluate(() => {
    MS.history.WINDOW_MS = 0;
    const d = MS.store.doc('work-1');
    const t = d.items.ui1;
    MS.store.put(d, { ...t, title: 'Версия А' });
    MS.store.put(d, { ...d.items.ui1, title: 'Версия Б' });
  });
  await page.evaluate(() => { document.querySelector('[data-view="tasks"]').click(); });
  await sleep(150);
  await page.evaluate(() => document.querySelector('.task .t-body').click());
  await sleep(250);
  const rows = await page.$$eval('#ts-hist .hist-row', (e) => e.length);
  check('в окне задачи есть история версий', rows >= 2, 'версий: ' + rows);
  await page.evaluate(() => { const all = document.querySelectorAll('#ts-hist [data-restore]'); all[all.length - 1].click(); });
  await sleep(250);
  check('версия возвращается из окна задачи', await page.evaluate(() => MS.store.doc('work-1').items.ui1.title !== 'Версия Б'));
  check('в окне задачи есть повтор', await exists('#ts-repeat'));
  await page.evaluate(() => document.querySelector('[data-close]').click());
  await sleep(150);

  // Шаблон списка через настройки
  await page.evaluate(() => { document.querySelector('#foot [data-act="settings"]').click(); });
  await sleep(250);
  await page.evaluate(() => {
    const f = document.querySelector('#tpl-form');
    f.elements.name.value = 'Публикация'; f.elements.lines.value = 'Написать текст\nПроверить ссылки';
    f.requestSubmit();
  });
  await sleep(250);
  check('шаблон сохранён из настроек', await page.evaluate(() => MS.features.templates().some((t) => t.name === 'Публикация')));
  check('копия за день создана', await page.evaluate(() => MS.features.backupList().length >= 1));
  await page.evaluate(() => document.querySelector('[data-close]').click());
  await sleep(150);
  await click('[data-view="tasks"]'); await sleep(150);
  check('шаблон доступен в задачах', await exists('[data-tpl-apply]'));
  await page.evaluate(() => { const s = document.querySelector('[data-tpl-apply]'); s.value = 'Публикация'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await sleep(200);
  check('список создан из шаблона', await page.evaluate(() => MS.store.items(MS.store.doc('work-1'), 'list').some((l) => l.name === 'Публикация')));

  check('ошибок в консоли нет', errs.length === 0, errs.join(';'));
  console.log(res.join('\n'));
  await browser.close();
})().catch((e) => { console.log(res.join('\n')); console.error('CRASH', e.message); process.exit(1); });
