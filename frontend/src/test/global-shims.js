// global-shims.js
// CRITICAL: This file must run BEFORE any other setup files
// It provides polyfills for Node.js globals that webidl-conversions expects

// Polyfill WeakMap (used by webidl-conversions at line 325)
if (typeof globalThis.WeakMap === 'undefined') {
  globalThis.WeakMap = Map;
}

// Polyfill WeakSet
if (typeof globalThis.WeakSet === 'undefined') {
  globalThis.WeakSet = Set;
}

// Polyfill WeakRef
if (typeof globalThis.WeakRef === 'undefined') {
  globalThis.WeakRef = class WeakRef {
    constructor(value) {
      this._value = value;
    }
    deref() {
      return this._value;
    }
  };
}

// Polyfill FinalizationRegistry
if (typeof globalThis.FinalizationRegistry === 'undefined') {
  globalThis.FinalizationRegistry = class FinalizationRegistry {
    constructor(_callback) {
      // Callback intentionally unused - this is a stub
    }
    register() {}
    unregister() {}
  };
}

// Polyfill ArrayBuffer
if (typeof globalThis.ArrayBuffer === 'undefined') {
  globalThis.ArrayBuffer = class ArrayBuffer {
    constructor(length) {
      this.byteLength = length;
    }
  };
}

// Polyfill DataView
if (typeof globalThis.DataView === 'undefined') {
  globalThis.DataView = class DataView {
    constructor(buffer) {
      this.buffer = buffer;
      this.byteLength = buffer?.byteLength || 0;
      this.byteOffset = 0;
    }
  };
}

// Polyfill URL
if (typeof globalThis.URL === 'undefined') {
  globalThis.URL = class URL {
    constructor(href, _base) {
      this.href = href;
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
  };
}

// Polyfill URLSearchParams
if (typeof globalThis.URLSearchParams === 'undefined') {
  globalThis.URLSearchParams = class URLSearchParams {
    constructor() {
      this._params = new Map();
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
  };
}
