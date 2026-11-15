// Панель оформления над текстом заметки: жирный, заголовок, список, ссылка на заметку.
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
  await page.evaluate(() => {
    MS.store.put(MS.store.doc('work-1'), { id: 'tb1', type: 'note', title: 'Панель', body: 'слово', pinned: false });
    MS.features; // модули загружены
  });
  await page.evaluate(() => { document.querySelector('[data-view="notes"]').click(); });
  await sleep(150);
  await page.evaluate(() => { [...document.querySelectorAll('.note')].find((n) => n.textContent.includes('Панель')).querySelector('[data-act="open-note"]').click(); });
  await sleep(250);
  const tool = (k) => page.evaluate((kind) => document.querySelector(`#ns-tools [data-md="${kind}"]`).click(), k);
  const body = () => page.evaluate(() => document.querySelector('#ns-body').value);
  // Выделяем слово и делаем жирным.
  await page.evaluate(() => { const t = document.querySelector('#ns-body'); t.focus(); t.setSelectionRange(0, 5); });
  await tool('bold');
  await sleep(100);
  check('жирный оборачивает выделенное', (await body()).startsWith('**слово**'), await body());
  // Заголовок ставится в начало строки.
  await page.evaluate(() => { const t = document.querySelector('#ns-body'); t.focus(); t.setSelectionRange(0, 0); });
  await tool('h');
  check('заголовок в начале строки', (await body()).startsWith('## '), await body());
  // Список на новой строке.
  await page.evaluate(() => { const t = document.querySelector('#ns-body'); t.value = t.value + '\nдело'; t.setSelectionRange(t.value.length, t.value.length); });
  await tool('list');
  check('список добавляет «- » в строку', (await body()).includes('\n- дело'), JSON.stringify(await body()));
  // Ссылка на заметку и пустое выделение.
  await page.evaluate(() => { const t = document.querySelector('#ns-body'); t.value = ''; t.focus(); t.setSelectionRange(0, 0); });
  await tool('wiki');
  check('пустое выделение вставляет подсказку внутри скобок', (await body()) === '[[название]]', JSON.stringify(await body()));
  // Сохранилось в заметке.
  await sleep(100);
  check('правка сохраняется в заметку', await page.evaluate(() => MS.store.doc('work-1').items.tb1.body === '[[название]]'));
  check('ошибок в консоли нет', errs.length === 0, errs.join(';'));
  console.log(res.join('\n'));
  await browser.close();
})().catch((e) => { console.log(res.join('\n')); console.error('CRASH', e.message); process.exit(1); });
