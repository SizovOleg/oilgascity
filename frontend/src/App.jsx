import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import Layout from './components/Layout';
import { Loading } from './components/Common';
import Home from './pages/Home';
import City from './pages/City';
import { Materials, Results } from './pages/Report';
import { Expedition, NewsList, NewsPost } from './pages/News';
import NotFound from './pages/NotFound';
import { localePath, useLang } from './lib/i18n';

// Карта геопортала (maplibre-gl) грузится отдельным чанком только на /geoportal
const Geoportal = lazy(() => import('./geoportal/Geoportal'));

function OldPost() {
  const { id } = useParams();
  const lang = useLang();
  return <Navigate to={localePath(lang, `/news/${id}`)} replace />;
}

// Страницы сайта на одном языке: prefix '' для русского, '/en' для английского (те же адреса с префиксом)
function pageRoutes(prefix) {
  const p = (path) => (prefix ? (path === '/' ? prefix : `${prefix}${path}`) : path);
  const to = (path) => localePath(prefix ? 'en' : 'ru', path);
  return [
    <Route key="home" path={p('/')} element={<Home />} />,
    <Route key="city" path={p('/cities/:slug')} element={<City />} />,
    <Route key="results" path={p('/results')} element={<Results />} />,
    <Route key="year" path={p('/results/:year')} element={<Results />} />,
    <Route key="materials" path={p('/materials')} element={<Materials />} />,
    <Route key="news" path={p('/news')} element={<NewsList />} />,
    <Route key="post" path={p('/news/:id')} element={<NewsPost />} />,
    <Route key="exp" path={p('/expeditions/:id')} element={<Expedition />} />,
    // адреса прежней версии сайта
    <Route key="o1" path={p('/cities')} element={<Navigate to={to('/#cities')} replace />} />,
    <Route key="o2" path={p('/expeditions')} element={<Navigate to={to('/materials#expeditions')} replace />} />,
    <Route key="o3" path={p('/publications')} element={<Navigate to={to('/materials#publications')} replace />} />,
    <Route key="o4" path={p('/team')} element={<Navigate to={to('/materials#team')} replace />} />,
    <Route key="o5" path={p('/blog')} element={<Navigate to={to('/news')} replace />} />,
    <Route key="o6" path={p('/blog/:id')} element={<OldPost />} />,
    <Route key="404" path={p('/*')} element={<NotFound />} />,
  ];
}

export default function App() {
  // key: при смене языка карта создаётся заново, и подписи, собранные при создании (атрибуция, подсказки), тоже
  const geo = (lang) => <Suspense key={lang} fallback={<Loading />}><Geoportal /></Suspense>;
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/geoportal" element={geo('ru')} />
        <Route path="/en/geoportal" element={geo('en')} />
        <Route path="/en" element={<Layout />}>{pageRoutes('/en')}</Route>
        <Route element={<Layout />}>{pageRoutes('')}</Route>
      </Routes>
    </BrowserRouter>
  );
}
