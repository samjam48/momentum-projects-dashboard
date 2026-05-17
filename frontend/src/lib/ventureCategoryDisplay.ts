/** Title-case display for venture category label names shown in dialogs and comboboxes. */
export function displayVentureCategoryTitle(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}
