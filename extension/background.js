importScripts('auth-config.js', 'auth-policy.js');
const {config} = BookmarkAuth;
let sessionVersion = 0;
let refreshing = null;
async function verifyOwner(idToken) {
  const response = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + config.firebase.apiKey, {
    method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({idToken})
  });
  if (!response.ok) throw new Error('ログインし直してください');
  const user = (await response.json()).users?.[0];
  if (!user || user.email !== config.ownerEmail || user.emailVerified !== true
      || !user.providerUserInfo?.some(p => p.providerId === 'google.com')) throw new Error('このアカウントは利用できません');
  return user.localId;
}
async function token() {
  const {ownerSession} = await chrome.storage.session.get('ownerSession');
  if (!ownerSession) throw new Error('Googleでログインしてください');
  if (ownerSession.expiresAt > Date.now() + 60000) return ownerSession.idToken;
  if (refreshing) return refreshing;
  const version = sessionVersion;
  refreshing = (async () => {
    const response = await fetch('https://securetoken.googleapis.com/v1/token?key=' + config.firebase.apiKey, {
      method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body: new URLSearchParams({grant_type:'refresh_token', refresh_token:ownerSession.refreshToken})
    });
    if (!response.ok) throw new Error('ログインし直してください');
    const data = await response.json();
    await verifyOwner(data.id_token);
    if (version !== sessionVersion) throw new Error('ログアウトしました');
    await chrome.storage.session.set({ownerSession:{idToken:data.id_token, refreshToken:data.refresh_token,
      expiresAt:Date.now() + Number(data.expires_in) * 1000}});
    return data.id_token;
  })().catch(async error => {
    if (version === sessionVersion) await chrome.storage.session.remove('ownerSession');
    throw error;
  }).finally(() => { refreshing = null; });
  return refreshing;
}
chrome.runtime.onMessageExternal.addListener((message, sender, reply) => {
  (async () => {
    const {pendingLogin} = await chrome.storage.session.get('pendingLogin');
    if (!BookmarkAuthPolicy.acceptsReply(message, sender, pendingLogin)) throw new Error('ログイン要求が無効です');
    // Consume the one-time challenge before processing credentials.
    await chrome.storage.session.remove('pendingLogin');
    const version = ++sessionVersion;
    if (typeof message.idToken !== 'string' || typeof message.refreshToken !== 'string') throw new Error('ログイン情報が無効です');
    await verifyOwner(message.idToken);
    if (version !== sessionVersion) throw new Error('ログインを中止しました');
    await chrome.storage.session.set({ownerSession:{idToken:message.idToken, refreshToken:message.refreshToken,
      expiresAt:Date.now() + 50 * 60 * 1000}});
    return {ok:true};
  })().then(reply, error => reply({ok:false,error:error.message}));
  return true;
});
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  // Only the packaged popup may request tokens or start a login.
  if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('popup.html')) return false;
  (async () => {
    if (message.type === 'auth:token') return {ok:true,token:await token()};
    if (message.type === 'auth:logout') {
      sessionVersion++;
      await chrome.storage.session.remove(['ownerSession','pendingLogin']);
      return {ok:true};
    }
    if (message.type === 'auth:login') {
      const nonce = crypto.randomUUID();
      const url = config.appURL + 'extension-login.html#' + new URLSearchParams({extension:chrome.runtime.id,nonce});
      const tab = await chrome.tabs.create({url});
      await chrome.storage.session.set({pendingLogin:{nonce,tabId:tab.id,createdAt:Date.now()}});
      return {ok:true};
    }
    throw new Error('未対応の操作です');
  })().then(reply, error => reply({ok:false,error:error.message}));
  return true;
});
