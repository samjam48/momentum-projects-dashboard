import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function readSource(relativePath: string): string {
  const absolutePath = resolve(process.cwd(), relativePath)
  if (!existsSync(absolutePath)) {
    return ''
  }
  return readFileSync(absolutePath, 'utf8')
}

function firstExistingPath(relativePaths: string[]): string | null {
  for (const relativePath of relativePaths) {
    if (existsSync(resolve(process.cwd(), relativePath))) {
      return relativePath
    }
  }
  return null
}

describe('FR-4 archive shared primitive extraction', () => {
  it('adds the shared confirm, feedback, and archive-list primitives in the approved frontend locations', () => {
    expect(existsSync(resolve(process.cwd(), 'src/components/ui/ConfirmDialog.tsx'))).toBe(true)
    expect(existsSync(resolve(process.cwd(), 'src/components/feedback/EmptyState.tsx'))).toBe(true)
    expect(existsSync(resolve(process.cwd(), 'src/components/feedback/LoadingState.tsx'))).toBe(true)
    expect(existsSync(resolve(process.cwd(), 'src/components/feedback/ErrorBanner.tsx'))).toBe(true)
    expect(
      firstExistingPath([
        'src/features/archives/ArchiveList.tsx',
        'src/components/archives/ArchiveList.tsx',
      ]),
    ).not.toBeNull()
  })

  it('defines the shared ConfirmDialog contract with explicit pending support for archive restores', () => {
    const source = readSource('src/components/ui/ConfirmDialog.tsx')

    expect(source).toMatch(/\bopen:\s*boolean/)
    expect(source).toMatch(/\bonOpenChange:\s*\(open:\s*boolean\)\s*=>\s*void/)
    expect(source).toMatch(/\bconfirmLabel:\s*string/)
    expect(source).toMatch(/\bcancelLabel\?:\s*string/)
    expect(source).toMatch(/\bpending\?:\s*boolean/)
    expect(source).toMatch(/\bonConfirm:\s*\(\)\s*=>\s*void\s*\|\s*Promise<void>/)
  })

  it('migrates ArchiveDialog to the shared ConfirmDialog, ArchiveList, and feedback primitives instead of inline markup', () => {
    const archiveDialogSource = readSource('src/components/ArchiveDialog.tsx')

    expect(archiveDialogSource).toMatch(/ConfirmDialog/)
    expect(archiveDialogSource).toMatch(/ArchiveList/)
    expect(archiveDialogSource).toMatch(/feedback\/EmptyState/)
    expect(archiveDialogSource).toMatch(/feedback\/LoadingState/)
    expect(archiveDialogSource).toMatch(/feedback\/ErrorBanner/)
    expect(archiveDialogSource).not.toMatch(/role="alertdialog"/)
  })

  it('keeps ArchiveList presentation-focused so restore side effects stay in the feature layer', () => {
    const archiveListPath = firstExistingPath([
      'src/features/archives/ArchiveList.tsx',
      'src/components/archives/ArchiveList.tsx',
    ])

    expect(archiveListPath).not.toBeNull()

    const source = archiveListPath ? readSource(archiveListPath) : ''

    expect(source).toMatch(/\bitems\b/)
    expect(source).toMatch(/\bonRestore\b/)
    expect(source).not.toMatch(/useQueryClient|listProjects|listVentures|unarchiveProject|unarchiveVenture|fetchQuery|useProjects\(|useVentures\(/)
  })
})
