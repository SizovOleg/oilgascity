import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { PinIcon } from './Icons';
import { LightboxHost } from './Lightbox';
import { useRevealOnScroll } from '../lib/motion';
import { LLink, LNavLink, localePath, stripLang, useLang, useT } from '../lib/i18n';
import { api, translationId } from '../lib/api';
import { Email } from '../lib/email';

const NAV = [
  { to: '/#about', label: 'О проекте', match: (p, h) => p === '/' && h === '#about' },
  { to: '/cities/muravlenko', label: 'Муравленко', city: true },
  { to: '/cities/kogalym', label: 'Когалым', city: true },
  { to: '/results', label: 'Результаты', match: (p) => p.startsWith('/results') },
  { to: '/materials', label: 'Материалы', match: (p) => p.startsWith('/materials') || p.startsWith('/expeditions') },
  { to: '/news', label: 'Новости', match: (p) => p.startsWith('/news') },
];

// Переключатель языка: та же страница на другом языке. У новостей и экспедиций в адресе id страницы,
// а у перевода свой id, поэтому он ищется через API (translation_of); у остальных страниц адрес тот же.
export function LangSwitch({ className = 'lang-btn' }) {
  const { pathname, hash, search } = useLocation();
  const lang = useLang();
  const navigate = useNavigate();
  const target = lang === 'en' ? 'ru' : 'en';
  const base = stripLang(pathname);
  const href = localePath(target, base) + search + hash;
  const byId = base.match(/^\/(news|expeditions)\/(\d+)$/);
  const go = async (e) => {
    if (!byId) return;
    e.preventDefault();
    const id = await translationId(byId[2], target).catch(() => null);
    navigate(id ? localePath(target, `/${byId[1]}/${id}`) : localePath(target, `/${byId[1] === 'news' ? 'news' : 'materials'}`));
  };
  return (
    <Link className={className} to={href} onClick={go} hrefLang={target} lang={target}
      title={target === 'en' ? 'English version' : 'Русская версия'}>
      {target === 'en' ? 'EN' : 'RU'}
    </Link>
  );
}

export function Header() {
  const { pathname, hash, key } = useLocation();
  const t = useT();
  const path = stripLang(pathname);
  // меню на телефоне открыто только на той странице, где его открыли: переход его закрывает
  const [openAt, setOpenAt] = useState(null);
  const open = openAt === key;
  const setOpen = (value) => setOpenAt(value ? key : null);

  return (
    <header className="bar">
      <div className="wrap">
        <LLink className="logo" to="/">OilGasCity<span>{t('проект РНФ № 25-27-00022')}</span></LLink>
        <input className="menu-check" type="checkbox" id="menu-check" aria-label={t('Показать разделы сайта')}
          checked={open} onChange={(e) => setOpen(e.target.checked)} />
        <label className="menu-btn" htmlFor="menu-check">{t('Меню')}</label>
        <nav className="nav" aria-label={t('Основная навигация')}>
          {NAV.map((item) => (item.city ? (
            <LNavLink key={item.to} className="city" to={item.to}>{t(item.label)}</LNavLink>
          ) : (
            <LLink key={item.to} to={item.to} aria-current={item.match(path, hash) ? 'page' : undefined}>{t(item.label)}</LLink>
          )))}
        </nav>
        <LLink className="geo-btn" to="/geoportal" title={t('Интерактивная карта проекта')}><PinIcon />{t('Геопортал')}</LLink>
        <LangSwitch />
      </div>
    </header>
  );
}

export function Footer() {
  const t = useT();
  const lang = useLang();
  // общий адрес проекта из главной страницы (ответ API уже в кэше: главную грузят многие разделы)
  const [contact, setContact] = useState('');
  useEffect(() => {
    let alive = true;
    api.home().then((h) => alive && setContact(h?.contact_email || '')).catch(() => {});
    return () => { alive = false; };
  }, [lang]);
  return (
    <footer className="end">
      <div className="wrap">
        <div>
          <p>{t('Исследование выполнено за счёт гранта Российского научного фонда')} <span className="nw">№ 25-27-00022</span>, <a href="https://rscf.ru/project/25-27-00022/">https://rscf.ru/project/25-27-00022/</a></p>
          <p>{t('Институт криосферы Земли Тюменского научного центра СО РАН')}</p>
          {contact ? <p>{t('Связь с авторами:')} <Email hidden={contact} /></p> : null}
          <p className="upd">{t('Содержание сайта ведётся в системе управления:')} <a href="/cms/">{t('вход для редакторов')}</a></p>
        </div>
        <ul>
          <li><LLink to="/#about">{t('О проекте')}</LLink></li>
          <li><LLink to="/cities/muravlenko">{t('Муравленко')}</LLink></li>
          <li><LLink to="/cities/kogalym">{t('Когалым')}</LLink></li>
          <li><LLink to="/results">{t('Результаты')}</LLink></li>
        </ul>
        <ul>
          <li><LLink to="/materials">{t('Материалы')}</LLink></li>
          <li><LLink to="/materials#expeditions">{t('Экспедиции')}</LLink></li>
          <li><LLink to="/materials#team">{t('Коллектив')}</LLink></li>
          <li><LLink to="/geoportal">{t('Геопортал')}</LLink></li>
        </ul>
      </div>
    </footer>
  );
}

// Кнопка «наверх»: появляется, когда страница прокручена дальше полутора экранов
const scrolledFar = () => window.scrollY > window.innerHeight * 1.5;

function ToTop() {
  const t = useT();
  const [show, setShow] = useState(scrolledFar);
  useEffect(() => {
    const onScroll = () => setShow(scrolledFar());
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <button type="button" className={`to-top${show ? ' on' : ''}`} aria-label={t('Наверх')} title={t('Наверх')}
      tabIndex={show ? 0 : -1} aria-hidden={!show} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
      <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" />
      </svg>
    </button>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  const lang = useLang();
  useRevealOnScroll();
  useEffect(() => {
    if (!window.location.hash) window.scrollTo(0, 0);
  }, [pathname]);
  // язык документа для чтения с экрана и поисковиков
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  // ссылки на ту же страницу в другом языке для поисковиков; у новостей и экспедиций с id перевод
  // имеет другой адрес, его пара известна только после запроса к API, поэтому для них ссылок нет
  useEffect(() => {
    document.querySelectorAll('link[data-alt-lang]').forEach((el) => el.remove());
    const base = stripLang(pathname);
    if (/^\/(news|expeditions)\/\d+$/.test(base)) return;
    for (const [code, href] of [['ru', base], ['en', localePath('en', base)], ['x-default', base]]) {
      const link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = code;
      link.href = window.location.origin + href;
      link.dataset.altLang = code;
      document.head.appendChild(link);
    }
  }, [pathname]);
  return (
    <>
      <Header />
      <Outlet />
      <Footer />
      <ToTop />
      <LightboxHost />
    </>
  );
}
