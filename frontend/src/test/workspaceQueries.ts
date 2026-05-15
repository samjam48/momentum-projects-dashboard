import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { TaskStatus } from '../api/types'

import { flushAct } from './actUtils'

const user = userEvent.setup()

export type KanbanDropDetail = {
  kanban_order: number | null
  status: TaskStatus
  taskId: string
}

export function getSidebar(): HTMLElement {
  return screen.getByRole('complementary', { name: /projects sidebar/i })
}

export function getKanbanRegion(): HTMLElement {
  return screen.getByRole('region', { name: /kanban board/i })
}

export function getTableRegion(): HTMLElement {
  return screen.getByRole('region', { name: /task summary/i })
}

export async function waitForWorkspaceReady(): Promise<HTMLElement> {
  const sidebar = await screen.findByRole('complementary', { name: /projects sidebar/i })

  await waitFor(() => {
    expect(screen.queryByText(/loading workspace/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/loading projects/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/loading tasks/i)).not.toBeInTheDocument()
  })

  await flushAct()

  return sidebar
}

export async function clickElement(element: HTMLElement): Promise<void> {
  await waitFor(async () => {
    await user.click(element)
  })
  await flushAct()
}

export async function selectComboboxOption(
  name: RegExp,
  value: string,
): Promise<void> {
  await waitFor(async () => {
    const combobox = screen.getByRole('combobox', { name })
    await user.selectOptions(combobox, value)
  })
  await flushAct()
}

export async function clickProjectFilterCheckbox(projectName: string): Promise<void> {
  await clickElement(getProjectFilterCheckbox(projectName))
}

export function getProjectFilterCheckbox(projectName: string): HTMLElement {
  const sidebar = getSidebar()
  return within(sidebar).getByRole('checkbox', { name: new RegExp(projectName, 'i') })
}

export function queryHexStrings(container: HTMLElement): HTMLElement[] {
  const hexPattern = /#[0-9A-Fa-f]{6}/
  return Array.from(container.querySelectorAll('*')).filter(
    (element) =>
      element.childElementCount === 0 &&
      hexPattern.test(element.textContent ?? ''),
  ) as HTMLElement[]
}

export function getKanbanBoard(): HTMLElement {
  const region = getKanbanRegion()
  const board =
    region.querySelector('.kanban-grid-row') ?? region.querySelector('.kanban-grid')

  if (!(board instanceof HTMLElement)) {
    throw new Error('Expected kanban board grid element inside the kanban region.')
  }

  return board
}

export function getKanbanColumn(label: RegExp): HTMLElement {
  const board = getKanbanBoard()
  return within(board).getByRole('region', { name: label })
}

export function getTaskCard(column: HTMLElement, title: string): HTMLElement {
  const taskTitle = within(column).getByTestId('kanban-task-title')
  expect(taskTitle).toHaveTextContent(title)
  const taskCard = taskTitle.closest('li')

  if (!(taskCard instanceof HTMLElement)) {
    throw new Error(`Expected task ${title} to be inside a kanban card.`)
  }

  return taskCard
}

export function getTaskCardByTitle(column: HTMLElement, title: string): HTMLElement {
  const taskTitle = within(column).getByText(title)
  const taskCard = taskTitle.closest('li')

  if (!(taskCard instanceof HTMLElement)) {
    throw new Error(`Expected task ${title} to be inside a kanban card.`)
  }

  return taskCard
}

export async function waitForKanbanCard(
  title: string,
  columnLabel: RegExp = /backlog/i,
): Promise<HTMLElement> {
  const column = getKanbanColumn(columnLabel)
  await waitFor(() => {
    expect(within(column).getByTestId('kanban-task-title')).toHaveTextContent(title)
  })
  return getTaskCard(column, title)
}

export async function waitForKanbanTaskVisible(
  title: string,
  columnLabel: RegExp = /backlog/i,
): Promise<void> {
  const column = getKanbanColumn(columnLabel)
  await waitFor(() => {
    expect(within(column).getByText(title)).toBeInTheDocument()
  })
}

export function expectKanbanTaskOrder(column: HTMLElement, titles: string[]): void {
  const label =
    column.querySelector('.task-card-header .status-pill')?.textContent?.trim() ?? ''
  const freshColumn = getKanbanColumn(new RegExp(label, 'i'))
  const items = freshColumn.querySelectorAll('ul.task-list > li')
  const actualOrder = Array.from(items).map((item) => {
    const title =
      within(item as HTMLElement).getByTestId('kanban-task-title').textContent?.trim() ?? ''
    return title
  })

  expect(actualOrder).toEqual(titles)
}

export async function dispatchKanbanDrop(detail: KanbanDropDetail): Promise<void> {
  const board = getKanbanBoard()
  await waitFor(() => {
    fireEvent(
      board,
      new CustomEvent('kanban:drop', {
        bubbles: true,
        detail,
      }),
    )
  })
  await flushAct()
}

export async function clickBoardOptionsCheckbox(label: RegExp): Promise<void> {
  await clickElement(getBoardOptionsCheckbox(label))
}

export function getBoardOptionsButton(): HTMLElement {
  return screen.getByRole('button', { name: /board options/i })
}

export async function openBoardOptionsMenu(): Promise<HTMLElement> {
  await clickElement(getBoardOptionsButton())
  return screen.getByRole('menu', { name: /board options/i })
}

export function getBoardOptionsCheckbox(label: RegExp): HTMLElement {
  const menu = screen.getByRole('menu', { name: /board options/i })
  return within(menu).getByRole('menuitemcheckbox', { name: label })
}

export function queryKanbanCardMoveButtons(card: HTMLElement): HTMLElement[] {
  return within(card)
    .queryAllByRole('button')
    .filter((button) => {
      const name = button.getAttribute('aria-label') ?? button.textContent ?? ''
      return /drag task|move task .* (up|down|to)/i.test(name)
    })
}

export function getTopNavProjectsControl(): HTMLElement {
  const nav = screen.getByRole('navigation', { name: /primary/i })
  return within(nav).getByRole('button', { name: /^projects$/i })
}

export function getArchiveViewControl(): HTMLElement {
  const sidebar = getSidebar()
  return within(sidebar).getByRole('button', { name: /view archive/i })
}

export function getTaskSummaryFilterSubtitle(): HTMLElement {
  const tableRegion = getTableRegion()
  return within(tableRegion).getByText(/^showing /i)
}

export function getKanbanBoardOptionsControl(): HTMLElement {
  const kanbanRegion = getKanbanRegion()
  return within(kanbanRegion).getByRole('button', { name: /board options|display options/i })
}

export function getTableSortControl(): HTMLElement {
  const tableRegion = getTableRegion()
  return within(tableRegion).getByTestId('table-sort-gear')
}

export async function openTableSortMenu(): Promise<HTMLElement> {
  await clickElement(getTableSortControl())
  return screen.getByRole('menu', { name: /sort by/i })
}
