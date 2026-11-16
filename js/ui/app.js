import { MS } from '../core/state.js';
import '../core/store.js';
import '../core/crypto.js';
import '../core/sync.js';
import '../core/spring.js';
import '../core/days.js';
import '../core/features.js';
import '../core/images.js';
import '../core/time.js';
// Интерфейс.

  const S = MS.store;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- иконки ----------
  const P = {
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/>',
    note: '<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h4"/>',
    cal: '<path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4"/>',
    done: '<path d="M4 12.5l5 5L20 6.5"/>',
    lock: '<path d="M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3"/>',
    unlock: '<path d="M6 11h12v9H6zM9 11V8a3 3 0 0 1 5.6-1.5"/>',
    sync: '<path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3M18 3v4h-4M6 21v-4h4"/>',
    gear: '<path d="M4 7h9M19 7h1M4 17h1M11 17h9"/><circle cx="16" cy="7" r="2.5"/><circle cx="8" cy="17" r="2.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    star: '<path d="M12 4l2.5 5.1 5.6.8-4 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4-4 5.6-.8z"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
    trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
    copy: '<path d="M9 9h10v11H9zM5 15V4h10"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    left: '<path d="M14.5 6l-6 6 6 6"/>',
    right: '<path d="M9.5 6l6 6-6 6"/>',
    grip: '<circle cx="9" cy="6" r="1.3" fill="currentColor"/><circle cx="15" cy="6" r="1.3" fill="currentColor"/><circle cx="9" cy="12" r="1.3" fill="currentColor"/><circle cx="15" cy="12" r="1.3" fill="currentColor"/><circle cx="9" cy="18" r="1.3" fill="currentColor"/><circle cx="15" cy="18" r="1.3" fill="currentColor"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  };
  const icon = (n, size = 20) =>
    `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;

  // ---------- даты ----------
  const pad = (n) => String(n).padStart(2, '0');
  const dstr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => dstr(new Date());
  const parseD = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const dayDiff = (s) => Math.round((parseD(s) - parseD(today())) / 864e5);
  function dueLabel(s) {
    const n = dayDiff(s);
    if (n === 0) return 'сегодня';
    if (n === 1) return 'завтра';
    if (n === -1) return 'вчера';
    return parseD(s).toLocaleDateString('ru', { day: 'numeric', month: 'short' });
  }
  const longDay = (d) => d.toLocaleDateString('ru', { day: 'numeric', month: 'long', weekday: 'long' });
  function ago(ts) {
    if (!ts) return '';
    const m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return 'только что';
    if (m < 60) return m + ' мин назад';
    if (m < 60 * 24) return Math.round(m / 60) + ' ч назад';
    return new Date(ts).toLocaleDateString('ru', { day: 'numeric', month: 'short' });
  }

  // ---------- состояние экрана ----------
  let view = 'tasks';
  let query = '';
  let period = 'week';
  let calMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let calDay = today();
  let focusAfter = null;
  const expanded = new Set(); // раскрытые задачи: состояние только этого экрана, не синхронизируется
  let justOpened = null;

  const VIEWS = [
    ['tasks', 'Задачи', 'list'],
    ['today', 'Сегодня', 'cal'],
    ['board', 'Доска', 'list'],
    ['notes', 'Заметки', 'note'],
    ['tags', 'Теги', 'note'],
    ['calendar', 'Календарь', 'cal'],
    ['journal', 'Сделано', 'done'],
  ];
  let tagFilter = '';
  const F = () => MS.features;

  const isVault = () => MS.cfg.space === MS.VAULT;
  const cur = () => S.doc(MS.cfg.space);
  const tasksOf = (doc) => S.items(doc, 'task');
  const listsOf = (doc) => S.items(doc, 'list').sort((a, b) => (a.order || 0) - (b.order || 0));

  // ---------- каркас ----------
  function render() {
    renderSide();
    renderMain();
  }

  function renderSide() {
    const sp = S.spaces();
    $('#spaces').innerHTML =
      sp.map((d) => `
        <div class="space-row"><button class="space ${d.id === MS.cfg.space ? 'on' : ''}" data-space="${d.id}" style="--c:${esc(d.color)}">
          <span class="dot"></span><span class="space-name">${esc(d.name)}</span>
        </button>${d.id === MS.cfg.space ? `<button class="space-edit" data-edit-space="${d.id}" aria-label="Изменить спейс «${esc(d.name)}»" title="Изменить спейс">${icon('edit', 15)}</button>` : ''}</div>`).join('') +
      `<button class="space ${isVault() ? 'on' : ''}" data-space="${MS.VAULT}" style="--c:${MS.VAULT_COLOR}">
          <span class="dot lockdot">${icon(MS.vault ? 'unlock' : 'lock', 14)}</span><span class="space-name">Сейф</span>
        </button>
        <button class="space add-space" data-act="new-space">${icon('plus', 16)}<span class="space-name">Новый спейс</span></button>`;

    $('#views').innerHTML = VIEWS.map(([id, name, ic]) =>
      `<button class="view ${view === id && !query ? 'on' : ''}" data-view="${id}">${icon(ic)}<span>${name}</span></button>`).join('');

    // Быстрый доступ: закреплённое по всем работам.
    const quick = F().pinnedEverywhere();
    $('#quick').innerHTML = quick.length
      ? '<p class="quick-title">Быстрый доступ</p>' + quick.slice(0, 8).map((q) =>
        `<button class="view quick-item" data-quick-space="${esc(q.space)}" data-quick-id="${esc(q.item.id)}">${icon('star', 15)}<span>${esc(q.item.title || q.item.name || 'Заметка')}</span></button>`).join('')
      : '';

    const st = MS.sync.state;
    const label = !MS.sync.configured() ? 'Синхронизация не настроена'
      : st.status === 'syncing' ? 'Синхронизация…'
        : st.status === 'error' ? st.error
          : st.at ? 'Синхронизировано ' + ago(st.at) : 'Готово к синхронизации';
    $('#foot').innerHTML = `
      <button class="foot-btn sync-btn ${st.status}" data-act="sync" title="${esc(label)}">
        ${icon('sync', 18)}<span class="foot-label">${esc(label)}</span>
      </button>
      ${MS.vault ? `<button class="foot-btn" data-act="lock" title="Заблокировать сейф">${icon('lock', 18)}<span class="foot-label">Заблокировать сейф</span></button>` : ''}
      <button class="foot-btn timer-btn ${MS.time.running() ? 'on' : ''}" data-act="timer" title="Учёт времени по работе">${icon('cal', 18)}<span class="foot-label">${MS.time.running() ? 'Идёт учёт времени · стоп' : 'Учёт времени: старт'}</span></button>
      <button class="foot-btn" data-act="settings" title="Настройки">${icon('gear', 18)}<span class="foot-label">Настройки</span></button>`;
  }

  function renderMain() {
    const doc = cur();
    const color = isVault() ? MS.VAULT_COLOR : (doc ? doc.color : MS.COLORS[0]);
    document.documentElement.style.setProperty('--accent', color);
    $('#title').textContent = isVault() ? 'Сейф' : (doc ? doc.name : '');
    const c = $('#content');
    c.className = 'content view-' + (query ? 'search' : view);
    if (isVault() && !MS.vault) { c.innerHTML = vaultGate(); const i = $('input', c); if (i) i.focus(); return; }
    if (!doc) { c.innerHTML = ''; return; }
    c.innerHTML = query ? searchView(doc)
      : view === 'today' ? todayView()
        : view === 'board' ? boardView(doc)
          : view === 'tags' ? tagsView(doc)
            : view === 'notes' ? notesView(doc)
        : view === 'calendar' ? calendarView(doc)
          : view === 'journal' ? journalView(doc)
            : tasksView(doc);
    if (focusAfter) { const el = $(focusAfter, c); if (el) el.focus(); focusAfter = null; }
  }

  // ---------- задачи ----------
  function taskRow(t, opts = {}) {
    const subs = t.subs || [];
    const meta = [];
    if (t.due) meta.push(`<span class="chip ${!t.done && dayDiff(t.due) < 0 ? 'late' : ''} ${dayDiff(t.due) === 0 ? 'now' : ''}">${dueLabel(t.due)}</span>`);
    const open = expanded.has(t.id);
    if (subs.length) meta.push(`<button class="chip chip-btn ${open ? 'open' : ''}" data-act="expand" aria-expanded="${open}" aria-label="${open ? 'Скрыть шаги' : 'Показать шаги'}">${icon('right', 12)}${subs.filter((s) => s.d).length}/${subs.length}</button>`);
    if (t.note) meta.push(`<span class="chip quiet">заметка</span>`);
    if (opts.list) meta.push(`<span class="chip quiet">${esc(opts.list)}</span>`);
    return `
      <li class="task ${t.done ? 'is-done' : ''} ${t.pinned ? 'is-pinned' : ''}" data-id="${t.id}">
        <button class="check" data-act="toggle" aria-label="${t.done ? 'Вернуть в работу' : 'Отметить выполненной'}">${icon('done', 14)}</button>
        <div class="t-main">
          <button class="t-body" data-act="open"><span class="t-title">${esc(t.title)}</span></button>
          ${meta.length ? `<div class="t-meta">${meta.join('')}</div>` : ''}
        </div>
        ${opts.plain ? '' : `
        <button class="pin" data-act="pin" aria-label="${t.pinned ? 'Открепить' : 'Закрепить'}" title="${t.pinned ? 'Открепить' : 'Закрепить'}">${icon('star', 17)}</button>
        <span class="grip" data-grip role="button" tabindex="0" aria-label="Переставить задачу. Стрелки вверх и вниз" title="Перетащить или переставить стрелками">${icon('grip', 16)}</span>`}
        ${open ? `
        <div class="t-subs ${justOpened === t.id ? 'opening' : ''}">
          <ul>${subs.map((s, n) => `
            <li class="sub ${s.d ? 'is-done' : ''}">
              <button class="check small" data-act="sub-toggle" data-sub="${n}" aria-label="${s.d ? 'Вернуть шаг в работу' : 'Отметить шаг'}">${icon('done', 12)}</button>
              <span>${esc(s.t)}</span>
            </li>`).join('')}
          </ul>
          <form class="add-sub" data-add-sub="${t.id}">
            <span class="add-plus small">${icon('plus', 14)}</span>
            <input name="title" placeholder="Добавить шаг" autocomplete="off" aria-label="Добавить шаг">
          </form>
        </div>` : ''}
      </li>`;
  }

  const openIn = (doc, listId) => tasksOf(doc)
    .filter((t) => !t.done && t.listId === listId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  // Список целиком: шапка с названием и датой, задачи, поле добавления.
  function listSection(doc, l, canDelete) {
    const rows = openIn(doc, l.id);
    const late = l.date && l.date < today() && rows.length;
    return `
      <section class="list" data-list="${l.id}">
        <header class="list-head">
          <input class="list-name" data-list-name="${l.id}" value="${esc(l.name)}" aria-label="Название списка">
          <span class="count">${rows.length || ''}</span>
          <label class="list-date ${l.date ? 'set' : ''} ${late ? 'late' : ''}" title="${l.date ? 'Изменить дату списка' : 'Назначить списку дату'}">
            ${icon('cal', 15)}<span>${l.date ? dueLabel(l.date) : 'Дата'}</span>
            <input type="date" data-list-date="${l.id}" value="${esc(l.date || '')}" aria-label="Дата списка ${esc(l.name)}">
          </label>
          ${canDelete ? `<button class="icon-btn" data-act="del-list" data-id="${l.id}" aria-label="Удалить список" title="Удалить список">${icon('trash', 16)}</button>` : ''}
        </header>
        <ul class="tasks">${rows.map((t) => taskRow(t)).join('')}</ul>
        <form class="add" data-add="${l.id}">
          <span class="add-plus">${icon('plus', 16)}</span>
          <input name="title" placeholder="Новая задача" autocomplete="off" aria-label="Новая задача в списке ${esc(l.name)}">
        </form>
      </section>`;
  }

  // В «Задачах» из списков с датой видны только сегодняшние и просроченные с незакрытыми делами.
  // Остальные дни открываются из календаря, чтобы страница не превращалась в простыню.
  function tasksView(doc) {
    const lists = listsOf(doc);
    const td = today();
    const dated = lists.filter((l) => l.date);
    const shownDated = dated
      .filter((l) => l.date === td || (l.date < td && openIn(doc, l.id).length))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const shown = [...shownDated, ...lists.filter((l) => !l.date)];
    const hidden = dated.length - shownDated.length;
    const h = doc.handoff || { text: '', updatedAt: 0 };
    return `
      <section class="handoff">
        <label for="handoff">Где остановился</label>
        <textarea id="handoff" rows="2" placeholder="Пара строк себе на другой компьютер: что сделал и с чего продолжить">${esc(h.text)}</textarea>
        <span class="handoff-at" id="handoff-at">${h.updatedAt ? 'Обновлено ' + ago(h.updatedAt) : ''}</span>
      </section>
      ${shown.map((l) => listSection(doc, l, lists.length > 1)).join('')}
      <div class="row-actions">
        <button class="ghost" data-act="add-list">${icon('plus', 16)} Добавить список</button>
        <button class="ghost" data-act="add-today">${icon('cal', 16)} Список на сегодня</button>
        ${F().templates().length ? `<select class="tpl-select" data-tpl-apply aria-label="Создать список из шаблона">
          <option value="">Из шаблона…</option>${F().templates().map((t) => `<option value="${esc(t.name)}">${esc(t.name)}</option>`).join('')}</select>` : ''}
      </div>
      ${hidden ? `<p class="hint">Списков на другие дни: ${hidden}. <button class="link" data-act="go-cal">Открыть календарь</button></p>` : ''}`;
  }

  const dayName = (s) => parseD(s).toLocaleDateString('ru', { day: 'numeric', month: 'long' });

  function addDayList(doc, day) {
    return S.put(doc, {
      id: MS.uid(), type: 'list', name: dayName(day), date: day,
      order: Math.max(0, ...listsOf(doc).map((x) => x.order || 0)) + 1,
    });
  }

  function addTask(doc, listId, title, due) {
    const sibs = tasksOf(doc).filter((t) => t.listId === listId && !t.done);
    return S.put(doc, {
      id: MS.uid(), type: 'task', listId, title, note: '', due: due || '', done: false, doneAt: 0,
      pinned: false, subs: [], createdAt: Date.now(),
      order: Math.max(0, ...sibs.map((t) => t.order || 0)) + 1,
    });
  }

  function toggleTask(li) {
    const doc = cur();
    const t = doc.items[li.dataset.id];
    if (!t) return;
    if (t.done) {
      t.done = false; t.doneAt = 0; t.status = 'todo'; S.put(doc, t); render();
      return;
    }
    const finish = () => {
      // Повторяющаяся задача создаёт следующую; отмена убирает и её.
      const next = F().completeTask(doc, t);
      render();
      toast('Перенесено в «Сделано»', () => {
        if (next) S.remove(doc, next.id);
        t.done = false; t.doneAt = 0; t.status = 'todo'; S.put(doc, t); render();
      });
    };
    li.classList.add('is-done');
    if (reduced() || view !== 'tasks' || query) { setTimeout(finish, 150); return; }
    setTimeout(() => {
      li.style.overflow = 'hidden';
      const a = li.animate(
        [{ height: li.offsetHeight + 'px', opacity: 1 }, { height: '0px', opacity: 0 }],
        { duration: 240, easing: 'cubic-bezier(.3,.7,.2,1)' });
      a.onfinish = finish;
    }, 260);
  }

  // ---------- перетаскивание задач ----------
  function startDrag(e, grip) {
    const li = grip.closest('.task');
    const rows = [...li.parentElement.children];
    if (rows.length < 2) return;
    e.preventDefault();
    const i = rows.indexOf(li);
    const rects = rows.map((r) => r.getBoundingClientRect());
    const H = rects[i].height;
    const minDy = rects[0].top - rects[i].top;
    const maxDy = rects[rects.length - 1].bottom - rects[i].bottom;
    const startY = e.clientY;
    let dy = 0, idx = i;
    const samples = [];
    grip.setPointerCapture(e.pointerId);
    li.classList.add('dragging');
    rows.forEach((r) => { if (r !== li) r.style.transition = 'transform 220ms cubic-bezier(.2,.8,.2,1)'; });

    const move = (ev) => {
      let raw = ev.clientY - startY;
      if (raw < minDy) raw = minDy - MS.rubber(minDy - raw);
      else if (raw > maxDy) raw = maxDy + MS.rubber(raw - maxDy);
      dy = raw;
      li.style.transform = `translateY(${dy}px) scale(1.015)`;
      samples.push({ t: ev.timeStamp, y: ev.clientY });
      if (samples.length > 5) samples.shift();
      // Решает передний край, а не центр: иначе высокую (раскрытую) задачу не провести через соседей.
      const edge = dy >= 0 ? rects[i].bottom + dy : rects[i].top + dy;
      const mid = (j) => rects[j].top + rects[j].height / 2;
      idx = dy >= 0
        ? i + rows.filter((r, j) => j > i && mid(j) < edge).length
        : i - rows.filter((r, j) => j < i && mid(j) > edge).length;
      rows.forEach((r, j) => {
        if (j === i) return;
        const s = j < i && j >= idx ? H : j > i && j <= idx ? -H : 0;
        r.style.transform = s ? `translateY(${s}px)` : '';
      });
    };

    const up = () => {
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', up);
      grip.removeEventListener('pointercancel', up);
      let target = 0;
      if (idx > i) for (let j = i + 1; j <= idx; j++) target += rects[j].height;
      if (idx < i) for (let j = idx; j < i; j++) target -= rects[j].height;
      let v = 0;
      if (samples.length > 1) {
        const a = samples[0], b = samples[samples.length - 1];
        if (b.t > a.t) v = ((b.y - a.y) / (b.t - a.t)) * 1000;
      }
      const commit = () => {
        const doc = cur();
        const ids = rows.map((r) => r.dataset.id);
        ids.splice(idx, 0, ids.splice(i, 1)[0]);
        ids.forEach((id, n) => {
          const t = doc.items[id];
          if (t && t.order !== n + 1) { t.order = n + 1; S.put(doc, t); }
        });
        render();
      };
      li.classList.remove('dragging');
      li.classList.add('settling');
      if (reduced()) { commit(); return; }
      MS.spring({
        from: dy, to: target, velocity: v, response: 0.3, damping: 0.85,
        onUpdate: (y) => { li.style.transform = `translateY(${y}px)`; },
        onDone: commit,
      });
    };

    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
    grip.addEventListener('pointercancel', up);
  }

  // ---------- сегодня, доска, теги ----------
  function todayView() {
    const rows = F().todayAcrossSpaces(today());
    if (!rows.length) return '<p class="empty">На сегодня задач с датой нет. Все дела по срокам выполнены.</p>';
    return `<section class="list"><ul class="tasks">${rows.map((r) => `
      <li class="task" data-id="${r.item.id}" data-space="${esc(r.space)}">
        <button class="check" data-act="today-done" aria-label="Отметить выполненной">${icon('done', 14)}</button>
        <div class="t-main">
          <button class="t-body" data-act="today-open"><span class="t-title">${esc(r.item.title)}</span></button>
          <div class="t-meta"><span class="chip ${r.late ? 'late' : 'now'}">${r.late ? 'просрочено' : 'сегодня'}</span><span class="chip quiet">${esc(r.spaceName)}</span></div>
        </div>
      </li>`).join('')}</ul></section>`;
  }

  function boardView(doc) {
    const all = tasksOf(doc);
    return `<div class="board">${F().STATUSES.map(([st, name]) => {
      const S = F().STATUSES, i = S.findIndex(([s]) => s === st);
      const rows = all.filter((t) => F().statusOf(t) === st).sort((a, b) => (a.order || 0) - (b.order || 0));
      return `<section class="col"><header class="list-head"><h3>${name}</h3><span class="count">${rows.length}</span></header>
        <ul class="cards">${rows.map((t) => `
          <li class="card" data-id="${t.id}">
            <button class="t-body" data-act="open">${esc(t.title)}</button>
            <div class="status-seg" role="group" aria-label="Статус задачи">
              ${S.map(([to, name]) => `<button type="button" data-act="move-status" data-to="${to}" class="${to === st ? 'on' : ''}" aria-pressed="${to === st}" ${to === st ? 'disabled' : ''}>${name}</button>`).join('')}
            </div>
          </li>`).join('')}</ul></section>`;
    }).join('')}</div>`;
  }

  function tagsView(doc) {
    const tags = F().allTags(doc);
    if (!tags.length) return '<p class="empty">Тегов пока нет. Напиши в задаче или заметке #слово, например #сервер/доступы.</p>';
    const chips = tags.map((t) => `<button class="chip-btn tagchip ${tagFilter === t.tag ? 'open' : ''}" data-act="tag" data-tag="${esc(t.tag)}">#${esc(t.tag)} <span class="count">${t.count}</span></button>`).join(' ');
    let body = '<p class="hint">Выбери тег, чтобы увидеть задачи и заметки с ним.</p>';
    if (tagFilter) {
      const items = F().itemsWithTag(doc, tagFilter);
      const tasks = items.filter((i) => i.type === 'task');
      const notes = F().sortNotes(items.filter((i) => i.type === 'note'));
      body = (tasks.length ? `<section class="list"><ul class="tasks">${tasks.map((t) => taskRow(t, { plain: true })).join('')}</ul></section>` : '')
        + (notes.length ? `<div class="notes">${notes.map(noteCard).join('')}</div>` : '');
    }
    return `<div class="tagbar">${chips}</div>${body}`;
  }

  function noteCard(n) {
    return `
      <article class="note" data-id="${n.id}">
        <button class="note-open" data-act="open-note">
          <h3>${esc(n.title || 'Без названия')}</h3>
          <p class="${isVault() ? 'veiled' : ''}">${esc((n.body || '').slice(0, 240))}</p>
        </button>
        <footer><span>${ago(n.updatedAt)}</span>
          <button class="icon-btn ${n.pinned ? 'on' : ''}" data-act="pin-note" aria-label="${n.pinned ? 'Открепить' : 'Закрепить'}">${icon('star', 16)}</button>
        </footer>
      </article>`;
  }

  // ---------- заметки ----------
  function notesView(doc) {
    const notes = F().sortNotes(S.items(doc, 'note'));
    return `
      <div class="row-actions"><button class="btn primary" data-act="new-note">${icon('plus', 16)} Новая заметка</button></div>
      ${notes.length ? `<div class="notes">${notes.map((n) => `
        <article class="note" data-id="${n.id}">
          <button class="note-open" data-act="open-note">
            <h3>${esc(n.title || 'Без названия')}</h3>
            <p class="${isVault() ? 'veiled' : ''}">${esc((n.body || '').slice(0, 240))}</p>
          </button>
          <footer><span>${ago(n.updatedAt)}</span>
            <button class="icon-btn" data-act="copy-note" aria-label="Скопировать текст" title="Скопировать текст">${icon('copy', 16)}</button>
          </footer>
        </article>`).join('')}</div>`
        : `<p class="empty">${isVault() ? 'В сейфе пока пусто. Заметки отсюда уходят на GitHub только в зашифрованном виде.' : 'Заметок пока нет. Сюда удобно класть то, что не является задачей: ссылки, черновики, договорённости.'}</p>`}`;
  }

  // ---------- календарь ----------
  function calendarView(doc) {
    const y = calMonth.getFullYear(), m = calMonth.getMonth();
    // Прошлый месяц приглушается, текущий выделяется, будущий обычный (см. styles.css, .cal-past/.cal-now).
    const nowIdx = new Date().getFullYear() * 12 + new Date().getMonth();
    const monthState = y * 12 + m < nowIdx ? 'past' : y * 12 + m === nowIdx ? 'now' : 'future';
    const first = new Date(y, m, 1);
    const offset = (first.getDay() + 6) % 7;
    const allLists = listsOf(doc);
    const listDate = Object.fromEntries(allLists.map((l) => [l.id, l.date || '']));
    const listsByDay = {};
    allLists.filter((l) => l.date).forEach((l) => { (listsByDay[l.date] = listsByDay[l.date] || []).push(l); });
    // Отдельные задачи со своим сроком. Если срок совпадает с датой списка, задача уже видна в нём.
    const open = tasksOf(doc).filter((t) => !t.done && t.due && listDate[t.listId] !== t.due);
    const byDay = {};
    open.forEach((t) => { (byDay[t.due] = byDay[t.due] || []).push(t); });
    const td = today();
    const offList = MS.days.listDays(doc);
    const offs = Object.fromEntries(offList.map((d) => [d.date, d.label]));
    let cells = '';
    for (let n = 0; n < 42; n++) {
      const d = new Date(y, m, 1 - offset + n);
      const s = dstr(d);
      const chips = [
        ...(listsByDay[s] || []).map((l) => {
          const left = openIn(doc, l.id).length;
          return `<span class="ev lst ${left ? '' : 'clear'} ${s < td && left ? 'late' : ''}" draggable="true" data-evlist="${l.id}"><span>${esc(l.name)}</span>${left ? `<b>${left}</b>` : ''}</span>`;
        }),
        ...(byDay[s] || []).map((t) => `<span class="ev ${s < td ? 'late' : ''}" draggable="true" data-ev="${t.id}">${esc(t.title)}</span>`),
      ];
      cells += `
        <div class="cell ${d.getMonth() !== m ? 'out' : ''} ${s === td ? 'today' : ''} ${s === calDay ? 'sel' : ''} ${offs[s] ? 'off' : ''}" data-day="${s}" tabindex="0" role="button" aria-label="${longDay(d)}${offs[s] ? ', нерабочий день' : ''}">
          <span class="num">${d.getDate()}</span>
          ${chips.slice(0, 3).join('')}
          ${chips.length > 3 ? `<span class="more">ещё ${chips.length - 3}</span>` : ''}
        </div>`;
    }
    const dayLists = listsByDay[calDay] || [];
    const dayTasks = (byDay[calDay] || []).sort((a, b) => (a.order || 0) - (b.order || 0));
    const lists = Object.fromEntries(allLists.map((l) => [l.id, l.name]));
    return `
      <div class="cal-head cal-${monthState}">
        <h2>${calMonth.toLocaleDateString('ru', { month: 'long' })} ${calMonth.getFullYear()}</h2>
        <div class="cal-nav">
          <button class="icon-btn" data-act="cal-prev" aria-label="Предыдущий месяц">${icon('left')}</button>
          <button class="btn" data-act="cal-today">Сегодня</button>
          <button class="icon-btn" data-act="cal-next" aria-label="Следующий месяц">${icon('right')}</button>
        </div>
      </div>
      <div class="cal-week">${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => `<span>${d}</span>`).join('')}</div>
      <div class="cal-grid cal-${monthState}">${cells}</div>
      <section class="offdays">
        <header class="list-head"><h3>Нерабочие дни</h3><span class="count">${offList.length || ''}</span></header>
        <div class="off-actions">
          <button class="btn" data-act="off-toggle" data-day="${calDay}">${offs[calDay] ? 'Убрать выход: ' : 'Отметить выходным: '}${esc(calDay.split('-').reverse().join('.'))}</button>
          <button class="btn" data-act="ics">${icon('copy', 16)} Скачать календарь (.ics)</button>
        </div>
        <form class="off-import" data-off-import>
          <textarea name="text" rows="3" placeholder="15.10.2027 выход&#10;16.10.2027 выход" aria-label="Список дней: одна дата в строке"></textarea>
          <button class="btn primary">Импортировать</button>
        </form>
        ${offList.length ? `<ul class="tasks">${offList.map((d) => `
          <li class="task"><div class="t-main"><span class="t-title">${esc(d.date.split('-').reverse().join('.'))} — ${esc(d.label)}</span></div>
            <button class="icon-btn" data-act="off-del" data-day="${d.date}" aria-label="Убрать день">${icon('x', 14)}</button></li>`).join('')}</ul>`
          : '<p class="hint">Отмеченных дней пока нет. Отметь день в календаре или вставь список вида «15.10.2027 выход».</p>'}
      </section>
      <h2 class="day-title">${longDay(parseD(calDay))}</h2>
      ${dayLists.map((l) => listSection(doc, l, allLists.length > 1)).join('')}
      ${dayTasks.length ? `
      <section class="list">
        <header class="list-head"><h3>Со сроком на этот день</h3><span class="count">${dayTasks.length}</span></header>
        <ul class="tasks">${dayTasks.map((t) => taskRow(t, { plain: true, list: lists[t.listId] })).join('')}</ul>
      </section>` : ''}
      ${dayLists.length ? `<button class="ghost" data-act="add-day-list">${icon('plus', 16)} Ещё один список на этот день</button>` : `
      <section class="list">
        <form class="add solo" data-add-day="${calDay}">
          <span class="add-plus">${icon('plus', 16)}</span>
          <input name="title" placeholder="Первая задача на этот день: список создастся сам" autocomplete="off" aria-label="Первая задача на этот день">
        </form>
      </section>`}`;
  }

  // ---------- сделано ----------
  function doneTasks(doc) {
    const from = period === 'week' ? Date.now() - 7 * 864e5 : period === 'month' ? Date.now() - 30 * 864e5 : 0;
    return tasksOf(doc).filter((t) => t.done && (t.doneAt || 0) >= from).sort((a, b) => b.doneAt - a.doneAt);
  }
  function groupByDay(tasks) {
    const g = new Map();
    tasks.forEach((t) => { const k = dstr(new Date(t.doneAt)); if (!g.has(k)) g.set(k, []); g.get(k).push(t); });
    return g;
  }
  const PERIODS = [['week', '7 дней'], ['month', '30 дней'], ['all', 'Всё время']];

  function journalView(doc) {
    const tasks = doneTasks(doc);
    const lists = Object.fromEntries(listsOf(doc).map((l) => [l.id, l.name]));
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 3650;
    const spent = MS.time.totalSince(S.spaces(), days).filter((r) => r.minutes > 0);
    const timeHtml = spent.length
      ? `<section class="timebox"><h3>Время за период</h3>${spent.map((r) => `<div class="hist-row"><span>${esc(r.name)}</span><span>${Math.floor(r.minutes / 60)} ч ${r.minutes % 60} мин</span></div>`).join('')}</section>`
      : '';
    return `
      ${timeHtml}
      <div class="row-actions">
        <div class="seg" role="tablist">${PERIODS.map(([id, n]) => `<button class="${period === id ? 'on' : ''}" data-period="${id}">${n}</button>`).join('')}</div>
        <span class="grow"></span>
        <button class="btn" data-act="copy-report" ${tasks.length ? '' : 'disabled'}>${icon('copy', 16)} Скопировать отчёт</button>
        <button class="btn" data-act="save-report" ${tasks.length ? '' : 'disabled'}>Скачать .md</button>
      </div>
      ${tasks.length ? [...groupByDay(tasks)].map(([day, items]) => `
        <section class="list">
          <header class="list-head"><h3>${longDay(parseD(day))}</h3><span class="count">${items.length}</span></header>
          <ul class="tasks">${items.map((t) => taskRow(t, { plain: true, list: lists[t.listId] })).join('')}</ul>
        </section>`).join('')
        : `<p class="empty">За этот период ничего не отмечено. Выполненные задачи попадают сюда с датой, и из них собирается отчёт.</p>`}`;
  }

  function reportMd(doc) {
    const lists = Object.fromEntries(listsOf(doc).map((l) => [l.id, l.name]));
    const name = PERIODS.find((p) => p[0] === period)[1].toLowerCase();
    let md = `# Сделано: ${doc.name} (${name})\n`;
    for (const [day, items] of groupByDay(doneTasks(doc))) {
      md += `\n## ${longDay(parseD(day))}\n`;
      items.forEach((t) => { md += `- ${t.title}${lists[t.listId] ? ` (${lists[t.listId]})` : ''}\n`; });
    }
    return md;
  }

  // ---------- поиск ----------
  function searchView(doc) {
    const q = query.toLowerCase();
    const hit = (s) => (s || '').toLowerCase().includes(q);
    const tasks = tasksOf(doc).filter((t) => hit(t.title) || hit(t.note) || (t.subs || []).some((s) => hit(s.t)));
    const notes = S.items(doc, 'note').filter((n) => hit(n.title) || hit(n.body));
    const lists = Object.fromEntries(listsOf(doc).map((l) => [l.id, l.name]));
    if (!tasks.length && !notes.length) return `<p class="empty">По запросу «${esc(query)}» в этом спейсе ничего нет.</p>`;
    return `
      ${tasks.length ? `<section class="list"><header class="list-head"><h3>Задачи</h3><span class="count">${tasks.length}</span></header>
        <ul class="tasks">${tasks.map((t) => taskRow(t, { plain: true, list: lists[t.listId] })).join('')}</ul></section>` : ''}
      ${notes.length ? `<div class="notes">${notes.map((n) => `
        <article class="note" data-id="${n.id}"><button class="note-open" data-act="open-note">
          <h3>${esc(n.title || 'Без названия')}</h3><p>${esc((n.body || '').slice(0, 240))}</p></button>
          <footer><span>${ago(n.updatedAt)}</span></footer></article>`).join('')}</div>` : ''}`;
  }

  // ---------- сейф ----------
  function vaultGate() {
    if (!MS.vaultApi.exists()) {
      return `
        <form class="gate" data-gate="create">
          <span class="gate-ico">${icon('lock', 28)}</span>
          <h2>Создайте сейф</h2>
          <p>Записи шифруются на этом устройстве, на GitHub уходит только шифр. Мастер-пароль нигде не хранится и не восстанавливается: забудете его — содержимое сейфа будет потеряно.</p>
          <input type="password" name="p1" aria-label="Мастер-пароль" placeholder="Мастер-пароль: фраза из 4–5 слов" autocomplete="new-password" required minlength="10">
          <input type="password" name="p2" aria-label="Повторите мастер-пароль" placeholder="Повторите мастер-пароль" autocomplete="new-password" required>
          <p class="gate-err" id="gate-err"></p>
          <button class="btn primary big">Создать сейф</button>
        </form>`;
    }
    return `
      <form class="gate" data-gate="unlock">
        <span class="gate-ico">${icon('lock', 28)}</span>
        <h2>Сейф заблокирован</h2>
        <input type="password" name="p1" aria-label="Мастер-пароль" placeholder="Мастер-пароль" autocomplete="current-password" required>
        <p class="gate-err" id="gate-err"></p>
        <button class="btn primary big">Открыть сейф</button>
      </form>`;
  }

  async function submitGate(form) {
    const err = $('#gate-err');
    const btn = $('button', form);
    const p1 = form.elements.p1.value;
    err.textContent = '';
    if (form.dataset.gate === 'create') {
      if (p1.length < 10) { err.textContent = 'Нужно хотя бы 10 символов. Лучше фраза из нескольких слов.'; return; }
      if (p1 !== form.elements.p2.value) { err.textContent = 'Пароли не совпадают.'; return; }
    }
    btn.disabled = true;
    try {
      if (form.dataset.gate === 'create') await MS.vaultApi.create(p1);
      else await MS.vaultApi.unlock(p1);
      armAutoLock();
      render();
      MS.sync.now();
    } catch (e) {
      btn.disabled = false;
      err.textContent = 'Пароль не подошёл.';
      form.classList.remove('shake');
      void form.offsetWidth;
      form.classList.add('shake');
      form.elements.p1.select();
    }
  }

  let lockTimer = 0;
  const LOCK_MS = 5 * 60 * 1000;
  function armAutoLock() {
    clearTimeout(lockTimer);
    if (MS.vault) lockTimer = setTimeout(lockVault, LOCK_MS);
  }
  function lockVault() {
    if (!MS.vault) return;
    MS.vaultApi.persist().then(() => {
      MS.vaultApi.lock();
      if (isVault()) closeSheet();
      render();
    });
  }

  // ---------- окна ----------
  let sheetClose = null;
  function openSheet(html, onMount, onClose) {
    const sh = $('#sheet');
    sh.innerHTML = `<button class="icon-btn sheet-x" data-close aria-label="Закрыть">${icon('x', 18)}</button>${html}`;
    sheetClose = onClose || null;
    // Запоминаем, откуда открыли, и делаем фон недоступным, пока открыто окно.
    sheetOpener = document.activeElement;
    document.body.classList.add('sheet-open');
    const shell = $('.app'); if (shell) shell.inert = true;
    if (onMount) onMount(sh);
    const f = $('[autofocus]', sh);
    if (f) setTimeout(() => f.focus(), 30);
  }
  let sheetOpener = null;
  function closeSheet() {
    if (!document.body.classList.contains('sheet-open')) return;
    document.body.classList.remove('sheet-open');
    const shell = $('.app'); if (shell) shell.inert = false;
    const fn = sheetClose;
    sheetClose = null;
    const back = sheetOpener; sheetOpener = null;
    if (fn) fn(); // onClose обычно перерисовывает экран
    // Фокус возвращаем туда, откуда открывали. Если перерисовка заменила элемент, ищем новый по его data-атрибуту.
    let target = back && back.isConnected ? back : null;
    if (!target && back) {
      const a = [...back.attributes].find((x) => x.name.startsWith('data-'));
      if (a) target = document.querySelector(`[${a.name}="${CSS.escape(a.value)}"]`);
    }
    if (target && typeof target.focus === 'function') target.focus();
  }

  function taskSheet(id) {
    const doc = cur();
    const t = doc.items[id];
    if (!t) return;
    const lists = listsOf(doc);
    const save = () => { const d = cur(); if (d && d.items[id] && !d.items[id].deleted) S.put(d, t); };
    const subsHtml = () => (t.subs || []).map((s, n) => `
      <li class="sub ${s.d ? 'is-done' : ''}">
        <button class="check small" data-sub="${n}" aria-label="Отметить шаг">${icon('done', 12)}</button>
        <span>${esc(s.t)}</span>
        <button class="icon-btn" data-sub-del="${n}" aria-label="Удалить шаг">${icon('x', 14)}</button>
      </li>`).join('');
    openSheet(`
      <input class="sheet-title" id="ts-title" value="${esc(t.title)}" aria-label="Название задачи">
      <div class="fields">
        <label>Срок<input type="date" id="ts-due" value="${esc(t.due || '')}"></label>
        <label>Список<select id="ts-list">${lists.map((l) => `<option value="${l.id}" ${l.id === t.listId ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></label>
        <label>Повтор<select id="ts-repeat">${F().REPEATS.map(([v, n]) => `<option value="${v}" ${(t.repeat || '') === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      </div>
      <ul class="subs" id="ts-subs">${subsHtml()}</ul>
      <form class="add inline" id="ts-sub-add"><span class="add-plus">${icon('plus', 16)}</span><input name="t" placeholder="Добавить шаг" autocomplete="off" aria-label="Добавить шаг"></form>
      <textarea id="ts-note" rows="4" placeholder="Заметка к задаче">${esc(t.note || '')}</textarea>
      ${F().linksOf(t.note).length ? `<div class="links">${F().linksOf(t.note).map((l) => `<a href="${esc(l)}" target="_blank" rel="noopener">${esc(l)}</a>`).join(' ')}</div>` : ''}
      <details class="hist"><summary>История версий</summary><div id="ts-hist">${histHtml(doc, id)}</div></details>
      <div class="sheet-foot">
        <button class="btn danger" id="ts-del">${icon('trash', 16)} Удалить задачу</button>
        <span class="grow"></span>
        <button class="btn primary" data-close>Готово</button>
      </div>`,
    (sh) => {
      $('#ts-title', sh).addEventListener('input', (e) => { t.title = e.target.value.trim() || t.title; save(); });
      $('#ts-due', sh).addEventListener('change', (e) => { t.due = e.target.value; save(); });
      $('#ts-list', sh).addEventListener('change', (e) => { t.listId = e.target.value; save(); });
      $('#ts-note', sh).addEventListener('input', (e) => { t.note = e.target.value; save(); });
      $('#ts-subs', sh).addEventListener('click', (e) => {
        const a = e.target.closest('[data-sub]'), d = e.target.closest('[data-sub-del]');
        if (a) t.subs[+a.dataset.sub].d = !t.subs[+a.dataset.sub].d;
        else if (d) t.subs.splice(+d.dataset.subDel, 1);
        else return;
        save();
        $('#ts-subs', sh).innerHTML = subsHtml();
      });
      $('#ts-sub-add', sh).addEventListener('submit', (e) => {
        e.preventDefault();
        const inp = e.target.elements.t;
        const v = inp.value.trim();
        if (!v) return;
        t.subs = t.subs || [];
        t.subs.push({ t: v, d: false });
        inp.value = '';
        save();
        $('#ts-subs', sh).innerHTML = subsHtml();
      });
      $('#ts-repeat', sh).addEventListener('change', (e) => { t.repeat = e.target.value; save(); });
      $('#ts-hist', sh).addEventListener('click', (e) => {
        const b = e.target.closest('[data-restore]');
        if (!b) return;
        S.restore(cur(), id, Number(b.dataset.restore));
        toast('Версия возвращена');
        taskSheet(id);
      });
      $('#ts-del', sh).addEventListener('click', () => {
        const prev = S.remove(cur(), id);
        closeSheet();
        toast('Задача удалена', () => { S.put(cur(), prev); render(); });
      });
    }, render);
  }

  // Список версий элемента для окна: последние 20, с кнопкой «Вернуть».
  function histHtml(doc, id) {
    const list = MS.history.list(doc.id, id);
    if (!list.length) return '<p class="hint">Версий пока нет. Они появятся после первых правок.</p>';
    return list.slice(0, 20).map((v) => `
      <div class="hist-row">
        <span>${esc(new Date(v.t).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}
          · ${esc(v.item.title || (v.item.body || '').slice(0, 40) || 'без названия')}</span>
        <button class="btn" data-restore="${v.t}">Вернуть</button>
      </div>`).join('');
  }

  // Открыть заметку или задачу по id в текущей работе.
  function openItem(id) {
    const it = cur() && cur().items[id];
    if (!it) return;
    if (it.type === 'note') noteSheet(id); else taskSheet(id);
  }
  // Открыть по названию из [[...]]. Если такой заметки нет, создаём её.
  function openTitle(title) {
    const doc = cur();
    if (!doc) return;
    const found = F().findByTitle(doc, title);
    if (found) { openItem(found.id); return; }
    const n = S.put(doc, { id: MS.uid(), type: 'note', title, body: '', pinned: false });
    noteSheet(n.id);
  }
  function backlinksHtml(doc, n) {
    const refs = F().backlinksOf(doc, n);
    if (!refs.length) return '<p class="hint">На эту заметку пока ничего не ссылается. Чтобы сослаться, напиши [[' + esc(n.title || 'название') + ']] в другой заметке.</p>';
    return `<p class="hint">Ссылаются сюда:</p>` + refs.map((r) => `<button class="chip-btn" data-open-id="${r.id}">${esc(r.title || (r.body || '').slice(0, 30) || 'без названия')}</button>`).join(' ');
  }

  function noteSheet(id) {
    const doc = cur();
    let n = id ? doc.items[id] : null;
    const fresh = !n;
    if (fresh) n = { id: MS.uid(), type: 'note', title: '', body: '', createdAt: Date.now() };
    // Существующая заметка открывается на «Читать», новая — сразу на «Править».
    const startRead = !fresh;
    const save = () => { const d = cur(); if (d) S.put(d, n); };
    const others = S.spaces().filter((d) => d.id !== MS.cfg.space);
    const moveOpts = [...others.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`),
      MS.cfg.space !== MS.VAULT ? `<option value="${MS.VAULT}">Сейф</option>` : ''].join('');
    openSheet(`
      <input class="sheet-title" id="ns-title" value="${esc(n.title)}" placeholder="Название" ${fresh ? 'autofocus' : ''} aria-label="Название заметки">
      <div class="seg note-mode" role="tablist">
        <button role="tab" class="${startRead ? '' : 'on'}" aria-selected="${!startRead}" data-mode="edit">Править</button><button role="tab" class="${startRead ? 'on' : ''}" aria-selected="${startRead}" data-mode="read">Читать</button>
      </div>
      <div class="md-tools" id="ns-tools" role="toolbar" aria-label="Оформление текста" ${startRead ? 'hidden' : ''}>
        <button type="button" data-md="bold" aria-label="Жирный" title="Жирный (Ctrl+B)"><b>B</b></button>
        <button type="button" data-md="italic" aria-label="Курсив" title="Курсив (Ctrl+I)"><i>I</i></button>
        <button type="button" data-md="h" aria-label="Заголовок" title="Заголовок">H</button>
        <button type="button" data-md="list" aria-label="Список" title="Список">•</button>
        <button type="button" data-md="check" aria-label="Чек-бокс" title="Чек-бокс">☐</button>
        <button type="button" data-md="link" title="Ссылка" aria-label="Ссылка">${icon('link', 18)}</button>
        <button type="button" data-md="code" aria-label="Код" title="Код">{ }</button>
        <button type="button" data-md="wiki" aria-label="Ссылка на заметку" title="Ссылка на заметку [[...]]">[[ ]]</button>
      </div>
      <textarea id="ns-body" class="tall" rows="12" ${startRead ? 'hidden' : ''} placeholder="Текст заметки. Можно Markdown: # заголовок, - список, **жирный**, [ссылка](https://...)">${esc(n.body)}</textarea>
      <div class="md-view" id="ns-view" ${startRead ? '' : 'hidden'}></div>
      ${fresh ? '' : `<div class="backlinks" id="ns-back">${backlinksHtml(doc, n)}</div>`}
      ${fresh || !moveOpts ? '' : `<div class="move-row"><label>Перенести в<select id="ns-move">${moveOpts}</select></label>
        <button class="btn" id="ns-move-go">Перенести</button></div>`}
      <details class="hist"><summary>История версий</summary><div id="ns-hist">${fresh ? '' : histHtml(doc, n.id)}</div></details>
      <div class="sheet-foot">
        ${fresh ? '' : `<button class="btn danger" id="ns-del">${icon('trash', 16)} Удалить</button>`}
        <button class="btn" id="ns-copy">${icon('copy', 16)} Скопировать текст</button>
        <button class="btn" id="ns-md">Скачать .md</button>
        ${MS.cfg.space === MS.VAULT ? '' : `<button class="btn" id="ns-img">Картинка</button><input type="file" id="ns-file" accept="image/*" hidden>`}
        ${fresh ? '' : `<button class="btn ${n.pinned ? 'on' : ''}" id="ns-pin">${n.pinned ? 'Открепить' : 'Закрепить'}</button>`}
        <span class="grow"></span>
        <button class="btn primary" data-close>Готово</button>
      </div>`,
    (sh) => {
      $('#ns-title', sh).addEventListener('input', (e) => { n.title = e.target.value; save(); });
      $('#ns-body', sh).addEventListener('input', (e) => { n.body = e.target.value; save(); });
      $('#ns-copy', sh).addEventListener('click', () => copyText(n.body));
      $('#ns-md', sh).addEventListener('click', () => download(`${n.title || 'заметка'}.md`, F().noteToMd(n), 'text/markdown'));
      const pinBtn = $('#ns-pin', sh);
      if (pinBtn) pinBtn.addEventListener('click', () => { F().togglePin(cur(), n.id); noteSheet(n.id); });
      $$('[data-mode]', sh).forEach((b) => b.addEventListener('click', () => {
        const read = b.dataset.mode === 'read';
        $$('[data-mode]', sh).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', String(x === b)); });
        $('#ns-body', sh).hidden = read;
        $('#ns-tools', sh).hidden = read;
        $('#ns-view', sh).hidden = !read;
        if (read) renderView();
      }));
      // Читать: оглавление сверху, ссылки [[...]] открываются, по оглавлению — переход к разделу.
      function renderView() {
        const body = $('#ns-body', sh).value;
        const heads = F().headingsOf(body);
        const toc = heads.length >= 2
          ? `<nav class="toc" aria-label="Оглавление">${heads.map((h) => `<button class="toc-item l${h.level}" data-toc="${h.id}">${esc(h.text)}</button>`).join('')}</nav>` : '';
        $('#ns-view', sh).innerHTML = (toc + F().mdToHtml(body)) || '<p class="hint">Пока пусто.</p>';
        // Картинки подгружаются по ссылке img:<id> из репозитория.
        $$('img[data-img]', $('#ns-view', sh)).forEach((img) => {
          MS.images.imageUrl(MS.cfg.space, img.dataset.img).then((u) => {
            if (u) img.src = u; else img.alt = (img.alt || 'картинка') + ' (не загрузилась: проверьте связь)';
          });
        });
      }
      if (startRead) renderView();
      // Панель оформления: оборачивает выделенный текст разметкой Markdown (сам текст остаётся текстом).
      const ta = $('#ns-body', sh);
      const applyMd = (kind) => {
        const wrap = { bold: ['**', '**', 'текст'], italic: ['*', '*', 'текст'], link: ['[', '](https://)', 'текст'],
          code: ['`', '`', 'код'], wiki: ['[[', ']]', 'название'] };
        const line = { h: '## ', list: '- ', check: '- [ ] ' };
        ta.focus();
        if (line[kind]) {
          const ls = ta.value.lastIndexOf('\n', ta.selectionStart - 1) + 1;
          ta.setRangeText(line[kind], ls, ls, 'end');
        } else {
          const [pre, post, ph] = wrap[kind];
          const s = ta.selectionStart, e = ta.selectionEnd;
          const inner = ta.value.slice(s, e) || ph;
          ta.setRangeText(pre + inner + post, s, e, 'select');
          if (!ta.value.slice(s, e)) { ta.selectionStart = s + pre.length; ta.selectionEnd = s + pre.length + ph.length; }
        }
        n.body = ta.value; save();
      };
      $('#ns-tools', sh).addEventListener('click', (e) => {
        const b = e.target.closest('[data-md]');
        if (b) applyMd(b.dataset.md);
      });
      ta.addEventListener('keydown', (e) => {
        if (!(e.ctrlKey || e.metaKey)) return;
        if (e.key === 'b' || e.key === 'B') { e.preventDefault(); applyMd('bold'); }
        if (e.key === 'i' || e.key === 'I') { e.preventDefault(); applyMd('italic'); }
      });
      const imgBtn = $('#ns-img', sh);
      if (imgBtn) imgBtn.addEventListener('click', () => $('#ns-file', sh).click());
      const fileInput = $('#ns-file', sh);
      if (fileInput) fileInput.addEventListener('change', async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        try {
          toast('Загружаю картинку…');
          const link = await MS.images.addImage(MS.cfg.space, f);
          const ta = $('#ns-body', sh);
          ta.value = (ta.value ? ta.value + '\n\n' : '') + `![картинка](${link})\n`;
          n.body = ta.value; save();
          toast('Картинка добавлена');
          if (!$('#ns-view', sh).hidden) renderView();
        } catch (err) { toast(err.message || 'Картинка не добавлена'); }
        e.target.value = '';
      });
      $('#ns-view', sh).addEventListener('click', (e) => {
        const w = e.target.closest('.wikilink');
        if (w) { e.preventDefault(); openTitle(w.dataset.wiki); return; }
        const t = e.target.closest('[data-toc]');
        if (t) { const el = document.getElementById(t.dataset.toc) || $('#ns-view', sh).querySelector('#' + t.dataset.toc); if (el) el.scrollIntoView({ block: 'start' }); }
      });
      const back = $('#ns-back', sh);
      if (back) back.addEventListener('click', (e) => {
        const b = e.target.closest('[data-open-id]');
        if (b) openItem(b.dataset.openId);
      });
      const mv = $('#ns-move-go', sh);
      if (mv) mv.addEventListener('click', () => {
        const to = $('#ns-move', sh).value;
        const target = to === MS.VAULT ? (MS.vault && MS.vault.doc) : S.doc(to);
        if (!target) { toast('Сначала откройте сейф'); return; }
        F().moveItem(cur(), target, n.id);
        closeSheet();
        toast('Заметка перенесена');
        render();
      });
      const hist = $('#ns-hist', sh);
      if (hist) hist.addEventListener('click', (e) => {
        const b = e.target.closest('[data-restore]');
        if (!b) return;
        S.restore(cur(), n.id, Number(b.dataset.restore));
        toast('Версия возвращена');
        noteSheet(n.id);
      });
      const del = $('#ns-del', sh);
      if (del) del.addEventListener('click', () => {
        const prev = S.remove(cur(), n.id);
        closeSheet();
        toast('Заметка удалена', () => { S.put(cur(), prev); render(); });
      });
    }, render);
  }

  function spaceSheet(id) {
    const doc = id ? MS.data.spaces[id] : null;
    let color = doc ? doc.color : MS.COLORS[S.spaces().length % MS.COLORS.length];
    openSheet(`
      <h2>${doc ? 'Спейс' : 'Новый спейс'}</h2>
      <form id="sp-form">
        <input name="name" value="${esc(doc ? doc.name : '')}" placeholder="Название, например «Работа 1»" required autofocus aria-label="Название спейса">
        <div class="swatches" id="sp-colors">${MS.COLORS.map((c) => `<button type="button" class="swatch ${c === color ? 'on' : ''}" data-color="${c}" style="--c:${c}" aria-label="Цвет ${c}"></button>`).join('')}</div>
        <div class="sheet-foot">
          ${doc && S.spaces().length > 1 ? `<button type="button" class="btn danger" id="sp-del">${icon('trash', 16)} Удалить спейс</button>` : ''}
          <span class="grow"></span>
          <button class="btn primary">${doc ? 'Сохранить' : 'Создать спейс'}</button>
        </div>
      </form>`,
    (sh) => {
      $('#sp-colors', sh).addEventListener('click', (e) => {
        const b = e.target.closest('[data-color]');
        if (!b) return;
        color = b.dataset.color;
        $$('.swatch', sh).forEach((s) => s.classList.toggle('on', s === b));
      });
      $('#sp-form', sh).addEventListener('submit', (e) => {
        e.preventDefault();
        const name = e.target.elements.name.value.trim();
        if (!name) return;
        if (doc) { doc.name = name; doc.color = color; S.touchDoc(doc); }
        else { MS.cfg.space = S.addSpace(name, color).id; S.saveCfg(); }
        closeSheet();
      });
      const del = $('#sp-del', sh);
      if (del) del.addEventListener('click', () => {
        const count = tasksOf(doc).length + S.items(doc, 'note').length;
        if (!confirm(`Удалить спейс «${doc.name}» и всё, что в нём (${count} записей)? Отменить это нельзя.`)) return;
        S.removeSpace(doc.id);
        MS.cfg.space = S.spaces()[0].id;
        S.saveCfg();
        closeSheet();
      });
    }, render);
  }

  // Тема: «auto» следует системной, светлая и тёмная фиксируются. Хранится в браузере, не в данных.
  // Превью: фон, поверхность, текст, акцент. Сами цвета тем задаёт styles.css.
  const THEMES = [
    ['auto', 'Как в системе', ['#f2f2f7', '#ffffff', '#1d1d1f', '#3a6cf0']],
    ['light', 'Светлая', ['#f2f2f7', '#ffffff', '#1d1d1f', '#3a6cf0']],
    ['dark', 'Тёмная', ['#000000', '#1c1c1e', '#f5f5f7', '#3a6cf0']],
    ['rose-dawn', 'Rosé Pine Dawn', ['#faf4ed', '#fffaf3', '#575279', '#286983']],
    ['rose-pine', 'Rosé Pine', ['#191724', '#1f1d2e', '#e0def4', '#c4a7e7']],
    ['nord', 'Nord', ['#2e3440', '#3b4252', '#eceff4', '#88c0d0']],
    ['dracula', 'Dracula', ['#282a36', '#44475a', '#f8f8f2', '#bd93f9']],
    ['tokyo-night', 'Tokyo Night', ['#1a1b26', '#24283b', '#c0caf5', '#7aa2f7']],
  ];
  const readTheme = () => { try { return localStorage.getItem('msync-theme') || 'auto'; } catch { return 'auto'; } };
  function setTheme(id) {
    try { if (id === 'auto') localStorage.removeItem('msync-theme'); else localStorage.setItem('msync-theme', id); } catch { /* без хранилища тема действует до перезагрузки */ }
    if (id === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = id;
  }

  function backupRows() {
    const list = F().backupList();
    if (!list.length) return '<p class="hint">Копий пока нет. Первая появится в ближайший запуск.</p>';
    return list.map((b) => `<div class="hist-row"><span>${esc(b.date)}</span><button class="btn" data-bk="${esc(b.date)}">Вернуть</button></div>`).join('');
  }
  function templateRows() {
    const list = F().templates();
    if (!list.length) return '<p class="hint">Шаблонов пока нет.</p>';
    return list.map((t) => `<div class="hist-row"><span>${esc(t.name)} · задач: ${t.lines.length}</span></div>`).join('');
  }

  // Размер интерфейса: S меньше, M по умолчанию, L и XL крупнее. Хранится в браузере.
  const SIZES = [['s', 'S'], ['m', 'M'], ['l', 'L'], ['xl', 'XL']];
  const readSize = () => { try { return localStorage.getItem('msync-size') || 'm'; } catch { return 'm'; } };
  function setSize(id) {
    try { if (id === 'm') localStorage.removeItem('msync-size'); else localStorage.setItem('msync-size', id); } catch { /* без хранилища размер действует до перезагрузки */ }
    if (id === 'm') delete document.documentElement.dataset.size;
    else document.documentElement.dataset.size = id;
  }

  function settingsSheet() {
    const gh = MS.cfg.gh || {};
    openSheet(`
      <h2>Настройки</h2>
      <h3>Оформление</h3>
      <div class="theme-grid" id="theme-grid" role="group" aria-label="Тема оформления">
        ${THEMES.map(([id, n, c]) => `<button type="button" class="theme-card ${readTheme() === id ? 'on' : ''}" data-theme-set="${id}" aria-pressed="${readTheme() === id}" style="--pb:${c[0]};--ps:${c[1]};--pt:${c[2]};--pa:${c[3]}"><span class="theme-prev"><i></i><b></b></span><span class="theme-name">${n}</span></button>`).join('')}
      </div>
      <h3>Размер</h3>
      <div class="seg size-seg" id="size-seg" role="group" aria-label="Размер интерфейса">
        ${SIZES.map(([id, n]) => `<button type="button" class="${readSize() === id ? 'on' : ''}" data-size-set="${id}" aria-pressed="${readSize() === id}">${n}</button>`).join('')}
      </div>
      <h3>Синхронизация через GitHub</h3>
      <p class="hint">Нужен приватный репозиторий и токен fine-grained с доступом только к нему (право Contents: Read and write). Токен хранится в этом браузере.</p>
      <form id="gh-form">
        <label>Репозиторий<input name="repo" value="${esc(gh.repo || '')}" placeholder="логин/название-репозитория" autocomplete="off"></label>
        <label>Токен<input name="token" type="password" value="${esc(gh.token || '')}" placeholder="github_pat_…" autocomplete="off"></label>
        <div class="sheet-foot"><button class="btn primary">Сохранить и синхронизировать</button>
          ${gh.token ? '<button type="button" class="btn" id="gh-off">Отключить</button>' : ''}</div>
      </form>
      <h3>Резервная копия</h3>
      <p class="hint">Файл со всеми спейсами. Сейф попадает в него зашифрованным.</p>
      <div class="sheet-foot">
        <button class="btn" id="exp">Скачать копию</button>
        <label class="btn file">Загрузить копию<input type="file" id="imp" accept="application/json,.json" hidden></label>
      </div>
      <h3>Копии за 7 дней</h3>
      <p class="hint">Снимок данных делается раз в день на этом компьютере. Возврат заменяет текущие данные на этом компьютере.</p>
      <div id="bk-list">${backupRows()}</div>
      <h3>Шаблоны списков</h3>
      <p class="hint">Шаблон создаёт список с задачами одним нажатием. Одна строка — одна задача.</p>
      <form id="tpl-form">
        <input name="name" placeholder="Название, например «Публикация статьи»" required autocomplete="off">
        <textarea name="lines" rows="4" placeholder="Одна задача в строке"></textarea>
        <div class="sheet-foot"><button class="btn primary">Сохранить шаблон</button></div>
      </form>
      <div id="tpl-list">${templateRows()}</div>
      <h3>Экспорт работы</h3>
      <p class="hint">Текущая работа в файл .md: задачи по спискам и заметки.</p>
      <div class="sheet-foot"><button class="btn" id="md-space">Скачать работу в .md</button></div>`,
    (sh) => {
      $('#size-seg', sh).addEventListener('click', (e) => {
        const b = e.target.closest('[data-size-set]');
        if (!b) return;
        setSize(b.dataset.sizeSet);
        $$('[data-size-set]', sh).forEach((x) => {
          const on = x === b;
          x.classList.toggle('on', on);
          x.setAttribute('aria-pressed', String(on));
        });
      });
      $('#theme-grid', sh).addEventListener('click', (e) => {
        const b = e.target.closest('[data-theme-set]');
        if (!b) return;
        setTheme(b.dataset.themeSet);
        $$('[data-theme-set]', sh).forEach((x) => {
          const on = x === b;
          x.classList.toggle('on', on);
          x.setAttribute('aria-pressed', String(on));
        });
      });
      $('#gh-form', sh).addEventListener('submit', (e) => {
        e.preventDefault();
        const el = e.target.elements;
        const repo = el.repo.value.trim().replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
        MS.cfg.gh = { repo, token: el.token.value.trim() };
        S.saveCfg();
        closeSheet();
        if (MS.sync.configured()) { MS.sync.now(); toast('Синхронизация запущена'); }
        else toast('Укажите репозиторий в виде логин/название и токен');
      });
      const off = $('#gh-off', sh);
      if (off) off.addEventListener('click', () => { delete MS.cfg.gh; S.saveCfg(); MS.sync.state.status = 'off'; closeSheet(); });
      $('#bk-list', sh).addEventListener('click', (e) => {
        const b = e.target.closest('[data-bk]');
        if (!b) return;
        if (!F().restoreBackup(b.dataset.bk)) { toast('Копия не найдена'); return; }
        closeSheet(); render(); toast('Данные возвращены из копии');
      });
      $('#tpl-form', sh).addEventListener('submit', (e) => {
        e.preventDefault();
        const el = e.target.elements;
        const name = el.name.value.trim();
        if (!name) return;
        F().saveTemplate(name, el.lines.value.split('\n'));
        toast('Шаблон сохранён');
        settingsSheet();
      });
      $('#md-space', sh).addEventListener('click', () => {
        const doc = cur();
        if (!doc) { toast('Откройте работу'); return; }
        download(`${doc.name}.md`, F().spaceToMd(doc), 'text/markdown');
      });
      $('#exp', sh).addEventListener('click', () => {
        download(`msync-${today()}.json`, JSON.stringify({ msync: 1, data: MS.data, vault: MS.vaultApi.blob() }, null, 2), 'application/json');
      });
      $('#imp', sh).addEventListener('change', async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        try {
          const j = JSON.parse(await f.text());
          if (!j.data || !j.data.spaces) throw new Error('bad');
          for (const [id, d] of Object.entries(j.data.spaces)) {
            MS.data.spaces[id] = S.merge(MS.data.spaces[id], d);
            MS.meta.dirty[id] = (MS.meta.dirty[id] || 0) + 1;
          }
          if (j.vault && !MS.vaultApi.exists()) MS.vaultApi.setBlob(j.vault);
          S.saveData(); S.saveMeta();
          closeSheet();
          toast('Копия загружена и объединена с текущими данными');
          MS.sync.schedule();
        } catch { toast('Это не файл копии MSync'); }
      });
    }, render);
  }

  // ---------- мелочи ----------
  let toastTimer = 0;
  function toast(msg, undo) {
    const el = $('#toast');
    el.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button data-undo>Отменить</button>' : ''}`;
    el.classList.add('on');
    const b = $('[data-undo]', el);
    if (b) b.onclick = () => { undo(); el.classList.remove('on'); };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('on'), undo ? 6000 : 2600);
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text || ''); toast('Скопировано'); }
    catch { toast('Браузер не дал доступ к буферу обмена'); }
  }

  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- события ----------
  function bind() {
    $('#search-ico').innerHTML = icon('search', 16);

    $('.sidebar').addEventListener('click', (e) => {
      const ed = e.target.closest('[data-edit-space]');
      if (ed) { spaceSheet(ed.dataset.editSpace); return; }
      const qi = e.target.closest('[data-quick-id]');
      if (qi) {
        const qdoc = S.doc(qi.dataset.quickSpace);
        const item = qdoc && qdoc.items[qi.dataset.quickId];
        MS.cfg.space = qi.dataset.quickSpace; S.saveCfg();
        view = 'tasks'; query = ''; $('#search').value = ''; render();
        if (item) { if (item.type === 'note') noteSheet(item.id); else taskSheet(item.id); }
        return;
      }
      const sp = e.target.closest('[data-space]');
      if (sp) {
        MS.cfg.space = sp.dataset.space;
        S.saveCfg();
        query = ''; $('#search').value = '';
        render();
        return;
      }
      const v = e.target.closest('[data-view]');
      if (v) { view = v.dataset.view; query = ''; $('#search').value = ''; render(); return; }
      const act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'new-space') spaceSheet();
      if (act.dataset.act === 'sync') { if (MS.sync.configured()) MS.sync.now(); else settingsSheet(); }
      if (act.dataset.act === 'settings') settingsSheet();
      if (act.dataset.act === 'lock') lockVault();
      if (act.dataset.act === 'timer') {
        if (MS.time.running()) {
          const done = MS.time.stop();
          toast(done ? `Записано: ${done.minutes} мин` : 'Слишком коротко, не записано');
        } else if (isVault()) {
          toast('Учёт времени не ведётся в сейфе');
        } else {
          MS.time.start(MS.cfg.space);
          toast('Учёт времени запущен');
        }
        renderSide();
      }
    });

    // Поиск перерисовывает колонку не на каждую букву, а через 150 мс после последней.
    let searchTimer = 0;
    $('#search').addEventListener('input', (e) => {
      const v = e.target.value.trim();
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        if ($('#search').value.trim() !== v) return; // поле уже очистили или поменяли
        query = v; renderSide(); renderMain();
      }, 150);
    });

    const c = $('#content');
    c.addEventListener('click', (e) => {
      const per = e.target.closest('[data-period]');
      if (per) { period = per.dataset.period; renderMain(); return; }
      const ld = e.target.closest('.list-date');
      if (ld) {
        const i = $('input', ld);
        e.preventDefault();
        try { i.showPicker(); } catch { i.focus(); }
        return;
      }
      const act = e.target.closest('[data-act]');
      if (act) {
        const doc = cur();
        const li = act.closest('[data-id]');
        const a = act.dataset.act;
        if (a === 'today-done' || a === 'today-open') {
          const tdoc = S.doc(li.dataset.space);
          const t = tdoc && tdoc.items[li.dataset.id];
          if (!t) return;
          if (a === 'today-open') {
            MS.cfg.space = li.dataset.space; S.saveCfg(); view = 'tasks'; render();
            taskSheet(t.id);
          } else {
            F().completeTask(tdoc, t); render(); toast('Отмечено выполненной');
          }
          return;
        }
        if (a === 'move-status') { F().setStatus(doc, doc.items[li.dataset.id], act.dataset.to); render(); return; }
        if (a === 'tag') { tagFilter = tagFilter === act.dataset.tag ? '' : act.dataset.tag; renderMain(); return; }
        if (a === 'pin-note') { F().togglePin(doc, li.dataset.id); render(); return; }
        if (a === 'off-toggle') {
          if (MS.days.listDays(doc).some((d) => d.date === act.dataset.day)) MS.days.removeDay(doc, act.dataset.day);
          else MS.days.setDay(doc, act.dataset.day, 'выход');
          render(); return;
        }
        if (a === 'off-del') { MS.days.removeDay(doc, act.dataset.day); render(); return; }
        if (a === 'ics') { download(`${doc.name}.ics`, MS.days.toIcs(doc), 'text/calendar'); return; }
        if (a === 'toggle') toggleTask(li);
        else if (a === 'expand') {
          const id = li.dataset.id;
          if (expanded.has(id)) expanded.delete(id); else { expanded.add(id); justOpened = id; }
          render();
          justOpened = null;
        } else if (a === 'sub-toggle') {
          const task = doc.items[li.dataset.id];
          const s = task.subs[+act.dataset.sub];
          s.d = !s.d;
          S.put(doc, task);
          render();
        } else if (a === 'open') taskSheet(li.dataset.id);
        else if (a === 'pin') {
          const t = doc.items[li.dataset.id];
          t.pinned = !t.pinned;
          if (t.pinned) t.order = Math.min(0, ...tasksOf(doc).filter((x) => x.listId === t.listId).map((x) => x.order || 0)) - 1;
          S.put(doc, t); render();
        } else if (a === 'add-list') {
          const l = S.put(doc, { id: MS.uid(), type: 'list', name: 'Новый список', order: Math.max(0, ...listsOf(doc).map((x) => x.order || 0)) + 1 });
          render();
          const inp = $(`[data-list-name="${l.id}"]`);
          if (inp) { inp.focus(); inp.select(); }
        } else if (a === 'add-today' || a === 'add-day-list') {
          const l = addDayList(doc, a === 'add-today' ? today() : calDay);
          focusAfter = `[data-add="${l.id}"] input`;
          render();
        } else if (a === 'go-cal') {
          view = 'calendar';
          render();
        } else if (a === 'del-list') {
          const id = act.dataset.id;
          const inside = tasksOf(doc).filter((t) => t.listId === id);
          const fallback = listsOf(doc).find((l) => l.id !== id);
          const prev = S.remove(doc, id);
          inside.forEach((t) => { t.listId = fallback.id; S.put(doc, t); });
          render();
          toast(inside.length ? `Список удалён, задачи перенесены в «${fallback.name}»` : 'Список удалён', () => {
            S.put(doc, prev);
            inside.forEach((t) => { t.listId = id; S.put(doc, t); });
            render();
          });
        } else if (a === 'new-note') noteSheet();
        else if (a === 'open-note') noteSheet(li.dataset.id);
        else if (a === 'copy-note') copyText(doc.items[li.dataset.id].body);
        else if (a === 'cal-prev') { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); renderMain(); }
        else if (a === 'cal-next') { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); renderMain(); }
        else if (a === 'cal-today') { const n = new Date(); calMonth = new Date(n.getFullYear(), n.getMonth(), 1); calDay = today(); renderMain(); }
        else if (a === 'copy-report') copyText(reportMd(doc));
        else if (a === 'save-report') download(`сделано-${doc.name}-${today()}.md`, reportMd(doc), 'text/markdown');
        return;
      }
      const cell = e.target.closest('[data-day]');
      if (cell) { calDay = cell.dataset.day; renderMain(); }
    });

    c.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      if (f.dataset.gate) { submitGate(f); return; }
      if (f.matches('[data-off-import]')) {
        const r = MS.days.importText(cur(), f.elements.text.value);
        const bad = r.bad.map((b) => b.line).join(', ');
        toast(`Добавлено дней: ${r.added}` + (bad ? `. Не поняли строки ${bad}: проверьте дату` : ''));
        render();
        return;
      }
      const doc = cur();
      const title = f.elements.title ? f.elements.title.value.trim() : '';
      if (!title) return;
      if (f.dataset.addSub) {
        const task = doc.items[f.dataset.addSub];
        task.subs = task.subs || [];
        task.subs.push({ t: title, d: false });
        S.put(doc, task);
        focusAfter = `[data-add-sub="${task.id}"] input`;
      } else if (f.dataset.add) {
        addTask(doc, f.dataset.add, title);
        focusAfter = `[data-add="${f.dataset.add}"] input`;
      } else if (f.dataset.addDay) {
        const day = f.dataset.addDay;
        const l = listsOf(doc).find((x) => x.date === day) || addDayList(doc, day);
        addTask(doc, l.id, title);
        focusAfter = `[data-add="${l.id}"] input`;
      }
      render();
    });

    c.addEventListener('input', (e) => {
      if (e.target.id === 'handoff') {
        const doc = cur();
        doc.handoff = { text: e.target.value, ...S.stamp() };
        S.save(doc.id);
        $('#handoff-at').textContent = 'Обновлено только что';
      }
    });

    c.addEventListener('change', (e) => {
      if (e.target.dataset.tplApply !== undefined) {
        const name = e.target.value;
        if (name) {
          const list = F().applyTemplate(cur(), name);
          if (list) { focusAfter = `[data-list="${list.id}"] input`; toast('Список создан из шаблона'); }
          render();
        }
        return;
      }
      const dateOf = e.target.dataset.listDate;
      if (dateOf) {
        const doc = cur();
        const l = doc.items[dateOf];
        l.date = e.target.value || '';
        S.put(doc, l);
        if (view === 'calendar' && l.date) { calDay = l.date; calMonth = new Date(parseD(l.date).getFullYear(), parseD(l.date).getMonth(), 1); }
        render();
        return;
      }
      const id = e.target.dataset.listName;
      if (!id) return;
      const doc = cur();
      const l = doc.items[id];
      const name = e.target.value.trim();
      if (name) { l.name = name; S.put(doc, l); } else e.target.value = l.name;
    });

    c.addEventListener('keydown', (e) => {
      // Порядок задач с клавиатуры: стрелки на ручке переставляют задачу в своём списке.
      if (e.target.matches && e.target.matches('[data-grip]') && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        const li = e.target.closest('.task');
        const sib = e.key === 'ArrowUp' ? li.previousElementSibling : li.nextElementSibling;
        if (!sib || !sib.classList.contains('task')) return;
        const doc = cur();
        const ids = [...li.parentElement.children].map((r) => r.dataset.id);
        const i = ids.indexOf(li.dataset.id), j = ids.indexOf(sib.dataset.id);
        [ids[i], ids[j]] = [ids[j], ids[i]];
        ids.forEach((id, n) => {
          const t = doc.items[id];
          if (t && t.order !== n + 1) { t.order = n + 1; S.put(doc, t); }
        });
        focusAfter = `[data-id="${li.dataset.id}"] [data-grip]`;
        render();
        return;
      }
      if (e.key === 'Enter' && e.target.dataset.listName) e.target.blur();
      if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset.day) { calDay = e.target.dataset.day; renderMain(); }
    });

    c.addEventListener('pointerdown', (e) => {
      const g = e.target.closest('[data-grip]');
      if (g && e.button === 0) startDrag(e, g);
    });

    // Календарь: перенос задачи на другой день.
    c.addEventListener('dragstart', (e) => {
      const ev = e.target.closest && e.target.closest('[data-ev], [data-evlist]');
      if (ev) { e.dataTransfer.setData('text/plain', ev.dataset.ev || ev.dataset.evlist); e.dataTransfer.effectAllowed = 'move'; }
    });
    c.addEventListener('dragover', (e) => {
      const cell = e.target.closest && e.target.closest('[data-day]');
      if (!cell) return;
      e.preventDefault();
      $$('.cell.drop', c).forEach((x) => x !== cell && x.classList.remove('drop'));
      cell.classList.add('drop');
    });
    c.addEventListener('dragleave', (e) => {
      const cell = e.target.closest && e.target.closest('[data-day]');
      if (cell && !cell.contains(e.relatedTarget)) cell.classList.remove('drop');
    });
    c.addEventListener('drop', (e) => {
      const cell = e.target.closest && e.target.closest('[data-day]');
      const id = e.dataTransfer.getData('text/plain');
      if (!cell || !id) return;
      e.preventDefault();
      const doc = cur();
      const t = doc.items[id];
      if (!t || t.deleted) return;
      // Список переезжает на другой день целиком, отдельная задача получает срок.
      if (t.type === 'list') t.date = cell.dataset.day; else t.due = cell.dataset.day;
      S.put(doc, t);
      calDay = cell.dataset.day;
      renderMain();
    });

    $('#scrim').addEventListener('click', closeSheet);
    $('#sheet').addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeSheet(); });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeSheet(); return; }
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') { e.preventDefault(); $('#search').focus(); }
      if (e.key === 'n' || e.key === 'т') {
        const i = $('.add input', $('#content'));
        if (i) { e.preventDefault(); i.focus(); }
      }
    });

    ['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, armAutoLock, { passive: true }));

    MS.onChange = () => MS.sync.schedule();
    MS.onSync = (changed) => {
      renderSide();
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if (changed && !typing && !document.body.classList.contains('sheet-open')) renderMain();
    };
    window.addEventListener('focus', () => {
      if (MS.sync.configured() && Date.now() - MS.sync.state.at > 60000) MS.sync.now();
    });
    window.addEventListener('online', () => MS.sync.now());
    setInterval(renderSide, 60000);
  }

  // ---------- запуск ----------
  S.init();
  F().backupIfDue(today());
  bind();
  render();
  MS.sync.now();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

