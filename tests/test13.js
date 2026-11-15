// Картинки в заметках (сжатие и ссылки), учёт времени по спейсам.
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
  const r = await page.evaluate(async () => {
    const out = {};
    // Картинка 3000x1500 должна стать не больше 1280 по большей стороне.
    const cv = document.createElement('canvas'); cv.width = 3000; cv.height = 1500;
    const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
    const file = new File([blob], 'x.png', { type: 'image/png' });
    const bytes = await MS.images.compress(file);
    out.jpegStart = bytes[0] === 0xff && bytes[1] === 0xd8;
    out.size = bytes.length > 100 && bytes.length < 1024 * 1024;
    // Не картинка — понятная ошибка.
    try { await MS.images.compress(new File(['x'], 'a.txt', { type: 'text/plain' })); out.notImg = false; }
    catch (e) { out.notImg = /не картинка/.test(e.message); }
    // Сейф картинок не принимает.
    try { await MS.images.addImage(MS.VAULT, file); out.vault = false; } catch (e) { out.vault = /сейф/.test(e.message); }
    // Ссылка на картинку превращается в тег.
    out.html = MS.features.mdToHtml('Вот ![фото](img:abc123) тут');
    // Учёт времени: старт и стоп пишут запись минут.
    const d = MS.store.doc('work-1');
    MS.time.start('work-1');
    localStorage.setItem('ms:timer', JSON.stringify({ space: 'work-1', start: Date.now() - 5 * 60000 }));
    out.stop = MS.time.stop();
    out.byDay = Object.values(MS.time.minutesByDay(d)).reduce((s, m) => s + m, 0);
    out.running = MS.time.running();
    out.totals = MS.time.totalSince(MS.store.spaces(), 7).find((x) => x.space === 'work-1').minutes;
    // Слишком короткий отрезок не записывается.
    MS.time.start('work-2'); const short = MS.time.stop();
    out.short = short;
    return out;
  });
  check('картинка сжимается в JPEG', r.jpegStart && r.size);
  check('не картинка отклоняется понятной ошибкой', r.notImg);
  check('в сейф картинки не добавляются', r.vault);
  check('ссылка img: превращается в картинку', r.html.includes('class="md-img"') && r.html.includes('data-img="abc123"') && r.html.includes('alt="фото"'), r.html);
  check('таймер записывает время в спейс', r.stop && r.stop.minutes === 5 && r.byDay === 5, JSON.stringify(r.stop));
  check('после остановки таймер выключен', r.running === null);
  check('время попадает в сумму за неделю', r.totals === 5, 'сумма: ' + r.totals);
  check('короткий отрезок не записывается', r.short === null);
  check('ошибок в консоли нет', errs.length === 0, errs.join(';'));
  console.log(res.join('\n'));
  await browser.close();
})().catch((e) => { console.log(res.join('\n')); console.error('CRASH', e.message); process.exit(1); });
