import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import Layout from './components/Layout';
import { Loading } from './components/Common';
import Home from './pages/Home';
import City from './pages/City';
import { Materials, Results } from './pages/Report';
import { Expedition, NewsList, NewsPost } from './pages/News';
import NotFound from './pages/NotFound';

// Карта геопортала (maplibre-gl) грузится отдельным чанком только на /geoportal
const Geoportal = lazy(() => import('./geoportal/Geoportal'));

function OldPost() {
  const { id } = useParams();
  return <Navigate to={`/news/${id}`} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/geoportal" element={<Suspense fallback={<Loading />}><Geoportal /></Suspense>} />
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/cities/:slug" element={<City />} />
          <Route path="/results" element={<Results />} />
          <Route path="/results/:year" element={<Results />} />
          <Route path="/materials" element={<Materials />} />
          <Route path="/news" element={<NewsList />} />
          <Route path="/news/:id" element={<NewsPost />} />
          <Route path="/expeditions/:id" element={<Expedition />} />
          {/* адреса прежней версии сайта */}
          <Route path="/cities" element={<Navigate to="/#cities" replace />} />
          <Route path="/expeditions" element={<Navigate to="/materials#expeditions" replace />} />
          <Route path="/publications" element={<Navigate to="/materials#publications" replace />} />
          <Route path="/team" element={<Navigate to="/materials#team" replace />} />
          <Route path="/blog" element={<Navigate to="/news" replace />} />
          <Route path="/blog/:id" element={<OldPost />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
