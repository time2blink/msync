// Напоминания: выбор задач, даты в часовом поясе, текст сообщения. Без сети и без Telegram.
import { todayIn, dueTasks, buildMessage } from '../scripts/remind.mjs';

const res = [];
const check = (n, ok, x = '') => res.push((ok ? 'PASS  ' : 'FAIL  ') + n + '  ' + x);

const spaces = [
  { id: 'work-1', name: 'Работа 1', items: {
    a: { type: 'task', title: 'Сегодня задача', due: '2026-11-15', done: false },
    b: { type: 'task', title: 'Просроченная', due: '2026-11-10', done: false },
    c: { type: 'task', title: 'Сделанная', due: '2026-11-15', done: true },
    d: { type: 'task', title: 'Завтра', due: '2026-11-16', done: false },
    e: { type: 'task', title: 'Удалённая', due: '2026-11-15', done: false, deleted: true },
    f: { type: 'note', title: 'Заметка', body: 'x' },
  } },
  { id: 'work-2', name: 'Работа 2', deleted: true, items: {
    g: { type: 'task', title: 'Из удалённой работы', due: '2026-11-15', done: false },
  } },
];

const tasks = dueTasks(spaces, '2026-11-15');
check('берутся задачи на сегодня и просроченные', tasks.map((t) => t.title).join('|') === 'Просроченная|Сегодня задача', tasks.map((t) => t.title).join('|'));
check('выполненные, будущие, удалённые и заметки не попадают', !tasks.some((t) => ['Сделанная', 'Завтра', 'Удалённая', 'Заметка'].includes(t.title)));
check('удалённые работы не напоминают', !tasks.some((t) => t.title === 'Из удалённой работы'));
check('просроченные помечаются', tasks.find((t) => t.title === 'Просроченная').late === true);

const text = buildMessage(tasks, '2026-11-15');
check('сообщение называет дату и работу', text.includes('2026-11-15') && text.includes('Работа 1:'));
check('в сообщении есть просрочка с датой', text.includes('Просроченная (просрочено, 2026-11-10)'));
check('пустой список — пустое сообщение', buildMessage([], '2026-11-15') === '');

// Часовой пояс: в момент 23:30 UTC в Москве уже следующий день.
const late = new Date('2026-11-15T23:30:00Z');
check('дата считается в часовом поясе', todayIn('Europe/Moscow', late) === '2026-11-16', todayIn('Europe/Moscow', late));
check('в UTC та же ночь — 15 число', todayIn('UTC', late) === '2026-11-15');

const bad = res.filter((l) => l.startsWith('FAIL')).length;
console.log(res.join('\n'));
if (bad) process.exit(1);
