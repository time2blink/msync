import { MS } from './state.js';
import './store.js'; // порядок важен: sync читает MS.store при загрузке
// Синхронизация с приватным репозиторием GitHub: по файлу на спейс + зашифрованный vault.json.

  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const { merge, canon } = MS.store;

  const state = { status: 'off', error: '', at: 0, busy: false, again: false };
  let backoffMs = 0; // сколько ждём перед повтором, если GitHub просит подождать

  function configured() {
    const c = MS.cfg.gh;
    return !!(c && c.repo && c.token && c.repo.includes('/'));
  }

  async function api(path, opts = {}) {
    const c = MS.cfg.gh;
    const res = await fetch(`https://api.github.com/repos/${c.repo}/contents/${path}`, {
      cache: 'no-store',
      ...opts,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer ' + c.token,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      const e = new Error(
        res.status === 401 ? 'GitHub не принял токен. Проверьте его в настройках.'
          : res.status === 403 ? 'У токена нет доступа к репозиторию (нужно право Contents: Read and write).'
            : 'GitHub ответил ошибкой ' + res.status);
      e.status = res.status;
      // Временные ограничения GitHub: лимит запросов, перегрузка сервера. Такие ошибки повторяем позже.
      e.transient = res.status === 429 || res.status >= 500
        || (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0');
      e.retryAfter = Number(res.headers.get('retry-after')) || 0;
      throw e;
    }
    return res.json();
  }

  async function getFile(path) {
    const r = await api(path);
    if (!r || Array.isArray(r) || !r.content) return null;
    return { json: JSON.parse(dec.decode(MS.unb64(r.content))), sha: r.sha };
  }

  async function putFile(path, obj, sha) {
    const body = { message: 'MSync: ' + path, content: MS.b64(enc.encode(JSON.stringify(obj, null, 2) + '\n')) };
    if (sha) body.sha = sha;
    const r = await api(path, { method: 'PUT', body: JSON.stringify(body) });
    return r && r.content ? r.content.sha : null;
  }

  async function syncSpace(id, listedSha) {
    const path = `spaces/${id}.json`;
    const dirtyBefore = MS.meta.dirty[id] || 0;
    if (listedSha && listedSha === MS.meta.shas[path] && !dirtyBefore) return false;
    const remote = listedSha ? await getFile(path) : null;
    if (remote) MS.store.checkFormat(remote.json); // файл новой версии не перезаписываем
    const local = MS.data.spaces[id];
    const merged = merge(local, remote && remote.json);
    let sha = remote ? remote.sha : null;
    if (!remote || canon(merged) !== canon(remote.json)) sha = await putFile(path, merged, sha);
    const changed = !local || canon(merged) !== canon(local);
    // Если за время запроса пользователь что-то поменял, не затираем его правку.
    if ((MS.meta.dirty[id] || 0) === dirtyBefore) {
      MS.data.spaces[id] = merged;
      delete MS.meta.dirty[id];
    } else {
      MS.data.spaces[id] = merge(MS.data.spaces[id], merged);
    }
    MS.meta.shas[path] = sha;
    return changed;
  }

  async function syncVault() {
    const path = 'vault.json';
    const remote = await getFile(path);
    const localBlob = MS.vaultApi.blob();
    if (!localBlob) {
      if (remote) { MS.vaultApi.setBlob(remote.json); return true; }
      return false;
    }
    if (!MS.vault) return false; // заблокирован: расшифровать нечем, ждём открытия
    const dirtyBefore = MS.meta.dirty[MS.VAULT] || 0;
    if (remote && remote.sha === MS.meta.shas[path] && !dirtyBefore) return false;
    let remoteDoc = null;
    if (remote) {
      try { remoteDoc = await MS.crypto.decrypt(MS.vault.pass, remote.json); }
      catch { throw new Error('Сейф на GitHub зашифрован другим мастер-паролем.'); }
    }
    if (remoteDoc) MS.store.checkFormat(remoteDoc);
    const merged = merge(MS.vault.doc, remoteDoc);
    const changed = canon(merged) !== canon(MS.vault.doc);
    let sha = remote ? remote.sha : null;
    if (!remote || canon(merged) !== canon(remoteDoc)) {
      if (remote) MS.vault.salt = remote.json.salt;
      const blob = await MS.crypto.encrypt(MS.vault.pass, merged, MS.vault.salt);
      sha = await putFile(path, blob, sha);
    }
    if (!MS.vault) return false;
    if ((MS.meta.dirty[MS.VAULT] || 0) === dirtyBefore) {
      MS.vault.doc = merged;
      delete MS.meta.dirty[MS.VAULT];
    } else {
      MS.vault.doc = merge(MS.vault.doc, merged);
    }
    MS.meta.shas[path] = sha;
    await MS.vaultApi.persist();
    return changed;
  }

  async function run() {
    const listing = (await api('spaces')) || [];
    const remoteShas = {};
    if (Array.isArray(listing)) {
      for (const f of listing) if (f.name.endsWith('.json')) remoteShas[f.name.slice(0, -5)] = f.sha;
    }
    let changed = false;
    for (const id of new Set([...Object.keys(MS.data.spaces), ...Object.keys(remoteShas)])) {
      if (await syncSpace(id, remoteShas[id])) changed = true;
    }
    if (await syncVault()) changed = true;
    MS.store.saveData();
    MS.store.saveMeta();
    return changed;
  }

  async function now() {
    if (!configured()) { state.status = 'off'; notify(false); return; }
    if (state.busy) { state.again = true; return; }
    state.busy = true;
    state.status = 'syncing';
    notify(false);
    let changed = false;
    try {
      try { changed = await run(); }
      catch (e) {
        // 409/422: файл успели изменить с другого компьютера. Один повтор с новыми версиями.
        if (e.status === 409 || e.status === 422) changed = await run();
        else throw e;
      }
      state.status = 'ok';
      state.error = '';
      backoffMs = 0;
      state.at = Date.now();
    } catch (e) {
      MS.store.saveData();
      MS.store.saveMeta();
      if (e.transient) {
        // Не сдаёмся и не пугаем пользователя: ждём всё дольше, до 30 минут.
        const wait = Math.max(e.retryAfter * 1000, backoffMs || 60000);
        backoffMs = Math.min(wait * 2, 30 * 60000);
        state.status = 'wait';
        state.error = `GitHub просит подождать. Повторю через ${Math.round(wait / 60000) || 1} мин.`;
        clearTimeout(timer);
        timer = setTimeout(now, wait);
      } else {
        state.status = 'error';
        state.error = e.message || 'Нет связи с GitHub';
      }
    }
    state.busy = false;
    notify(changed);
    if (state.again) { state.again = false; now(); }
  }

  function notify(changed) { if (MS.onSync) MS.onSync(changed); }

  let timer = 0;
  function schedule() {
    if (!configured()) return;
    clearTimeout(timer);
    timer = setTimeout(now, 4000);
  }

  MS.sync = { state, configured, now, schedule };

