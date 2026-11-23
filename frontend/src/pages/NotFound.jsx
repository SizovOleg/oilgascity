import { LLink as Link, T } from '../lib/i18n';
import { useTitle } from '../lib/hooks';

export default function NotFound() {
  useTitle(T('Страница не найдена'));
  return (
    <main className="wrap state">
      <h1>{T('Страница не найдена')}</h1>
      <p>{T('Возможно, адрес изменился после обновления сайта. Начните с')} <Link to="/">{T('главной страницы')}</Link>.</p>
    </main>
  );
}
