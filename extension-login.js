firebase.initializeApp(BookmarkAuth.config.firebase);
const auth = firebase.auth();
const params = new URLSearchParams(location.hash.slice(1));
const extension = params.get('extension');
const nonce = params.get('nonce');
history.replaceState(null, '', location.pathname);
const button = document.getElementById('login');
const message = document.getElementById('message');
if (!/^[a-p]{32}$/.test(extension || '') || !/^[0-9a-f-]{36}$/.test(nonce || '') || !window.chrome?.runtime?.sendMessage) {
  button.disabled = true;
  message.textContent = 'ブラウザのMyRaindrop拡張機能からログインを開始してください。';
}
button.addEventListener('click', async () => {
  button.disabled = true;
  try {
    await auth.setPersistence(firebase.auth.Auth.Persistence.NONE);
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({prompt:'select_account'});
    const {user} = await auth.signInWithPopup(provider);
    if (!BookmarkAuth.isOwner(user)) throw new Error('このアカウントは利用できません。登録したGoogleアカウントを選んでください。');
    const idToken = await user.getIdToken(true);
    const result = await chrome.runtime.sendMessage(extension, {type:'owner-login',nonce,idToken,refreshToken:user.refreshToken});
    if (!result?.ok) throw new Error(result?.error || '拡張機能との接続に失敗しました。拡張機能からやり直してください。');
    message.textContent = 'ログインしました。このタブを閉じ、保存したいページで拡張機能を開いてください。';
    button.hidden = true;
  } catch (error) {
    message.textContent = error.code ? 'ログインできませんでした。ポップアップと接続を確認してお試しください。' : error.message;
    button.disabled = false;
  } finally { await auth.signOut(); }
});
