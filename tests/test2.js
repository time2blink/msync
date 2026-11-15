const puppeteer = require('puppeteer-core');
const path = require('path');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = [];
const check = (n, ok, x = '') => res.push((ok ? 'PASS  ' : 'FAIL  ') + n + '  ' + x);
(async () => {
  const browser = await puppeteer.launch({ executablePath: (process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'), headless: 'new' });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewport({ width: 1320, height: 900 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  await page.goto('http://127.0.0.1:8765/');
  const type = async (sel, text) => { await page.click(sel); await page.keyboard.type(text); await page.keyboard.press('Enter'); await sleep(80); };
  const day = (off) => page.evaluate((o) => { const d = new Date(); d.setDate(d.getDate() + o); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }, off);
  const tomorrow = await day(1), yesterday = await day(-1), today = await day(0);

  // список на сегодня из «Задач»
  await page.click('[data-act="add-today"]'); await sleep(100);
  await page.keyboard.type('Сдать тексты'); await page.keyboard.press('Enter'); await sleep(80);
  await page.keyboard.type('Проверить вёрстку'); await page.keyboard.press('Enter'); await sleep(80);
  check('список на сегодня создан с датой', await page.$eval('.list-date.set', (e) => e.textContent.trim() === 'сегодня'));

  // списки на завтра и вчера через календарь
  await page.click('[data-view="calendar"]'); await sleep(100);
  await page.click(`[data-day="${tomorrow}"]`); await sleep(100);
  await type('[data-add-day] input', 'Собрать семантику');
  await page.keyboard.type('Написать бриф'); await page.keyboard.press('Enter'); await sleep(80);
  check('в календаре на завтра появился список', (await page.$$(`[data-day="${tomorrow}"] .ev.lst`)).length === 1);
  check('день показывает список целиком', (await page.$$('.list .task')).length === 2);
  await page.click(`[data-day="${yesterday}"]`); await sleep(100);
  await type('[data-add-day] input', 'Хвост со вчера');
  await page.mouse.move(900, 40); await sleep(200);
  await page.screenshot({ path: path.join(__dirname, 'out', 'c-calendar.png') });

  // «Задачи»: сегодня + просроченный, завтрашний скрыт
  await page.click('[data-view="tasks"]'); await sleep(100);
  const names = await page.$$eval('.list-date.set', (e) => e.map((x) => x.textContent.trim()));
  check('в «Задачах» видны вчера и сегодня, завтра скрыто', JSON.stringify(names) === JSON.stringify(['вчера', 'сегодня']), names.join(','));
  check('подсказка про остальные дни', await page.$eval('.hint', (e) => e.textContent.includes('Списков на другие дни: 1')));
  await page.screenshot({ path: path.join(__dirname, 'out', 'c-tasks.png') });

  // смена даты списка через поле
  await page.$eval('[data-list-date]', (el, d) => { el.value = d; el.dispatchEvent(new Event('change', { bubbles: true })); }, tomorrow);
  await sleep(100);
  const names2 = await page.$$eval('.list-date.set', (e) => e.map((x) => x.textContent.trim()));
  check('после переноса на завтра список ушёл из «Задач»', JSON.stringify(names2) === JSON.stringify(['сегодня']), names2.join(','));

  // перенос списка перетаскиванием в календаре
  await page.click('[data-act="go-cal"]'); await sleep(100);
  const moved = await page.evaluate((from, to) => {
    const chip = document.querySelector(`[data-day="${from}"] [data-evlist]`);
    const id = chip.dataset.evlist;
    const dt = new DataTransfer();
    chip.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
    document.querySelector(`[data-day="${to}"]`).dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    return MS.store.doc(MS.cfg.space).items[id].date;
  }, today, yesterday);
  check('перетаскивание переносит список на другой день', moved === yesterday, moved);
  check('ошибок нет', errs.length === 0, errs.join(';'));
  console.log(res.join('\n'));
  await browser.close();
})().catch((e) => { console.log(res.join('\n')); console.error('CRASH', e.message); process.exit(1); });
