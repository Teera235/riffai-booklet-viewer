/**
 * Polyfills for older iOS Safari / mobile browsers.
 * These must be imported before any library that uses these features (e.g. pdfjs-dist).
 *
 * Targeted features:
 * - Promise.withResolvers()  — Safari 17.4+
 * - structuredClone()        — Safari 15.4+
 * - Object.hasOwn()          — Safari 15.4+
 * - Array.prototype.at()     — Safari 15.4+
 * - String.prototype.at()    — Safari 15.4+
 */

// --- Promise.withResolvers ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof (Promise as any).withResolvers === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(Promise as any).withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }
}

// --- structuredClone ---
if (typeof globalThis.structuredClone === 'undefined') {
  // Minimal structuredClone polyfill using JSON serialization.
  // Handles plain objects, arrays, and primitives — sufficient for pdfjs-dist usage.
  // Does NOT handle circular references, Map, Set, or ArrayBuffer transfers.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).structuredClone = function structuredClone<T>(value: T): T {
    if (value === undefined) return undefined as T
    try {
      return JSON.parse(JSON.stringify(value)) as T
    } catch {
      return value
    }
  }
}

// --- Object.hasOwn ---
if (!Object.hasOwn) {
  Object.hasOwn = function hasOwn(obj: object, prop: PropertyKey): boolean {
    return Object.prototype.hasOwnProperty.call(obj, prop)
  }
}

// --- Array.prototype.at ---
if (!Array.prototype.at) {
  Object.defineProperty(Array.prototype, 'at', {
    value: function <T>(this: T[], index: number): T | undefined {
      const len = this.length
      const i = index >= 0 ? index : len + index
      if (i < 0 || i >= len) return undefined
      return this[i]
    },
    writable: true,
    enumerable: false,
    configurable: true,
  })
}

// --- String.prototype.at ---
if (!String.prototype.at) {
  Object.defineProperty(String.prototype, 'at', {
    value: function (this: string, index: number): string | undefined {
      const len = this.length
      const i = index >= 0 ? index : len + index
      if (i < 0 || i >= len) return undefined
      return this[i]
    },
    writable: true,
    enumerable: false,
    configurable: true,
  })
}

export {}
