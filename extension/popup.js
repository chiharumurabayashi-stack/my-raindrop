const API_KEY = 'AIzaSyBGcuc2uwBpFWGs31Duj4jIZRdA3Nxg_2Y';
const DOC_URL = `https://firestore.googleapis.com/v1/projects/my-raindrop/databases/(default)/documents/myraindrop/data?key=${API_KEY}`;

// ===== Firestore REST API ↔ JS 変換 =====
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
  } catch(e) { return ''; }
}

async function loadData() {
  const res = await fetch(DOC_URL);
  if (!res.ok) throw new Error('fetch failed');
  const json = await res.json();
  const fields = json.fields || {};
  bookmarks = fromFS(fields.bookmarks) || [];
  collections = fromFS(fields.collections) || [];
}

function buildCollectionSelect() {
  const sel = document.getElementById('f-col');
  sel.innerHTML = '<option value="">未分類</option>' +
    collections.filter(c => c.id !== 'all').map(c =>
      `<option value="${c.id}">${c.icon || ''} ${c.name}</option>`
    ).join('');
}

function checkAlreadyExists(url) {
  const exists = bookmarks.some(b => b.url === url);
  document.getElementById('already-msg').style.display = exists ? 'block' : 'none';
}

// ===== タグ chip 入力 =====
let selectedTags = [];

function renderTagChips() {
  document.getElementById('tag-chips').innerHTML = selectedTags.map((t, i) =>
    `<span class="tag-chip">${esc(t)}<button class="tag-chip-remove" onmousedown="event.preventDefault();removeTag(${i})">×</button></span>`
  ).join('');
}

function removeTag(i) {
  selectedTags.splice(i, 1);
  renderTagChips();
}

function addTag(tag) {
  const t = tag.trim();
  if (t && !selectedTags.includes(t)) { selectedTags.push(t); renderTagChips(); }
  document.getElementById('tag-text-input').value = '';
  showTagDropdown();
}

function onTagKeydown(e) {
  const inp = document.getElementById('tag-text-input');
  const val = inp.value.trim();
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    if (val) addTag(val);
  } else if (e.key === 'Backspace' && !val && selectedTags.length > 0) {
    selectedTags.pop();
    renderTagChips();
  }
}

function onTagInput() { showTagDropdown(); }

function showTagDropdown() {
  const inp = document.getElementById('tag-text-input');
  const query = inp.value.trim().toLowerCase();
  const freq = {};
  bookmarks.forEach(b => (b.tags || []).forEach(t => { freq[t] = (freq[t] || 0) + 1; }));
  let all = Object.keys(freq).sort((a, b) => freq[b] - freq[a]).filter(t => !selectedTags.includes(t));
  let filtered = query ? all.filter(t => t.toLowerCase().includes(query)) : all;

  const dd = document.getElementById('tag-dropdown');
  let html = '';

  if (!query) {
    // 最近のタグ
    const seen = new Set(); const recent = [];
    for (const b of [...bookmarks].reverse()) {
      for (const t of (b.tags || [])) {
        if (!seen.has(t) && !selectedTags.includes(t)) { seen.add(t); recent.push(t); }
        if (recent.length >= 5) break;
      }
      if (recent.length >= 5) break;
    }
    if (recent.length) {
      html += `<div class="tag-dropdown-section">最近の</div>`;
      html += recent.map(t => `<div class="tag-dropdown-item" onmousedown="event.preventDefault();addTag('${esc(t)}')">${esc(t)}</div>`).join('');
    }
    if (filtered.length) {
      html += `<div class="tag-dropdown-section">すべて</div>`;
      html += filtered.map(t => `<div class="tag-dropdown-item" onmousedown="event.preventDefault();addTag('${esc(t)}')">${esc(t)}<span class="tag-dropdown-count">${freq[t]}</span></div>`).join('');
    }
  } else {
    html += filtered.map(t => `<div class="tag-dropdown-item" onmousedown="event.preventDefault();addTag('${esc(t)}')">${esc(t)}<span class="tag-dropdown-count">${freq[t]}</span></div>`).join('');
    if (!freq[query]) html += `<div class="tag-dropdown-item" onmousedown="event.preventDefault();addTag('${esc(query)}')" style="color:#888">「${esc(query)}」を追加</div>`;
  }

  dd.innerHTML = html;
  dd.style.display = html ? 'block' : 'none';
}

function hideTagDropdown() {
  document.getElementById('tag-dropdown').style.display = 'none';
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===== 保存 =====
async function save() {
  const url = document.getElementById('f-url').value.trim();
  const title = document.getElementById('f-title').value.trim() || url;
  const col = document.getElementById('f-col').value;
  const inputVal = document.getElementById('tag-text-input').value.trim();
  if (inputVal && !selectedTags.includes(inputVal)) selectedTags.push(inputVal);
  if (!url) return;

  const btn = document.getElementById('btn-save');
  btn.disabled = true;
  btn.textContent = '保存中...';

  try {
    bookmarks.push({ id: Date.now(), url, title, collection: col, tags: [...selectedTags], thumb: faviconUrl(url) });

    const res = await fetch(DOC_URL, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { bookmarks: toFS(bookmarks), collections: toFS(collections) } })
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

// ===== 起動 =====
document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  document.getElementById('f-url').value = tab.url || '';
  document.getElementById('f-title').value = tab.title || '';

  const status = document.getElementById('status');
  status.textContent = '読み込み中...';
  try {
    await loadData();
    buildCollectionSelect();
    checkAlreadyExists(tab.url || '');
    status.textContent = '';
  } catch(e) {
    status.textContent = 'データの読み込みに失敗しました';
    status.className = 'status err';
  }

  document.getElementById('btn-save').addEventListener('click', save);
  document.getElementById('btn-cancel').addEventListener('click', () => window.close());
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing && document.activeElement.id !== 'tag-text-input') save();
  });
});
