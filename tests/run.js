// Запуск всех проверок одной командой: npm test
// Поднимает приложение на локальном сервере и прогоняет три набора сценариев в Chrome.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PORT = 8765;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
};

fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end('not found');
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

function runSuite(file) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [path.join(__dirname, file)]);
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { out += d; });
    p.on('close', (code) => resolve({ code, out }));
  });
}

server.on('error', (e) => {
  console.error(`Порт ${PORT} занят предыдущим запуском (${e.code}). Закройте процесс node в диспетчере задач и запустите снова.`);
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', async () => {
  let failed = false;
  for (const suite of ['test.js', 'test2.js', 'test3.js', 'test4.js', 'test5.js', 'test6.js', 'test7.js', 'test8.js', 'test9.js', 'test10.js', 'test11.js', 'test12.js']) {
    const { code, out } = await runSuite(suite);
    console.log(`\n== ${suite} ==\n${out}`);
    if (code !== 0 || /FAIL|CRASH/.test(out)) failed = true;
  }
  server.close();
  console.log(failed ? '\nРЕЗУЛЬТАТ: есть ошибки' : '\nРЕЗУЛЬТАТ: все проверки прошли');
  process.exit(failed ? 1 : 0);
});
