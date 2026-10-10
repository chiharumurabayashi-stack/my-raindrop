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
