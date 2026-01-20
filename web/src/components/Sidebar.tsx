import { NavLink } from 'react-router';
import {
  LayoutDashboard,
  Camera,
  PieChart,
  Target,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/snapshots', icon: Camera, label: 'Snapshots' },
  { to: '/portfolio', icon: PieChart, label: 'Portfolio' },
  { to: '/allocations', icon: Target, label: 'Allocations' },
];

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-10 flex h-full w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center border-b px-4">
        <Wallet className="mr-2 h-6 w-6" />
        <span className="font-semibold">Wealth Manager</span>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'hover:bg-sidebar-accent/50'
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t p-4">
        <p className="text-xs text-muted-foreground">
          Multi-asset wealth tracking
        </p>
      </div>
    </aside>
  );
}
