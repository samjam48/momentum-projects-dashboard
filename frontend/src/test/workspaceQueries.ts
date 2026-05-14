import { screen, within } from '@testing-library/react'

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
  return screen.findByRole('complementary', { name: /projects sidebar/i })
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
