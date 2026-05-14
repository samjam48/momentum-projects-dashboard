export const PROJECT_PALETTE: readonly string[] = [
  '#D97048',
  '#E07A5F',
  '#C8553D',
  '#9C5D35',
  '#B8860B',
  '#6B8E6B',
  '#5B7C99',
  '#7B5EA7',
  '#C77DFF',
  '#E8A87C',
  '#85C1E2',
  '#8B7355',
] as const

export const PROJECT_PALETTE_NAMES: readonly string[] = [
  'Terracotta',
  'Coral',
  'Burnt sienna',
  'Umber',
  'Antique gold',
  'Sage',
  'Slate blue',
  'Plum',
  'Lavender',
  'Peach',
  'Sky',
  'Taupe',
] as const

export const DEFAULT_PROJECT_COLOUR = PROJECT_PALETTE[0]

export function paletteNameForColour(colour: string): string {
  const normalized = PROJECT_PALETTE.find(
    (swatch) => swatch.toLowerCase() === colour.toLowerCase(),
  )
  if (!normalized) {
    return 'Colour swatch'
  }

  const paletteIndex = PROJECT_PALETTE.indexOf(normalized)
  return PROJECT_PALETTE_NAMES[paletteIndex] ?? 'Colour swatch'
}
