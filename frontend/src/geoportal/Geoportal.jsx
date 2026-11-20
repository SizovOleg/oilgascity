// Временная заглушка: полноценный геопортал собирается в изменении geoportal-prototype
import { Link } from 'react-router-dom';

export default function Geoportal() {
  return (
    <main className="wrap state">
      <h1>Геопортал</h1>
      <p>Карта загружается. <Link to="/">Вернуться на сайт</Link></p>
    </main>
  );
}
