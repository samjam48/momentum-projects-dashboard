const installChecklist = [
  {
    title: 'Backend runtime',
    detail: 'FastAPI, SQLModel, Alembic, pytest, and strict Python tooling are configured.',
  },
  {
    title: 'Frontend toolchain',
    detail: 'React 18, TypeScript 5, Vite 5, ESLint, and Vitest are wired for local development.',
  },
  {
    title: 'SQLite configuration',
    detail: 'The default database URL is routed through typed settings instead of hardcoded router logic.',
  },
] as const

function App() {
  return (
    <main className="app-shell">
      <section className="app-panel">
        <p className="eyebrow">Phase 0</p>
        <h1 className="app-title">Momentum installation scaffold</h1>
        <p className="app-copy">
          The repo now has the base runtime, test, and build tooling in place for the
          backend and frontend. Feature work can build on top of this without reworking the
          project foundation.
        </p>
        <ul className="checklist">
          {installChecklist.map((item) => (
            <li key={item.title} className="checklist-card">
              <strong>{item.title}</strong>
              <span>{item.detail}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}

export default App
