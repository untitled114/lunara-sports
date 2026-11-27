// A dns-prefetch hint for the API, taken from the build's VITE_API_URL, so no host is written
// in the source. Without an absolute API address the page gets no hint.
export function apiPrefetch(env) {
  return {
    name: 'api-prefetch',
    transformIndexHtml() {
      // Only an absolute address names a host to prefetch; a relative one (a dev proxy path) has none.
      if (!/^https?:\/\//.test(env.VITE_API_URL || '')) return []
      const href = new URL(env.VITE_API_URL).origin
      return [{ tag: 'link', attrs: { rel: 'dns-prefetch', href }, injectTo: 'head' }]
    },
  }
}
