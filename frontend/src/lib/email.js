// Адреса e-mail приходят из API не открытым текстом (backend/home/models.py, hide_email):
// base64 от перевёрнутой строки. Раскодируются только при показе.
import { createElement } from 'react';

export function showEmail(hidden) {
  if (!hidden) return '';
  try {
    return [...atob(hidden)].reverse().join('');
  } catch {
    return '';
  }
}

export function Email({ hidden, className }) {
  const address = showEmail(hidden);
  if (!address) return null;
  return createElement('a', { className, href: `mailto:${address}` }, address);
}
