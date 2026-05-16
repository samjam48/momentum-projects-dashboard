import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const srcDir = resolve(currentDir)

const TASK_SURFACE_PATHS = [
  'api/types.ts',
  'api/tasks.ts',
  'components/TaskDialog.tsx',
  'components/TaskKanbanBoard.tsx',
  'components/TaskSummaryTable.tsx',
  'components/kanban/KanbanTaskCard.tsx',
]

function readSrc(relativePath: string): string {
  return readFileSync(resolve(srcDir, relativePath), 'utf-8')
}

/** Block starting at `export type Name = {` with balanced braces. */
function exportedObjectTypeBlock(source: string, typeName: string): string {
  const needle = `export type ${typeName} = {`
  const start = source.indexOf(needle)
  if (start === -1) {
    return ''
  }
  let depth = 0
  for (let i = start + needle.length - 1; i < source.length; i++) {
    const c = source[i]
    if (c === '{') {
      depth++
    } else if (c === '}') {
      depth--
      if (depth === 0) {
        return source.slice(start, i + 1)
      }
    }
  }
  return ''
}

describe('Phase 1.6-12 scope guard — task taxonomy stays out of UI/API surface', () => {
  it('does not introduce task type, labels, or semantic colour fields in task surfaces', () => {
    const forbidden = [
      /\btask_type\b/,
      /\bTaskType\b/,
      /\btask_labels\b/,
      /\bsemantic_colou?r\b/,
      /\blabel_ids\b/,
    ]
    const combined = TASK_SURFACE_PATHS.map(readSrc).join('\n')
    forbidden.forEach((pattern) => {
      expect(combined, pattern.source).not.toMatch(pattern)
    })
  })

  it('keeps Task and TaskPayload object shapes free of taxonomy fields', () => {
    const typesSource = readSrc('api/types.ts')
    const forbidden = [
      /\btask_type\b/,
      /\bTaskType\b/,
      /\btask_labels\b/,
      /\bsemantic_colou?r\b/,
      /\blabel_ids\b/,
    ]
    for (const name of ['Task', 'TaskPayload'] as const) {
      const block = exportedObjectTypeBlock(typesSource, name)
      expect(block.length).toBeGreaterThan(10)
      forbidden.forEach((pattern) => {
        expect(block, `${name} ${pattern.source}`).not.toMatch(pattern)
      })
    }
  })
})
