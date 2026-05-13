export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: Record<string, string>
  readonly formError: string | null

  constructor(
    message: string,
    status: number,
    fieldErrors: Record<string, string> = {},
    formError: string | null = null,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
    this.formError = formError
  }
}

type ApiEnv = {
  VITE_API_BASE_URL?: unknown
}

function hasApiBaseUrl(value: object): value is ApiEnv {
  return 'VITE_API_BASE_URL' in value
}

function readApiBaseUrl(): string {
  const envCandidate = import.meta.env
  if (typeof envCandidate !== 'object' || envCandidate === null || !hasApiBaseUrl(envCandidate)) {
    return ''
  }

  const apiBaseUrl = envCandidate.VITE_API_BASE_URL
  return typeof apiBaseUrl === 'string' ? apiBaseUrl : ''
}

const API_BASE_URL = readApiBaseUrl()

type ValidationDetail = {
  loc?: string[]
  msg?: string
}

type ErrorPayload = {
  detail?: string | ValidationDetail[]
  message?: string
  error?: string
}

function isValidationDetail(value: unknown): value is ValidationDetail {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as ValidationDetail
  return Array.isArray(candidate.loc) || typeof candidate.msg === 'string'
}

function isErrorPayload(value: unknown): value is ErrorPayload {
  return typeof value === 'object' && value !== null
}

function buildApiError(status: number, payload: unknown): ApiError {
  if (isErrorPayload(payload)) {
    const fieldErrors: Record<string, string> = {}

    if (Array.isArray(payload.detail)) {
      for (const item of payload.detail) {
        if (!isValidationDetail(item) || typeof item.msg !== 'string') {
          continue
        }

        const fieldName = item.loc?.[item.loc.length - 1]
        if (fieldName) {
          fieldErrors[fieldName] = item.msg
        }
      }

      const detailMessage = payload.detail
        .filter(isValidationDetail)
        .map((item) => item.msg)
        .find((message): message is string => typeof message === 'string')

      return new ApiError(
        detailMessage ?? 'Request failed',
        status,
        fieldErrors,
        detailMessage ?? null,
      )
    }

    const message =
      typeof payload.detail === 'string'
        ? payload.detail
        : typeof payload.message === 'string'
          ? payload.message
          : typeof payload.error === 'string'
            ? payload.error
            : `Request failed with status ${status}`

    return new ApiError(message, status, fieldErrors, message)
  }

  return new ApiError(`Request failed with status ${status}`, status)
}

async function parseResponse(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null
  }

  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    return response.json()
  }

  return response.text()
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })

  const payload = await parseResponse(response)

  if (!response.ok) {
    throw buildApiError(response.status, payload)
  }

  return payload as T
}
