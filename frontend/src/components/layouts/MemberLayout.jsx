import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import {
  Home,
  ClipboardList,
  Files,
  FileText,
  IdCard,
  CreditCard,
  CalendarDays,
  CalendarRange,
  GraduationCap,
  Newspaper,
} from 'lucide-react';
import { api } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';
import { Brand } from './PublicLayout';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: Home },
  { to: '/membership/wizard/domain', label: 'My Application', icon: ClipboardList },
  { to: '/documents', label: 'Documents', icon: Files },
  { to: '/cv', label: 'CV', icon: FileText },
  { to: '/id-card', label: 'ID Card', icon: IdCard },
  { to: '/payment', label: 'Payment', icon: CreditCard },
  { to: '/events', label: 'Events', icon: CalendarDays },
  { to: '/calendar', label: 'Calendar', icon: CalendarRange },
  { to: '/certifications', label: 'Certifications', icon: GraduationCap },
  { to: '/newsletters', label: 'Newsletters', icon: Newspaper },
];

export function navLinkClass({ isActive }) {
  return `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-brand-700 text-white' : 'text-slate-600 hover:bg-slate-100'
  }`;
}

export function useLogout() {
  const navigate = useNavigate();
  return async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Session may already be gone — clearing locally is what matters
    }
    useAuthStore.getState().clearSession();
    navigate('/');
  };
}

export default function MemberLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();

  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-slate-200 bg-white md:w-64 md:border-b-0 md:border-r">
        <div className="flex h-16 items-center px-4">
          <Brand />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} className={navLinkClass}>
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
          {user && user.role !== 'MEMBER' && (
            <Link to="/admin" className="btn-secondary mb-2 w-full">
              Admin portal
            </Link>
          )}
          <button onClick={logout} className="btn-secondary w-full">
            Log out
          </button>
        </div>
      </aside>
      <main className="flex-1">
        <div className="mx-auto max-w-5xl p-4 md:p-8">
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
