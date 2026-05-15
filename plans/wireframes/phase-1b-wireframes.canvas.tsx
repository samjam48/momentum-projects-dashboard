import {
  Button,
  Callout,
  Card,
  CardBody,
  Checkbox,
  Divider,
  Grid,
  H1,
  H2,
  H3,
  Pill,
  Row,
  Spacer,
  Stack,
  Table,
  Text,
  mergeStyle,
  useCanvasState,
  useHostTheme,
  type CSSProperties,
} from 'cursor/canvas'

type Screen = 'projects-1b' | 'modals' | 'phase-16' | 'dashboard-3'
type BoardMode = 'tasks' | 'projects'

function Frame({
  children,
  style,
  dashed,
}: {
  children?: React.ReactNode
  style?: CSSProperties
  dashed?: boolean
}) {
  const t = useHostTheme()
  return (
    <Stack
      gap={0}
      style={mergeStyle(
        {
          border: `${dashed ? '1px dashed' : '1px solid'} ${t.stroke.secondary}`,
          borderRadius: 6,
          background: t.bg.elevated,
          padding: 8,
          overflow: 'hidden',
        },
        style,
      )}
    >
      {children}
    </Stack>
  )
}

function ColorDot({ tone }: { tone: 'project' | 'venture' | 'muted' }) {
  const t = useHostTheme()
  const bg =
    tone === 'project'
      ? t.accent.primary
      : tone === 'venture'
        ? t.text.link
        : t.fill.primary
  return (
    <Stack
      style={{
        width: 8,
        height: 8,
        borderRadius: 99,
        background: bg,
        flexShrink: 0,
      }}
    />
  )
}

function TaskCardWire({
  title,
  project,
  metric,
  showVentureLine,
}: {
  title: string
  project: string
  metric: string
  showVentureLine?: boolean
}) {
  const t = useHostTheme()
  return (
    <Frame style={{ padding: 10, gap: 6 }}>
      <Row gap={6} align="center">
        <ColorDot tone="project" />
        <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
          <Text
            size="small"
            weight="semibold"
            style={
              showVentureLine
                ? { borderBottom: `2px solid ${t.text.link}`, paddingBottom: 2 }
                : undefined
            }
          >
            {title}
          </Text>
          <Text size="small" tone="tertiary">
            {project}
          </Text>
        </Stack>
      </Row>
      <Text size="small" tone="secondary">
        {metric}
      </Text>
    </Frame>
  )
}

function KanbanColumnWire({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children?: React.ReactNode
}) {
  const t = useHostTheme()
  return (
    <Frame style={{ flex: '0 0 168px', minHeight: 200, background: t.bg.chrome }}>
      <Row justify="space-between" align="center" style={{ marginBottom: 8 }}>
        <Text size="small" weight="semibold">
          {title}
        </Text>
        <Pill size="sm">{String(count)}</Pill>
      </Row>
      <Stack gap={8}>{children}</Stack>
    </Frame>
  )
}

function TopNavWire({ active }: { active: 'projects' | 'income' | 'goals' }) {
  return (
    <Frame style={{ padding: '10px 12px' }}>
      <Row gap={8} align="center">
        <Text weight="semibold">Momentum</Text>
        <Spacer />
        <Pill active={active === 'projects'}>Projects</Pill>
        <Pill tone="neutral">Income</Pill>
        <Pill tone="neutral">Goals</Pill>
        <Text size="small" tone="quaternary">
          Dashboard (Phase 3)
        </Text>
      </Row>
    </Frame>
  )
}

function Sidebar1bWire({
  onProjectClick,
}: {
  onProjectClick?: () => void
}) {
  const t = useHostTheme()
  return (
    <Frame
      style={{
        width: 200,
        minHeight: 420,
        background: t.bg.sidebar,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 10,
      }}
    >
      <Stack gap={10}>
        <Text size="small" tone="tertiary" weight="semibold">
          PROJECTS (Phase 1b)
        </Text>
        <Text size="small" tone="quaternary">
          Flat list until Phase 1.6 adds ventures
        </Text>
        <Stack gap={8}>
          {['Podcast', 'Trading bot', 'Etsy store'].map((name) => (
            <Row key={name} gap={8} align="center">
              <Checkbox checked disabled label="" />
              <Button variant="ghost" onClick={onProjectClick}>
                <Text size="small" weight="semibold">
                  {name}
                </Text>
              </Button>
            </Row>
          ))}
        </Stack>
        <Button variant="secondary" style={{ width: '100%' }}>
          + Hustle (1.6)
        </Button>
      </Stack>
      <Button variant="ghost">View archive</Button>
    </Frame>
  )
}

function Sidebar16Wire() {
  const t = useHostTheme()
  const [expanded, setExpanded] = useCanvasState('venture-podcast-open', true)
  return (
    <Frame
      style={{
        width: 220,
        minHeight: 420,
        background: t.bg.sidebar,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 10,
      }}
    >
      <Stack gap={10}>
        <Text size="small" tone="tertiary" weight="semibold">
          VENTURES
        </Text>
        <Stack gap={6}>
          <Row gap={6} align="center">
            <Button variant="ghost" onClick={() => setExpanded(!expanded)}>
              {expanded ? 'v' : '>'}
            </Button>
            <ColorDot tone="venture" />
            <Text size="small" weight="semibold">
              Podcast business
            </Text>
          </Row>
          {expanded ? (
            <Stack gap={6} style={{ paddingLeft: 28 }}>
              {['Website rebuild', 'Sponsor outreach'].map((p) => (
                <Row key={p} gap={8} align="center">
                  <Checkbox checked disabled label="" />
                  <ColorDot tone="project" />
                  <Text size="small">{p}</Text>
                </Row>
              ))}
            </Stack>
          ) : null}
          <Row gap={6} align="center">
            <Button variant="ghost">{`>`}</Button>
            <ColorDot tone="venture" />
            <Text size="small" weight="semibold">
              Trading bots
            </Text>
          </Row>
        </Stack>
        <Button variant="primary">+ Hustle</Button>
      </Stack>
      <Button variant="ghost">View archive</Button>
    </Frame>
  )
}

function ProjectsPageWire({
  boardMode,
  setBoardMode,
  onOpenModals,
}: {
  boardMode: BoardMode
  setBoardMode: (m: BoardMode) => void
  onOpenModals: () => void
}) {
  return (
    <Stack gap={12} style={{ flex: 1, minWidth: 0 }}>
      <TopNavWire active="projects" />
      <Frame dashed style={{ padding: 10 }}>
        <Row gap={8} align="center" wrap>
          <Row gap={4}>
            <Pill active={boardMode === 'tasks'} onClick={() => setBoardMode('tasks')}>
              Tasks
            </Pill>
            <Pill
              active={boardMode === 'projects'}
              onClick={() => setBoardMode('projects')}
              tone="info"
            >
              Projects (1.6)
            </Pill>
          </Row>
          <Pill>All projects</Pill>
          <Button variant="primary">+ New task</Button>
          <Button variant="secondary">Board options</Button>
          <Spacer />
          <Text size="small" tone="tertiary">
            No workspace filter panel
          </Text>
        </Row>
      </Frame>

      {boardMode === 'tasks' ? (
        <Row gap={10} align="stretch" style={{ overflowX: 'auto', paddingBottom: 4 }}>
          <KanbanColumnWire title="Backlog" count={1}>
            <TaskCardWire
              title="Landing page copy"
              project="Podcast"
              metric="Due 29 May"
              showVentureLine
            />
          </KanbanColumnWire>
          <KanbanColumnWire title="In Progress" count={1}>
            <TaskCardWire
              title="SEO audit"
              project="Website"
              metric="Due 14 Jun"
              showVentureLine
            />
          </KanbanColumnWire>
          <KanbanColumnWire title="Review" count={0}>
            <Text size="small" tone="quaternary">
              Empty column
            </Text>
          </KanbanColumnWire>
          <KanbanColumnWire title="Done" count={1}>
            <TaskCardWire title="Episode edit" project="Podcast" metric="4.5h logged" />
          </KanbanColumnWire>
        </Row>
      ) : (
        <Row gap={10} style={{ overflowX: 'auto' }}>
          {(['Idea', 'Active', 'Paused', 'Shipped'] as const).map((col, i) => (
            <KanbanColumnWire key={col} title={col} count={i === 1 ? 2 : 0}>
              {i === 1 ? (
                <Frame>
                  <Row gap={6} align="center">
                    <ColorDot tone="project" />
                    <Text size="small" weight="semibold">
                      Website rebuild
                    </Text>
                  </Row>
                  <Text size="small" tone="tertiary">
                    3 open tasks
                  </Text>
                </Frame>
              ) : (
                <Text size="small" tone="quaternary">
                  —
                </Text>
              )}
            </KanbanColumnWire>
          ))}
        </Row>
      )}

      <Stack gap={6}>
        <Row align="center">
          <H3>Task summary</H3>
          <Spacer />
          <Pill size="sm">Sort: due date</Pill>
        </Row>
        <Table
          headers={['Title', 'Project', 'Status', 'Priority', 'Due', 'Hours']}
          rows={[
            ['Landing page copy', 'Podcast', 'backlog', 'high', '29 May', '—'],
            ['SEO audit', 'Website', 'in progress', 'medium', '14 Jun', '1.5'],
            ['Episode edit', 'Podcast', 'done', 'medium', '—', '4.5'],
          ]}
          striped
        />
      </Stack>

      <Callout tone="info" title="Interactions">
        <Text size="small" tone="secondary">
          Drag anywhere on card · Click title opens task modal ·{' '}
          <Button variant="ghost" onClick={onOpenModals}>
            See modals screen
          </Button>
        </Text>
      </Callout>
    </Stack>
  )
}

function ModalOverlay({ title, children }: { title: string; children?: React.ReactNode }) {
  const t = useHostTheme()
  return (
    <Frame
      style={{
        maxWidth: 480,
        margin: '0 auto',
        background: t.bg.editor,
        border: `1px solid ${t.stroke.primary}`,
      }}
    >
      <Row style={{ padding: '12px 14px', borderBottom: `1px solid ${t.stroke.tertiary}` }}>
        <Text weight="semibold">{title}</Text>
        <Spacer />
        <Text tone="tertiary">x</Text>
      </Row>
      <Stack gap={12} style={{ padding: 14 }}>
        {children}
      </Stack>
    </Frame>
  )
}

function ModalsScreen() {
  const t = useHostTheme()
  return (
    <Stack gap={20}>
      <H2>Dialogs (shadcn Dialog)</H2>
      <Grid columns={2} gap={16}>
        <Stack gap={8}>
          <Text weight="semibold">Edit project (interim hub)</Text>
          <ModalOverlay title="Edit project">
            <Stack gap={8}>
              <Text size="small" tone="tertiary">
                Name
              </Text>
              <Frame dashed style={{ padding: 8 }}>
                <Text>Podcast</Text>
              </Frame>
              <Text size="small" tone="tertiary">
                Description
              </Text>
              <Frame dashed style={{ minHeight: 48 }} />
              <Text size="small" tone="tertiary">
                Colour
              </Text>
              <Row gap={8} align="center">
                <Stack
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 99,
                    background: t.accent.primary,
                    border: `2px solid ${t.text.primary}`,
                  }}
                />
                <Text size="small" tone="secondary">
                  Click to choose (12 options)
                </Text>
              </Row>
              <Divider />
              <Button variant="secondary">Archive project</Button>
            </Stack>
          </ModalOverlay>
        </Stack>

        <Stack gap={8}>
          <Text weight="semibold">Edit task</Text>
          <ModalOverlay title="Task detail">
            <Stack gap={8}>
              <Frame dashed style={{ padding: 8 }}>
                <Text weight="semibold">SEO audit</Text>
              </Frame>
              <Row gap={8}>
                <Pill active>Website</Pill>
                <Pill>In progress</Pill>
                <Pill>Medium</Pill>
              </Row>
              <Text size="small" tone="tertiary">
                Time logs · actual hours read-only
              </Text>
              <Frame dashed style={{ minHeight: 64 }}>
                <Text size="small" tone="quaternary">
                  Manual time log form
                </Text>
              </Frame>
              <Row gap={8}>
                <Button variant="primary">Save</Button>
                <Button variant="ghost">Cancel</Button>
              </Row>
            </Stack>
          </ModalOverlay>
        </Stack>
      </Grid>

      <Callout tone="warning" title="Phase 1b scope">
        No permanent create/edit forms on the page. All create flows open modals. Project hub
        page with stats replaces edit-only modal in Phase 3.
      </Callout>
    </Stack>
  )
}

function Dashboard3Screen() {
  const [weekly, setWeekly] = useCanvasState('dash-weekly', false)
  return (
    <Stack gap={16}>
      <H2>Dashboard (Phase 3 — IA preview)</H2>
      <Row gap={8} align="center">
        <Text size="small">Period:</Text>
        <Pill active={!weekly} onClick={() => setWeekly(false)}>
          Monthly
        </Pill>
        <Pill active={weekly} onClick={() => setWeekly(true)}>
          Weekly
        </Pill>
        <Text size="small" tone="tertiary">
          Toggle applies to all KPIs and charts
        </Text>
      </Row>
      <Grid columns={4} gap={12}>
        <Card>
          <CardBody>
            <Text size="small" tone="tertiary">
              Total revenue
            </Text>
            <Text weight="semibold">GBP 4,200</Text>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Text size="small" tone="tertiary">
              Revenue goal
            </Text>
            <Text weight="semibold">68%</Text>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Text size="small" tone="tertiary">
              Tasks done
            </Text>
            <Text weight="semibold">12</Text>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Text size="small" tone="tertiary">
              Goals on track
            </Text>
            <Text weight="semibold">5 / 7</Text>
          </CardBody>
        </Card>
      </Grid>
      <Grid columns="1fr 280px" gap={16}>
        <Frame style={{ minHeight: 160 }}>
          <Text size="small" tone="tertiary">
            Income over time (Recharts)
          </Text>
          <Text tone="quaternary">Stacked area by venture</Text>
        </Frame>
        <Frame>
          <Text size="small" weight="semibold" style={{ marginBottom: 8 }}>
            Revenue by venture
          </Text>
          {['Podcast', 'Trading', 'Property'].map((v, i) => (
            <Row key={v} gap={8} align="center" style={{ marginBottom: 6 }}>
              <ColorDot tone={i === 0 ? 'venture' : 'muted'} />
              <Text size="small">{v}</Text>
              <Spacer />
              <Text size="small" tone="secondary">
                GBP {(3 - i) * 900}
              </Text>
            </Row>
          ))}
        </Frame>
      </Grid>
      <H3>Projects by urgency</H3>
      <Table
        headers={['Project', 'Venture', 'Next goal', 'Status']}
        rows={[
          ['Website rebuild', 'Podcast', 'Ship landing page', 'At risk'],
          ['Bot v3', 'Trading', 'Backtest pass', 'On track'],
        ]}
      />
    </Stack>
  )
}

function ScreenPicker({
  screen,
  setScreen,
}: {
  screen: Screen
  setScreen: (s: Screen) => void
}) {
  const tabs: { id: Screen; label: string }[] = [
    { id: 'projects-1b', label: '1b · Projects page' },
    { id: 'modals', label: '1b · Modals' },
    { id: 'phase-16', label: '1.6 · Ventures sidebar' },
    { id: 'dashboard-3', label: '3 · Dashboard' },
  ]
  return (
    <Row gap={6} wrap>
      {tabs.map((tab) => (
        <Pill key={tab.id} active={screen === tab.id} onClick={() => setScreen(tab.id)}>
          {tab.label}
        </Pill>
      ))}
    </Row>
  )
}

export default function Phase1bWireframes() {
  const [screen, setScreen] = useCanvasState<Screen>('wire-screen', 'projects-1b')
  const [boardMode, setBoardMode] = useCanvasState<BoardMode>('board-mode', 'tasks')

  return (
    <Stack gap={20}>
      <Stack gap={6}>
        <H1>Phase 1b wireframes</H1>
        <Text tone="secondary">
          Low-fi layout confirmation from plans/phase-1.5-ux.md. Switch screens below.
          Terracotta palette applies in implementation; canvas uses host theme tokens.
        </Text>
      </Stack>

      <ScreenPicker screen={screen} setScreen={setScreen} />
      <Divider />

      {screen === 'projects-1b' ? (
        <Row gap={12} align="stretch" style={{ alignItems: 'flex-start' }}>
          <Sidebar1bWire onProjectClick={() => setScreen('modals')} />
          <ProjectsPageWire
            boardMode={boardMode}
            setBoardMode={setBoardMode}
            onOpenModals={() => setScreen('modals')}
          />
        </Row>
      ) : null}

      {screen === 'modals' ? <ModalsScreen /> : null}

      {screen === 'phase-16' ? (
        <Stack gap={16}>
          <Callout title="Phase 1.6 addition" tone="info">
            Venture tree in sidebar, project Kanban toggle active, + Hustle creates ventures.
            Phase 1b ships flat project list with layout reserved for this structure.
          </Callout>
          <Row gap={12} align="stretch">
            <Sidebar16Wire />
            <ProjectsPageWire
              boardMode={boardMode}
              setBoardMode={setBoardMode}
              onOpenModals={() => setScreen('modals')}
            />
          </Row>
        </Stack>
      ) : null}

      {screen === 'dashboard-3' ? <Dashboard3Screen /> : null}

      <Divider />
      <Grid columns={3} gap={12}>
        <Callout tone="neutral" title="1b builds">
          <Text size="small">Shell, toolbar, full-width Kanban, table below, modals, card drag</Text>
        </Callout>
        <Callout tone="neutral" title="1b defers">
          <Text size="small">Venture tree, project board, dashboard, settings</Text>
        </Callout>
        <Callout tone="success" title="Legend">
          <Row gap={8}>
            <Row gap={4} align="center">
              <ColorDot tone="project" />
              <Text size="small">Project</Text>
            </Row>
            <Row gap={4} align="center">
              <ColorDot tone="venture" />
              <Text size="small">Venture underline</Text>
            </Row>
          </Row>
        </Callout>
      </Grid>
    </Stack>
  )
}
