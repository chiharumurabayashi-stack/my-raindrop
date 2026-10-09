// Browse controls only store presentation preferences locally; bookmark data stays in Firestore.
const VIEW_KEY = 'myraindrop_views_v1';
const browse = {
  preferences: BookmarkLibrary.readPreferences(localStorage.getItem(VIEW_KEY)),
  favorites: false, untagged: false, menu: 'root', open: false, selected: -1, previousQuery: '',
};
const uiEscape = BookmarkLibrary.escapeHTML;
function currentView() { return BookmarkLibrary.viewFor(browse.preferences, state.activeCollection); }
function searchQuery() {
  const value = document.getElementById('search-input').value;
  return value.startsWith('#') ? browse.previousQuery : value;
}
function currentFilters(overrides = {}) {
  return { collection: state.activeCollection, tags: state.activeTags, favorites: browse.favorites,
    untagged: browse.untagged, query: searchQuery(), ...overrides };
}
function visibleBookmarks(overrides) { return BookmarkLibrary.filterBookmarks(state.bookmarks, currentFilters(overrides)); }
function persistActiveTags() {
  localStorage.setItem('active_tags', JSON.stringify(state.activeTags));
  localStorage.removeItem('active_tag');
}
function searchOption(label, count, action, value = '', icon = '#') {
  return `<button type="button" role="option" tabindex="-1" aria-selected="false" class="search-option" data-action="${action}" data-value="${uiEscape(value)}"><span class="option-icon" aria-hidden="true">${icon}</span><span class="option-label">${uiEscape(label)}</span><span class="count">${count ?? ''}</span></button>`;
}
function renderSearchMenu() {
  const input = document.getElementById('search-input');
  const menu = document.getElementById('search-menu');
  menu.hidden = !browse.open;
  input.setAttribute('aria-expanded', String(browse.open));
  document.getElementById('search-filter-button').setAttribute('aria-expanded', String(browse.open));
  if (!browse.open) return;
  const isTag = input.value.startsWith('#') || browse.menu === 'tags';
  let html = '';
  if (isTag) {
    const query = input.value.startsWith('#') ? input.value.slice(1).trim() : '';
    const tags = BookmarkLibrary.tagCounts(visibleBookmarks(), query).filter(([tag]) => !state.activeTags.includes(tag));
    html = '<div class="menu-label">タグで絞り込み</div>' + searchOption('条件の一覧に戻る', '', 'back', '', '‹')
      + tags.map(([tag, count]) => searchOption(tag, count, 'tag', tag)).join('');
    if (!tags.length) html += '<div class="menu-label">一致するタグはありません</div>';
  } else if (browse.menu === 'collections') {
    const candidates = visibleBookmarks({collection: 'all'});
    html = '<div class="menu-label">コレクションを選択</div>' + searchOption('条件の一覧に戻る', '', 'back', '', '‹')
      + state.collections.filter(c => c.id !== 'all').map(c => searchOption(c.name,
        candidates.filter(b => b.collection === c.id).length, 'collection', c.id, '▱')).join('');
  } else {
    const items = visibleBookmarks();
    html = '<div class="menu-label">絞り込み検索</div>'
      + searchOption('お気に入り', items.filter(b => b.pinned).length, 'favorites', '', '♡')
      + searchOption('タグ', BookmarkLibrary.tagCounts(items).length, 'tags')
      + searchOption('コレクション', state.collections.filter(c => c.id !== 'all').length, 'collections', '', '▱')
      + searchOption('未分類', visibleBookmarks({collection:'__unclassified__'}).length, 'collection', '__unclassified__', '▱')
      + searchOption('タグなし', items.filter(b => !b.tags?.length).length, 'untagged', '', '#');
  }
  menu.innerHTML = html + '<div class="search-hint">文字検索と組み合わせて絞り込めます。<br>↑ ↓ で選択、Enter で決定、Esc で閉じる</div>';
  browse.selected = -1;
  input.removeAttribute('aria-activedescendant');
  menu.querySelectorAll('[role=option]').forEach((el, i) => el.id = 'search-option-' + i);
}
function openSearchMenu() {
  closeViewMenu();
  browse.open = true;
  renderSearchMenu();
}
function closeSearchMenu() {
  const input = document.getElementById('search-input');
  if (input.value.startsWith('#')) input.value = browse.previousQuery;
  browse.open = false; browse.menu = 'root'; browse.selected = -1;
  input.removeAttribute('aria-activedescendant');
  renderSearchMenu();
}
function selectSearchOption(button) {
  const {action, value} = button.dataset;
  const input = document.getElementById('search-input');
  if (['tags', 'collections', 'back'].includes(action)) {
    if (action === 'tags') { browse.previousQuery = searchQuery(); input.value = '#'; }
    else if (input.value.startsWith('#')) input.value = browse.previousQuery;
    browse.menu = action === 'back' ? 'root' : action;
    input.focus(); browse.open = true; renderSearchMenu(); return;
  }
  if (action === 'tag') {
    if (!state.activeTags.includes(value)) state.activeTags.push(value);
    browse.untagged = false;
  }
  if (action === 'favorites') browse.favorites = true;
  if (action === 'untagged') { browse.untagged = true; state.activeTags = []; }
  if (action === 'collection') {
    state.activeCollection = value;
    localStorage.setItem('active_collection', value);
  }
  persistActiveTags();
  closeSearchMenu();
  renderSidebar(); renderCards();
  input.focus(); closeSearchMenu();
}
function onSearchInput() {
  const input = document.getElementById('search-input');
  if (!input.value.startsWith('#')) { browse.previousQuery = input.value; browse.menu = 'root'; }
  browse.open = true; renderCards();
}
function onSearchKeydown(event) {
  const options = [...document.querySelectorAll('#search-menu [role=option]')];
  if (event.key === 'Escape') { closeSearchMenu(); return; }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    if (!browse.open) { openSearchMenu(); return; }
    if (!options.length) return;
    browse.selected = (browse.selected + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
    options.forEach((el, i) => el.setAttribute('aria-selected', String(i === browse.selected)));
    const active = options[browse.selected];
    event.target.setAttribute('aria-activedescendant', active.id);
    active.scrollIntoView({block:'nearest'});
  } else if (event.key === 'Enter') {
    event.preventDefault();
    if (browse.open && options[browse.selected]) selectSearchOption(options[browse.selected]);
    else if (event.target.value.startsWith('#')) {
      const exact = options.find(el => el.dataset.action === 'tag' && el.dataset.value.toLowerCase() === event.target.value.slice(1).trim().toLowerCase());
      if (exact) selectSearchOption(exact);
    } else closeSearchMenu();
  } else if (event.key === 'Tab') closeSearchMenu();
}
function resetBrowseFilters() {
  state.activeTags = []; browse.favorites = false; browse.untagged = false; browse.previousQuery = '';
  document.getElementById('search-input').value = '';
  persistActiveTags(); closeSearchMenu();
}
function removeBrowseFilter(action, value) {
  if (action === 'tag') state.activeTags = state.activeTags.filter(t => t !== value);
  if (action === 'favorites') browse.favorites = false;
  if (action === 'untagged') browse.untagged = false;
  if (action === 'all') resetBrowseFilters();
  persistActiveTags(); renderSidebar(); renderCards();
}
function renderBrowseChrome(count) {
  const title = state.activeCollection === 'all' ? 'すべてのブックマーク'
    : state.activeCollection === '__favorites__' ? 'お気に入り'
    : state.activeCollection === '__unclassified__' ? '未分類'
    : state.collections.find(c => c.id === state.activeCollection)?.name || 'ブックマーク';
  document.getElementById('browse-title').textContent = title;
  document.getElementById('result-count').textContent = count + '件';
  const chips = state.activeTags.map(tag => ({label:'# ' + tag, action:'tag', value:tag}));
  if (browse.favorites && state.activeCollection !== '__favorites__') chips.unshift({label:'♡ お気に入り',action:'favorites'});
  if (browse.untagged) chips.push({label:'タグなし', action:'untagged'});
  const wrap = document.getElementById('filter-chips');
  wrap.hidden = !chips.length;
  wrap.innerHTML = chips.map(c => `<button class="filter-chip" data-remove="${c.action}" data-value="${uiEscape(c.value || '')}" aria-label="${uiEscape(c.label)}の条件を外す"><span>${uiEscape(c.label)}</span><span aria-hidden="true">×</span></button>`).join('')
    + (chips.length ? '<button class="filter-reset" data-remove="all">条件をクリア</button>' : '');
  document.getElementById('view-button').textContent = BookmarkLibrary.layouts[currentView().layout] + ' ▾';
  document.getElementById('search-clear').hidden = !document.getElementById('search-input').value;
  renderSearchMenu();
}
function closeViewMenu() {
  document.getElementById('view-menu').hidden = true;
  document.getElementById('view-button').setAttribute('aria-expanded','false');
}
function renderViewMenu() {
  const view = currentView(), options = view.options[view.layout];
  const labels = {cover:'画像',title:'タイトル',tags:'タグ',description:'説明・要約',url:'URL'};
  document.getElementById('view-menu').innerHTML = '<div class="menu-label">表示方法</div>'
    + Object.entries(BookmarkLibrary.layouts).map(([key,label]) => `<label><input type="radio" name="layout" value="${key}" ${view.layout === key ? 'checked' : ''}>${label}</label>`).join('')
    + '<hr><div class="menu-label">' + BookmarkLibrary.layouts[view.layout] + 'で表示</div>'
    + BookmarkLibrary.fields.map(key => `<label><input type="checkbox" data-field="${key}" ${options[key] ? 'checked' : ''} ${key === 'cover' && view.layout === 'headlines' || key === 'title' && !options.cover ? 'disabled' : ''}>${labels[key]}</label>`).join('')
    + (view.layout === 'list' && options.cover ? '<hr><div class="menu-label">画像の位置</div>' + ['left','right'].map(side => `<label><input type="radio" name="coverSide" value="${side}" ${options.coverSide === side ? 'checked' : ''}>${side === 'left' ? '左' : '右'}</label>`).join('') : '')
    + '<hr><button class="btn btn-sm btn-block" data-apply-all>すべてに適用</button><div class="menu-label">表示設定はこのブラウザに保存されます</div>';
}
function saveView(view, all = false) {
  const normalized = BookmarkLibrary.normalizeView(view);
  if (all) browse.preferences = {defaults:normalized, collections:{}};
  else Object.defineProperty(browse.preferences.collections, state.activeCollection, {value:normalized,writable:true,enumerable:true,configurable:true});
  localStorage.setItem(VIEW_KEY, JSON.stringify(browse.preferences));
  renderCards(); renderViewMenu();
}
function initBrowse() {
  const input = document.getElementById('search-input');
  input.addEventListener('focus', openSearchMenu);
  input.addEventListener('click', () => { if (!browse.open) openSearchMenu(); });
  input.addEventListener('input', onSearchInput);
  input.addEventListener('keydown', onSearchKeydown);
  document.getElementById('search-filter-button').addEventListener('click', () => {
    if (browse.open) closeSearchMenu(); else { input.focus(); openSearchMenu(); }
  });
  document.getElementById('search-clear').addEventListener('click', () => {
    input.value = ''; browse.previousQuery = ''; browse.menu = 'root'; input.focus(); renderCards();
  });
  document.getElementById('search-menu').addEventListener('mousedown', e => e.preventDefault());
  document.getElementById('search-menu').addEventListener('click', e => {
    e.stopPropagation();
    const option = e.target.closest('[data-action]'); if (option) selectSearchOption(option);
  });
  document.getElementById('filter-chips').addEventListener('click', e => {
    const button = e.target.closest('[data-remove]'); if (button) removeBrowseFilter(button.dataset.remove, button.dataset.value);
  });
  document.getElementById('view-button').addEventListener('click', () => {
    const menu = document.getElementById('view-menu');
    if (!menu.hidden) return closeViewMenu();
    closeSearchMenu(); renderViewMenu(); menu.hidden = false;
    document.getElementById('view-button').setAttribute('aria-expanded','true');
  });
  document.getElementById('view-menu').addEventListener('change', e => {
    const view = currentView(), el = e.target;
    if (el.name === 'layout') view.layout = el.value;
    else if (el.name === 'coverSide') view.options[view.layout].coverSide = el.value;
    else if (el.dataset.field) view.options[view.layout][el.dataset.field] = el.checked;
    const selector = el.name ? `input[name="${el.name}"][value="${el.value}"]` : `input[data-field="${el.dataset.field}"]`;
    saveView(view);
    document.querySelector('#view-menu ' + selector)?.focus();
  });
  document.getElementById('view-menu').addEventListener('click', e => {
    e.stopPropagation();
    if (e.target.closest('[data-apply-all]')) {
      saveView(currentView(), true);
      document.querySelector('[data-apply-all]').textContent = 'すべてに適用しました';
    }
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrap')) closeSearchMenu();
    if (!e.target.closest('.view-wrap')) closeViewMenu();
    const tag = e.target.closest('[data-filter-tag]'); if (tag) setTag(tag.dataset.filterTag);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!document.getElementById('view-menu').hidden) { closeViewMenu(); document.getElementById('view-button').focus(); }
      closeSearchMenu();
    }
  });
}
