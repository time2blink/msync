const puppeteer = require('puppeteer-core');
const path = require('path');
const URL_ = 'http://127.0.0.1:8765/';
const out = (n) => path.join(__dirname, 'out', n);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, extra = '') => { results.push([ok ? 'PASS' : 'FAIL', name, extra]); };

// Поддельный GitHub Contents API в памяти, общий для двух «компьютеров».
const repo = new Map(); let shaN = 0;
async function fakeGithub(page) {
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url();
    if (!u.startsWith('https://api.github.com/')) return req.continue();
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
    if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: cors });
    const p = decodeURIComponent(u.split('/contents/')[1]);
    const json = (status, body) => req.respond({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(body) });
    if (req.method() === 'GET') {
      if (p === 'spaces') {
        const list = [...repo.entries()].filter(([k]) => k.startsWith('spaces/')).map(([k, v]) => ({ name: k.slice(7), sha: v.sha }));
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
  const browser = await puppeteer.launch({ executablePath: (process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'), headless: 'new' });
  const mk = async (w = 1320, h = 860) => {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    // Ошибки самого приложения: сообщения console.error и 404 для файлов приложения.
    // 404 от поддельного GitHub (файла ещё нет в репозитории) — ожидаемы, их не считаем.
    page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text()); });
    page.on('response', (r) => {
      const u = r.url();
      if (r.status() === 404 && u.startsWith('http://127.0.0.1') && !u.endsWith('favicon.ico')) errs.push('404 ' + u);
    });
    await fakeGithub(page);
    await page.goto(URL_);
    return { page, errs };
  };
  // Если синхронизация перерисовала список прямо во время клика, повторяем клик.
  const add = async (page, text, sel = '.add input') => {
    for (let i = 0; i < 3; i++) {
      try { await page.click(sel); break; } catch (e) { if (!/detached/.test(e.message) || i === 2) throw e; await sleep(150); }
    }
    await page.keyboard.type(text); await page.keyboard.press('Enter'); await sleep(60);
  };

  // ---- компьютер A ----
  const A = await mk();
  const a = A.page;
  for (const t of ['Обновить страницу казино', 'Проверить ссылки в футере', 'Сверить коэффициенты', 'Отправить отчёт за неделю']) await add(a, t);
  check('добавление задач', (await a.$$('.task')).length === 4);
  await a.type('#handoff', 'Закончил на странице 665, осталось проверить ACF-поля.');

  // перетаскивание: первую задачу на третье место
  const order0 = await a.$$eval('.task .t-title', (e) => e.map((x) => x.textContent));
  await a.hover('.task:nth-child(1)');
  const g = await (await a.$('.task:nth-child(1) .grip')).boundingBox();
  await a.mouse.move(g.x + 8, g.y + 8); await a.mouse.down();
  for (let i = 1; i <= 12; i++) { await a.mouse.move(g.x + 8, g.y + 8 + i * 8); await sleep(12); }
  await a.screenshot({ path: out('s-drag.png') });
  await a.mouse.up(); await sleep(900);
  const order1 = await a.$$eval('.task .t-title', (e) => e.map((x) => x.textContent));
  check('перетаскивание меняет порядок', order1[2] === order0[0] && order1[0] === order0[1], order1.join(' | '));

  // срок и шаги в карточке
  await a.click('.task:nth-child(1) .t-body'); await sleep(400);
  await a.$eval('#ts-due', (el) => { const d = new Date(); const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; el.value = s; el.dispatchEvent(new Event('change', { bubbles: true })); });
  await a.click('#ts-sub-add input'); await a.keyboard.type('Проверить мобильную версию'); await a.keyboard.press('Enter');
  await sleep(100);
  await a.screenshot({ path: out('s-sheet.png') });
  await a.keyboard.press('Escape'); await sleep(400);
  check('срок «сегодня» в строке', await a.$eval('.task:nth-child(1)', (e) => e.textContent.includes('сегодня')));

  // выполнение
  await a.click('.task:nth-child(2) .check'); await sleep(900);
  check('выполненная уходит из списка', (await a.$$('.task')).length === 3);
  await a.click('[data-act="add-list"]'); await a.keyboard.type('Контент'); await a.keyboard.press('Enter'); await sleep(100);
  await add(a, 'Написать превью матча', '.list:nth-of-type(3) .add input');
  await a.mouse.move(700, 500); await sleep(3000);
  await a.screenshot({ path: out('s-tasks.png') });

  await a.evaluate(() => document.querySelector('[data-view="journal"]').click()); await sleep(150);
  check('журнал показывает выполненное', (await a.$$('.task.is-done')).length === 1);
  await a.screenshot({ path: out('s-journal.png') });
  await a.evaluate(() => document.querySelector('[data-view="calendar"]').click()); await sleep(150);
  check('календарь показывает задачу со сроком', (await a.$$('.ev')).length === 1);
  await a.screenshot({ path: out('s-calendar.png') });

  // заметка
  await a.evaluate(() => document.querySelector('[data-view="notes"]').click()); await a.click('[data-act="new-note"]'); await sleep(350);
  await a.keyboard.type('Доступы к стенду'); await a.click('#ns-body'); await a.keyboard.type('Стенд обновляется по вторникам.\nКонтакт: редактор.');
  await a.keyboard.press('Escape'); await sleep(400);
  check('заметка сохранена', (await a.$$('.note')).length === 1);
  await a.screenshot({ path: out('s-notes.png') });

  // сейф
  await a.evaluate(() => document.querySelector('[data-space="vault"]').click()); await sleep(200);
  await a.screenshot({ path: out('s-gate.png') });
  await a.type('[name=p1]', 'четыре слова про синий чайник'); await a.type('[name=p2]', 'четыре слова про синий чайник');
  await a.keyboard.press('Enter'); await a.waitForFunction(() => !document.querySelector('.gate'), { timeout: 20000 }); await a.evaluate(() => document.querySelector('[data-view="tasks"]').click()); await sleep(150);
  await add(a, 'Секретная запись');
  check('сейф создан и принимает записи', (await a.$$('.task')).length === 1);
  await sleep(1500);
  const blob = await a.evaluate(() => localStorage.getItem('ms:vault'));
  check('сейф на диске зашифрован', !!blob && !blob.includes('Секретная') && JSON.parse(blob).ct.length > 20);
  await a.click('[data-act="lock"]'); await sleep(600);
  check('блокировка закрывает сейф', !!(await a.$('.gate')) && await a.evaluate(() => !MS.vault));
  await a.type('[name=p1]', 'неверный пароль тут'); await a.keyboard.press('Enter'); await sleep(2500);
  check('неверный пароль отклонён', await a.$eval('#gate-err', (e) => e.textContent.includes('не подошёл')));
  await a.$eval('[name=p1]', (e) => { e.value = ''; });
  await a.type('[name=p1]', 'четыре слова про синий чайник'); await a.keyboard.press('Enter'); await a.waitForFunction(() => !document.querySelector('.gate'), { timeout: 20000 }); await a.evaluate(() => document.querySelector('[data-view="tasks"]').click()); await sleep(150);
  check('верный пароль открывает', (await a.$$('.task')).length === 1);

  // ---- синхронизация ----
  const cfg = () => { MS.cfg.gh = { repo: 'me/notes', token: 'test-token' }; MS.store.saveCfg(); return MS.sync.now(); };
  await a.evaluate(cfg); await sleep(1500);
  check('A выгрузил файлы', repo.has('spaces/work-1.json') && repo.has('vault.json'), [...repo.keys()].join(','));
  const vaultRemote = Buffer.from(repo.get('vault.json').content, 'base64').toString();
  check('сейф в репозитории зашифрован', !vaultRemote.includes('Секретная'));
  check('спейс в репозитории читаемый JSON', Buffer.from(repo.get('spaces/work-1.json').content, 'base64').toString().includes('Сверить коэффициенты'));

  const B = await mk();
  const b = B.page;
  await b.evaluate(cfg); await sleep(1500);
  check('B получил задачи', (await b.$$('.task')).length === 4, String((await b.$$('.task')).length));
  check('B получил «Где остановился»', (await b.$eval('#handoff', (e) => e.value)).includes('665'));
  await b.evaluate(() => document.querySelector('[data-space="vault"]').click()); await sleep(200);
  check('B видит сейф заблокированным', await b.$eval('.gate h2', (e) => e.textContent.includes('заблокирован')));
  await b.type('[name=p1]', 'четыре слова про синий чайник'); await b.keyboard.press('Enter'); await b.waitForFunction(() => !document.querySelector('.gate'), { timeout: 20000 });
  check('B открыл сейф тем же паролем', await b.$eval('.task .t-title', (e) => e.textContent === 'Секретная запись'));

  // правки на обоих, затем слияние
  await b.evaluate(() => document.querySelector('[data-space="work-1"]').click()); await sleep(150);
  await add(b, 'Задача с макбука');
  await a.evaluate(() => document.querySelector('[data-space="work-1"]').click()); await a.evaluate(() => document.querySelector('[data-view="tasks"]').click()); await sleep(150);
  await add(a, 'Задача с винды');
  await a.evaluate(() => MS.sync.now()); await sleep(1200);
  await b.evaluate(() => MS.sync.now()); await sleep(1200);
  await a.evaluate(() => MS.sync.now()); await sleep(1200);
  await a.evaluate(() => document.activeElement.blur()); await b.evaluate(() => document.activeElement.blur());
  await a.evaluate(() => MS.sync.now()); await b.evaluate(() => MS.sync.now()); await sleep(1200);
  const ta = await a.evaluate(() => Object.values(MS.data.spaces['work-1'].items).filter((i) => i.type === 'task' && !i.deleted).map((t) => t.title).sort());
  const tb = await b.evaluate(() => Object.values(MS.data.spaces['work-1'].items).filter((i) => i.type === 'task' && !i.deleted).map((t) => t.title).sort());
  check('правки с двух компьютеров слились', JSON.stringify(ta) === JSON.stringify(tb) && ta.includes('Задача с винды') && ta.includes('Задача с макбука'), ta.length + ' / ' + tb.length);

  // ---- виды ----
  await b.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await b.evaluate(() => document.querySelector('[data-space="work-2"]').click()); await sleep(150);
  await add(b, 'Собрать семантику'); await add(b, 'Сдать тексты редактору');
  await b.mouse.move(700, 600); await sleep(600);
  await b.screenshot({ path: out('s-dark.png') });

  await a.setViewport({ width: 390, height: 800, deviceScaleFactor: 2 });
  await sleep(500);
  await a.screenshot({ path: out('s-mobile.png') });
  await a.evaluate(() => document.querySelector('[data-view="calendar"]').click()); await sleep(200);
  await a.screenshot({ path: out('s-mobile-cal.png') });

  check('ошибок в консоли нет (A)', A.errs.length === 0, A.errs.join(' ; '));
  check('ошибок в консоли нет (B)', B.errs.length === 0, B.errs.join(' ; '));
  results.forEach((r) => console.log(r.join('  ')));
  await browser.close();
})().catch((e) => { results.forEach((r) => console.log(r.join('  '))); console.error('CRASH', e); process.exit(1); });
