import { Button } from '../ui/button'

const NAV_ITEMS = [
  { href: '/projects', id: 'projects', label: 'Projects' },
  { disabled: true, id: 'income', label: 'Income' },
  { disabled: true, id: 'goals', label: 'Goals' },
] as const

export function TopNav(): JSX.Element {
  return (
    <header className="app-top-nav">
      <nav aria-label="Primary" className="app-top-nav-inner">
        <span className="app-brand">Momentum</span>
        <div className="app-top-nav-links">
          {NAV_ITEMS.map((item) =>
            'href' in item ? (
              <a
                key={item.id}
                aria-current="page"
                className="app-nav-link app-nav-link-active"
                href={item.href}
              >
                {item.label}
              </a>
            ) : (
              <Button
                key={item.id}
                aria-disabled
                className="app-nav-link-stub"
                disabled
                type="button"
                variant="ghost"
              >
                {item.label}
              </Button>
            ),
          )}
        </div>
      </nav>
    </header>
  )
}
