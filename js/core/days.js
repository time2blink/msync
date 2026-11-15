import { MS } from './state.js';
import './store.js';
// Нерабочие дни по работе: отмечаются вручную или импортом текста вида «15.10.2027 выход».
// Дни хранятся как элементы спейса типа day, поэтому синхронизируются вместе с ним.
// Выгрузка в файл .ics открывается в Google, Apple и Outlook: каждая работа — отдельный календарь.

const pad = (n) => String(n).padStart(2, '0');
const isoDate = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

// «15.10.2027 выход» → { date: '2027-10-15', label: 'выход' }. Неверная дата или формат → null.
export function parseLine(line) {
  const m = String(line).trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s*(.*)$/);
  if (!m) return null;
  const dd = +m[1], mm = +m[2], yy = +m[3];
  const check = new Date(yy, mm - 1, dd);
  if (check.getFullYear() !== yy || check.getMonth() !== mm - 1 || check.getDate() !== dd) return null;
  return { date: isoDate(yy, mm, dd), label: m[4].trim() || 'выход' };
}

// Разбор всего текста: что распознали и какие строки не поняли (с номером строки).
export function parseText(text) {
  const days = [], bad = [];
  String(text).split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    const r = parseLine(line);
    if (r) days.push(r);
    else bad.push({ line: i + 1, text: line.trim() });
  });
  return { days, bad };
}

export function setDay(doc, date, label) {
  return MS.store.put(doc, { id: 'day-' + date, type: 'day', date, label: label || 'выход' });
}

export function removeDay(doc, date) {
  return MS.store.remove(doc, 'day-' + date);
}

export function listDays(doc) {
  return MS.store.items(doc, 'day').sort((a, b) => a.date.localeCompare(b.date));
}

// Импорт текста в спейс. Возвращает, сколько дней добавлено и какие строки пропущены.
export function importText(doc, text) {
  const { days, bad } = parseText(text);
  for (const d of days) setDay(doc, d.date, d.label);
  return { added: days.length, bad };
}

// Файл календаря (.ics): одно событие на весь день для каждого отмеченного дня.
export function toIcs(doc) {
  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MSync//RU', 'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:' + esc(doc.name), 'METHOD:PUBLISH'];
  for (const d of listDays(doc)) {
    const [y, m, day] = d.date.split('-').map(Number);
    const next = new Date(y, m - 1, day + 1);
    const nextCompact = `${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`;
    lines.push('BEGIN:VEVENT',
      'UID:' + d.id + '-' + doc.id + '@msync',
      'DTSTAMP:' + stamp,
      'DTSTART;VALUE=DATE:' + d.date.replace(/-/g, ''),
      'DTEND;VALUE=DATE:' + nextCompact,
      'SUMMARY:' + esc(d.label),
      'TRANSP:TRANSPARENT',
      'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

export const days = { parseLine, parseText, setDay, removeDay, listDays, importText, toIcs };
MS.days = days;
