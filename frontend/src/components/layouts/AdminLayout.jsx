import { NavLink, Outlet, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Inbox,
  Users,
  UserPlus,
  CalendarDays,
  Newspaper,
  Megaphone,
  LayoutTemplate,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { Brand } from './PublicLayout';
import { navLinkClass, useLogout } from './MemberLayout';

const NAV_ITEMS = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/applications', label: 'Applications', icon: Inbox },
  { to: '/admin/members', label: 'Members', icon: Users },
  { to: '/admin/add-members', label: 'Add Members', icon: UserPlus },
  { to: '/admin/events', label: 'Events', icon: CalendarDays },
  { to: '/admin/newsletters', label: 'Newsletters', icon: Newspaper },
  { to: '/admin/notifications', label: 'Notifications', icon: Megaphone },
  { to: '/admin/cv-templates', label: 'CV Templates', icon: LayoutTemplate },
];

export default function AdminLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();

  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-slate-200 bg-white md:w-64 md:border-b-0 md:border-r">
        <div className="flex h-16 items-center gap-2 px-4">
          <Brand />
          <span className="badge bg-navy text-white">Admin</span>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="mt-6 hidden border-t border-slate-200 p-4 md:block">
          <div className="truncate text-sm font-semibold text-slate-700">
            {user && (user.email || user.phoneNumber)}
          </div>
          <div className="mb-3 text-xs text-slate-400">{user && user.role}</div>
          <Link to="/dashboard" className="btn-secondary mb-2 w-full">
            Member view
          </Link>
          <button onClick={logout} className="btn-secondary w-full">
            Log out
          </button>
        </div>
      </aside>
      <main className="flex-1">
        <div className="mx-auto max-w-6xl p-4 md:p-8">
          <div className="mb-4 flex justify-end md:hidden">
            <button onClick={logout} className="btn-secondary">
              Log out
            </button>
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
