// Нерабочие дни: импорт по шаблону «15.10.2027 выход» и выгрузка в календарь (.ics).
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
    const d = MS.store.doc('work-1');
    const imp = MS.days.importText(d, '15.10.2027 выход\n31.02.2027 выход\nпустая строка ниже\n\n20.10.2027\n3.11.2027 отпуск');
    const list = MS.days.listDays(d).map((x) => x.date + ' ' + x.label);
    const ics = MS.days.toIcs(d);
    const second = MS.store.doc('work-2');
    MS.days.importText(second, '01.01.2028 выход');
    const ics2 = MS.days.toIcs(second);
    MS.days.removeDay(d, '2027-10-20');
    const afterRemove = MS.days.listDays(d).length;
    return { imp, list, ics, ics2, afterRemove };
  });
  check('импорт распознаёт верные даты и пропускает неверные', r.imp.added === 3 && r.imp.bad.length === 2 && r.imp.bad[0].line === 2, `добавлено ${r.imp.added}, пропущено ${r.imp.bad.map((b) => b.line).join(',')}`);
  check('строка без метки получает «выход»', r.list.includes('2027-10-20 выход'), r.list.join(' | '));
  check('день попадает в файл календаря на весь день', r.ics.includes('DTSTART;VALUE=DATE:20271015') && r.ics.includes('DTEND;VALUE=DATE:20271016') && r.ics.includes('SUMMARY:выход'));
  check('календарь получает имя работы', r.ics.includes('X-WR-CALNAME:Работа 1') && r.ics2.includes('X-WR-CALNAME:Работа 2'));
  check('дни разных работ не смешиваются', !r.ics2.includes('20271015') && r.ics2.includes('DTSTART;VALUE=DATE:20280101'));
  check('день можно убрать', r.afterRemove === 2, 'осталось: ' + r.afterRemove);
  check('ошибок в консоли нет', errs.length === 0, errs.join(';'));
  console.log(res.join('\n'));
  await browser.close();
})().catch((e) => { console.log(res.join('\n')); console.error('CRASH', e.message); process.exit(1); });
