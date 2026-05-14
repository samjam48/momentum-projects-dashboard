const MONTH_ABBREV = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

export function formatDueDateDisplay(isoDate: string): string {
  const [, monthStr, dayStr] = isoDate.split('-')
  const monthIndex = Number(monthStr) - 1
  const day = Number(dayStr)
  const monthLabel = MONTH_ABBREV[monthIndex] ?? monthStr
  return `${monthLabel} ${String(day).padStart(2, '0')}`
}
