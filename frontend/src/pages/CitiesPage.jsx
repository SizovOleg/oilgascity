import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { getPageByType, getChildren } from '../api/client';
import AnimatedSection, { StaggerContainer, StaggerItem } from '../components/AnimatedSection';
import CityMap from '../components/CityMap';

export default function CitiesPage() {
  const [cities, setCities] = useState([]);

  useEffect(() => {
    getPageByType('home.CitiesIndexPage').then(res => {
      if (res.data.items.length > 0) {
        getChildren(res.data.items[0].id).then(r => setCities(r.data.items));
      }
    });
  }, []);

  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
            <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.5rem', background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MapPin style={{ width: '1.25rem', height: '1.25rem', color: '#0284c7' }} />
            </div>
            <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#111827' }}>Города</h1>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.1}>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Объекты исследования — два малых молодых города на севере Западной Сибири
          </p>
          <CityMap />
        </AnimatedSection>

        {cities.length > 0 && (
          <StaggerContainer staggerDelay={0.15} className="grid grid-cols-1 sm:grid-cols-2 gap-6" style={{ marginTop: '2rem' }}>
            {cities.map(city => (
              <StaggerItem key={city.id}>
                <Link to={'/cities/' + city.id}
                  className="group glass-card" style={{ display: 'block', overflow: 'hidden', textDecoration: 'none', transition: 'box-shadow 0.3s' }}>
                  {city.header_image && (
                    <div style={{ overflow: 'hidden' }}>
                      <img src={city.header_image.large} alt={city.title}
                        style={{ width: '100%', height: '12rem', objectFit: 'cover', transition: 'transform 0.5s' }} />
                    </div>
                  )}
                  <div style={{ padding: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>{city.title}</h2>
                    {city.region && <p style={{ color: '#6b7280', marginTop: '0.25rem' }}>{city.region}</p>}
                    {city.population && <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginTop: '0.5rem' }}>Население: {city.population}</p>}
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </StaggerContainer>
        )}

        {cities.length === 0 && (
          <AnimatedSection delay={0.2}>
            <p style={{ color: '#9ca3af', marginTop: '2rem' }}>Страницы городов будут добавлены позже.</p>
          </AnimatedSection>
        )}
      </div>
    </div>
  );
}
