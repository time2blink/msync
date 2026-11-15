import { MS } from './state.js';
import { history, mergeTables } from './history.js';
// Данные, локальное хранение и слияние версий.

const LS = { data: 'ms:data', cfg: 'ms:cfg', meta: 'ms:meta', vault: 'ms:vault' };

// Версия формата файлов. Новая версия приложения умеет читать старые файлы и
// переводит их; старое приложение не трогает файл более новой версии.
const FORMAT = 2;

const read = (k, d) => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; }
};
const write = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn('Не удалось сохранить', k, e); }
};

MS.VAULT = 'vault';
MS.VAULT_COLOR = '#4a4f5a';
MS.COLORS = ['#4b5bdb', '#0c8f86', '#c96a12', '#cf3a72', '#3c8d3f', '#8250c8', '#1f7fd1'];
MS.FORMAT = FORMAT;

MS.uid = () => {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
};

// Метка правки. Часы компьютера могут отставать, поэтому метка никогда не бывает
// меньше самой большой метки, которую этот компьютер уже видел (логика «гибридных часов»).
// Если метки совпали, побеждает большее имя компьютера: решение одинаковое на обоих.
function stamp() {
  const t = Math.max(Date.now(), ((MS.meta && MS.meta.clock) || 0) + 1);
  if (MS.meta) MS.meta.clock = t;
  return { updatedAt: t, by: (MS.meta && MS.meta.dev) || '' };
}

// Какая из двух версий новее.
function newer(x, y) {
  const tx = (x && x.updatedAt) || 0, ty = (y && y.updatedAt) || 0;
  if (tx !== ty) return tx > ty;
  return ((x && x.by) || '') > ((y && y.by) || '');
}

// Запоминаем самую большую метку из чужих данных, чтобы свои правки шли после неё.
function observe(t) {
  if (MS.meta && t > (MS.meta.clock || 0)) MS.meta.clock = t;
}

// updatedAt: 0 у заготовок, чтобы на втором компьютере они не затирали настоящие данные.
function blankDoc(id, name, color, order) {
  return {
    v: FORMAT, id, name, color, order, updatedAt: 0, by: '',
    handoff: { text: '', updatedAt: 0, by: '' },
    items: { inbox: { id: 'inbox', type: 'list', name: 'Входящие', order: 0, updatedAt: 0, by: '' } },
  };
}

function merge(a, b) {
  if (!a) return b;
  if (!b) return a;
  const m = newer(b, a) ? b : a;
  const out = { v: Math.max(a.v || 1, b.v || 1), id: a.id, name: m.name, color: m.color, order: m.order,
    updatedAt: m.updatedAt || 0, by: m.by || '' };
  if (m.deleted) out.deleted = true;
  const ha = a.handoff || { text: '', updatedAt: 0 };
  const hb = b.handoff || { text: '', updatedAt: 0 };
  out.handoff = newer(hb, ha) ? hb : ha;
  out.items = {};
  const ai = a.items || {}, bi = b.items || {};
  for (const id of new Set([...Object.keys(ai), ...Object.keys(bi)])) {
    const x = ai[id], y = bi[id];
    out.items[id] = !x ? y : !y ? x : newer(y, x) ? y : x;
  }
  if (a.hist || b.hist) out.hist = mergeTables(a.hist, b.hist); // история сейфа
  for (const t of [a.updatedAt, b.updatedAt, out.handoff.updatedAt, ...Object.values(out.items).map((i) => i.updatedAt)]) observe(t || 0);
  return out;
}

// Проверка версии: файл новее приложения — не трогаем, иначе потеряем поля.
function checkFormat(doc) {
  if ((doc.v || 1) > FORMAT) {
    throw new Error('Этот файл создан новой версией MSync. Обновите приложение, прежде чем менять данные.');
  }
  return doc;
}

// Перевод старого файла в текущий формат. Версия 1 → 2: добавляются метки правок.
function migrate(doc) {
  checkFormat(doc);
  if ((doc.v || 1) < FORMAT) {
    doc.v = FORMAT;
    for (const it of Object.values(doc.items || {})) { if (it.by === undefined) it.by = ''; }
    if (doc.by === undefined) doc.by = '';
    if (doc.handoff && doc.handoff.by === undefined) doc.handoff.by = '';
  }
  return doc;
}

// Каноническая строка: порядок ключей не влияет на сравнение.
function canon(v) {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  }
  return JSON.stringify(v === undefined ? null : v);
}

const store = {
  LS, read, write, merge, canon, blankDoc, stamp, newer, migrate, checkFormat, FORMAT,

  init() {
    MS.data = read(LS.data, null);
    MS.cfg = read(LS.cfg, {});
    MS.meta = read(LS.meta, { shas: {}, dirty: {} });
    MS.meta.shas = MS.meta.shas || {};
    MS.meta.dirty = MS.meta.dirty || {};
    MS.meta.clock = MS.meta.clock || 0;
    MS.meta.dev = MS.meta.dev || MS.uid(); // имя этого компьютера в метках правок
    if (!MS.data || !MS.data.spaces) {
      MS.data = { v: FORMAT, spaces: {} };
      [['work-1', 'Работа 1', MS.COLORS[0]], ['work-2', 'Работа 2', MS.COLORS[1]], ['personal', 'Личное', MS.COLORS[2]]]
        .forEach(([id, name, color], i) => { MS.data.spaces[id] = blankDoc(id, name, color, i); });
    }
    MS.data.v = FORMAT;
    for (const d of Object.values(MS.data.spaces)) migrate(d);
    write(LS.data, MS.data);
    store.saveMeta();
    if (!MS.cfg.space || (MS.cfg.space !== MS.VAULT && !MS.data.spaces[MS.cfg.space])) {
      MS.cfg.space = store.spaces()[0] ? store.spaces()[0].id : MS.VAULT;
    }
  },

  spaces() {
    return Object.values(MS.data.spaces).filter((d) => !d.deleted).sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  doc(id) {
    if (id === MS.VAULT) return MS.vault ? MS.vault.doc : null;
    return MS.data.spaces[id] || null;
  },

  items(doc, type) {
    return Object.values(doc.items).filter((i) => i.type === type && !i.deleted);
  },

  put(doc, item) {
    Object.assign(item, stamp());
    doc.items[item.id] = item;
    history.record(doc.id, item);
    store.save(doc.id);
    return item;
  },

  // Откат к сохранённой версии. Текущее состояние тоже попадает в историю, так что откат обратим.
  restore(doc, itemId, t) {
    const snap = history.find(doc.id, itemId, t);
    if (!snap) return false;
    store.put(doc, snap);
    return true;
  },

  remove(doc, id) {
    const prev = doc.items[id];
    doc.items[id] = { id, type: prev ? prev.type : 'task', deleted: true, ...stamp() };
    store.save(doc.id);
    return prev;
  },

  touchDoc(doc) {
    Object.assign(doc, stamp());
    store.save(doc.id);
  },

  addSpace(name, color) {
    const id = MS.uid();
    const order = Math.max(-1, ...Object.values(MS.data.spaces).map((d) => d.order || 0)) + 1;
    const doc = blankDoc(id, name, color, order);
    Object.assign(doc, stamp());
    MS.data.spaces[id] = doc;
    store.save(id);
    return doc;
  },

  removeSpace(id) {
    const doc = MS.data.spaces[id];
    if (!doc) return;
    doc.deleted = true;
    doc.items = {};
    doc.handoff = { text: '', ...stamp() };
    store.touchDoc(doc);
  },

  save(id) {
    MS.meta.dirty[id] = (MS.meta.dirty[id] || 0) + 1;
    write(LS.meta, MS.meta);
    if (id === MS.VAULT) MS.vaultApi.persist();
    else write(LS.data, MS.data);
    if (MS.onChange) MS.onChange(id);
  },

  saveCfg() { write(LS.cfg, MS.cfg); },
  saveMeta() { write(LS.meta, MS.meta); },
  saveData() { write(LS.data, MS.data); },
};

MS.store = store;
