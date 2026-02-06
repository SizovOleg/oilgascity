import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: 'Главная' },
  { to: '/cities', label: 'Города' },
  { to: '/expeditions', label: 'Экспедиции' },
  { to: '/publications', label: 'Публикации' },
  { to: '/team', label: 'Коллектив' },
  { to: '/blog', label: 'Новости' },
];

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f9fafb' }}>
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 40,
        background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '0 1rem', height: '4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0284c7' }}>OG</span>
            <span style={{ color: '#111827', fontWeight: 600, fontSize: '0.875rem' }}>OilGasCity</span>
          </Link>

          {/* Desktop nav */}
          <nav style={{ display: 'flex', gap: '0.25rem' }} className="desktop-nav">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'}
                style={({ isActive }) => ({
                  padding: '0.5rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 500,
                  textDecoration: 'none', transition: 'all 0.2s',
                  color: isActive ? '#0284c7' : '#6b7280',
                  background: isActive ? '#f0f9ff' : 'transparent',
                })}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Mobile toggle */}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="mobile-toggle"
            style={{ padding: '0.5rem', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem' }}>
            {mobileOpen ? '\u2715' : '\u2630'}
          </button>
        </div>

        {mobileOpen && (
          <div className="mobile-menu" style={{ borderTop: '1px solid #e5e7eb', background: 'rgba(255,255,255,0.97)', padding: '0.75rem 1rem' }}>
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={() => setMobileOpen(false)}
                style={({ isActive }) => ({
                  display: 'block', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.875rem',
                  fontWeight: 500, textDecoration: 'none',
                  color: isActive ? '#0284c7' : '#6b7280',
                  background: isActive ? '#f0f9ff' : 'transparent',
                })}>
                {item.label}
              </NavLink>
            ))}
          </div>
        )}
      </header>

      <main style={{ flex: 1, paddingTop: '4rem' }}>
        <Outlet />
      </main>

      <footer style={{ borderTop: '1px solid #e5e7eb', background: 'white', padding: '2.5rem 0' }}>
        <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '0 1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem', fontSize: '0.875rem' }}>
            <div>
              <h4 style={{ color: '#111827', fontWeight: 600, marginBottom: '0.75rem' }}>Грант</h4>
              <p style={{ color: '#6b7280', lineHeight: 1.6 }}>Исследование выполняется при поддержке Российского научного фонда (проект № 25-27-00022)</p>
            </div>
            <div>
              <h4 style={{ color: '#111827', fontWeight: 600, marginBottom: '0.75rem' }}>Организация</h4>
              <p style={{ color: '#6b7280', lineHeight: 1.6 }}>Институт криосферы Земли ТюмНЦ СО РАН</p>
            </div>
            <div>
              <h4 style={{ color: '#111827', fontWeight: 600, marginBottom: '0.75rem' }}>Разделы</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {NAV_ITEMS.map((item) => (
                  <Link key={item.to} to={item.to} style={{ color: '#6b7280', textDecoration: 'none' }}>{item.label}</Link>
                ))}
              </div>
            </div>
          </div>
          <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #f3f4f6', textAlign: 'center', color: '#9ca3af', fontSize: '0.75rem' }}>
            © {new Date().getFullYear()} OilGasCity — РНФ № 25-27-00022
          </div>
        </div>
      </footer>

      <style>{`
        .desktop-nav { display: none; }
        .mobile-toggle { display: block; }
        @media (min-width: 768px) {
          .desktop-nav { display: flex !important; }
          .mobile-toggle { display: none !important; }
          .mobile-menu { display: none !important; }
        }
        @media (max-width: 767px) {
          footer > div > div:first-child { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
