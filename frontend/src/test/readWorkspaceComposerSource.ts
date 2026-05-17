import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const APP_PATH = resolve(process.cwd(), 'src/App.tsx')
const WORKSPACE_EXPERIENCE_PATH = resolve(
  process.cwd(),
  'src/features/workspace/WorkspaceExperience.tsx',
)

/**
 * Repo integration tests historically asserted wiring against `App.tsx`. FR-11+
 * keeps `App.tsx` as a thin shell and moves the composer into `WorkspaceExperience`.
 */
export function readWorkspaceComposerSource(): string {
  let combined = readFileSync(APP_PATH, 'utf8')
  if (existsSync(WORKSPACE_EXPERIENCE_PATH)) {
    combined += `\n${readFileSync(WORKSPACE_EXPERIENCE_PATH, 'utf8')}`
  }
  return combined
}
