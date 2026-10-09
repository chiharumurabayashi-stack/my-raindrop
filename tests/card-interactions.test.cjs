const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const BookmarkLibrary = require('../library.js');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const dragCode = html.split('// ========== ドラッグ＆ドロップ ==========')[1]
  .split('// コレクション並び替え')[0];
function runtime(extra = {}) {
  const context = vm.createContext({
    document: { addEventListener() {}, querySelectorAll: () => [] },
    getComputedStyle: () => ({ rowGap: '12px', columnGap: '12px' }),
    ...extra,
  });
  vm.runInContext(dragCode, context);
  return context;
}

test('inserts before/after in both directions without the old index shift', () => {
  const { moveBookmark } = runtime();
  for (const [from, to, before, expected] of [
    [1, 3, true, [2, 1, 3, 4]], [1, 3, false, [2, 3, 1, 4]],
    [4, 2, true, [1, 4, 2, 3]], [4, 2, false, [1, 2, 4, 3]],
    [4, 1, true, [4, 1, 2, 3]], [1, 4, false, [2, 3, 4, 1]],
  ]) {
    const items = [1, 2, 3, 4].map(id => ({ id }));
    assert.equal(moveBookmark(items, from, to, before), true);
    assert.deepEqual(items.map(b => b.id), expected);
  }
});

test('same slot, same card, and missing source leave the list unchanged', () => {
  const { moveBookmark } = runtime();
  for (const [from, to, before] of [[1, 2, true], [2, 1, false], [1, 1, true], [9, 2, false]]) {
    const items = [1, 2, 3].map(id => ({ id }));
    assert.equal(moveBookmark(items, from, to, before), false);
    assert.deepEqual(items.map(b => b.id), [1, 2, 3]);
  }
});

function gridFixture(columns) {
  const cards = [1, 2, 3, 4].map((id, i) => {
    const left = (i % columns) * 212, top = Math.floor(i / columns) * 312;
    return { dataset: { bookmarkId: String(id) }, getBoundingClientRect: () =>
      ({ left, top, right: left + 200, bottom: top + 300, width: 200, height: 300 }) };
  });
  return { dataset: {}, querySelectorAll: () => cards };
}

test('drop position handles card halves, gaps, row wrap, and single column', () => {
  const { getCardDropPosition: position } = runtime();
  const grid = gridFixture(2);
  assert.equal(position(grid, 220, 100).before, true);
  assert.equal(position(grid, 390, 100).before, false);
  const gap = position(grid, 206, 100);
  assert.equal(gap.left, 204.5);
  assert.equal(gap.width, 3);
  assert.equal(position(grid, 10, 350).targetId, 3);
  assert.equal(position(grid, 10, 350).before, true);
  const single = position(gridFixture(1), 80, 590);
  assert.equal(single.targetId, 2);
  assert.equal(single.before, false);
  assert.equal(single.height, 3);
});

test('favorites drop persists visible order without changing ordinary list order', async () => {
  const grid = gridFixture(2);
  grid.dataset.orderKey = 'quickAccessOrder';
  let saves = 0;
  const state = { bookmarks: [1, 2, 3, 4].map(id => ({ id, pinned:true })) };
  const ctx = runtime({ state, renderSidebar() {}, renderCards() {}, saveToFirestore: async () => { saves++; } });
  ctx.grid = grid;
  vm.runInContext('draggingBookmarkId = 1; dragSourceGrid = grid;', ctx);
  await ctx.cardDrop({ target: { closest: () => grid }, clientX: 390, clientY: 350,
    preventDefault() {}, stopPropagation() {} });
  assert.deepEqual(state.bookmarks.map(b => b.id), [1, 2, 3, 4]);
  assert.deepEqual([...state.bookmarks].sort((a, b) => a.quickAccessOrder - b.quickAccessOrder).map(b => b.id), [2, 3, 4, 1]);
  assert.equal(saves, 1);
});

test('filtered favorites keep unique positions for hidden items', async () => {
  const grid = gridFixture(2);
  grid.dataset.orderKey = 'quickAccessOrder';
  const state = { bookmarks:[1,2,3,4,5].map((id,i)=>({id,pinned:true,quickAccessOrder:i})) };
  const ctx = runtime({state,renderSidebar(){},renderCards(){},saveToFirestore:async()=>{}});
  ctx.grid=grid;
  vm.runInContext('draggingBookmarkId=1;dragSourceGrid=grid;',ctx);
  await ctx.cardDrop({target:{closest:()=>grid},clientX:390,clientY:350,preventDefault(){},stopPropagation(){}});
  assert.deepEqual([...state.bookmarks].sort((a,b)=>a.quickAccessOrder-b.quickAccessOrder).map(b=>b.id),[2,3,4,1,5]);
  assert.equal(new Set(state.bookmarks.map(b=>b.quickAccessOrder)).size,5);
});

test('insertion line follows zero-gap list rows and the nearest masonry column', () => {
  const ctx=runtime({getComputedStyle:()=>({rowGap:'0px',columnGap:'12px'})});
  assert.equal(ctx.getCardDropPosition(gridFixture(1),80,590).top,610.5);
  const card=(id,left,top,height)=>({dataset:{bookmarkId:String(id)},getBoundingClientRect:()=>({left,top,right:left+200,bottom:top+height,width:200,height})});
  const grid={dataset:{layout:'moodboard'},querySelectorAll:()=>[card(1,0,0,100),card(2,0,112,100),card(3,212,0,250)]};
  const position=ctx.getCardDropPosition(grid,100,106);
  assert.equal(position.targetId,1);
  assert.equal(position.height,3);
});

test('cards use accessible thumbnail links and have no open button', () => {
  const ctx = vm.createContext({ BookmarkLibrary, uiEscape: BookmarkLibrary.escapeHTML });
  vm.runInContext('function cardHTML(' + html.split('function cardHTML(')[1].split('function renderCards()')[0], ctx);
  for (const thumb of ['https://example.com/image.png', '🌐', '']) {
    const card = ctx.cardHTML({ id: 1, url: 'https://example.com/?a=1&b=2', title: 'Test "page"', thumb });
    assert.match(card, /<a class="card-thumb"/);
    assert.match(card, /target="_blank" rel="noopener" draggable="false"/);
    assert.match(card, /aria-label="Test &quot;page&quot;（新しいタブで開く）"/);
    assert.match(card, /onclick="recordOpen\(1\)"/);
    assert.doesNotMatch(card, /card-open-link/);
  }
});

test('opening a thumbnail records usage without removing the active link', () => {
  const scheduled = [];
  let renders = 0, saves = 0;
  const ctx = vm.createContext({
    state: { activeCollection: 'all', bookmarks: [{ id: 1, useCount: 3 }] },
    saveCache() {}, saveToFirestore() { saves++; }, renderCards() { renders++; },
    setTimeout(callback) { scheduled.push(callback); },
  });
  vm.runInContext('function recordOpen(id) {' + html.split('function recordOpen(id) {')[1].split('async function togglePin')[0], ctx);
  ctx.recordOpen(1);
  assert.equal(ctx.state.bookmarks[0].useCount, 4);
  assert.equal(saves, 1);
  assert.equal(renders, 0, 'do not remove the link during its click handler');
  assert.equal(scheduled.length, 0);
});

test('inline scripts have valid JavaScript syntax', () => {
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (match[1].trim()) new vm.Script(match[1]);
  }
});
