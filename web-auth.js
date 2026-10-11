/* Google sign-in gates the UI; firestore.rules enforces access at the server. */
function initOwnerAuth({ onUnlock, onLock }) {
  const auth = firebase.auth();
  const gate = document.getElementById('auth-gate');
  const app = document.getElementById('application');
  const message = document.getElementById('auth-message');
  const button = document.getElementById('auth-login');
  const title = document.getElementById('auth-title');
  let unsubscribe = null;
  let revision = 0;
  function lock(text, canLogin = true) {
    revision++;
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    app.hidden = true;
    gate.hidden = false;
    onLock();
    message.textContent = text;
    title.textContent = canLogin ? 'ブックマークにログイン' : '読み込み中…';
    button.hidden = !canLogin;
    button.disabled = false;
  }
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await auth.signInWithPopup(provider);
    } catch (error) {
      message.textContent = error.code === 'auth/popup-blocked'
        ? 'ポップアップを許可して、もう一度ログインしてください。'
        : 'ログインできませんでした。もう一度お試しください。';
    } finally { button.disabled = false; }
  });
  document.getElementById('auth-logout').addEventListener('click', async () => {
    lock('ログアウトしました。');
    // Reload also discards SDK memory, pending UI work and private form contents.
    await auth.signOut();
    location.reload();
  });
  auth.onAuthStateChanged(async user => {
    if (!user) {
      lock('登録したGoogleアカウントでログインしてください。');
      return;
    }
    lock('ブックマークを読み込んでいます…', false);
    const currentRevision = revision;
    if (!BookmarkAuth.isOwner(user)) {
      await auth.signOut();
      lock('このアカウントは利用できません。登録したGoogleアカウントを選んでください。');
      return;
    }
    // Migrate an already signed-in SESSION user as well as new sign-ins.
    try { await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); }
    catch { /* Keep the valid current session if browser storage is unavailable. */ }
    if (currentRevision !== revision || !BookmarkAuth.isOwner(auth.currentUser)) return;
    unsubscribe = onUnlock(() => {
      if (currentRevision !== revision || !BookmarkAuth.isOwner(auth.currentUser)) return;
      gate.hidden = true;
      app.hidden = false;
    }, () => lock('データへのアクセスが拒否されました。登録したアカウントでログインし直してください。'));
  }, () => lock('ログイン状態を確認できません。ページを再読み込みしてください。'));
}
