import { create } from 'zustand'

export const BOARD_DISPLAY_OPTIONS_STORAGE_KEY = 'momentum.boardDisplayOptions'

export type BoardDisplayOptions = {
  showActualHours: boolean
  showDueDate: boolean
  showPriority: boolean
  showProjectName: boolean
  showStatusBadge: boolean
}

export const DEFAULT_BOARD_DISPLAY_OPTIONS: BoardDisplayOptions = {
  showDueDate: true,
  showPriority: false,
  showActualHours: false,
  showStatusBadge: false,
  showProjectName: false,
}

type BoardDisplayOptionsState = BoardDisplayOptions & {
  setOption: (key: keyof BoardDisplayOptions, value: boolean) => void
  toggleOption: (key: keyof BoardDisplayOptions) => void
}

export function readBoardDisplayOptionsFromStorage(): BoardDisplayOptions {
  if (typeof window === 'undefined') {
    return DEFAULT_BOARD_DISPLAY_OPTIONS
  }

  const raw = localStorage.getItem(BOARD_DISPLAY_OPTIONS_STORAGE_KEY)
  if (!raw) {
    return DEFAULT_BOARD_DISPLAY_OPTIONS
  }

  try {
    const parsed = JSON.parse(raw) as Partial<BoardDisplayOptions>
    return {
      ...DEFAULT_BOARD_DISPLAY_OPTIONS,
      ...parsed,
    }
  } catch {
    return DEFAULT_BOARD_DISPLAY_OPTIONS
  }
}

function writeStoredOptions(options: BoardDisplayOptions): void {
  localStorage.setItem(BOARD_DISPLAY_OPTIONS_STORAGE_KEY, JSON.stringify(options))
}

export const useBoardDisplayOptionsStore = create<BoardDisplayOptionsState>((set, get) => ({
  ...readBoardDisplayOptionsFromStorage(),
  setOption: (key, value) => {
    const next = { ...get(), [key]: value }
    writeStoredOptions({
      showDueDate: next.showDueDate,
      showPriority: next.showPriority,
      showActualHours: next.showActualHours,
      showStatusBadge: next.showStatusBadge,
      showProjectName: next.showProjectName,
    })
    set({ [key]: value })
  },
  toggleOption: (key) => {
    const current = get()[key]
    get().setOption(key, !current)
  },
}))

export function resetBoardDisplayOptionsStore(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(BOARD_DISPLAY_OPTIONS_STORAGE_KEY)
  }

  useBoardDisplayOptionsStore.setState({
    ...DEFAULT_BOARD_DISPLAY_OPTIONS,
  })
}

export function hydrateBoardDisplayOptionsFromStorage(): void {
  useBoardDisplayOptionsStore.setState(readBoardDisplayOptionsFromStorage())
}
