/** Build a URL from fetch()'s first argument (used in mocked fetch tests). */
export function urlFromFetchMockFirstArg(raw: unknown): URL {
  if (typeof raw === 'string') {
    return new URL(raw, 'http://localhost')
  }
  if (raw instanceof URL) {
    return new URL(raw.href, 'http://localhost')
  }
  if (raw instanceof Request) {
    return new URL(raw.url, 'http://localhost')
  }
  throw new Error('Expected fetch call first argument to be string, URL, or Request')
}
