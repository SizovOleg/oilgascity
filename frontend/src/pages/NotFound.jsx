import { Link } from 'react-router-dom';
import { useTitle } from '../lib/hooks';

export default function NotFound() {
  useTitle('Страница не найдена');
  return (
    <main className="wrap state">
      <h1>Страница не найдена</h1>
      <p>Возможно, адрес изменился после обновления сайта. Начните с <Link to="/">главной страницы</Link>.</p>
    </main>
  );
}
