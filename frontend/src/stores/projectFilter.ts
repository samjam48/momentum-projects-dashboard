import { create } from 'zustand'

export const DEFAULT_PROJECT_FILTER: string = 'all'

export type ProjectFilterState = {
  selectedProjectId: string
  setSelectedProjectId: (projectId: string) => void
}

export const useProjectFilterStore = create<ProjectFilterState>((set) => ({
  selectedProjectId: DEFAULT_PROJECT_FILTER,
  setSelectedProjectId: (projectId) => {
    set({ selectedProjectId: projectId })
  },
}))

export function resetProjectFilterStore(): void {
  useProjectFilterStore.setState({ selectedProjectId: DEFAULT_PROJECT_FILTER })
}
