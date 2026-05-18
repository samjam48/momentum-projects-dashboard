import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { readWorkspaceComposerSource } from '../../test/readWorkspaceComposerSource'

function readRequiredSource(relativePath: string, description: string): string {
  const absolutePath = resolve(process.cwd(), relativePath)

  expect(
    existsSync(absolutePath),
    `Expected ${description} at ${absolutePath}, but it does not exist yet.`,
  ).toBe(true)

  return readFileSync(absolutePath, 'utf8')
}

/**
 * FR-9 (Test Writer): extraction guards for toolbar/sidebar project filter synchronisation
 * effects currently inlined in `App.tsx`.
 */
describe('FR-9 project filter sync extraction (repo integration)', () => {
  it('adds features/workspace/useProjectFilterSync.ts as the home for toolbar/sidebar filter effects', () => {
    const absolutePath = resolve(process.cwd(), 'src/features/workspace/useProjectFilterSync.ts')
    expect(
      existsSync(absolutePath),
      'FR-9 should introduce src/features/workspace/useProjectFilterSync.ts before wiring completes.',
    ).toBe(true)
  })

  it('exports a hook that keeps Zustand toolbar selection aligned with sidebar subset rules', () => {
    const hookSource = readRequiredSource(
      'src/features/workspace/useProjectFilterSync.ts',
      'the FR-9 project filter sync hook',
    )

    expect(hookSource).toMatch(/export\s+(function|const)\s+useProjectFilterSync\b/)
    expect(hookSource).toMatch(/\bderiveToolbarProjectId\b/)
    expect(hookSource).toMatch(/\b(useProjectFilterStore|ProjectFilterState)\b/)
    expect(hookSource).toMatch(/\b(getSidebarSelectedProjectIds|selectedProjectIds)\b/)
    expect(hookSource).toMatch(/\buseEffect\b/)
  })

  it('wires the App composer through useProjectFilterSync', () => {
    const composerSource = readWorkspaceComposerSource()

    expect(/\bfrom\s+['"][^'"]*useProjectFilterSync['"]/.test(composerSource)).toBe(true)
  })

  it('stops calling deriveToolbarProjectId from App.tsx once the sync hook owns that alignment', () => {
    const composerSource = readWorkspaceComposerSource()

    expect(composerSource).not.toMatch(/\bderiveToolbarProjectId\s*\(/)
    expect(composerSource).not.toMatch(
      /\bimport\s*\{[^}]*\bderiveToolbarProjectId\b[^}]*\}\s*from\s*['"].*stores\/projectFilter['"]/,
    )
  })
})
