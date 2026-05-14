const STORAGE_KEY = '__momentum_test_storage__'

type StorageLike = Pick<Storage, 'clear' | 'getItem' | 'removeItem' | 'setItem' | 'key' | 'length'>

function createMemoryStorage(): StorageLike {
  const store = new Map<string, string>()

  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key) ?? null : null
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, String(value))
    },
  }
}

function nativeStorageWorks(): boolean {
  if (typeof globalThis.localStorage === 'undefined') {
    return false
  }

  try {
    globalThis.localStorage.setItem(STORAGE_KEY, 'ok')
    globalThis.localStorage.removeItem(STORAGE_KEY)
    return typeof globalThis.localStorage.clear === 'function'
  } catch {
    return false
  }
}

let installed = false

export function ensureTestStorage(): void {
  if (installed || nativeStorageWorks()) {
    return
  }

  const memoryStorage = createMemoryStorage()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: memoryStorage,
  })
  installed = true
}

export function resetTestStorage(): void {
  ensureTestStorage()
  globalThis.localStorage.clear()
}
