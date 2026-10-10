(function(root) {
  const config = {
    ownerEmail: 'chiharu.murabayashi@gmail.com',
    appURL: 'https://chiharumurabayashi-stack.github.io/my-raindrop/',
    firebase: {
      apiKey: 'AIzaSyBGcuc2uwBpFWGs31Duj4jIZRdA3Nxg_2Y',
      authDomain: 'my-raindrop.firebaseapp.com',
      projectId: 'my-raindrop',
      appId: '1:389386045279:web:947ede469e10b1f2f198ea'
    }
  };
  // UI check only. Firestore rules are the authoritative access boundary.
  function isOwner(user) {
    return !!user && user.email === config.ownerEmail && user.emailVerified === true
      && (user.providerData || []).some(p => p.providerId === 'google.com');
  }
  const api = {config, isOwner};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BookmarkAuth = api;
})(globalThis);
