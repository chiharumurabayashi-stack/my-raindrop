/* Google sign-in gates the UI; firestore.rules enforces access at the server. */
function initOwnerAuth({ onUnlock, onLock }) {
  const auth = firebase.auth();
  const gate = document.getElementById('auth-gate');
  const app = document.getElementById('application');
  const message = document.getElementById('auth-message');
  const button = document.getElementById('auth-login');
  let unsubscribe = null;
  function lock(text) {
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    app.hidden = true;
    gate.hidden = false;
    onLock();
    message.textContent = text;
    button.disabled = false;
  }
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
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
    lock('登録したGoogleアカウントでログインしてください。');
    if (!user) return;
    if (!BookmarkAuth.isOwner(user)) {
      await auth.signOut();
      message.textContent = 'このアカウントは利用できません。登録したGoogleアカウントを選んでください。';
      return;
    }
    unsubscribe = onUnlock(() => {
      if (!BookmarkAuth.isOwner(auth.currentUser)) return;
      gate.hidden = true;
      app.hidden = false;
    }, () => lock('データへのアクセスが拒否されました。登録したアカウントでログインし直してください。'));
  }, () => lock('ログイン状態を確認できません。ページを再読み込みしてください。'));
}
