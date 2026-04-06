const FIREBASE_KEY = 'AIzaSyBGcuc2uwBpFWGs31Duj4jIZRdA3Nxg_2Y';
const DOC_URL = `https://firestore.googleapis.com/v1/projects/my-raindrop/databases/(default)/documents/myraindrop/data?key=${FIREBASE_KEY}`;

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

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function faviconUrl(url) {
  try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=128`; }
  catch(e) { return ''; }
}

let collections = [];
let bookmarks = [];
let selectedTags = [];
let pendingSummary = '';

// ===== Firestore 読み込み =====
async function loadData() {
  const res = await fetch(DOC_URL);
  if (!res.ok) throw new Error('fetch failed');
  const json = await res.json();
  bookmarks   = fromFS((json.fields || {}).bookmarks)   || [];
  collections = fromFS((json.fields || {}).collections) || [];
}

// ===== コレクション =====
function buildCollectionSelect(selectedId) {
  const sel = document.getElementById('f-col');
  sel.innerHTML =
    '<option value="">未分類</option>' +
    collections.filter(c => c.id !== 'all').map(c =>
      `<option value="${esc(c.id)}"${c.id === selectedId ? ' selected' : ''}>${esc((c.icon||'') + ' ' + c.name)}</option>`
    ).join('');
}

// ===== タグ chip =====
function renderTagChips() {
  document.getElementById('tag-chips').innerHTML = selectedTags.map((t, i) =>
    `<span class="tag-chip" data-index="${i}">${esc(t)}<button class="tag-chip-remove" data-index="${i}">×</button></span>`
  ).join('');
}

function addTag(tag) {
  const t = tag.trim();
  if (t && !selectedTags.includes(t)) { selectedTags.push(t); renderTagChips(); }
  document.getElementById('tag-text-input').value = '';
  renderDropdown('');
}

function removeTag(i) {
  selectedTags.splice(i, 1);
  renderTagChips();
}

function setTags(tags) {
  selectedTags = [...tags];
  renderTagChips();
}

// ===== ドロップダウン =====
function renderDropdown(query) {
  const q = query.toLowerCase();
  const freq = {};
  bookmarks.forEach(b => (b.tags || []).forEach(t => { freq[t] = (freq[t] || 0) + 1; }));
  let all = Object.keys(freq).sort((a, b) => freq[b] - freq[a]).filter(t => !selectedTags.includes(t));
  const filtered = q ? all.filter(t => t.toLowerCase().includes(q)) : all;

  const dd = document.getElementById('tag-dropdown');
  let html = '';

  if (!q) {
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
      html += recent.map(t => `<div class="tag-dropdown-item" data-tag="${esc(t)}">${esc(t)}</div>`).join('');
    }
    if (filtered.length) {
      html += `<div class="tag-dropdown-section">すべて</div>`;
      html += filtered.map(t => `<div class="tag-dropdown-item" data-tag="${esc(t)}">${esc(t)}<span class="tag-dropdown-count">${freq[t]}</span></div>`).join('');
    }
  } else {
    html += filtered.map(t => `<div class="tag-dropdown-item" data-tag="${esc(t)}">${esc(t)}<span class="tag-dropdown-count">${freq[t]}</span></div>`).join('');
    if (!freq[q] && q) html += `<div class="tag-dropdown-item" data-tag="${esc(q)}" style="color:#888">「${esc(q)}」を追加</div>`;
  }

  dd.innerHTML = html;
  dd.style.display = html ? 'block' : 'none';
}

function hideDropdown() {
  document.getElementById('tag-dropdown').style.display = 'none';
}

// ===== AI 自動入力 =====
async function aiFill() {
  const { geminiKey } = await chrome.storage.local.get('geminiKey');
  if (!geminiKey) {
    // 設定パネルを開いて知らせる
    document.getElementById('settings-box').style.display = 'block';
    document.getElementById('gemini-key-input').focus();
    document.getElementById('status').textContent = '⚙️ まずGemini APIキーを設定してください';
    document.getElementById('status').className = 'status err';
    return;
  }

  const url   = document.getElementById('f-url').value.trim();
  const title = document.getElementById('f-title').value.trim();
  if (!url) return;

  const btn = document.getElementById('btn-ai-fill');
  btn.disabled = true;
  btn.textContent = '✨ 解析中...';
  document.getElementById('status').textContent = '';
  document.getElementById('status').className = 'status';

  try {
    // 現在のタブからページ本文を直接取得（corsproxy不要）
    let pageText = '';
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const clone = document.cloneNode(true);
          clone.querySelectorAll('script,style,nav,footer,header,aside').forEach(el => el.remove());
          return (clone.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 3000);
        }
      });
      pageText = results?.[0]?.result || '';
    } catch(e) {}

    const existingCollections = collections.filter(c => c.id !== 'all').map(c => c.name).join(', ');
    const existingTags = [...new Set(bookmarks.flatMap(b => b.tags || []))].slice(0, 40).join(', ');

    const prompt = `以下のWebページについて、ブックマーク管理アプリ用にJSON形式で回答してください。

URL: ${url}
タイトル: ${title || '（未取得）'}
本文抜粋: ${pageText || '（取得できませんでした）'}

既存のコレクション: ${existingCollections}
既存のタグ: ${existingTags}

以下のJSON形式のみで回答（他の文字は一切含めない）:
{
  "collection": "最も適切なコレクション名（既存から選ぶか、新規名を提案）",
  "tags": ["タグ1", "タグ2", "タグ3"],
  "summary": "このページの内容を日本語で2〜3文で要約"
}

注意:
- collectionは既存のコレクションから最適なものを選ぶ。どれも合わない場合は新しい名前を提案
- tagsは既存タグを優先しつつ、内容に合ったものを3〜5個
- summaryは日本語で簡潔に`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }

    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('レスポンスの解析に失敗しました');
    const result = JSON.parse(match[0]);

    // コレクション選択を更新
    if (result.collection) {
      const sel = document.getElementById('f-col');
      const existingOpt = [...sel.options].find(o => o.value === result.collection || o.text.includes(result.collection));
      if (existingOpt) {
        sel.value = existingOpt.value;
      } else {
        const opt = document.createElement('option');
        opt.value = result.collection;
        opt.text = `${result.collection}（新規）`;
        opt.selected = true;
        sel.appendChild(opt);
      }
    }

    // タグをセット
    if (Array.isArray(result.tags)) setTags(result.tags);

    // 要約を表示・保存
    if (result.summary) {
      pendingSummary = result.summary;
      document.getElementById('ai-summary-text').textContent = result.summary;
      document.getElementById('field-summary').style.display = 'block';
    }

  } catch(e) {
    document.getElementById('status').textContent = `AI失敗: ${e.message}`;
    document.getElementById('status').className = 'status err';
  } finally {
    btn.disabled = false;
    btn.textContent = '✨ AIでタグ・コレクション・要約を自動入力';
  }
}

// ===== 保存 =====
async function save() {
  const url   = document.getElementById('f-url').value.trim();
  const title = document.getElementById('f-title').value.trim() || url;
  const col   = document.getElementById('f-col').value;
  const inputVal = document.getElementById('tag-text-input').value.trim();
  if (inputVal && !selectedTags.includes(inputVal)) selectedTags.push(inputVal);
  if (!url) return;

  const btn = document.getElementById('btn-save');
  btn.disabled = true; btn.textContent = '保存中...';

  try {
    const bookmark = { id: Date.now(), url, title, collection: col, tags: [...selectedTags], thumb: faviconUrl(url) };
    if (pendingSummary) bookmark.summary = pendingSummary;
    bookmarks.push(bookmark);
    const res = await fetch(DOC_URL, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { bookmarks: toFS(bookmarks), collections: toFS(collections) } })
    });
    if (!res.ok) throw new Error();
    const st = document.getElementById('status');
    st.textContent = '✓ 保存しました'; st.className = 'status ok';
    setTimeout(() => window.close(), 900);
  } catch(e) {
    const st = document.getElementById('status');
    st.textContent = '保存に失敗しました'; st.className = 'status err';
    btn.disabled = false; btn.textContent = '保存';
  }
}

// ===== 起動 =====
document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  document.getElementById('f-url').value   = tab.url   || '';
  document.getElementById('f-title').value = tab.title || '';

  const st = document.getElementById('status');
  st.textContent = '読み込み中...';
  try {
    await loadData();
    buildCollectionSelect('');
    const exists = bookmarks.some(b => b.url === tab.url);
    document.getElementById('already-msg').style.display = exists ? 'block' : 'none';
    st.textContent = '';
  } catch(e) {
    st.textContent = 'データ読み込み失敗'; st.className = 'status err';
  }

  // 設定パネルの開閉
  document.getElementById('settings-toggle').addEventListener('click', () => {
    const box = document.getElementById('settings-box');
    const open = box.style.display === 'block';
    box.style.display = open ? 'none' : 'block';
    if (!open) {
      chrome.storage.local.get('geminiKey', ({ geminiKey }) => {
        document.getElementById('gemini-key-input').value = geminiKey || '';
      });
    }
  });

  document.getElementById('save-key-btn').addEventListener('click', () => {
    const key = document.getElementById('gemini-key-input').value.trim();
    chrome.storage.local.set({ geminiKey: key }, () => {
      document.getElementById('settings-box').style.display = 'none';
      document.getElementById('status').textContent = key ? '✓ APIキーを保存しました' : 'APIキーを削除しました';
      document.getElementById('status').className = 'status ok';
      setTimeout(() => { document.getElementById('status').textContent = ''; document.getElementById('status').className = 'status'; }, 2000);
    });
  });

  // AI ボタン
  document.getElementById('btn-ai-fill').addEventListener('click', aiFill);

  // タグ入力ラップ → フォーカス
  document.getElementById('tag-input-wrap').addEventListener('click', () => {
    document.getElementById('tag-text-input').focus();
  });

  const tagInput = document.getElementById('tag-text-input');
  tagInput.addEventListener('focus', () => renderDropdown(tagInput.value));
  tagInput.addEventListener('input', () => renderDropdown(tagInput.value));
  tagInput.addEventListener('blur',  () => setTimeout(hideDropdown, 150));
  tagInput.addEventListener('keydown', e => {
    const val = tagInput.value.trim();
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (val) addTag(val);
    } else if (e.key === 'Backspace' && !val && selectedTags.length > 0) {
      selectedTags.pop(); renderTagChips();
    }
  });

  document.getElementById('tag-chips').addEventListener('mousedown', e => {
    const btn = e.target.closest('.tag-chip-remove');
    if (btn) { e.preventDefault(); removeTag(Number(btn.dataset.index)); }
  });

  document.getElementById('tag-dropdown').addEventListener('mousedown', e => {
    const item = e.target.closest('.tag-dropdown-item');
    if (item) { e.preventDefault(); addTag(item.dataset.tag); }
  });

  document.getElementById('btn-save').addEventListener('click', save);
  document.getElementById('btn-cancel').addEventListener('click', () => window.close());
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing && document.activeElement.id !== 'tag-text-input') save();
  });
});
