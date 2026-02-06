import { useState, useEffect } from 'react';
import { Users, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { getPageByType } from '../api/client';
import AnimatedSection, { StaggerContainer, StaggerItem } from '../components/AnimatedSection';

const ROLE_COLORS = {
  'Руководитель проекта': 'from-amber-50 to-orange-50 border-amber-200',
  'Исполнитель': 'from-sky-50 to-cyan-50 border-sky-200',
};

export default function TeamPage() {
  const [page, setPage] = useState(null);

  useEffect(() => {
    getPageByType('home.TeamPage').then(res => {
      if (res.data.items.length > 0) setPage(res.data.items[0]);
    });
  }, []);

  if (!page) return <div className="text-center py-20 text-gray-400">Загрузка...</div>;

  const leader = page.members?.find(m => m.role === 'Руководитель проекта');
  const others = page.members?.filter(m => m.role !== 'Руководитель проекта') || [];

  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection>
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-sky-600" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Авторский коллектив</h1>
          </div>
        </AnimatedSection>
        {leader && <AnimatedSection delay={0.1}><MemberCard member={leader} /></AnimatedSection>}
        <StaggerContainer staggerDelay={0.15} className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {others.map(m => <StaggerItem key={m.id}><MemberCard member={m} /></StaggerItem>)}
        </StaggerContainer>
      </div>
    </div>
  );
}

function MemberCard({ member: m }) {
  const [expanded, setExpanded] = useState(false);
  const colorClass = ROLE_COLORS[m.role] || 'from-sky-50 to-cyan-50 border-sky-200';

  const links = [
    { label: 'ORCID', url: m.orcid },
    { label: 'Scopus', url: m.scopus },
    { label: 'WoS', url: m.wos },
    { label: 'eLibrary', url: m.elibrary },
  ].filter(l => l.url);

  return (
    <div className={`rounded-xl bg-gradient-to-br ${colorClass} border p-5 shadow-sm`}>
      <div className="flex gap-4">
        {m.photo ? (
          <img src={m.photo.thumbnail} alt={m.name} className="w-20 h-20 rounded-xl object-cover shrink-0" />
        ) : (
          <div className="w-20 h-20 rounded-xl bg-gray-200 flex items-center justify-center shrink-0">
            <Users className="w-8 h-8 text-gray-400" />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-gray-900 font-bold text-lg">{m.name}</h3>
          <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium bg-white/70 text-gray-600 border border-gray-200">{m.role}</span>
          {m.position && <p className="text-gray-500 text-sm mt-1">{m.position}</p>}
          {m.organization && <p className="text-gray-400 text-sm">{m.organization}</p>}
        </div>
      </div>
      {(links.length > 0 || m.spin_code) && (
        <div className="mt-3">
          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1.5 text-sky-600 hover:text-sky-700 text-sm transition-colors">
            Научные профили {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {expanded && (
            <div className="mt-2 flex flex-wrap gap-2">
              {links.map(l => (
                <a key={l.label} href={l.url} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded text-xs text-sky-600 hover:text-sky-700 border border-gray-200">
                  {l.label} <ExternalLink className="w-3 h-3" />
                </a>
              ))}
              {m.spin_code && <span className="px-2 py-1 bg-white rounded text-xs text-gray-500 border border-gray-200">SPIN: {m.spin_code}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
