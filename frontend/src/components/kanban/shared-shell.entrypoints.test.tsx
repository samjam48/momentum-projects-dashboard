import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'

import type { Project, Task } from '../../api/types'
import { TaskKanbanBoard } from '../TaskKanbanBoard'
import { ProjectKanbanBoard } from '../ProjectKanbanBoard'
import { buildProject, buildTask } from '../../test/fixtures'
import { DEFAULT_BOARD_DISPLAY_OPTIONS } from '../../stores/boardDisplayOptions'

function readRequiredSource(relativePath: string, description: string): string {
  const absolutePath = resolve(process.cwd(), relativePath)

  expect(
    existsSync(absolutePath),
    `Expected ${description} at ${absolutePath}, but it does not exist yet.`,
  ).toBe(true)

  return readFileSync(absolutePath, 'utf8')
}

describe('FR-6 shared kanban shell entry points', () => {
  it('extracts the shared DnD board wrapper and column shell out of the task and project entry points', () => {
    const taskBoardSource = readRequiredSource(
      'src/components/TaskKanbanBoard.tsx',
      'the FR-6 task board entry point',
    )
    const projectBoardSource = readRequiredSource(
      'src/components/ProjectKanbanBoard.tsx',
      'the FR-6 project board entry point',
    )
    const kanbanBoardSource = readRequiredSource(
      'src/components/kanban/KanbanBoard.tsx',
      'the extracted shared KanbanBoard shell for FR-6',
    )
    const kanbanColumnSource = readRequiredSource(
      'src/components/kanban/KanbanColumn.tsx',
      'the extracted shared KanbanColumn shell for FR-6',
    )

    expect(kanbanBoardSource).toMatch(/\bDndContext\b/)
    expect(kanbanBoardSource).toMatch(/\bPointerSensor\b/)
    expect(kanbanBoardSource).toMatch(/\bKeyboardSensor\b/)
    expect(kanbanBoardSource).toMatch(/\bsortableKeyboardCoordinates\b/)
    expect(kanbanBoardSource).toMatch(/activationConstraint\s*:\s*\{[\s\S]*distance\s*:\s*8/)
    expect(kanbanBoardSource).toMatch(/\bboardRef:\s*RefObject<HTMLDivElement>/)
    expect(kanbanBoardSource).toMatch(/\bonDragEnd:\s*\(event:\s*DragEndEvent\)\s*=>\s*void/)
    expect(kanbanBoardSource).toMatch(/\bchildren\b/)

    expect(kanbanColumnSource).toMatch(/\baria-label=\{title\}/)
    expect(kanbanColumnSource).toMatch(/\bkanban-empty-state\b/)
    expect(kanbanColumnSource).toMatch(/\bmuted-copy\b/)

    expect(taskBoardSource).toMatch(/\bKanbanBoard\b/)
    expect(taskBoardSource).toMatch(/\bKanbanColumn\b/)
    expect(projectBoardSource).toMatch(/\bKanbanBoard\b/)
    expect(projectBoardSource).toMatch(/\bKanbanColumn\b/)

    ;[
      /\bDndContext\b/,
      /\bPointerSensor\b/,
      /\bKeyboardSensor\b/,
      /\buseDroppable\b/,
      /\buseSensor\b/,
      /\buseSensors\b/,
      /\bSortableContext\b/,
    ].forEach((pattern) => {
      expect(taskBoardSource).not.toMatch(pattern)
      expect(projectBoardSource).not.toMatch(pattern)
    })
  })

  it('keeps task and project cards as feature-specific adapters over a shared sortable card shell', () => {
    const kanbanCardShellSource = readRequiredSource(
      'src/components/kanban/KanbanCardShell.tsx',
      'the extracted shared KanbanCardShell for FR-6',
    )
    const taskCardSource = readRequiredSource(
      'src/components/kanban/KanbanTaskCard.tsx',
      'the FR-6 task card adapter',
    )
    const projectCardSource = readRequiredSource(
      'src/components/kanban/KanbanProjectCard.tsx',
      'the FR-6 project card adapter',
    )

    expect(kanbanCardShellSource).toMatch(/\buseSortable\b/)
    expect(kanbanCardShellSource).toMatch(/\bdraggingDisabled:\s*boolean/)
    expect(kanbanCardShellSource).toMatch(/\bchildren\b/)

    expect(taskCardSource).toMatch(/\bKanbanCardShell\b/)
    expect(projectCardSource).toMatch(/\bKanbanCardShell\b/)
    expect(taskCardSource).not.toMatch(/\buseSortable\b/)
    expect(projectCardSource).not.toMatch(/\buseSortable\b/)

    expect(taskCardSource).toMatch(/\bboardDisplayOptions\b/)
    expect(taskCardSource).toMatch(/\bshowProjectNameOnCard\b/)
    expect(taskCardSource).toMatch(/\bonOpenTask\b/)
    expect(taskCardSource).not.toMatch(/\bopenTaskCounts\b/)

    expect(projectCardSource).toMatch(/\bopenTaskCounts\b/)
    expect(projectCardSource).toMatch(/\bonOpenProject\b/)
    expect(projectCardSource).not.toMatch(/\bboardDisplayOptions\b/)
    expect(projectCardSource).not.toMatch(/\bshowProjectNameOnCard\b/)
  })

  it('keeps the task board entry point safe for title clicks and empty columns when dragging is disabled', async () => {
    const user = userEvent.setup()
    const boardRef = createRef<HTMLDivElement>()
    const project = buildProject({
      id: 'project-fr6-task-entry',
      name: 'Task entry point project',
    })
    const task = buildTask({
      id: 'task-fr6-entry',
      project_id: project.id,
      title: 'Task entry point title',
      status: 'backlog',
      kanban_order: 0,
    })
    const onOpenTask = vi.fn<(task: Task) => void>()

    render(
      <TaskKanbanBoard
        boardDisplayOptions={DEFAULT_BOARD_DISPLAY_OPTIONS}
        boardInteractionDisabled
        boardRef={boardRef}
        displayTasks={[task]}
        hasSidebarProjectSelection
        kanbanMutationError={null}
        onDragEnd={() => {}}
        onOpenTask={onOpenTask}
        projectsById={{ [project.id]: project }}
        showProjectNameOnCard
        tasksError={null}
        tasksLoading={false}
      />,
    )

    const backlogColumn = screen.getByRole('region', { name: /backlog/i })
    const reviewColumn = screen.getByRole('region', { name: /review/i })
    const titleButton = within(backlogColumn).getByRole('button', { name: /task entry point title/i })

    expect(boardRef.current).toHaveClass('kanban-grid-row')
    expect(boardRef.current?.querySelectorAll('section.kanban-column')).toHaveLength(4)
    expect(within(reviewColumn).getByText('No tasks in this column.')).toHaveClass('muted-copy')

    await user.click(titleButton)
    titleButton.focus()
    await user.keyboard('{Enter}')

    expect(onOpenTask).toHaveBeenCalledTimes(2)
    expect(onOpenTask).toHaveBeenNthCalledWith(1, task)
    expect(onOpenTask).toHaveBeenNthCalledWith(2, task)
  })

  it('keeps the project board entry point safe for title clicks and empty columns when dragging is disabled', async () => {
    const user = userEvent.setup()
    const boardRef = createRef<HTMLDivElement>()
    const project = buildProject({
      id: 'project-fr6-project-entry',
      name: 'Project entry point title',
      board_status: 'active',
      kanban_order: 0,
      project_type: 'contract',
    })
    const onOpenProject = vi.fn<(project: Project) => void>()

    render(
      <ProjectKanbanBoard
        boardInteractionDisabled
        boardRef={boardRef}
        displayProjects={[project]}
        filterMatchedProjects
        hasSidebarProjectSelection
        kanbanMutationError={null}
        onDragEnd={() => {}}
        onOpenProject={onOpenProject}
        openTaskCounts={{ [project.id]: 3 }}
        projectsError={null}
        projectsLoading={false}
      />,
    )

    const activeColumn = screen.getByRole('region', { name: /active/i })
    const ideaColumn = screen.getByRole('region', { name: /idea/i })
    const titleButton = within(activeColumn).getByRole('button', {
      name: /project entry point title/i,
    })

    expect(boardRef.current).toHaveClass('kanban-grid-row')
    expect(boardRef.current?.querySelectorAll('section.kanban-column')).toHaveLength(4)
    expect(
      within(ideaColumn).getByText(
        'No projects in this column. Drop a project here when moving cards between columns.',
      ),
    ).toHaveClass('muted-copy')

    await user.click(titleButton)
    titleButton.focus()
    await user.keyboard('{Enter}')

    expect(onOpenProject).toHaveBeenCalledTimes(2)
    expect(onOpenProject).toHaveBeenNthCalledWith(1, project)
    expect(onOpenProject).toHaveBeenNthCalledWith(2, project)
  })
})
