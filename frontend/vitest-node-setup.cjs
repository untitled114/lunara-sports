// vitest-node-setup.cjs
// This file is loaded via Node's --require flag BEFORE any module compilation
// It must be CommonJS (.cjs) to work with --require

// Polyfill globals that webidl-conversions needs at line 325
if (typeof globalThis.WeakMap === 'undefined') {
  globalThis.WeakMap = Map;
}

if (typeof globalThis.WeakSet === 'undefined') {
  globalThis.WeakSet = Set;
}

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

if (typeof globalThis.FinalizationRegistry === 'undefined') {
  globalThis.FinalizationRegistry = class FinalizationRegistry {
    constructor(_callback) {}
    register() {}
    unregister() {}
  };
}

if (typeof globalThis.ArrayBuffer === 'undefined') {
  globalThis.ArrayBuffer = class ArrayBuffer {
    constructor(length) {
      this.byteLength = length;
    }
  };
}

if (typeof globalThis.DataView === 'undefined') {
  globalThis.DataView = class DataView {
    constructor(buffer) {
      this.buffer = buffer;
      this.byteLength = buffer?.byteLength || 0;
      this.byteOffset = 0;
    }
  };
}

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
