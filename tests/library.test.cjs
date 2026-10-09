const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const L = require('../library.js');
const bookmarks = [
  {id:1,title:'メール',url:'https://mail.example.com',summary:'毎日の連絡',collection:'Work',tags:['Google','仕事'],pinned:true},
  {id:2,title:'画像集',url:'https://example.com',collection:'Design',tags:['画像','仕事'],pinned:true},
  {id:3,title:'ノート',url:'https://example.org',collection:'Work',tags:['仕事']},
  {id:4,title:'未整理',url:'https://example.net',collection:'',tags:[]},
];
test('search combines collection, favorites, multiple tags and words without changing data', () => {
  const original = structuredClone(bookmarks);
  const ids = options => L.filterBookmarks(bookmarks, options).map(b=>b.id);
  assert.deepEqual(ids({collection:'Work',tags:['Google','仕事'],favorites:true,query:'mail 連絡'}),[1]);
  assert.deepEqual(ids({collection:'__favorites__'}),[1,2]);
  assert.deepEqual(ids({collection:'__unclassified__',untagged:true}),[4]);
  assert.deepEqual(ids({tags:['Google','画像']}),[]);
  assert.deepEqual(ids({query:'MAIL'}),[1]);
  assert.deepEqual(bookmarks,original);
});
test('tag suggestions count bookmarks once, order by count, and match partial names', () => {
  assert.deepEqual(L.tagCounts([...bookmarks,{tags:['仕事','仕事']}])[0],['仕事',4]);
  assert.deepEqual(L.tagCounts(bookmarks,'goo'),[['Google',1]]);
  assert.deepEqual(L.tagCounts(L.filterBookmarks(bookmarks,{collection:'Design'})).map(t=>t[0]).sort(),['仕事','画像']);
});
test('invalid preferences recover to a usable list with a visible opening target', () => {
  assert.equal(L.readPreferences('{broken').defaults.layout,'list');
  const view = L.normalizeView({layout:'toString',options:{list:{cover:false,title:false,tags:'true'}}});
  assert.equal(view.layout,'list');
  assert.equal(view.options.list.title,true);
  assert.equal(view.options.list.tags,true);
  assert.equal(L.normalizeView({layout:'headlines',options:{headlines:{cover:true,title:false}}}).options.headlines.title,true);
});
test('per-collection and per-layout options survive reload; apply-all supplies future defaults', () => {
  const view = L.defaults();view.layout='card';view.options.card.description=true;view.options.list.coverSide='right';
  const saved = L.readPreferences(JSON.stringify({defaults:L.defaults(),collections:{Work:view}}));
  assert.equal(L.viewFor(saved,'Work').layout,'card');
  assert.equal(L.viewFor(saved,'Design').layout,'list');
  assert.equal(L.viewFor(saved,'Work').options.list.coverSide,'right');
  const all = L.readPreferences(JSON.stringify({defaults:view,collections:{}}));
  assert.equal(L.viewFor(all,'New').options.card.description,true);
  const clone = L.viewFor(all,'New');clone.options.card.title=false;
  assert.equal(all.defaults.options.card.title,true);
});
test('all four rendered layouts keep an accessible link, including when cover is hidden', () => {
  const html=fs.readFileSync('index.html','utf8');
  const ctx=vm.createContext({BookmarkLibrary:L,uiEscape:L.escapeHTML});
  vm.runInContext('function cardHTML('+html.split('function cardHTML(')[1].split('function renderCards()')[0],ctx);
  for(const layout of Object.keys(L.layouts)) {
    const view=L.defaults();view.layout=layout;view.options[layout].cover=false;
    const rendered=ctx.cardHTML({...bookmarks[0],title:'<test> "page"',tags:['a" onclick="alert(1)'],summary:'<script>x</script>'},L.normalizeView(view));
    assert.match(rendered,/class="card-title"/);
    assert.match(rendered,/href="https:\/\/mail.example.com\//);
    assert.doesNotMatch(rendered,/<test>|<script>|class="card-thumb"/);
  }
  assert.equal(L.safeURL('javascript:alert(1)'),'');
});
test('dropping onto favorites never changes the actual collection; unclassified uses empty ID', async () => {
  const html=fs.readFileSync('index.html','utf8');
  const ctx=vm.createContext({state:{bookmarks:structuredClone(bookmarks)},cardDragEnd(){},renderSidebar(){},renderCards(){},saveToFirestore:async()=>{}});
  vm.runInContext('async function dropToCollection('+html.split('async function dropToCollection(')[1].split('// グリッド')[0],ctx);
  const event={preventDefault(){},dataTransfer:{getData:key=>key==='type'?'bookmark':'3'}};
  await ctx.dropToCollection(event,'__favorites__');
  assert.equal(ctx.state.bookmarks[2].collection,'Work');assert.equal(ctx.state.bookmarks[2].pinned,true);
  await ctx.dropToCollection(event,'all');assert.equal(ctx.state.bookmarks[2].collection,'Work');
  await ctx.dropToCollection(event,'__unclassified__');assert.equal(ctx.state.bookmarks[2].collection,'');
});
