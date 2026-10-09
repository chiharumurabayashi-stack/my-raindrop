(function(root) {
  'use strict';
  const layouts = { list: 'リスト', card: 'カード', headlines: 'ヘッドライン', moodboard: 'ムードボード' };
  const fields = ['cover', 'title', 'tags', 'description', 'url'];
  function defaults() {
    return { layout: 'list', options: Object.fromEntries(Object.keys(layouts).map(mode => [mode, {
      cover: mode !== 'headlines', title: true, tags: mode !== 'headlines',
      description: false, url: mode !== 'moodboard', coverSide: 'left',
    }])) };
  }
  function normalizeView(value) {
    const result = defaults();
    if (value && Object.hasOwn(layouts, value.layout)) result.layout = value.layout;
    for (const mode of Object.keys(layouts)) {
      const saved = value?.options?.[mode];
      for (const key of fields) if (typeof saved?.[key] === 'boolean') result.options[mode][key] = saved[key];
      if (saved?.coverSide === 'right') result.options[mode].coverSide = 'right';
      if (mode === 'headlines') result.options[mode].cover = false;
      if (!result.options[mode].cover) result.options[mode].title = true;
    }
    return result;
  }
  function readPreferences(text) {
    try {
      const raw = JSON.parse(text);
      return { defaults: normalizeView(raw?.defaults), collections: Object.fromEntries(
        Object.entries(raw?.collections || {}).map(([id, view]) => [id, normalizeView(view)])) };
    } catch { return { defaults: defaults(), collections: {} }; }
  }
  function viewFor(preferences, collection) {
    return normalizeView(Object.hasOwn(preferences.collections, collection) ? preferences.collections[collection] : preferences.defaults);
  }
  function filterBookmarks(bookmarks, { collection = 'all', tags = [], favorites = false, untagged = false, query = '' } = {}) {
    const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return bookmarks.filter(b => {
      if (collection === '__favorites__' && !b.pinned) return false;
      if (collection === '__unclassified__' && b.collection) return false;
      if (!['all', '__home__', '__favorites__', '__unclassified__'].includes(collection) && b.collection !== collection) return false;
      if (favorites && !b.pinned || untagged && b.tags?.length) return false;
      if (!tags.every(tag => (b.tags || []).includes(tag))) return false;
      const text = [b.title, b.url, b.summary, ...(b.tags || [])].join(' ').toLocaleLowerCase();
      return words.every(word => text.includes(word));
    });
  }
  function tagCounts(bookmarks, query = '') {
    const counts = new Map();
    for (const b of bookmarks) for (const tag of new Set(b.tags || [])) counts.set(tag, (counts.get(tag) || 0) + 1);
    return [...counts].filter(([tag]) => tag.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
      .sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'));
  }
  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function safeURL(value) {
    try { const url = new URL(value); return /^https?:$/.test(url.protocol) ? url.href : ''; } catch { return ''; }
  }
  const api = { layouts, fields, defaults, normalizeView, readPreferences, viewFor, filterBookmarks, tagCounts, escapeHTML, safeURL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BookmarkLibrary = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
