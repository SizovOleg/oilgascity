// Запросы к API Wagtail (/wt-api/v2/pages/). Ответы кэшируются на время сессии вкладки:
// разделы ссылаются друг на друга (главная берёт результаты и города), повторно не грузим.
// Язык страниц (locale) берётся из адреса: без него API отдаёт страницы обоих языков сразу.
import { useEffect, useState } from 'react';
import { currentLang, useLang } from './i18n';

const BASE = '/wt-api/v2/pages/';
const cache = new Map();

// Английская версия, пока перевод не закончен: страницы без перевода показываются на русском с пометкой
// _untranslated. Пара «оригинал и перевод» находится по slug (wagtail-localize держит его общим), а если на обоих
// языках по одной странице (главная, коллектив, запрос по id), берётся английская. Порядок как у русского списка.
function withFallback(en, ru) {
  if (!ru.length || (ru.length === 1 && en.length === 1)) return en;
  const bySlug = new Map(en.map((p) => [p.meta?.slug, p]));
  return ru.map((p) => bySlug.get(p.meta?.slug) || { ...p, _untranslated: true });
}

export function getPages(params) {
  // явный locale (поиск перевода для переключателя) и русская версия идут одним запросом
  if (params.locale || currentLang() !== 'en') return fetchPages({ locale: currentLang(), ...params });
  return Promise.all([fetchPages({ ...params, locale: 'en' }), fetchPages({ ...params, locale: 'ru' })])
    .then(([en, ru]) => withFallback(en, ru));
}

function fetchPages(params) {
  const query = new URLSearchParams({ fields: '*', limit: '20', ...params }).toString();
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

// Загрузка нескольких запросов сразу: { data, error }, data появляется, когда готово всё.
// Язык в зависимостях: при переключении RU/EN страница с тем же id не пересоздаётся и иначе осталась бы
// с данными прежнего языка
export function useData(load, deps = []) {
  const lang = useLang();
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
  }, [...deps, lang]);
  return state;
}
