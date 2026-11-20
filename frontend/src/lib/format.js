// Форматирование для подписей: даты по-русски, диапазоны через дефис, без длинных тире.
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function parse(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

export function formatDate(iso) {
  const p = parse(iso);
  return p ? `${p.d} ${MONTHS[p.m - 1]} ${p.y}` : '';
}

export function formatRange(startIso, endIso) {
  const a = parse(startIso);
  const b = parse(endIso);
  if (!a) return '';
  if (!b || startIso === endIso) return formatDate(startIso);
  if (a.y === b.y && a.m === b.m) return `${a.d}-${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
  if (a.y === b.y) return `${a.d} ${MONTHS[a.m - 1]} - ${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
  return `${formatDate(startIso)} - ${formatDate(endIso)}`;
}

// Убирает внешний <p>, чтобы вставить короткий текст из редактора в строку
export function inline(html) {
  if (!html) return '';
  const trimmed = html.trim();
  const m = trimmed.match(/^<p[^>]*>([\s\S]*)<\/p>$/);
  return m && !m[1].includes('<p') ? m[1] : trimmed;
}

// Текст без тегов: для описаний и подписей
export function plain(html, limit = 0) {
  const text = (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!limit || text.length <= limit) return text;
  const cut = text.slice(0, limit);
  return `${cut.slice(0, cut.lastIndexOf(' '))}...`;
}

// Первое число в строке вида «29 529 чел. (01.01.2025, Росстат)» и остаток в скобках
export function splitFigure(text) {
  const m = (text || '').match(/^([\d\s]+[\d])\s*(.*)$/);
  if (!m) return { value: text || '', rest: '' };
  return { value: m[1].trim(), rest: m[2].trim() };
}

// Счётчики архива по городам: строка с темой «всего» задаёт итог города, остальные идут чипсами.
// Темы покрывают не все снимки, поэтому итог без строки «всего» считается суммой тем.
export function photoGroups(counts) {
  const groups = new Map();
  for (const c of counts || []) {
    const key = `${c.city}, ${c.year}`;
    if (!groups.has(key)) groups.set(key, { key, total: null, items: [] });
    const g = groups.get(key);
    if (c.theme.trim().toLowerCase() === 'всего') g.total = c.count;
    else g.items.push(c);
  }
  return [...groups.values()].map((g) => ({ ...g, total: g.total ?? g.items.reduce((s, c) => s + c.count, 0) }));
}

export const THEME_LABELS = {
  parks: 'парки и скверы',
  sites: 'площадки',
  geobot: 'геоботаника',
  sand: 'пески и карьеры',
  waste: 'свалки',
  town: 'город и муралы',
  water: 'водоёмы',
  field: 'полевая работа',
};

export const STATUS_LABELS = {
  published: { text: 'опубликовано', cls: 'done' },
  in_press: { text: 'в печати', cls: 'wait' },
  in_review: { text: 'на рецензировании', cls: 'wait' },
};
