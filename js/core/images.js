import { MS } from './state.js';
import './store.js';
import './sync.js';
// Картинки в заметках. Файл сжимается в браузере (до 1280 пикселей, JPEG) и хранится
// в приватном репозитории: images/<спейс>/<id>.jpg. В тексте заметки остаётся ссылка ![подпись](img:<id>).
// Картинки сейфа не загружаются: сейф шифруется целиком, а картинки в нём пока не поддерживаются.

const MAX_SIDE = 1280;
const MAX_BYTES = 1024 * 1024; // после сжатия не больше 1 МБ

async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') return createImageBitmap(file);
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// Сжатие: возвращает байты JPEG. Бросает ошибку, если файл не картинка или слишком большой.
export async function compress(file) {
  if (!file || !/^image\//.test(file.type)) throw new Error('Это не картинка');
  const img = await decodeImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
  if (!blob) throw new Error('Браузер не смог сжать картинку');
  if (blob.size > MAX_BYTES) throw new Error('Картинка слишком большая даже после сжатия');
  return new Uint8Array(await blob.arrayBuffer());
}

// Сохранить картинку спейса в репозиторий. Возвращает ссылку для текста заметки.
export async function addImage(spaceId, file) {
  if (spaceId === MS.VAULT) throw new Error('Картинки пока не добавляются в сейф');
  if (!MS.sync.configured()) throw new Error('Для картинок нужна настройка GitHub');
  const bytes = await compress(file);
  const id = MS.uid();
  await MS.sync.putBinary(`images/${spaceId}/${id}.jpg`, bytes);
  return `img:${id}`;
}

// Загрузить картинку для показа: возвращает адрес для <img> или null, если не получилось.
const cache = new Map();
export async function imageUrl(spaceId, id) {
  const key = spaceId + '/' + id;
  if (cache.has(key)) return cache.get(key);
  try {
    const bytes = await MS.sync.getBinary(`images/${spaceId}/${id}.jpg`);
    if (!bytes) return null;
    const url = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
    cache.set(key, url);
    return url;
  } catch {
    return null;
  }
}

export const images = { compress, addImage, imageUrl };
MS.images = images;
