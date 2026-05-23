import { Link } from 'react-router-dom';

const NAV_LINKS = [
  { to: '/about', label: 'About' },
  { to: '/facilities', label: 'Facilities' },
  { to: '/rooms', label: 'Rooms' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/location', label: 'Location' },
  { to: '/contact', label: 'Contact' },
];

interface PublicLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

/** Shared header/footer layout for all public hostel pages. */
export function PublicLayout({ children, title, subtitle }: PublicLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* ── Sticky Nav ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 shadow-lg" style={{ background: '#1e3a5f' }}>
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
          <Link to="/" className="no-underline">
            <span className="text-white font-extrabold text-xl tracking-tight">
              Sri Adithya{' '}
              <span style={{ color: '#f59e0b' }}>Boys Hostel</span>
            </span>
          </Link>

          <nav aria-label="Main navigation" className="hidden md:flex items-center gap-7">
            {NAV_LINKS.map(l => (
              <Link
                key={l.to}
                to={l.to}
                className="text-slate-300 hover:text-amber-400 no-underline text-sm font-medium transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <Link
            to="/login"
            className="no-underline font-bold text-sm px-5 py-2 rounded-lg transition-opacity hover:opacity-90"
            style={{ background: '#f59e0b', color: '#1e3a5f' }}
          >
            Tenant Login
          </Link>
        </div>
      </header>

      {/* ── Page Hero ──────────────────────────────────────────────────── */}
      {(title || subtitle) && (
        <div
          className="text-white text-center py-14 px-6"
          style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a96 100%)' }}
        >
          <div className="max-w-2xl mx-auto">
            {title && (
              <h1 className="font-extrabold tracking-tight mb-3" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)' }}>
                {title}
              </h1>
            )}
            {subtitle && <p className="text-slate-300 text-lg m-0">{subtitle}</p>}
          </div>
        </div>
      )}

      {/* ── Page Content ───────────────────────────────────────────────── */}
      <main className="flex-1">{children}</main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer style={{ background: '#0f172a', color: '#64748b' }} className="text-sm px-6 py-9">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <p className="m-0">© {new Date().getFullYear()} Sri Adithya Boys Hostel. All rights reserved.</p>
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-5">
            {NAV_LINKS.map(l => (
              <Link key={l.to} to={l.to} className="text-slate-500 hover:text-slate-300 no-underline transition-colors">
                {l.label}
              </Link>
            ))}
            <Link to="/legal" className="text-slate-500 hover:text-slate-300 no-underline transition-colors">
              Legal
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
