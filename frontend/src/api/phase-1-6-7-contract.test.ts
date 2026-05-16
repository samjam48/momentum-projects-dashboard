import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expectTypeOf } from 'vitest'

import { archiveActivityType } from './activityTypes'
import type * as ApiTypes from './types'

const currentDir = dirname(fileURLToPath(import.meta.url))
const srcDir = resolve(currentDir, '..')

function source(pathFromSrc: string): string {
  return readFileSync(resolve(srcDir, pathFromSrc), 'utf-8')
}

function requireFile(pathFromSrc: string): void {
  expect(existsSync(resolve(srcDir, pathFromSrc))).toBe(true)
}

type Phase167ExportedTypeNames =
  | 'Venture'
  | 'VenturePayload'
  | 'VentureStatus'
  | 'VentureCategoryLabel'
  | 'VentureCategoryLabelPayload'
  | 'ProjectType'
  | 'ProjectBoardStatus'
  | 'ActivityType'
  | 'ActivityTypePayload'

type MissingPhase167Exports = Exclude<Phase167ExportedTypeNames, keyof typeof ApiTypes>
type AssertPhase167TypesExported = [MissingPhase167Exports] extends [never]
  ? true
  : `Missing api/types exports: ${MissingPhase167Exports}`

describe('phase 1.6-7 frontend API and query contract', () => {
  it('exports Phase 1.6.7 domain types from api/types', () => {
    const ok: AssertPhase167TypesExported = true
    expect(ok).toBe(true)
  })
  it('adds typed API modules for venture category labels, ventures, and activity types', () => {
    requireFile('api/ventureCategoryLabels.ts')
    requireFile('api/ventures.ts')
    requireFile('api/activityTypes.ts')
  })

  it('wires QueryClientProvider in main.tsx (TanStack Query app shell)', () => {
    const mainSource = source('main.tsx')
    expect(mainSource).toContain('QueryClientProvider')
    expect(mainSource).toContain('@tanstack/react-query')
    expect(mainSource).toContain('appQueryClient')
  })

  it('does not introduce server-persisted board preference API calls', () => {
    const projectsSource = source('api/projects.ts')
    const tasksSource = source('api/tasks.ts')
    const timeLogsSource = source('api/timeLogs.ts')
    const combined = `${projectsSource}\n${tasksSource}\n${timeLogsSource}`

    expect(combined).not.toContain('/preferences')
    expect(combined).not.toContain('board-preferences')
  })

  it('does not expose TaskType or is_asset in shared API types', () => {
    const typesSource = source('api/types.ts')
    expect(typesSource).not.toMatch(/export type TaskType\b/)
    expect(typesSource).not.toContain('is_asset')
  })

  it('types archiveActivityType as a void Promise API helper', () => {
    expectTypeOf(archiveActivityType).toBeFunction()
    expectTypeOf(archiveActivityType).returns.toEqualTypeOf<Promise<void>>()
    expectTypeOf(archiveActivityType).parameters.toEqualTypeOf<[string]>()
  })
})
