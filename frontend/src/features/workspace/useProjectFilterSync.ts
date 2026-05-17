import { useEffect, useMemo } from 'react'

import {
  DEFAULT_PROJECT_FILTER,
  deriveToolbarProjectId,
  getSidebarSelectedProjectIds,
  useProjectFilterStore,
  type ProjectFilterState,
} from '../../stores/projectFilter'

type UseProjectFilterSyncArgs = {
  activeProjectIds: string[]
}

/**
 * Keeps Zustand toolbar project selection aligned with sidebar subset rules and
 * clears stale toolbar picks when the active project list changes.
 */
export function useProjectFilterSync({ activeProjectIds }: UseProjectFilterSyncArgs): void {
  const selectedProjectId = useProjectFilterStore(
    (state: ProjectFilterState): string => state.selectedProjectId,
  )
  const selectedProjectIds = useProjectFilterStore(
    (state: ProjectFilterState): ProjectFilterState['selectedProjectIds'] =>
      state.selectedProjectIds,
  )
  const setToolbarProjectFilter = useProjectFilterStore(
    (state: ProjectFilterState): ProjectFilterState['setToolbarProjectFilter'] =>
      state.setToolbarProjectFilter,
  )

  const activeProjectIdsKey = useMemo(
    () => activeProjectIds.join('|'),
    [activeProjectIds],
  )
  const storedProjectIdsKey = selectedProjectIds?.join('|') ?? ''

  useEffect(() => {
    const projectIds =
      activeProjectIdsKey.length > 0 ? activeProjectIdsKey.split('|') : []
    if (projectIds.length === 0) {
      return
    }

    const sidebarIds = getSidebarSelectedProjectIds(selectedProjectIds, projectIds)
    const toolbarProjectId = deriveToolbarProjectId(sidebarIds, projectIds)

    if (selectedProjectId !== toolbarProjectId) {
      useProjectFilterStore.setState({ selectedProjectId: toolbarProjectId })
    }
  }, [activeProjectIdsKey, selectedProjectId, storedProjectIdsKey, selectedProjectIds])

  useEffect(() => {
    const projectIds =
      activeProjectIdsKey.length > 0 ? activeProjectIdsKey.split('|') : []
    if (projectIds.length === 0) {
      return
    }

    if (
      selectedProjectId !== DEFAULT_PROJECT_FILTER &&
      !projectIds.includes(selectedProjectId)
    ) {
      setToolbarProjectFilter(DEFAULT_PROJECT_FILTER, projectIds)
    }
  }, [activeProjectIdsKey, selectedProjectId, setToolbarProjectFilter])
}
