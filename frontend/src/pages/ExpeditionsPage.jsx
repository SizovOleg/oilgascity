import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Compass, Calendar } from 'lucide-react';
import { getPageByType, getChildren } from '../api/client';
import AnimatedSection, { StaggerContainer, StaggerItem } from '../components/AnimatedSection';

export default function ExpeditionsPage() {
  const [expeditions, setExpeditions] = useState([]);

  useEffect(() => {
    getPageByType('home.ExpeditionsIndexPage').then(res => {
      if (res.data.items.length > 0) {
        getChildren(res.data.items[0].id).then(r => setExpeditions(r.data.items));
      }
    });
  }, []);

  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection>
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
              <Compass className="w-5 h-5 text-sky-600" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Экспедиции</h1>
          </div>
        </AnimatedSection>
        {expeditions.length > 0 ? (
          <StaggerContainer staggerDelay={0.15} className="space-y-6">
            {expeditions.map(exp => (
              <StaggerItem key={exp.id}>
                <Link to={'/expeditions/' + exp.id}
                  className="group glass-card overflow-hidden hover:border-sky-300 hover:shadow-md transition-all duration-300 block p-6">
                  <h2 className="text-xl font-bold text-gray-900 group-hover:text-sky-600 transition-colors">{exp.title}</h2>
                  <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500">
                    <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{exp.date_start}{exp.date_end ? ' — ' + exp.date_end : ''}</span>
                    {exp.location && <span>{exp.location}</span>}
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </StaggerContainer>
        ) : (
          <AnimatedSection>
            <div className="glass-card p-8 text-center">
              <Compass className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">Экспедиции будут добавлены позже</p>
            </div>
          </AnimatedSection>
        )}
      </div>
    </div>
  );
}
