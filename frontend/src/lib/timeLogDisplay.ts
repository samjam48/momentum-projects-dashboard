import type { TimeLog } from '../api/types'

type ParsedLegacyNotes = {
  body: string | null
  location: string | null
  title: string | null
}

export function parseLegacyNotes(notes: string | null): ParsedLegacyNotes {
  if (!notes) {
    return { body: null, location: null, title: null }
  }

  const bodyLines: string[] = []
  let title: string | null = null
  let location: string | null = null

  for (const line of notes.split('\n')) {
    if (line.startsWith('title:')) {
      title = line.slice('title:'.length)
      continue
    }

    if (line.startsWith('location:')) {
      location = line.slice('location:'.length)
      continue
    }

    bodyLines.push(line)
  }

  const body = bodyLines.join('\n').trim()

  return {
    body: body === '' ? null : body,
    location,
    title,
  }
}

export function getTimeLogTitle(timeLog: TimeLog): string {
  if (timeLog.title) {
    return timeLog.title
  }

  const legacy = parseLegacyNotes(timeLog.notes)
  if (legacy.title) {
    return legacy.title
  }

  if (timeLog.notes && !timeLog.notes.includes('title:')) {
    return timeLog.notes.split('\n')[0] ?? 'Time log'
  }

  return 'Time log'
}

export function getTimeLogLocation(timeLog: TimeLog): string | null {
  if (timeLog.location) {
    return timeLog.location
  }

  return parseLegacyNotes(timeLog.notes).location
}

export function getTimeLogBody(timeLog: TimeLog): string | null {
  const legacy = parseLegacyNotes(timeLog.notes)
  if (legacy.body) {
    return legacy.body
  }

  if (timeLog.title && timeLog.notes) {
    return timeLog.notes
  }

  if (timeLog.notes && !timeLog.notes.includes('title:')) {
    return null
  }

  return timeLog.notes
}

export function getTimeLogListPrimaryLabel(timeLog: TimeLog): string {
  if (timeLog.activity_type_id) {
    return timeLog.activity_type_display_name
  }

  const fromTitleField = timeLog.title?.trim()
  if (fromTitleField) {
    return fromTitleField
  }

  const legacy = parseLegacyNotes(timeLog.notes)
  const legacyTitle = legacy.title?.trim()
  if (legacyTitle) {
    return legacyTitle
  }

  if (timeLog.notes?.trim() && !timeLog.notes.includes('title:')) {
    return timeLog.notes.split('\n')[0]?.trim() ?? 'Time log'
  }

  return timeLog.activity_type_display_name || 'uncategorised'
}

export function formatTimeLogDate(loggedDate: string): string {
  const parsedDate = new Date(`${loggedDate}T00:00:00`)
  if (Number.isNaN(parsedDate.getTime())) {
    return loggedDate
  }

  return parsedDate.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
  })
}
