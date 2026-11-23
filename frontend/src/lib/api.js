// Запросы к API Wagtail (/wt-api/v2/pages/). Ответы кэшируются на время сессии вкладки:
// разделы ссылаются друг на друга (главная берёт результаты и города), повторно не грузим.
// Язык страниц (locale) берётся из адреса: без него API отдаёт страницы обоих языков сразу.
import { useEffect, useState } from 'react';
import { currentLang } from './i18n';

const BASE = '/wt-api/v2/pages/';
const cache = new Map();

export function getPages(params) {
  const query = new URLSearchParams({ fields: '*', limit: '20', locale: currentLang(), ...params }).toString();
  if (!cache.has(query)) {
    const request = fetch(`${BASE}?${query}`)
      .then((res) => {
        if (!res.ok) throw new Error(`API ${res.status}: ${query}`);
        return res.json();
      })
      .then((data) => data.items)
      .catch((err) => {
        cache.delete(query);
        throw err;
      });
    cache.set(query, request);
  }
  return cache.get(query);
}

export const getByType = (type, params = {}) => getPages({ type, ...params });

// id той же страницы на другом языке (для переключателя языка на страницах с id в адресе)
export function translationId(id, lang) {
  return getPages({ translation_of: String(id), locale: lang, fields: 'title' }).then((items) => items[0]?.id ?? null);
}
export const getOne = (type, params = {}) => getByType(type, params).then((items) => items[0] || null);

export const api = {
  home: () => getOne('home.HomePage'),
  cities: () => getByType('home.CityPage'),
  city: (slug) => getOne('home.CityPage', { slug }),
  reports: () => getByType('home.ReportPage'),
  news: () => getByType('home.BlogPost', { order: '-date' }),
  post: (id) => getOne('home.BlogPost', { id }),
  expeditions: () => getByType('home.ExpeditionPage', { order: 'date_start' }),
  expedition: (id) => getOne('home.ExpeditionPage', { id }),
  team: () => getOne('home.TeamPage'),
  publications: () => getOne('home.PublicationsPage'),
};

// Загрузка нескольких запросов сразу: { data, error }, data появляется, когда готово всё
export function useData(load, deps = []) {
  const [state, setState] = useState({ data: null, error: null });
  useEffect(() => {
    let alive = true;
    setState({ data: null, error: null });
    load()
      .then((data) => alive && setState({ data, error: null }))
      .catch((error) => {
        console.error(error);
        if (alive) setState({ data: null, error });
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
