// Язык сайта: русский по умолчанию, английский под префиксом /en (те же адреса страниц: /en/news, /en/cities/kogalym).
// Тексты страниц приходят из Wagtail на нужном языке (параметр locale в api.js), здесь только строки интерфейса:
// ключ словаря сам русский текст, английский берётся из STRINGS.en, а если перевода нет, остаётся русский.
import { createElement } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { EN } from './strings-en';

export const langOf = (pathname) => (pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'ru');
export const currentLang = () => langOf(window.location.pathname);

export function useLang() {
  return langOf(useLocation().pathname);
}

// Путь в нужном языке: '/news' -> '/en/news', '/' -> '/en', '/#about' -> '/en#about'
export function localePath(lang, path) {
  if (lang !== 'en' || typeof path !== 'string' || !path.startsWith('/')) return path;
  if (path === '/') return '/en';
  if (path.startsWith('/#')) return `/en${path.slice(1)}`;
  return `/en${path}`;
}

// Путь без префикса языка: '/en/news' -> '/news', '/en' -> '/'
export function stripLang(pathname) {
  if (langOf(pathname) !== 'en') return pathname;
  return pathname.slice(3) || '/';
}

export function useLocalePath() {
  const lang = useLang();
  return (path) => localePath(lang, path);
}

// Строка интерфейса на языке страницы
export const tr = (lang, s) => (lang === 'en' ? EN[s] ?? s : s);

// То же без хука: для вспомогательных функций и подписей вне компонентов. Язык из адреса страницы;
// смена языка меняет маршрут (/en или без), и страница перерисовывается целиком.
export const T = (s) => tr(currentLang(), s);

export function useT() {
  const lang = useLang();
  return (s) => tr(lang, s);
}

// Ссылки внутри сайта сами получают префикс текущего языка
export function LLink({ to, ...rest }) {
  const lp = useLocalePath();
  return createElement(Link, { to: lp(to), ...rest });
}

export function LNavLink({ to, ...rest }) {
  const lp = useLocalePath();
  return createElement(NavLink, { to: lp(to), ...rest });
}
