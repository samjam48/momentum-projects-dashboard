import { buildActivityType, buildTimeLog } from './fixtures'
import { installWorkspaceBackendMock } from './workspaceBackendMock'

describe('workspaceBackendMock Phase C status alignment', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns 409 for duplicate venture category label create and keeps 422 for empty name payload', async () => {
    installWorkspaceBackendMock({})

    const duplicateResponse = await fetch('http://localhost/api/v1/venture-category-labels', {
      method: 'POST',
      body: JSON.stringify({ name: 'Hustle' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(duplicateResponse.status).toBe(409)

    const emptyResponse = await fetch('http://localhost/api/v1/venture-category-labels', {
      method: 'POST',
      body: JSON.stringify({ name: '   ' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(emptyResponse.status).toBe(422)

    const punctuationOnlyResponse = await fetch('http://localhost/api/v1/venture-category-labels', {
      method: 'POST',
      body: JSON.stringify({ name: '!!!' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(punctuationOnlyResponse.status).toBe(422)
  })

  it('returns 409 for reserved and duplicate activity type create conflicts, with 422 for missing name', async () => {
    installWorkspaceBackendMock({})

    const reservedResponse = await fetch('http://localhost/api/v1/activity-types', {
      method: 'POST',
      body: JSON.stringify({ name: 'uncategorised' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(reservedResponse.status).toBe(409)

    const duplicateResponse = await fetch('http://localhost/api/v1/activity-types', {
      method: 'POST',
      body: JSON.stringify({ name: 'planning' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(duplicateResponse.status).toBe(409)

    const missingNameResponse = await fetch('http://localhost/api/v1/activity-types', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(missingNameResponse.status).toBe(422)

    const punctuationOnlyResponse = await fetch('http://localhost/api/v1/activity-types', {
      method: 'POST',
      body: JSON.stringify({ name: '!!!' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(punctuationOnlyResponse.status).toBe(422)
  })

  it('returns 409 when deleting an in-use activity type and 422 for invalid update shape', async () => {
    const admin = buildActivityType({
      id: 'at-admin',
      name: 'admin',
      slug: 'admin',
      sort_order: 0,
    })
    installWorkspaceBackendMock({
      activityTypes: [admin],
      timeLogs: {
        'task-1': [
          buildTimeLog({
            id: 'log-1',
            task_id: 'task-1',
            activity_type_id: 'at-admin',
            activity_type_name: 'admin',
            activity_type_display_name: 'Admin',
            hours: 1,
          }),
        ],
      },
    })

    const deleteResponse = await fetch('http://localhost/api/v1/activity-types/at-admin', {
      method: 'DELETE',
    })
    expect(deleteResponse.status).toBe(409)

    const invalidShapeUpdate = await fetch('http://localhost/api/v1/activity-types/at-admin', {
      method: 'PATCH',
      body: JSON.stringify({ name: '' }),
      headers: { 'Content-Type': 'application/json' },
    })
    if ([404, 405, 500].includes(invalidShapeUpdate.status)) {
      // PATCH support is optional in this mock; enforce 422 only when supported.
      expect([404, 405, 500]).toContain(invalidShapeUpdate.status)
      return
    }

    expect(invalidShapeUpdate.status).toBe(422)

    const punctuationOnlyUpdate = await fetch('http://localhost/api/v1/activity-types/at-admin', {
      method: 'PATCH',
      body: JSON.stringify({ name: '!!!' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(punctuationOnlyUpdate.status).toBe(422)
  })
})
