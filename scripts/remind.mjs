// Напоминания в Telegram: раз в день присылает задачи, у которых сегодня срок или он прошёл.
// Запускается на GitHub по расписанию (.github/workflows/remind.yml) или вручную.
// Секреты задаются в настройках репозитория, в код не попадают:
//   DATA_TOKEN  — токен с доступом Contents: Read к приватному репозиторию с данными
//   TG_TOKEN    — токен бота Telegram (создаётся в @BotFather)
//   TG_CHAT_ID  — куда слать (id чата с ботом)
// Переменные: DATA_REPO (логин/репозиторий с данными), TZ_NAME (часовой пояс, например Europe/Moscow).
// Сейф сюда не попадает: vault.json не читается.

const DATA_REPO = process.env.DATA_REPO || '';
const TZ_NAME = process.env.TZ_NAME || 'UTC';

// Сегодняшняя дата в нужном часовом поясе: 'YYYY-MM-DD'.
export function todayIn(tz, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// Задачи к напоминанию: не выполнены, срок сегодня или раньше. Возвращает [{space, title, due, late}].
export function dueTasks(spaces, today) {
  const out = [];
  for (const sp of spaces) {
    if (sp.deleted) continue;
    for (const it of Object.values(sp.items || {})) {
      if (it.deleted || it.type !== 'task' || it.done || !it.due) continue;
      if (it.due > today) continue;
      out.push({ space: sp.name || sp.id, title: it.title, due: it.due, late: it.due < today });
    }
  }
  return out.sort((a, b) => (a.late === b.late ? 0 : a.late ? -1 : 1) || a.due.localeCompare(b.due));
}

// Текст сообщения. Пусто, если напоминать не о чем.
export function buildMessage(tasks, today) {
  if (!tasks.length) return '';
  const lines = [`MSync, ${today}. Задачи на сегодня и просроченные:`];
  let space = '';
  for (const t of tasks) {
    if (t.space !== space) { space = t.space; lines.push('', `${space}:`); }
    lines.push(`- ${t.title}${t.late ? ` (просрочено, ${t.due})` : ''}`);
  }
  return lines.join('\n');
}

async function loadSpaces(repo, token) {
  const headers = { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, 'X-GitHub-Api-Version': '2022-11-28' };
  const list = await fetch(`https://api.github.com/repos/${repo}/contents/spaces`, { headers });
  if (list.status === 404) return [];
  if (!list.ok) throw new Error('GitHub не отдал список спейсов: ' + list.status);
  const files = (await list.json()).filter((f) => f.name.endsWith('.json'));
  const out = [];
  for (const f of files) {
    const r = await fetch(f.url, { headers });
    if (!r.ok) continue;
    const j = await r.json();
    const doc = JSON.parse(Buffer.from(j.content, 'base64').toString('utf8'));
    out.push(doc);
  }
  return out;
}

async function sendTelegram(token, chatId, text) {
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  if (!r.ok) throw new Error('Telegram ответил ошибкой ' + r.status);
}

async function main() {
  const { DATA_TOKEN, TG_TOKEN, TG_CHAT_ID } = process.env;
  if (!DATA_REPO || !DATA_TOKEN || !TG_TOKEN || !TG_CHAT_ID) {
    console.log('Не заданы DATA_REPO, DATA_TOKEN, TG_TOKEN или TG_CHAT_ID. Напоминание не отправлено.');
    process.exit(0);
  }
  const today = todayIn(TZ_NAME);
  const spaces = await loadSpaces(DATA_REPO, DATA_TOKEN);
  const text = buildMessage(dueTasks(spaces, today), today);
  if (!text) { console.log('На сегодня напоминать не о чем.'); return; }
  await sendTelegram(TG_TOKEN, TG_CHAT_ID, text);
  console.log('Напоминание отправлено.');
}

if (process.argv[1] && process.argv[1].endsWith('remind.mjs')) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
