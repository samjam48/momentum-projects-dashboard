import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const archiveDialogSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), 'ArchiveDialog.tsx'),
  'utf-8',
)

describe('ArchiveDialog — Phase 1.6-12 archive UX scope', () => {
  it('separates archived ventures from archived projects in the archive dialog UI', () => {
    expect(archiveDialogSource).toContain('Archived ventures')
    expect(archiveDialogSource).toContain('Archived projects')
  })

  it('does not offer hard-delete or purge copy in the archive dialog shell', () => {
    const lower = archiveDialogSource.toLowerCase()
    expect(lower.includes('purge')).toBe(false)
    expect(lower.includes('hard delete')).toBe(false)
    expect(lower.includes('permanent delete')).toBe(false)
  })
})
