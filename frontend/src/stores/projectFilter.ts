import { create } from 'zustand'

export const DEFAULT_PROJECT_FILTER = 'all'
export const SIDEBAR_PROJECT_FILTER_STORAGE_KEY = 'momentum.sidebar.selectedProjectIds'

export type ProjectFilterState = {
  isSidebarProjectSelected: (projectId: string, activeProjectIds: string[]) => boolean
  resetSidebarToAllProjects: (activeProjectIds: string[]) => void
  selectedProjectId: string
  selectedProjectIds: string[] | null
  setToolbarProjectFilter: (projectId: string, activeProjectIds: string[]) => void
  toggleSidebarProject: (projectId: string, activeProjectIds: string[]) => void
}

function readStoredProjectIds(): string[] | null {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = localStorage.getItem(SIDEBAR_PROJECT_FILTER_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return null
    }

    return parsed.filter((value): value is string => typeof value === 'string')
  } catch {
    return null
  }
}

function writeStoredProjectIds(projectIds: string[]): void {
  localStorage.setItem(SIDEBAR_PROJECT_FILTER_STORAGE_KEY, JSON.stringify(projectIds))
}

export function getSidebarSelectedProjectIds(
  storedIds: string[] | null,
  activeProjectIds: string[],
): string[] {
  if (storedIds === null) {
    return activeProjectIds
  }

  return storedIds.filter((projectId) => activeProjectIds.includes(projectId))
}

export function deriveToolbarProjectId(
  sidebarIds: string[],
  activeProjectIds: string[],
): string {
  if (activeProjectIds.length === 0) {
    return DEFAULT_PROJECT_FILTER
  }

  const activeSidebarIds = sidebarIds.filter((projectId) =>
    activeProjectIds.includes(projectId),
  )

  const isAllSelected =
    activeSidebarIds.length === activeProjectIds.length &&
    activeProjectIds.every((projectId) => activeSidebarIds.includes(projectId))

  if (isAllSelected || activeSidebarIds.length !== 1) {
    return DEFAULT_PROJECT_FILTER
  }

  return activeSidebarIds[0] ?? DEFAULT_PROJECT_FILTER
}

export const useProjectFilterStore = create<ProjectFilterState>((set, get) => ({
  selectedProjectId: DEFAULT_PROJECT_FILTER,
  selectedProjectIds: readStoredProjectIds(),
  setToolbarProjectFilter: (projectId, activeProjectIds) => {
    if (activeProjectIds.length === 0) {
      set({ selectedProjectId: projectId })
      return
    }

    if (projectId === DEFAULT_PROJECT_FILTER) {
      writeStoredProjectIds(activeProjectIds)
      set({
        selectedProjectId: DEFAULT_PROJECT_FILTER,
        selectedProjectIds: activeProjectIds,
      })
      return
    }

    writeStoredProjectIds([projectId])
    set({
      selectedProjectId: projectId,
      selectedProjectIds: [projectId],
    })
  },
  isSidebarProjectSelected: (projectId, activeProjectIds) => {
    const storedIds = get().selectedProjectIds
    if (storedIds === null) {
      return activeProjectIds.includes(projectId)
    }

    return storedIds.includes(projectId)
  },
  toggleSidebarProject: (projectId, activeProjectIds) => {
    const storedIds = get().selectedProjectIds
    const currentSelection = storedIds ?? activeProjectIds
    const nextSelection = currentSelection.includes(projectId)
      ? currentSelection.filter((id) => id !== projectId)
      : [...currentSelection, projectId]

    writeStoredProjectIds(nextSelection)
    const sidebarIds = getSidebarSelectedProjectIds(nextSelection, activeProjectIds)
    set({
      selectedProjectIds: nextSelection,
      selectedProjectId: deriveToolbarProjectId(sidebarIds, activeProjectIds),
    })
  },
  resetSidebarToAllProjects: (activeProjectIds) => {
    writeStoredProjectIds(activeProjectIds)
    set({
      selectedProjectId: DEFAULT_PROJECT_FILTER,
      selectedProjectIds: activeProjectIds,
    })
  },
}))

export function resetProjectFilterStore(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SIDEBAR_PROJECT_FILTER_STORAGE_KEY)
  }

  useProjectFilterStore.setState({
    selectedProjectId: DEFAULT_PROJECT_FILTER,
    selectedProjectIds: null,
  })
}
