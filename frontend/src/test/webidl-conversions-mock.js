// src/test/webidl-conversions-mock.js
// This mock is based on the webidl-conversions API, providing required stubs.
// It prevents the initial CJS loading from failing.

// The original module exports many functions (e.g., convertToUSVString). 
// We export stubs for safety.

export const AbstractOperations = {};
export const converters = new Proxy({}, { 
  get: (target, prop) => () => {
    // Return a dummy function for any conversion utility called
    console.warn(`[webidl-conversions-mock] Called converter for: ${String(prop)}`);
    return undefined; 
  }
});

// webidl-conversions is an index file that exports many things. 
// Simply re-exporting the main module may be enough.
const conversions = {};

// Common methods used by 'whatwg-url' and other users:
conversions.any = (V) => V;
conversions.boolean = (V) => !!V;
conversions.USVString = (V) => String(V);
conversions.DOMString = (V) => String(V);
conversions.object = (V) => V; // Pass-through for object types

export default conversions;