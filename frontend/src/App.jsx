import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import CitiesPage from './pages/CitiesPage';
import CityPage from './pages/CityPage';
import ExpeditionsPage from './pages/ExpeditionsPage';
import ExpeditionPage from './pages/ExpeditionPage';
import PublicationsPage from './pages/PublicationsPage';
import TeamPage from './pages/TeamPage';
import BlogPage from './pages/BlogPage';
import BlogPostPage from './pages/BlogPostPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/cities" element={<CitiesPage />} />
          <Route path="/cities/:id" element={<CityPage />} />
          <Route path="/expeditions" element={<ExpeditionsPage />} />
          <Route path="/expeditions/:id" element={<ExpeditionPage />} />
          <Route path="/publications" element={<PublicationsPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:id" element={<BlogPostPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
