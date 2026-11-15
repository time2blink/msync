import { MS } from './state.js';
// История версий задач и заметок. Хранится на этом компьютере: ключ ms:hist.
// Одна запись на каждые WINDOW_MS. Если правили чаще, последнее состояние заменяет предыдущее,
// так история не засоряется каждым нажатием клавиши. Храним не больше LIMIT записей на элемент.

const KEY = 'ms:hist';
const LIMIT = 50;

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function save(h) {
  try { localStorage.setItem(KEY, JSON.stringify(h)); } catch (e) { console.warn('История не сохранена', e); }
}

export const history = {
  WINDOW_MS: 120000,
  LIMIT,

  // Вызывается после каждой правки элемента, со его текущим состоянием.
  record(spaceId, item) {
    if (!item || item.deleted) return;
    const h = load();
    const k = spaceId + '/' + item.id;
    const list = h[k] || [];
    const entry = { t: item.updatedAt || 0, by: item.by || '', snap: JSON.stringify(item) };
    const last = list[list.length - 1];
    if (last && entry.t - last.t < history.WINDOW_MS) list[list.length - 1] = entry;
    else list.push(entry);
    h[k] = list.slice(-LIMIT);
    save(h);
  },

  // Список версий, новые сверху.
  list(spaceId, itemId) {
    return (load()[spaceId + '/' + itemId] || []).slice().reverse()
      .map((v) => ({ t: v.t, by: v.by, item: JSON.parse(v.snap) }));
  },

  find(spaceId, itemId, t) {
    const v = (load()[spaceId + '/' + itemId] || []).find((e) => e.t === t);
    return v ? JSON.parse(v.snap) : null;
  },
};

MS.history = history;
