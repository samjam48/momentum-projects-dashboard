import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))

function readSrc(relativePath: string): string {
  return readFileSync(resolve(currentDir, relativePath), 'utf-8')
}

describe('Phase 1.6-12 — archive UI patterns and no entity purge affordances', () => {
  it('uses distinct archive copy for ventures, projects, and tasks; archive surfaces omit hard-delete', () => {
    const archiveDialog = readSrc('components/ArchiveDialog.tsx')
    const ventureDialog = readSrc('components/VentureDialog.tsx')
    const projectDialog = readSrc('components/ProjectDialog.tsx')
    const taskDialog = readSrc('components/TaskDialog.tsx')

    expect(archiveDialog).toMatch(/Archived ventures/i)
    expect(archiveDialog).toMatch(/Archived projects/i)
    expect(archiveDialog).toMatch(/View archive/i)

    expect(ventureDialog).toMatch(/Archive venture/i)
    expect(projectDialog).toMatch(/Archive project/i)

    expect(taskDialog).toMatch(/\bArchive\b/)
    expect(taskDialog).toMatch(/Delete time log/i)

    const entityArchiveSurfaces = `${archiveDialog}\n${ventureDialog}\n${projectDialog}`
    expect(entityArchiveSurfaces).not.toMatch(/\bPurge\b/i)
    expect(entityArchiveSurfaces).not.toMatch(/Delete venture/i)
    expect(entityArchiveSurfaces).not.toMatch(/Delete project/i)
    expect(entityArchiveSurfaces).not.toMatch(/hard[- ]?delete/i)
  })
})
