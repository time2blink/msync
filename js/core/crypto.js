import { MS } from './state.js';
// Сейф: PBKDF2-SHA256 → AES-256-GCM. Пароль живёт только в памяти, пока сейф открыт.

  const ITER = 600000;
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const b64 = (u8) => {
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const unb64 = (s) => Uint8Array.from(atob(s.replace(/\s/g, '')), (c) => c.charCodeAt(0));

  const keyCache = new Map();

  async function key(pass, salt, iter) {
    const id = salt + ':' + iter;
    if (!keyCache.has(id)) {
      const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
      const k = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: unb64(salt), iterations: iter, hash: 'SHA-256' },
        base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      keyCache.set(id, k);
    }
    return keyCache.get(id);
  }

  async function encrypt(pass, obj, salt) {
    salt = salt || b64(crypto.getRandomValues(new Uint8Array(16)));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const k = await key(pass, salt, ITER);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, enc.encode(JSON.stringify(obj)));
    return { v: 1, kdf: 'PBKDF2-SHA256', iter: ITER, salt, iv: b64(iv), ct: b64(new Uint8Array(ct)) };
  }

  async function decrypt(pass, blob) {
    const k = await key(pass, blob.salt, blob.iter);
    try {
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.iv) }, k, unb64(blob.ct));
      return JSON.parse(dec.decode(pt));
    } catch (e) {
      // Ключ от неверного пароля не должен остаться в кэше и подставиться при следующей попытке.
      keyCache.delete(blob.salt + ':' + blob.iter);
      throw e;
    }
  }

  MS.b64 = b64;
  MS.unb64 = unb64;
  MS.crypto = { encrypt, decrypt };
  MS.vault = null; // { doc, pass, salt } пока открыт

  let chain = Promise.resolve();

  MS.vaultApi = {
    blob() { return MS.store.read(MS.store.LS.vault, null); },
    setBlob(b) { MS.store.write(MS.store.LS.vault, b); },
    exists() { return !!MS.vaultApi.blob(); },
    unlocked() { return !!MS.vault; },

    async create(pass) {
      const doc = MS.store.blankDoc(MS.VAULT, 'Сейф', MS.VAULT_COLOR, 999);
      const blob = await encrypt(pass, doc);
      MS.vaultApi.setBlob(blob);
      MS.vault = { doc, pass, salt: blob.salt };
      MS.store.save(MS.VAULT);
    },

    async unlock(pass) {
      const blob = MS.vaultApi.blob();
      const doc = await decrypt(pass, blob); // бросает ошибку при неверном пароле
      MS.store.migrate(doc);
      MS.vault = { doc, pass, salt: blob.salt };
    },

    lock() {
      MS.vault = null;
      keyCache.clear();
    },

    // Записи идут по очереди, чтобы более старая версия не легла поверх новой.
    persist() {
      chain = chain.then(async () => {
        if (!MS.vault) return;
        const blob = await encrypt(MS.vault.pass, MS.vault.doc, MS.vault.salt);
        if (MS.vault) MS.vaultApi.setBlob(blob);
      }).catch((e) => console.warn('Сейф не сохранён', e));
      return chain;
    },
  };

