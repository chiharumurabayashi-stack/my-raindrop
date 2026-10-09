const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const taxonomy = require('../extension/classification.js');
const collections = [{id:'all',name:'すべて'},{id:'AI',name:'AI'},{id:'daily',name:'仕事・日常ツール'}];
const bookmarks = [{tags:['AI','チャット','ニュース','RSS','Google']},{tags:['ニュース','メール']}];

test('normalizes aliases, whitespace, full-width Latin text, and duplicates', () => {
  assert.deepEqual(taxonomy.normalizeTags(['news',' ニュース ','ｄｅｓｉｇｎ','ROM','rom','dev',null,{},'', 'Blender']),
    ['ニュース','デザイン','ROM','開発','Blender']);
  assert.deepEqual(taxonomy.normalizeTags('news'), []);
});

test('retains all vocabulary beyond the old 40-tag limit, sorted by frequency', () => {
  const many = [{tags:Array.from({length:60},(_,i)=>'tag'+i)}, ...bookmarks, {tags:['tool','インターネット']}];
  const words = taxonomy.vocabulary(many);
  assert(words.includes('tag59'));
  assert.equal(words[0],'ニュース');
  assert(!words.includes('ツール'));
  const prompt=taxonomy.buildPrompt({url:'https://example.com',title:'Example',pageText:'',collections,bookmarks:many});
  assert(prompt.includes('tag59'));
  assert(prompt.includes('0〜3個'));
  assert(!prompt.includes('3〜5個'));
});

test('only applies known tags and exact existing collections, separating new suggestions', () => {
  const result=taxonomy.sanitizeResult({collection:'AI画像',tags:['news','ニュース','AI','RSS','チャット','新規タグ','tool'],summary:' test '},collections,bookmarks);
  assert.equal(result.collectionId,null);
  assert.equal(result.proposedCollection,'AI画像');
  assert.deepEqual(result.tags,['ニュース','AI','RSS']);
  assert.deepEqual(result.proposedTags,['新規タグ']);
  assert.equal(result.summary,'test');
  assert.equal(taxonomy.sanitizeResult({collection:'仕事・日常ツール'},collections,bookmarks).collectionId,'daily');
  assert.equal(taxonomy.sanitizeResult({collection:'仕事'},collections,bookmarks).collectionId,null);
  assert.equal(taxonomy.sanitizeResult({collection:'all'},collections,bookmarks).proposedCollection,'');
});

test('empty and malformed AI fields never create classifications', () => {
  for(const input of [null,{},[],{tags:'bad',summary:{},proposedTags:'bad',collection:123}]) {
    const result=taxonomy.sanitizeResult(input,collections,bookmarks);
    assert.deepEqual(result.tags,[]);
    assert.deepEqual(result.proposedTags,[]);
    assert.equal(result.collectionId,null);
  }
});

test('suggestion display is plain text and clearing hides stale proposals', () => {
  const element={textContent:'',hidden:true};
  taxonomy.showSuggestions(element,{proposedTags:['<img src=x>'],proposedCollection:'New'});
  assert.equal(element.hidden,false);
  assert(element.textContent.includes('<img src=x>'));
  assert.equal(element.innerHTML,undefined);
  taxonomy.showSuggestions(element,null);
  assert.equal(element.hidden,true);
  assert.equal(element.textContent,'');
});

test('renamed and merged collections preserve the selected view', () => {
  const current=[{id:'仕事・日常ツール',name:'仕事・日常ツール'},{id:'学習・研究',name:'学習・研究'},{id:'クリエイティブ',name:'クリエイティブ'}];
  assert.equal(taxonomy.resolveCollectionId('ツール',current),'仕事・日常ツール');
  assert.equal(taxonomy.resolveCollectionId('研究資料',current),'学習・研究');
  assert.equal(taxonomy.resolveCollectionId('スマートシティ',current),'クリエイティブ');
  assert.equal(taxonomy.resolveCollectionId('missing',current),'all');
  assert.equal(taxonomy.resolveCollectionId('__home__',current),'all');
});

for (const target of ['web','extension']) {
  test(target+' AI form preserves selection for unknown collections and shows unapplied proposals', async () => {
    const source=fs.readFileSync(path.join(__dirname,'..',target==='web'?'index.html':'extension/popup.js'),'utf8');
    const code='async function aiFill() {'+source.split('async function aiFill() {')[1].split(target==='web'?'async function deleteBookmark':'// ===== 保存 =====')[0];
    const elements=new Map();
    const element=id=>{
      if(!elements.has(id))elements.set(id,{value:'',textContent:'',className:'',style:{},hidden:true});
      return elements.get(id);
    };
    element('f-url').value='https://example.com';element('f-title').value='Example';element('f-col').value='daily';
    let appliedTags;
    const ctx=vm.createContext({
      BookmarkClassification:taxonomy, state:{collections,bookmarks}, collections,bookmarks,
      document:{getElementById:element},localStorage:{getItem:()=> 'test-key'},
      chrome:{storage:{local:{get:async()=>({geminiKey:'test-key'})}},tabs:{query:async()=>[{id:1}]},scripting:{executeScript:async()=>[{result:'Test page'}]}},
      fetch:async url=>url.includes('generateContent')?{ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({collection:'AI画像',tags:['news','新規タグ','tool'],summary:'要約'})}]}}]})}:{ok:false},
      AbortSignal,initTagInput:tags=>{appliedTags=tags;},setTags:tags=>{appliedTags=tags;},
      alert:message=>assert.fail(message),openSettings:()=>assert.fail('unexpected settings'),
    });
    vm.runInContext(code,ctx); await ctx.aiFill();
    assert.equal(element('f-col').value,'daily');
    assert.deepEqual(appliedTags,['ニュース']);
    assert.equal(element('ai-classification-suggestions').hidden,false);
    assert(element('ai-classification-suggestions').textContent.includes('新規タグ'));
    assert.equal(element('btn-ai-fill').disabled,false);
  });
}

test('both entry points load the shared classifier before their application code', () => {
  const web=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  const popup=fs.readFileSync(path.join(__dirname,'..','extension','popup.html'),'utf8');
  const scriptIndex = web.indexOf('src="extension/classification.js');
  assert(scriptIndex >= 0 && scriptIndex < web.indexOf('function aiFill()'));
  assert(popup.indexOf('src="classification.js"')<popup.indexOf('src="popup.js"'));
  new vm.Script(fs.readFileSync(path.join(__dirname,'..','extension','popup.js'),'utf8'));
});
