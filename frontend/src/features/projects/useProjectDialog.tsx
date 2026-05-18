import type { FormEvent } from 'react'
import type { ReactElement } from 'react'
import { useEffect, useState } from 'react'

import { ApiError } from '../../api/client'
import { useVentures } from '../../api/ventures'
import { useProjectMutations } from '../../api/projects'
import type { Project, ProjectPayload } from '../../api/types'
import type { ProjectFormErrors, ProjectFormState } from '../../components/ProjectDialog'
import { ProjectDialog } from '../../components/ProjectDialog'
import { DEFAULT_PROJECT_COLOUR } from '../../lib/projectPalette'
import {
  DEFAULT_PROJECT_FILTER,
  SIDEBAR_PROJECT_FILTER_STORAGE_KEY,
  getSidebarSelectedProjectIds,
  useProjectFilterStore,
  type ProjectFilterState,
} from '../../stores/projectFilter'

type ProjectDialogMode = 'create' | 'edit' | null

const EMPTY_PROJECT_FORM: ProjectFormState = {
  board_status: 'active',
  colour: '',
  description: '',
  icon: '',
  name: '',
  project_type: 'project',
  shippedWhenArchiving: false,
  venture_id: '',
}

function projectPayloadFromForm(formState: ProjectFormState): ProjectPayload {
  return {
    venture_id: formState.venture_id.trim(),
    colour: formState.colour.trim() || null,
    description: formState.description.trim() || null,
    icon: formState.icon.trim() || null,
    name: formState.name.trim(),
    project_type: formState.project_type,
    board_status: formState.board_status,
  }
}

function formStateFromProject(project: Project): ProjectFormState {
  return {
    board_status: project.board_status,
    colour: project.colour ?? '',
    description: project.description ?? '',
    icon: project.icon ?? '',
    name: project.name,
    project_type: project.project_type,
    shippedWhenArchiving: false,
    venture_id: project.venture_id,
  }
}

function projectFieldErrors(error: ApiError | null): ProjectFormErrors {
  if (!error) {
    return {}
  }

  return {
    colour: error.fieldErrors.colour,
    description: error.fieldErrors.description,
    form: error.formError ?? undefined,
    name: error.fieldErrors.name,
    venture_id: error.fieldErrors.venture_id,
  }
}

export type UseProjectDialogParams = {
  onProjectsReload: () => Promise<void>
  onTasksReload: () => Promise<void>
  projectsQueryData: Project[]
  resetSidebarToAllProjects: ProjectFilterState['resetSidebarToAllProjects']
  selectedProjectId: string
  selectedProjectIds: ProjectFilterState['selectedProjectIds']
  setToolbarProjectFilter: ProjectFilterState['setToolbarProjectFilter']
}

const DEFAULT_USE_PROJECT_DIALOG_PARAMS: UseProjectDialogParams = {
  onProjectsReload: async () => {},
  onTasksReload: async () => {},
  projectsQueryData: [],
  resetSidebarToAllProjects: () => {},
  selectedProjectId: '',
  selectedProjectIds: null,
  setToolbarProjectFilter: () => {},
}

export function useProjectDialog(
  params: UseProjectDialogParams = DEFAULT_USE_PROJECT_DIALOG_PARAMS,
): {
  handleProjectEdit: (project: Project) => void
  locallyArchivedProjectIds: string[]
  openCreateProjectDialog: (ventureId?: string) => void
  projectDialog: ReactElement | null
} {
  const {
    onProjectsReload,
    onTasksReload,
    projectsQueryData,
    resetSidebarToAllProjects,
    selectedProjectId,
    selectedProjectIds,
    setToolbarProjectFilter,
  } = params

  const venturesQuery = useVentures('active')
  const activeVentureIds = venturesQuery.data.map((venture) => venture.id)
  const [projectDialogMode, setProjectDialogMode] = useState<ProjectDialogMode>(null)
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [projectForm, setProjectForm] = useState<ProjectFormState>(EMPTY_PROJECT_FORM)
  const [projectFormErrors, setProjectFormErrors] = useState<ProjectFormErrors>({})
  const [locallyArchivedProjectIds, setLocallyArchivedProjectIds] = useState<string[]>([])

  const serverActiveIds = projectsQueryData
    .filter((project) => project.status === 'active')
    .map((project) => project.id)

  const visibleActiveProjectIds = serverActiveIds.filter(
    (projectId) => !locallyArchivedProjectIds.includes(projectId),
  )

  const sidebarSelectedProjectIds = getSidebarSelectedProjectIds(
    selectedProjectIds,
    visibleActiveProjectIds,
  )

  const projectMutations = useProjectMutations()

  useEffect(() => {
    setLocallyArchivedProjectIds((currentIds) => {
      const nextIds = currentIds.filter((projectId) =>
        projectsQueryData.some((project) => project.id === projectId),
      )

      if (
        nextIds.length === currentIds.length &&
        nextIds.every((projectId, index) => projectId === currentIds[index])
      ) {
        return currentIds
      }

      return nextIds
    })
  }, [projectsQueryData])

  const handleProjectInputChange = <K extends keyof ProjectFormState>(
    field: K,
    value: ProjectFormState[K],
  ): void => {
    setProjectForm((currentState) => ({ ...currentState, [field]: value }))
    setProjectFormErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
      form: undefined,
    }))
    projectMutations.resetError()
  }

  const resetProjectForm = (): void => {
    setProjectDialogMode(null)
    setEditingProjectId(null)
    setProjectForm(EMPTY_PROJECT_FORM)
    setProjectFormErrors({})
    projectMutations.resetError()
  }

  const openCreateProjectDialog = (ventureId?: string): void => {
    setProjectDialogMode('create')
    setEditingProjectId(null)
    const ventures = venturesQuery.data
    const resolvedVentureId =
      ventureId !== undefined && ventures.some((venture) => venture.id === ventureId)
        ? ventureId
        : ventures[0]?.id ?? ''
    setProjectForm({
      ...EMPTY_PROJECT_FORM,
      venture_id: resolvedVentureId,
      colour: DEFAULT_PROJECT_COLOUR,
    })
    setProjectFormErrors({})
    projectMutations.resetError()
  }

  const handleProjectSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setProjectFormErrors({})

    try {
      const ventureId = projectForm.venture_id.trim()

      if (!ventureId) {
        setProjectFormErrors({ form: 'Select a venture.' })
        return
      }

      if (!activeVentureIds.includes(ventureId)) {
        setProjectFormErrors({
          form: 'Create or unarchive a venture before adding projects.',
        })
        return
      }

      if (projectForm.name.trim() === '') {
        setProjectFormErrors({ name: 'Enter a project name.' })
        return
      }

      if (editingProjectId) {
        await projectMutations.update(editingProjectId, projectPayloadFromForm(projectForm))
      } else {
        await projectMutations.create(projectPayloadFromForm(projectForm))
      }

      resetProjectForm()
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setProjectFormErrors(projectFieldErrors(caughtError))
        return
      }

      setProjectFormErrors({ form: 'Unable to save project.' })
    }
  }

  const handleProjectEdit = (project: Project): void => {
    setProjectDialogMode('edit')
    setEditingProjectId(project.id)
    setProjectForm(formStateFromProject(project))
    setProjectFormErrors({})
    projectMutations.resetError()
  }

  const handleProjectArchive = async (projectId: string): Promise<void> => {
    setProjectFormErrors({})
    const wasOnlySidebarSelection =
      sidebarSelectedProjectIds.length === 1 && sidebarSelectedProjectIds[0] === projectId
    const toolbarFilteredToArchivedProject = selectedProjectId === projectId
    const filterSnapshot = {
      selectedProjectId,
      selectedProjectIds,
    }

    const nextArchived = locallyArchivedProjectIds.includes(projectId)
      ? locallyArchivedProjectIds
      : [...locallyArchivedProjectIds, projectId]

    const remainingActiveProjectIds = serverActiveIds.filter(
      (activeId) => !nextArchived.includes(activeId),
    )

    setLocallyArchivedProjectIds((currentIds) =>
      currentIds.includes(projectId) ? currentIds : [...currentIds, projectId],
    )

    try {
      await projectMutations.archive(
        projectId,
        projectForm.shippedWhenArchiving ? { finished: true } : undefined,
      )
      await onProjectsReload()
      if (toolbarFilteredToArchivedProject) {
        setToolbarProjectFilter(DEFAULT_PROJECT_FILTER, remainingActiveProjectIds)
      }
      if (wasOnlySidebarSelection) {
        resetSidebarToAllProjects(remainingActiveProjectIds)
      }
      await onTasksReload()
      resetProjectForm()
    } catch (caughtError) {
      setLocallyArchivedProjectIds((currentIds) =>
        currentIds.filter((currentId) => currentId !== projectId),
      )

      if (filterSnapshot.selectedProjectIds === null) {
        localStorage.removeItem(SIDEBAR_PROJECT_FILTER_STORAGE_KEY)
      } else {
        localStorage.setItem(
          SIDEBAR_PROJECT_FILTER_STORAGE_KEY,
          JSON.stringify(filterSnapshot.selectedProjectIds),
        )
      }
      useProjectFilterStore.setState({
        selectedProjectId: filterSnapshot.selectedProjectId,
        selectedProjectIds: filterSnapshot.selectedProjectIds,
      })

      if (caughtError instanceof ApiError) {
        setProjectFormErrors(projectFieldErrors(caughtError))
        return
      }

      setProjectFormErrors({ form: 'Unable to archive project.' })
    }
  }

  const projectDialog =
    projectDialogMode !== null ? (
      <ProjectDialog
        activeVentures={venturesQuery.data}
        editingProjectId={editingProjectId}
        formErrors={projectFormErrors}
        formState={projectForm}
        isOpen
        isSaving={projectMutations.isSaving}
        mode={projectDialogMode}
        onArchive={
          editingProjectId ? () => void handleProjectArchive(editingProjectId) : undefined
        }
        onClose={resetProjectForm}
        onFieldChange={handleProjectInputChange}
        onSubmit={handleProjectSubmit}
      />
    ) : null

  return {
    handleProjectEdit,
    locallyArchivedProjectIds,
    openCreateProjectDialog,
    projectDialog,
  }
}
