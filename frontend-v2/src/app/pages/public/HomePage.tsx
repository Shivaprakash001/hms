import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PublicLayout } from './PublicLayout';

const FEATURES = [
  { icon: '🏠', title: 'Furnished Rooms', desc: 'Single, double, and triple-sharing rooms with beds, wardrobes, and study tables.' },
  { icon: '🍽️', title: 'Nutritious Meals', desc: 'Home-cooked breakfast, lunch, and dinner served daily in our dining hall.' },
  { icon: '🔒', title: '24/7 Security', desc: 'Round-the-clock security staff, biometric entry, and CCTV surveillance.' },
  { icon: '📶', title: 'High-Speed Wi-Fi', desc: 'Reliable internet connectivity throughout the entire premises.' },
  { icon: '📚', title: 'Study Room', desc: 'Dedicated quiet study area with good lighting for focused preparation.' },
  { icon: '👕', title: 'Laundry Facility', desc: 'Washing machine access available for all residents at scheduled times.' },
];

export function HomePage() {
  useEffect(() => {
    document.title = 'Sri Adithya Boys Hostel | Student Accommodation in Hyderabad';
    const desc = document.querySelector('meta[name="description"]');
    desc?.setAttribute('content', 'Sri Adithya Boys Hostel offers safe, affordable student accommodation in Hyderabad with furnished rooms, meals, 24/7 security, and modern facilities.');
    const canonical = document.querySelector('link[rel="canonical"]');
    canonical?.setAttribute('href', 'https://sriadithyahostels.in/');
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* ── Sticky Nav ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 shadow-lg" style={{ background: '#1e3a5f' }}>
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
          <Link to="/" className="no-underline">
            <span className="text-white font-extrabold text-xl tracking-tight">
              Sri Adithya <span style={{ color: '#f59e0b' }}>Boys Hostel</span>
            </span>
          </Link>
          <nav aria-label="Main navigation" className="hidden md:flex items-center gap-7">
            {[
              { to: '/about', label: 'About' },
              { to: '/facilities', label: 'Facilities' },
              { to: '/rooms', label: 'Rooms' },
              { to: '/gallery', label: 'Gallery' },
              { to: '/location', label: 'Location' },
              { to: '/contact', label: 'Contact' },
            ].map(l => (
              <Link key={l.to} to={l.to} className="text-slate-300 hover:text-amber-400 no-underline text-sm font-medium transition-colors">
                {l.label}
              </Link>
            ))}
          </nav>
          <Link to="/login" className="no-underline font-bold text-sm px-5 py-2 rounded-lg hover:opacity-90 transition-opacity" style={{ background: '#f59e0b', color: '#1e3a5f' }}>
            Tenant Login
          </Link>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section
        className="text-white text-center py-24 px-6"
        style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a96 60%, #1e3a5f 100%)' }}
      >
        <div className="max-w-3xl mx-auto">
          <p className="font-bold tracking-widest text-xs uppercase mb-4" style={{ color: '#f59e0b', letterSpacing: '0.2em' }}>
            Student Accommodation · Hyderabad
          </p>
          <h1 className="font-extrabold tracking-tight mb-5" style={{ fontSize: 'clamp(2rem, 5vw, 3.4rem)', lineHeight: 1.15 }}>
            Sri Adithya Boys Hostel
          </h1>
          <p className="text-slate-300 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
            Safe, affordable, and comfortable student accommodation in Hyderabad.
            Fully furnished rooms, home-cooked meals, and 24/7 security — so you can focus on what matters.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/contact" className="no-underline font-bold text-base px-8 py-4 rounded-xl hover:opacity-90 transition-opacity" style={{ background: '#f59e0b', color: '#1e3a5f' }}>
              Enquire Now
            </Link>
            <Link to="/facilities" className="no-underline font-semibold text-base px-8 py-4 rounded-xl border transition-colors" style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}>
              See Facilities
            </Link>
          </div>
        </div>
      </section>

      {/* ── Key Features ─────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-center font-bold text-slate-800 mb-2" style={{ fontSize: 28 }}>Everything You Need</h2>
        <p className="text-center text-slate-500 mb-12">From meals to security — we've got you covered.</p>
        <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {FEATURES.map(f => (
            <article key={f.title} className="bg-white rounded-2xl p-7 shadow-sm border border-slate-100">
              <div className="text-4xl mb-4">{f.icon}</div>
              <h3 className="font-bold text-slate-800 text-base mb-2">{f.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── CTA Strip ────────────────────────────────────────────────── */}
      <section className="text-white text-center py-16 px-6" style={{ background: '#1e3a5f' }}>
        <h2 className="font-bold text-2xl mb-3">Looking for Accommodation?</h2>
        <p className="text-slate-400 mb-8">Get in touch with us to check availability and fees.</p>
        <Link to="/contact" className="no-underline font-bold text-base px-9 py-4 rounded-xl hover:opacity-90 transition-opacity" style={{ background: '#f59e0b', color: '#1e3a5f' }}>
          Contact Us Today
        </Link>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer style={{ background: '#0f172a', color: '#64748b' }} className="text-sm px-6 py-9">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <p className="m-0">© {new Date().getFullYear()} Sri Adithya Boys Hostel. All rights reserved.</p>
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-5">
            {['/about', '/facilities', '/rooms', '/gallery', '/location', '/contact', '/legal'].map(path => (
              <Link key={path} to={path} className="text-slate-500 hover:text-slate-300 no-underline transition-colors capitalize">
                {path.replace('/', '')}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
