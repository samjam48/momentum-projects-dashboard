import type { ReactNode } from 'react'

import { Sidebar, type SidebarProps } from './Sidebar'
import { TopNav } from './TopNav'

type AppShellProps = SidebarProps & {
  children: ReactNode
}

export function AppShell({ children, ...sidebarProps }: AppShellProps): JSX.Element {
  return (
    <div className="app-shell">
      <TopNav />
      <div className="app-shell-body">
        <Sidebar {...sidebarProps} />
        <main className="app-main">{children}</main>
      </div>
    </div>
  )
}
