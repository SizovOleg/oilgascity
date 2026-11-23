import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { PinIcon } from './Icons';
import { LightboxHost } from './Lightbox';
import { useRevealOnScroll } from '../lib/motion';

const NAV = [
  { to: '/#about', label: 'О проекте', match: (p, h) => p === '/' && h === '#about' },
  { to: '/cities/muravlenko', label: 'Муравленко', city: true },
  { to: '/cities/kogalym', label: 'Когалым', city: true },
  { to: '/results', label: 'Результаты', match: (p) => p.startsWith('/results') },
  { to: '/materials', label: 'Материалы', match: (p) => p.startsWith('/materials') || p.startsWith('/expeditions') },
  { to: '/news', label: 'Новости', match: (p) => p.startsWith('/news') },
];

export function Header() {
  const { pathname, hash, key } = useLocation();
  // меню на телефоне открыто только на той странице, где его открыли: переход его закрывает
  const [openAt, setOpenAt] = useState(null);
  const open = openAt === key;
  const setOpen = (value) => setOpenAt(value ? key : null);

  return (
    <header className="bar">
      <div className="wrap">
        <Link className="logo" to="/">OilGasCity<span>проект РНФ № 25-27-00022</span></Link>
        <input className="menu-check" type="checkbox" id="menu-check" aria-label="Показать разделы сайта"
          checked={open} onChange={(e) => setOpen(e.target.checked)} />
        <label className="menu-btn" htmlFor="menu-check">Меню</label>
        <nav className="nav" aria-label="Основная навигация">
          {NAV.map((item) => (item.city ? (
            <NavLink key={item.to} className="city" to={item.to}>{item.label}</NavLink>
          ) : (
            <Link key={item.to} to={item.to} aria-current={item.match(pathname, hash) ? 'page' : undefined}>{item.label}</Link>
          )))}
        </nav>
        <Link className="geo-btn" to="/geoportal" title="Интерактивная карта проекта"><PinIcon />Геопортал</Link>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="end">
      <div className="wrap">
        <div>
          <p>Исследование выполнено за счёт гранта Российского научного фонда <span className="nw">№ 25-27-00022</span>, <a href="https://rscf.ru/project/25-27-00022/">https://rscf.ru/project/25-27-00022/</a></p>
          <p>Институт криосферы Земли Тюменского научного центра СО РАН</p>
          <p className="upd">Содержание сайта ведётся в системе управления: <a href="/cms/">вход для редакторов</a></p>
        </div>
        <ul>
          <li><Link to="/#about">О проекте</Link></li>
          <li><Link to="/cities/muravlenko">Муравленко</Link></li>
          <li><Link to="/cities/kogalym">Когалым</Link></li>
          <li><Link to="/results">Результаты</Link></li>
        </ul>
        <ul>
          <li><Link to="/materials">Материалы</Link></li>
          <li><Link to="/materials#expeditions">Экспедиции</Link></li>
          <li><Link to="/materials#team">Коллектив</Link></li>
          <li><Link to="/geoportal">Геопортал</Link></li>
        </ul>
      </div>
    </footer>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  useRevealOnScroll();
  useEffect(() => {
    if (!window.location.hash) window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <>
      <Header />
      <Outlet />
      <Footer />
      <LightboxHost />
    </>
  );
}
