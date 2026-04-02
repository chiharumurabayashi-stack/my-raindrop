const API_KEY = 'AIzaSyBGcuc2uwBpFWGs31Duj4jIZRdA3Nxg_2Y';
const DOC_URL = `https://firestore.googleapis.com/v1/projects/my-raindrop/databases/(default)/documents/myraindrop/data?key=${API_KEY}`;

// Firestore REST API ↔ JS 変換
function fromFS(val) {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return val.doubleValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(fromFS);
  if ('mapValue' in val) {
    const obj = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) obj[k] = fromFS(v);
    return obj;
  }
  return null;
}

function toFS(val) {
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'number' && Number.isInteger(val)) return { integerValue: String(val) };
  if (typeof val === 'number') return { doubleValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (val === null || val === undefined) return { nullValue: null };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(toFS) } };
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) fields[k] = toFS(v);
    return { mapValue: { fields } };
  }
  return { nullValue: null };
}

let collections = [];
let bookmarks = [];

function faviconUrl(url) {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  } catch(e) { return '🌐'; }
}

async function loadData() {
  const res = await fetch(DOC_URL);
  if (!res.ok) throw new Error('fetch failed');
  const json = await res.json();
  const fields = json.fields || {};
  bookmarks = fromFS(fields.bookmarks) || [];
  collections = fromFS(fields.collections) || [];
}

function buildCollectionSelect(activeColId) {
  const sel = document.getElementById('f-col');
  sel.innerHTML = '<option value="">未分類</option>' +
    collections.filter(c => c.id !== 'all').map(c =>
      `<option value="${c.id}"${c.id === activeColId ? ' selected' : ''}>${c.icon || ''} ${c.name}</option>`
    ).join('');
}

function checkAlreadyExists(url) {
  const exists = bookmarks.some(b => b.url === url);
  document.getElementById('already-msg').style.display = exists ? 'block' : 'none';
}

async function save() {
  const url = document.getElementById('f-url').value.trim();
  const title = document.getElementById('f-title').value.trim() || url;
  const col = document.getElementById('f-col').value;
  const tagsRaw = document.getElementById('f-tags').value;
  const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
  if (!url) return;

  const btn = document.getElementById('btn-save');
  btn.disabled = true;
  btn.textContent = '保存中...';

  try {
    const newBookmark = {
      id: Date.now(),
      url,
      title,
      collection: col,
      tags,
      thumb: faviconUrl(url)
    };

    bookmarks.push(newBookmark);

    const body = {
      fields: {
        bookmarks: toFS(bookmarks),
        collections: toFS(collections)
      }
    };

    const res = await fetch(DOC_URL, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error('save failed');

    const status = document.getElementById('status');
    status.textContent = '✓ 保存しました';
    status.className = 'status ok';
    setTimeout(() => window.close(), 900);
  } catch(e) {
    const status = document.getElementById('status');
    status.textContent = '保存に失敗しました。再試行してください。';
    status.className = 'status err';
    btn.disabled = false;
    btn.textContent = '保存';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // 現在のタブ情報を取得
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  document.getElementById('f-url').value = tab.url || '';
  document.getElementById('f-title').value = tab.title || '';

  const status = document.getElementById('status');
  status.textContent = '読み込み中...';

  try {
    await loadData();
    buildCollectionSelect('');
    checkAlreadyExists(tab.url || '');
    status.textContent = '';
  } catch(e) {
    status.textContent = 'データの読み込みに失敗しました';
    status.className = 'status err';
  }

  document.getElementById('btn-save').addEventListener('click', save);
  document.getElementById('btn-cancel').addEventListener('click', () => window.close());

  // Enterキーで保存
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing) save();
  });
});
