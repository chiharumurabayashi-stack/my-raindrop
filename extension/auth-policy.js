(function(root) {
  const loginPath = '/my-raindrop/extension-login.html';
  function acceptsReply(message, sender, pending, now = Date.now()) {
    if (!pending || message?.type !== 'owner-login' || message.nonce !== pending.nonce
        || now - pending.createdAt > 5 * 60 * 1000 || now < pending.createdAt
        || sender?.tab?.id !== pending.tabId || sender.frameId !== 0) return false;
    try {
      const url = new URL(sender.url);
      return url.origin === 'https://chiharumurabayashi-stack.github.io' && url.pathname === loginPath;
    } catch { return false; }
  }
  const api = { acceptsReply };
  if (typeof module !== 'undefined') module.exports = api;
  root.BookmarkAuthPolicy = api;
})(globalThis);
