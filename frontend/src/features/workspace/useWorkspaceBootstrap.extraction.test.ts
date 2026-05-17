import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

function readRequiredSource(relativePath: string, description: string): string {
  const absolutePath = resolve(process.cwd(), relativePath)

  expect(
    existsSync(absolutePath),
    `Expected ${description} at ${absolutePath}, but it does not exist yet.`,
  ).toBe(true)

  return readFileSync(absolutePath, 'utf8')
}

/**
 * FR-9 (Test Writer): extraction guards for moving workspace bootstrap and the ready gate
 * out of `App.tsx` into `useWorkspaceBootstrap`.
 */
describe('FR-9 workspace bootstrap extraction (repo integration)', () => {
  it('adds features/workspace/useWorkspaceBootstrap.ts as the home for bootstrap + ready gate', () => {
    const absolutePath = resolve(process.cwd(), 'src/features/workspace/useWorkspaceBootstrap.ts')
    expect(
      existsSync(absolutePath),
      'FR-9 should introduce src/features/workspace/useWorkspaceBootstrap.ts before wiring completes.',
    ).toBe(true)
  })

  it('exports a hook that couples project list priming with task workspace enablement and workspace readiness', () => {
    const hookSource = readRequiredSource(
      'src/features/workspace/useWorkspaceBootstrap.ts',
      'the FR-9 workspace bootstrap hook',
    )

    expect(hookSource).toMatch(/export\s+(function|const)\s+useWorkspaceBootstrap\b/)
    expect(hookSource).toMatch(/\bworkspaceReady\b/)
    expect(hookSource).toMatch(/\b(useProjects\b|projectsQuery\b)/)
    expect(hookSource).toMatch(/\b(useTasks\b|tasksQuery\b)/)
    expect(hookSource).toMatch(/\b(taskWorkspacePrimed|hasEvaluatedTaskWorkspaceBootstrap)\b/)
  })

  it('wires the App composer through useWorkspaceBootstrap (or optional WorkspaceRoot that uses it)', () => {
    const appSource = readRequiredSource('src/App.tsx', 'App composer')

    const importsBootstrap = /\bfrom\s+['"].*\/workspace\/useWorkspaceBootstrap['"]/.test(appSource)
    const importsWorkspaceRoot = /\bfrom\s+['"].*\/app\/WorkspaceRoot['"]/.test(appSource)

    expect(
      importsBootstrap || importsWorkspaceRoot,
      'App should import useWorkspaceBootstrap directly or optionally compose WorkspaceRoot that does.',
    ).toBe(true)

    if (importsWorkspaceRoot) {
      const rootPath = resolve(process.cwd(), 'src/app/WorkspaceRoot.tsx')
      expect(
        existsSync(rootPath),
        'WorkspaceRoot.tsx should exist when App imports it.',
      ).toBe(true)
      const rootSource = readFileSync(rootPath, 'utf8')
      expect(
        rootSource.includes('useWorkspaceBootstrap'),
        'WorkspaceRoot should delegate bootstrap to useWorkspaceBootstrap.',
      ).toBe(true)
    }
  })

  it('stops owning inline workspace bootstrap state in App.tsx once the hook exists', () => {
    const appSource = readRequiredSource('src/App.tsx', 'App composer')

    expect(appSource).not.toMatch(
      /\[\s*workspaceReady\s*,\s*setWorkspaceReady\s*\]\s*=\s*useState/,
    )
    expect(appSource).not.toMatch(
      /\[\s*taskWorkspacePrimed\s*,\s*setTaskWorkspacePrimed\s*\]\s*=\s*useState/,
    )
    expect(appSource).not.toMatch(
      /\[\s*hasEvaluatedTaskWorkspaceBootstrap\s*,\s*setHasEvaluatedTaskWorkspaceBootstrap\s*\]\s*=\s*useState/,
    )
  })
})
