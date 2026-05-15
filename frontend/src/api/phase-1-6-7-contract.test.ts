import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = dirname(fileURLToPath(import.meta.url))
const srcDir = resolve(currentDir, '..')

function source(pathFromSrc: string): string {
  return readFileSync(resolve(srcDir, pathFromSrc), 'utf-8')
}

function requireFile(pathFromSrc: string): void {
  expect(existsSync(resolve(srcDir, pathFromSrc))).toBe(true)
}

describe('phase 1.6-7 frontend API and query contract', () => {
  it('adds typed API modules for venture category labels, ventures, and activity types', () => {
    requireFile('api/ventureCategoryLabels.ts')
    requireFile('api/ventures.ts')
    requireFile('api/activityTypes.ts')
  })

  it('extends projects API for venture filters, board/status fields, unarchive, and board-status mutation', () => {
    const projectsSource = source('api/projects.ts')

    expect(projectsSource).toContain('venture_id')
    expect(projectsSource).toContain('project_type')
    expect(projectsSource).toContain('board_status')
    expect(projectsSource).toContain('finished')
    expect(projectsSource).toContain('/unarchive')
    expect(projectsSource).toContain('/board-status')
    expect(projectsSource).toContain('project_id: string')
    expect(projectsSource).toContain('kanban_order: number')
  })

  it('extends time logs API for optional activity_type_id and display fields', () => {
    const timeLogsSource = source('api/timeLogs.ts')
    const typesSource = source('api/types.ts')

    expect(timeLogsSource).toContain('activity_type_id')
    expect(typesSource).toContain('activity_type_id')
    expect(typesSource).toContain('activity_type_name')
    expect(typesSource).toContain('activity_type_display_name')
  })

  it('defines new phase 1.6 TypeScript types and avoids task type additions', () => {
    const typesSource = source('api/types.ts')

    expect(typesSource).toContain('export type Venture =')
    expect(typesSource).toContain('export type VenturePayload =')
    expect(typesSource).toContain('export type VentureStatus =')
    expect(typesSource).toContain('export type VentureCategoryLabel =')
    expect(typesSource).toContain('export type VentureCategoryLabelPayload =')
    expect(typesSource).toContain('export type ProjectType =')
    expect(typesSource).toContain('export type ProjectBoardStatus =')
    expect(typesSource).toContain('export type ActivityType =')
    expect(typesSource).toContain('export type ActivityTypePayload =')
    expect(typesSource).toContain('usage_count?: number')
    expect(typesSource).not.toContain('export type TaskType =')
  })

  it('keeps archiveActivityType typed as no-content response', () => {
    const activityTypesSource = source('api/activityTypes.ts')
    expect(activityTypesSource).toContain('archiveActivityType(activityTypeId: string): Promise<void>')
  })

  it('introduces TanStack Query hooks/query keys and minimal mutation invalidation', () => {
    const apiFiles = [
      'api/projects.ts',
      'api/timeLogs.ts',
      'api/ventureCategoryLabels.ts',
      'api/ventures.ts',
      'api/activityTypes.ts',
    ]

    const combined = apiFiles
      .filter((file) => existsSync(resolve(srcDir, file)))
      .map((file) => source(file))
      .join('\n')

    expect(combined).toContain('@tanstack/react-query')
    expect(combined).toContain('queryKey')
    expect(combined).toContain('useQuery')
    expect(combined).toContain('useMutation')
    expect(combined).toContain('invalidateQueries')
  })

  it('does not introduce server-persisted board preference API calls', () => {
    const projectsSource = source('api/projects.ts')
    const tasksSource = source('api/tasks.ts')
    const timeLogsSource = source('api/timeLogs.ts')
    const combined = `${projectsSource}\n${tasksSource}\n${timeLogsSource}`

    expect(combined).not.toContain('/preferences')
    expect(combined).not.toContain('board-preferences')
  })
})
