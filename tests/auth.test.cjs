const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {config,isOwner} = require('../extension/auth-config.js');
const {acceptsReply} = require('../extension/auth-policy.js');
const owner = {email:config.ownerEmail,emailVerified:true,providerData:[{providerId:'google.com'}]};
test('only the verified owner using Google is accepted', () => {
  assert.equal(isOwner(owner),true);
  for(const user of [null,{...owner,email:'someone@gmail.com'},{...owner,emailVerified:false},{...owner,providerData:[{providerId:'password'}]}]) assert.equal(isOwner(user),false);
});
test('extension login reply is tied to the exact origin, page, tab, nonce, frame and time', () => {
  const pending={nonce:'challenge',tabId:12,createdAt:1000};
  const sender={url:config.appURL+'extension-login.html',tab:{id:12},frameId:0};
  const message={type:'owner-login',nonce:'challenge'};
  assert(acceptsReply(message,sender,pending,2000));
  for(const altered of [{...sender,url:'https://evil.example/extension-login.html'}, {...sender,url:config.appURL+'index.html'}, {...sender,tab:{id:13}}, {...sender,frameId:1}]) assert.equal(acceptsReply(message,altered,pending,2000),false);
  assert.equal(acceptsReply({...message,nonce:'other'},sender,pending,2000),false);
  assert.equal(acceptsReply(message,sender,null,2000),false);
  assert.equal(acceptsReply(message,sender,pending,400000),false);
});
test('web keeps private UI locked until owner data arrives, and removes it on logout/account change', async () => {
  const elements = new Map();
  const element = id => {if(!elements.has(id))elements.set(id,{hidden:false,addEventListener(type,fn){this[type]=fn;}});return elements.get(id);};
  let observer, unlocks=0,locks=0,stops=0,ready;
  const auth={currentUser:null,onAuthStateChanged(fn){observer=fn;},async signOut(){this.currentUser=null;}};
  const ctx=vm.createContext({firebase:{auth:()=>auth},BookmarkAuth:{isOwner},document:{getElementById:element},location:{reload(){}}});
  vm.runInContext(fs.readFileSync('web-auth.js','utf8'),ctx);
  ctx.initOwnerAuth({onUnlock(callback){unlocks++;ready=callback;return()=>stops++;},onLock(){locks++;}});
  await observer(null); assert(element('application').hidden); assert.equal(unlocks,0);
  auth.currentUser={...owner,email:'other@gmail.com'};await observer(auth.currentUser);assert.equal(unlocks,0);assert(element('application').hidden);
  auth.currentUser=owner;await observer(owner);assert.equal(unlocks,1);assert(element('application').hidden);
  ready();assert.equal(element('application').hidden,false);
  auth.currentUser=null;await observer(null);assert(element('application').hidden);assert.equal(stops,1);
  ready();assert(element('application').hidden);assert(locks>=4);
});
test('extension never issues a database request without a token', async () => {
  const source=fs.readFileSync('extension/popup.js','utf8');
  let requests=0,allowed=false,options;
  const ctx=vm.createContext({chrome:{runtime:{sendMessage:async()=>allowed?{ok:true,token:'test-token'}:{ok:false}}},fetch:async(url,opts)=>{requests++;options=opts;return {ok:true,status:200};}});
  vm.runInContext(source.slice(source.indexOf('async function authRequest'),source.indexOf('function lockPopup')),ctx);
  await assert.rejects(ctx.privateFetch('https://example.com'));assert.equal(requests,0);
  allowed=true;await ctx.privateFetch('https://example.com');assert.equal(requests,1);assert.equal(options.headers.Authorization,'Bearer test-token');
});
function backgroundHarness() {
  const storage={}; let external,internal; let lookups=0;
  const runtime={id:'a'.repeat(32),getURL:path=>'chrome-extension://'+'a'.repeat(32)+'/'+path,
    onMessageExternal:{addListener(fn){external=fn;}},onMessage:{addListener(fn){internal=fn;}}};
  const ctx=vm.createContext({BookmarkAuth:{config},BookmarkAuthPolicy:{acceptsReply},importScripts(){},URLSearchParams,
    crypto:{randomUUID:()=> 'test-nonce'}, chrome:{runtime,storage:{session:{
      async get(key){return {[key]:storage[key]};},async set(value){Object.assign(storage,value);},async remove(keys){for(const key of [keys].flat())delete storage[key];}
    }},tabs:{async create(){return {id:42};}}},
    fetch:async(url,options)=>{lookups++;const accepted=JSON.parse(options.body).idToken==='owner-token';return {ok:accepted,json:async()=>({users:[{email:config.ownerEmail,emailVerified:true,localId:'owner',providerUserInfo:[{providerId:'google.com'}]}]})};}
  });
  vm.runInContext(fs.readFileSync('extension/background.js','utf8'),ctx);
  return {storage,runtime,get lookups(){return lookups;},external:(message,sender)=>new Promise(resolve=>external(message,sender,resolve)),internal:(message,sender)=>new Promise(resolve=>{if(internal(message,sender,resolve)===false)resolve(false);})};
}
test('extension validates login with Firebase before keeping credentials; challenges cannot be replayed', async()=>{
  const h=backgroundHarness();
  const sender={url:config.appURL+'extension-login.html',tab:{id:42},frameId:0};
  const pending={nonce:'test',tabId:42,createdAt:Date.now()};
  const message={type:'owner-login',nonce:'test',idToken:'not-an-owner-token',refreshToken:'refresh'};
  h.storage.pendingLogin=pending;
  assert.equal((await h.external(message,sender)).ok,false);
  assert.equal(h.storage.ownerSession,undefined);
  h.storage.pendingLogin=pending;message.idToken='owner-token';
  assert.equal((await h.external(message,sender)).ok,true);
  assert.equal(h.storage.ownerSession.idToken,'owner-token');
  const calls=h.lookups;
  assert.equal((await h.external(message,sender)).ok,false);assert.equal(h.lookups,calls);
});
test('only the extension popup can request tokens and logout removes the session', async()=>{
  const h=backgroundHarness();h.storage.ownerSession={idToken:'owner-token',expiresAt:Date.now()+3600000};
  const popup={id:h.runtime.id,url:h.runtime.getURL('popup.html')};
  assert.equal(await h.internal({type:'auth:token'},{...popup,url:config.appURL}),false);
  assert.equal((await h.internal({type:'auth:token'},popup)).token,'owner-token');
  await h.internal({type:'auth:logout'},popup);
  assert.equal((await h.internal({type:'auth:token'},popup)).ok,false);assert.equal(h.storage.ownerSession,undefined);
});
