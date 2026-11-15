import { MS } from './state.js';
import './store.js';
// Учёт времени по спейсам. Таймер запускается на этом компьютере (ключ ms:timer).
// При остановке записывается запись вида {type: 'time', date, minutes} в спейс, поэтому она синхронизируется.
// Минуты меньше одной не записываются. Сейф не учитывается: его данные открываются только после пароля.

const KEY = 'ms:timer';
const dstr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function running() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
}

export function start(spaceId) {
  if (running()) stop();
  localStorage.setItem(KEY, JSON.stringify({ space: spaceId, start: Date.now() }));
  return true;
}

// Останавливает таймер и записывает время. Возвращает {space, minutes} или null, если нечего записывать.
export function stop() {
  const r = running();
  if (!r) return null;
  localStorage.removeItem(KEY);
  const minutes = Math.round((Date.now() - r.start) / 60000);
  const doc = MS.store.doc(r.space);
  if (minutes < 1 || !doc) return null;
  MS.store.put(doc, { id: 'time-' + MS.uid(), type: 'time', date: dstr(new Date(r.start)), minutes });
  return { space: r.space, minutes };
}

// Минуты по дням для одного спейса: {'2026-11-15': 95, ...}.
export function minutesByDay(doc) {
  const out = {};
  for (const it of MS.store.items(doc, 'time')) out[it.date] = (out[it.date] || 0) + (it.minutes || 0);
  return out;
}

// Сумма за период (дней назад от сегодня) для списка спейсов.
export function totalSince(spaces, days) {
  const from = new Date(Date.now() - days * 864e5);
  const fromIso = dstr(from);
  const rows = spaces.map((d) => {
    const by = minutesByDay(d);
    const sum = Object.entries(by).filter(([date]) => date >= fromIso).reduce((s, [, m]) => s + m, 0);
    return { space: d.id, name: d.name, minutes: sum };
  });
  return rows;
}

export const time = { running, start, stop, minutesByDay, totalSince };
MS.time = time;
