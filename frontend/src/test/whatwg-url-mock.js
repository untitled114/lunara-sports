// src/test/whatwg-url-mock.js
// Mock for whatwg-url to prevent loading issues in Vitest

export class URL {
  constructor(href, base) {
    this.href = href || '';
    this.origin = '';
    this.protocol = 'http:';
    this.host = 'localhost';
    this.hostname = 'localhost';
    this.port = '';
    this.pathname = '/';
    this.search = '';
    this.hash = '';
  }

  toString() {
    return this.href;
  }
}

export class URLSearchParams {
  constructor(init) {
    this._params = new Map();
    if (init) {
      if (typeof init === 'string') {
        // Parse query string
        init.split('&').forEach(pair => {
          const [key, value] = pair.split('=');
          if (key) this._params.set(decodeURIComponent(key), decodeURIComponent(value || ''));
        });
      } else if (init instanceof Map) {
        this._params = new Map(init);
      }
    }
  }

  get(name) {
    return this._params.get(name) || null;
  }

  set(name, value) {
    this._params.set(name, value);
  }

  has(name) {
    return this._params.has(name);
  }

  delete(name) {
    this._params.delete(name);
  }

  toString() {
    const parts = [];
    for (const [key, value] of this._params) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
    return parts.join('&');
  }
}

export default {
  URL,
  URLSearchParams,
};
