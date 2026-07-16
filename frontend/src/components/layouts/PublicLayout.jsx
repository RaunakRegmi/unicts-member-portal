import { Link, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy text-lg font-bold text-white">
        U
      </span>
      <span className="text-lg font-bold text-navy">UNICTS</span>
    </Link>
  );
}

export default function PublicLayout() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          <Brand />
          <nav className="flex items-center gap-3 text-sm">
            {user ? (
              <Link
                to={user.role === 'MEMBER' ? '/dashboard' : '/admin'}
                className="btn-primary"
              >
                Go to portal
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn-secondary">
                  Log in
                </Link>
                <Link to="/apply" className="btn-primary">
                  Apply for membership
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} UNICTS — United Nepal ICT Society
      </footer>
    </div>
  );
}
