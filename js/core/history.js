import { MS } from './state.js';
// История версий задач и заметок.
// Спейсы: история лежит на этом компьютере (ключ ms:hist) и синхронизируется файлами history/<спейс>.json.
// Сейф: история лежит внутри самого сейфа (поле hist), поэтому шифруется вместе с ним.
// Одна запись на каждые WINDOW_MS: быстрые правки подряд заменяют последнюю запись, а не плодят новые.
// Храним не больше LIMIT записей на элемент.

const KEY = 'ms:hist';
const LIMIT = 50;

function loadLocal() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function saveLocal(h) {
  try { localStorage.setItem(KEY, JSON.stringify(h)); } catch (e) { console.warn('История не сохранена', e); }
}

// Таблица истории для спейса. Для сейфа — та, что лежит в открытом сейфе.
function table(spaceId) {
  if (spaceId === MS.VAULT) {
    if (!MS.vault) return {};
    MS.vault.doc.hist = MS.vault.doc.hist || {};
    return MS.vault.doc.hist;
  }
  return loadLocal();
}
function commit(spaceId, h) {
  if (spaceId !== MS.VAULT) saveLocal(h); // сейф сохраняется вместе с самим документом
}

// Объединение двух списков записей: одинаковые по метке и компьютеру считаются одной.
function union(a = [], b = []) {
  const seen = new Map();
  for (const e of [...a, ...b]) seen.set(e.t + '|' + e.by, e);
  return [...seen.values()].sort((x, y) => x.t - y.t).slice(-LIMIT);
}

// Слияние двух таблиц истории (используется при слиянии сейфа).
export function mergeTables(a = {}, b = {}) {
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = union(a[k], b[k]);
  return out;
}

export const history = {
  WINDOW_MS: 120000,
  LIMIT,

  // Вызывается после каждой правки элемента, с его текущим состоянием.
  record(spaceId, item) {
    if (!item || item.deleted) return;
    const h = table(spaceId);
    const k = spaceId + '/' + item.id;
    const list = (h[k] || []).slice();
    const entry = { t: item.updatedAt || 0, by: item.by || '', snap: JSON.stringify(item) };
    const last = list[list.length - 1];
    if (last && entry.t - last.t < history.WINDOW_MS) list[list.length - 1] = entry;
    else list.push(entry);
    h[k] = list.slice(-LIMIT);
    commit(spaceId, h);
  },

  // Список версий, новые сверху.
  list(spaceId, itemId) {
    return (table(spaceId)[spaceId + '/' + itemId] || []).slice().reverse()
      .map((v) => ({ t: v.t, by: v.by, item: JSON.parse(v.snap) }));
  },

  // История спейса в виде, пригодном для файла на GitHub: { itemId: [{t, by, item}] }.
  exportSpace(spaceId) {
    const h = table(spaceId), prefix = spaceId + '/', out = {};
    for (const [k, list] of Object.entries(h)) {
      if (!k.startsWith(prefix)) continue;
      out[k.slice(prefix.length)] = list.map((e) => ({ t: e.t, by: e.by, item: JSON.parse(e.snap) }));
    }
    return out;
  },

  // Слияние истории спейса с версией с GitHub.
  mergeSpace(spaceId, remote) {
    const h = table(spaceId), prefix = spaceId + '/';
    for (const [itemId, list] of Object.entries(remote || {})) {
      const k = prefix + itemId;
      const incoming = (list || []).map((e) => ({ t: e.t, by: e.by, snap: JSON.stringify(e.item) }));
      h[k] = union(h[k], incoming);
    }
    commit(spaceId, h);
  },

  find(spaceId, itemId, t) {
    const v = (table(spaceId)[spaceId + '/' + itemId] || []).find((e) => e.t === t);
    return v ? JSON.parse(v.snap) : null;
  },
};

MS.history = history;
