import { MS } from './state.js';
import './store.js';
import './history.js';
// Функции очереди 1 и 2: теги, закрепление, статусы, повторы, перенос в сейф, Markdown,
// сегодня по всем работам, шаблоны списков и ежедневные копии.
// Здесь только логика и данные. Экраны — в js/ui.

const S = () => MS.store;

// ---------- теги и ссылки ----------
// Тег пишется как #слово, вложенный через слэш: #сервер/доступы. Регистр не важен.
const TAG_RE = /(^|[\s(,;])#([\p{L}\d_][\p{L}\d_\-/]*)/gu;
export function tagsOf(text) {
  const out = new Set();
  for (const m of String(text || '').matchAll(TAG_RE)) out.add(m[2].toLowerCase().replace(/\/+$/, ''));
  return [...out];
}

// Все теги спейса со счётчиками. «сервер/доступы» засчитывается и в «сервер».
export function allTags(doc) {
  const count = new Map();
  for (const it of Object.values(doc.items)) {
    if (it.deleted || (it.type !== 'task' && it.type !== 'note')) continue;
    const seen = new Set();
    for (const tag of tagsOf(it.title + ' ' + (it.note || '') + ' ' + (it.body || ''))) {
      const parts = tag.split('/');
      for (let i = 1; i <= parts.length; i++) seen.add(parts.slice(0, i).join('/'));
    }
    for (const tag of seen) count.set(tag, (count.get(tag) || 0) + 1);
  }
  return [...count.entries()].map(([tag, n]) => ({ tag, count: n })).sort((a, b) => a.tag.localeCompare(b.tag));
}

// Элементы с тегом, включая вложенные.
export function itemsWithTag(doc, tag) {
  const t = tag.toLowerCase();
  return Object.values(doc.items).filter((it) => !it.deleted && (it.type === 'task' || it.type === 'note') &&
    tagsOf(it.title + ' ' + (it.note || '') + ' ' + (it.body || '')).some((x) => x === t || x.startsWith(t + '/')));
}

export function linksOf(text) {
  return [...String(text || '').matchAll(/https?:\/\/[^\s)<>"]+/g)].map((m) => m[0]);
}

// ---------- закрепление ----------
export function togglePin(doc, id) {
  const it = doc.items[id];
  if (!it) return null;
  it.pinned = !it.pinned;
  return S().put(doc, it);
}

// Закреплённые сверху, потом по времени правки.
export function sortNotes(list) {
  return list.slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updatedAt || 0) - (a.updatedAt || 0));
}

// Быстрый доступ: закреплённые задачи и заметки по всем открытым спейсам.
export function pinnedEverywhere() {
  const out = [];
  for (const d of S().spaces()) {
    for (const it of Object.values(d.items)) if (it.pinned && !it.deleted) out.push({ space: d.id, spaceName: d.name, item: it });
  }
  if (MS.vault) for (const it of Object.values(MS.vault.doc.items)) if (it.pinned && !it.deleted) out.push({ space: MS.VAULT, spaceName: 'Сейф', item: it });
  return out;
}

// ---------- статусы (доска) ----------
export const STATUSES = [['todo', 'Сделать'], ['doing', 'В работе'], ['done', 'Готово']];
export function statusOf(t) {
  if (t.status) return t.status;
  return t.done ? 'done' : 'todo';
}
export function setStatus(doc, task, status) {
  task.status = status;
  task.done = status === 'done';
  task.doneAt = task.done ? Date.now() : 0;
  return S().put(doc, task);
}

// ---------- повторы ----------
export const REPEATS = [['', 'не повторять'], ['daily', 'каждый день'], ['weekly', 'каждую неделю']];
function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const x = new Date(y, m - 1, d + n);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
// Закрыть задачу. Если она повторяется, создаётся следующая с новым сроком.
export function completeTask(doc, task) {
  setStatus(doc, task, 'done');
  if (!task.repeat || !task.due) return null;
  const step = task.repeat === 'daily' ? 1 : 7;
  const next = {
    ...task, id: MS.uid(), due: addDays(task.due, step), done: false, doneAt: 0, status: 'todo',
    subs: (task.subs || []).map((s) => ({ t: s.t, d: false })),
  };
  return S().put(doc, next);
}

// ---------- перенос элемента (сейф ↔ спейс) ----------
export function moveItem(fromDoc, toDoc, id) {
  const it = fromDoc.items[id];
  if (!it || it.deleted || !toDoc) return null;
  const copy = JSON.parse(JSON.stringify(it));
  if (copy.type === 'task') {
    const firstList = S().items(toDoc, 'list').sort((a, b) => (a.order || 0) - (b.order || 0))[0];
    copy.listId = firstList ? firstList.id : 'inbox';
  }
  delete copy.updatedAt; delete copy.by;
  const moved = S().put(toDoc, copy);
  S().remove(fromDoc, id);
  return moved;
}

// ---------- Markdown ----------
const stamp = (s) => {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${d}.${m}.${y}`;
};

export function noteToMd(n) {
  return `# ${n.title || 'Без названия'}\n\n${n.body || ''}\n`;
}

export function spaceToMd(doc) {
  const lists = S().items(doc, 'list').sort((a, b) => (a.order || 0) - (b.order || 0));
  let md = `# ${doc.name}\n`;
  for (const l of lists) {
    md += `\n## ${l.name}\n`;
    const rows = S().items(doc, 'task').filter((t) => t.listId === l.id).sort((a, b) => (a.order || 0) - (b.order || 0));
    if (!rows.length) md += '\n';
    for (const t of rows) {
      md += `- [${t.done ? 'x' : ' '}] ${t.title}${t.due ? ` (срок ${stamp(t.due)})` : ''}\n`;
      for (const s of t.subs || []) md += `  - [${s.d ? 'x' : ' '}] ${s.t}\n`;
    }
  }
  const notes = sortNotes(S().items(doc, 'note'));
  if (notes.length) {
    md += '\n## Заметки\n';
    for (const n of notes) md += `\n### ${n.title || 'Без названия'}\n\n${n.body || ''}\n`;
  }
  return md;
}

// Безопасный показ Markdown: сначала экранируем всё, потом разрешаем только свою разметку.
export function mdToHtml(src) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const inline = (s) => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
  const out = [];
  let list = false, code = false, para = [];
  const flushPara = () => { if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; } };
  const closeList = () => { if (list) { out.push('</ul>'); list = false; } };
  for (const line of String(src || '').split('\n')) {
    if (line.trim().startsWith('```')) {
      flushPara(); closeList();
      out.push(code ? '</code></pre>' : '<pre><code>');
      code = !code; continue;
    }
    if (code) { out.push(esc(line) + '\n'); continue; }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    const li = line.match(/^\s*[-*]\s+(\[([ xX])\]\s+)?(.*)$/);
    if (h) { flushPara(); closeList(); out.push(`<h${h[1].length + 2}>${inline(h[2])}</h${h[1].length + 2}>`); }
    else if (li) {
      flushPara();
      if (!list) { out.push('<ul>'); list = true; }
      const box = li[2] ? `<span class="box">${li[2].toLowerCase() === 'x' ? '☑' : '☐'}</span> ` : '';
      out.push(`<li>${box}${inline(li[3])}</li>`);
    } else if (!line.trim()) { flushPara(); closeList(); }
    else { closeList(); para.push(line); }
  }
  flushPara(); closeList();
  if (code) out.push('</code></pre>');
  return out.join('\n');
}

// ---------- сегодня по всем работам ----------
export function todayAcrossSpaces(today) {
  const out = [];
  const add = (d) => {
    for (const t of S().items(d, 'task')) {
      if (t.done || !t.due || t.due > today) continue;
      out.push({ space: d.id, spaceName: d.name, item: t, late: t.due < today });
    }
  };
  for (const d of S().spaces()) add(d);
  if (MS.vault) add(MS.vault.doc);
  return out.sort((a, b) => (a.late === b.late ? 0 : a.late ? -1 : 1) || a.item.due.localeCompare(b.item.due));
}

// ---------- шаблоны списков ----------
// Шаблон: название и строки задач. Хранится на этом компьютере (cfg), не синхронизируется.
export function templates() {
  return MS.cfg.templates || [];
}
export function saveTemplate(name, lines) {
  const list = templates().filter((t) => t.name !== name);
  list.push({ name, lines: lines.map((l) => l.trim()).filter(Boolean) });
  MS.cfg.templates = list;
  S().saveCfg();
}
export function applyTemplate(doc, name) {
  const tpl = templates().find((t) => t.name === name);
  if (!tpl) return null;
  const sibs = S().items(doc, 'list');
  const order = Math.max(0, ...sibs.map((l) => l.order || 0)) + 1;
  const list = S().put(doc, { id: MS.uid(), type: 'list', name: tpl.name, order, updatedAt: 0 });
  tpl.lines.forEach((title, i) => {
    S().put(doc, { id: MS.uid(), type: 'task', listId: list.id, title, note: '', due: '', done: false, doneAt: 0,
      pinned: false, subs: [], status: 'todo', order: i + 1 });
  });
  return list;
}

// ---------- ежедневные копии ----------
// Раз в день сохраняем снимок данных (последние 7 дней). Это страховка на случай порчи localStorage.
const BKEY = 'ms:backups';
export function backupIfDue(today) {
  let list = [];
  try { list = JSON.parse(localStorage.getItem(BKEY)) || []; } catch { list = []; }
  if (list.length && list[list.length - 1].date === today) return false;
  list.push({ date: today, data: JSON.stringify(MS.data) });
  list = list.slice(-7);
  try { localStorage.setItem(BKEY, JSON.stringify(list)); } catch (e) { console.warn('Копия не сохранена', e); return false; }
  return true;
}
export function backupList() {
  let list = [];
  try { list = JSON.parse(localStorage.getItem(BKEY)) || []; } catch { list = []; }
  return list.map((b) => ({ date: b.date, size: b.data.length })).reverse();
}
export function restoreBackup(date) {
  let list = [];
  try { list = JSON.parse(localStorage.getItem(BKEY)) || []; } catch { list = []; }
  const b = list.find((x) => x.date === date);
  if (!b) return false;
  MS.data = JSON.parse(b.data);
  S().saveData();
  return true;
}

export const features = {
  tagsOf, allTags, itemsWithTag, linksOf, togglePin, sortNotes, pinnedEverywhere,
  STATUSES, statusOf, setStatus, REPEATS, completeTask, moveItem,
  noteToMd, spaceToMd, mdToHtml, todayAcrossSpaces,
  templates, saveTemplate, applyTemplate, backupIfDue, backupList, restoreBackup,
};
MS.features = features;
