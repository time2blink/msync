// Функции очереди 1 и 2: теги, закрепление, статусы, повторы, перенос, Markdown, шаблоны, копии.
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
    const F = MS.features;
    const d = MS.store.doc('work-1');
    const d2 = MS.store.doc('work-2');
    localStorage.removeItem('ms:backups');
    const out = {};
    out.tags = F.tagsOf('Купить #Сервер/доступы и #покупки, ссылка https://x.y/z');
    MS.store.put(d, { id: 'tg1', type: 'task', listId: 'inbox', title: 'Заход #сервер/доступы', note: '', due: '', done: false, doneAt: 0, pinned: false, subs: [], order: 50 });
    out.allTags = F.allTags(d).map((x) => x.tag + ':' + x.count);
    out.withTag = F.itemsWithTag(d, 'сервер').map((i) => i.id).includes('tg1');

    const n = { id: 'nt1', type: 'note', title: 'Обычная', body: 'текст', pinned: false, updatedAt: 1 };
    MS.store.put(d, n);
    F.togglePin(d, 'nt1');
    MS.store.put(d, { id: 'nt2', type: 'note', title: 'Новая', body: '', pinned: false });
    out.pinnedFirst = F.sortNotes(MS.store.items(d, 'note'))[0].id === 'nt1';
    out.pinnedEverywhere = F.pinnedEverywhere().some((x) => x.item.id === 'nt1');

    MS.store.put(d, { id: 'st1', type: 'task', listId: 'inbox', title: 'Статус', note: '', due: '', done: false, doneAt: 0, pinned: false, subs: [], order: 60 });
    F.setStatus(d, d.items.st1, 'doing');
    out.status = F.statusOf(d.items.st1) + '/' + d.items.st1.done;
    F.setStatus(d, d.items.st1, 'done');
    out.statusDone = F.statusOf(d.items.st1) + '/' + d.items.st1.done;

    const today = new Date(); const pad = (x) => String(x).padStart(2, '0');
    const todayIso = today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate());
    MS.store.put(d, { id: 'rp1', type: 'task', listId: 'inbox', title: 'Ежедневно', note: '', due: todayIso, done: false, doneAt: 0, pinned: false, subs: [{ t: 'шаг', d: true }], order: 70, repeat: 'daily' });
    const next = F.completeTask(d, d.items.rp1);
    out.repeatNext = next ? next.due === F.todayAcrossSpaces ? '' : next.due : null;
    out.repeatDone = d.items.rp1.done && next && !next.done && next.subs[0].d === false;

    MS.store.put(d, { id: 'mv1', type: 'note', title: 'Переезд', body: 'тело', pinned: false });
    const moved = F.moveItem(d, d2, 'mv1');
    out.moved = !!moved && d.items.mv1.deleted === true;
    out.movedInTarget = !!d2.items.mv1 && d2.items.mv1.title === 'Переезд';

    out.md = F.spaceToMd(MS.store.doc('work-1'));
    out.mdHasBox = out.md.includes('- [') && out.md.includes('## Заметки');
    const safe = F.mdToHtml('<script>x</script> **жирно** `код` [ссылка](https://a.b) https://c.d\n- [x] готово\n- [ ] нет\n```\n<b>\n```');
    out.htmlSafe = !safe.includes('<script>') && safe.includes('&lt;script&gt;');
    out.htmlBold = safe.includes('<strong>жирно</strong>') && safe.includes('<code>код</code>');
    out.htmlLinks = safe.includes('href="https://a.b"') && safe.includes('href="https://c.d"');
    out.htmlBoxes = safe.includes('☑') && safe.includes('☐') && safe.includes('<pre><code>') && safe.includes('&lt;b&gt;');

    MS.store.put(d2, { id: 'td1', type: 'task', listId: MS.store.items(d2, 'list')[0].id, title: 'Сегодня', note: '', due: todayIso, done: false, doneAt: 0, pinned: false, subs: [], order: 1 });
    out.today = F.todayAcrossSpaces(todayIso).some((x) => x.item.id === 'td1');

    F.saveTemplate('Публикация', ['Написать текст', '', 'Проверить ссылки']);
    const tplList = F.applyTemplate(d, 'Публикация');
    out.template = !!tplList && MS.store.items(d, 'task').filter((t) => t.listId === tplList.id).length === 2;
    out.templateSaved = F.templates().some((t) => t.name === 'Публикация' && t.lines.length === 2);

    out.backupFirst = F.backupIfDue(todayIso);
    out.backupSecond = F.backupIfDue(todayIso);
    out.backupCount = F.backupList().length;
    return out;
  });
  check('теги с вложенностью и без учёта регистра', JSON.stringify(r.tags) === JSON.stringify(['сервер/доступы', 'покупки']), r.tags.join(','));
  check('сводка тегов учитывает вложенность', r.allTags.includes('сервер:1') && r.allTags.includes('сервер/доступы:1'), r.allTags.join(' '));
  check('поиск по тегу находит вложенные', r.withTag);
  check('закреплённые заметки сверху', r.pinnedFirst);
  check('закреплённое попадает в быстрый доступ', r.pinnedEverywhere);
  check('статус «в работе» не означает готово', r.status === 'doing/false', r.status);
  check('статус «готово» отмечает задачу', r.statusDone === 'done/true', r.statusDone);
  check('повторяющаяся задача создаёт следующую и сбрасывает шаги', r.repeatDone);
  check('перенос заметки в другую работу', r.moved && r.movedInTarget);
  check('Markdown спейса с галочками и заметками', r.mdHasBox);
  check('Markdown безопасен: скрипты экранируются', r.htmlSafe);
  check('Markdown: жирный, код', r.htmlBold);
  check('Markdown: ссылки', r.htmlLinks);
  check('Markdown: чек-листы и блоки кода', r.htmlBoxes);
  check('сегодняшние задачи собираются по всем работам', r.today);
  check('шаблон создаёт список с задачами', r.template);
  check('шаблон сохраняется для следующих раз', r.templateSaved);
  check('ежедневная копия создаётся один раз в день', r.backupFirst === true && r.backupSecond === false);
  check('копия видна в списке', r.backupCount === 1, 'копий: ' + r.backupCount);
  check('ошибок в консоли нет', errs.length === 0, errs.join(';'));
  console.log(res.join('\n'));
  await browser.close();
})().catch((e) => { console.log(res.join('\n')); console.error('CRASH', e.message); process.exit(1); });
