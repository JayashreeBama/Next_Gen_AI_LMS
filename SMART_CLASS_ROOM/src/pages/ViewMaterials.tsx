import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { BookOpen, Search, Filter, PlayCircle, Globe, File, ExternalLink, Download } from 'lucide-react';
import { api } from '../api';
import { Material } from '../types';

export default function ViewMaterials() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await api.student.getMaterials();
      setMaterials(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleAccess = async (m: Material) => {
    await api.student.logAccess(m.id);
    window.open(m.file_path, '_blank');
  };

  const getDownloadName = (m: Material) => {
    if (m.file_path.startsWith('/')) {
      const parts = m.file_path.split('/');
      return parts[parts.length - 1] || `${m.topic}.file`;
    }
    return `${m.topic}.file`;
  };

  const handleDownload = async (m: Material) => {
    try {
      await api.student.logAccess(m.id);
      const blob = await api.student.downloadMaterial(m.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = getDownloadName(m);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed', err);
      alert('Download failed. Please try again.');
    }
  };

  const departments = Array.from(
    new Set(materials.map((m) => (m.department || '').trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const subjects = Array.from(
    new Set(materials.map((m) => (m.subject || '').trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const filtered = materials.filter(m => {
    const matchesSearch = m.topic.toLowerCase().includes(search.toLowerCase()) || 
                         m.subject.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || m.resource_type === typeFilter;
    const materialDepartment = (m.department || '').trim();
    const matchesDepartment = departmentFilter === 'all' || materialDepartment === departmentFilter;
    const materialSubject = (m.subject || '').trim();
    const matchesSubject = subjectFilter === 'all' || materialSubject === subjectFilter;
    return matchesSearch && matchesType && matchesDepartment && matchesSubject;
  });

  const groupedBySubject = filtered.reduce<Record<string, Material[]>>((acc, material) => {
    const key = (material.subject || 'General').trim() || 'General';
    if (!acc[key]) acc[key] = [];
    acc[key].push(material);
    return acc;
  }, {});

  const groupedEntries = Object.entries(groupedBySubject).sort((a, b) => a[0].localeCompare(b[0]));

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Learning Materials</h1>
          <p className="text-slate-500">Explore and access study resources</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search topics..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none w-full sm:w-64"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="pl-10 pr-8 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none appearance-none w-full"
            >
              <option value="all">All Types</option>
              <option value="pdf">PDFs</option>
              <option value="youtube">Videos</option>
              <option value="website">Websites</option>
              <option value="zip">Archives</option>
            </select>
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="pl-10 pr-8 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none appearance-none w-full"
            >
              <option value="all">All Departments</option>
              {departments.map((department) => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="pl-10 pr-8 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none appearance-none w-full"
            >
              <option value="all">All Subjects</option>
              {subjects.map((subject) => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <div className="space-y-8">
        {groupedEntries.map(([subject, subjectMaterials]) => (
          <section key={subject}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">{subject}</h2>
              <span className="text-xs font-semibold text-slate-500">{subjectMaterials.length} materials</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {subjectMaterials.map((m) => {
                return (
                  <motion.div
                    layout
                    key={m.id}
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all overflow-hidden flex flex-col"
                  >
                    <div className={`h-2 ${
                      m.resource_type === 'youtube' ? 'bg-red-500' :
                      m.resource_type === 'website' ? 'bg-blue-500' :
                      'bg-indigo-500'
                    }`} />

                    <div className="p-6 flex-1">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{m.subject}</span>
                        <div className={`p-2 rounded-lg ${
                          m.resource_type === 'youtube' ? 'bg-red-50 text-red-600' :
                          m.resource_type === 'website' ? 'bg-blue-50 text-blue-600' :
                          'bg-indigo-50 text-indigo-600'
                        }`}>
                          {m.resource_type === 'youtube' ? <PlayCircle size={18} /> :
                           m.resource_type === 'website' ? <Globe size={18} /> :
                           <File size={18} />}
                        </div>
                      </div>

                      <h3 className="text-lg font-bold text-slate-900 mb-2 line-clamp-1">{m.topic}</h3>
                      <p className="text-sm text-slate-500 line-clamp-3 mb-6">{m.description}</p>
                      {m.department && (
                        <span className="inline-block mb-4 px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-[10px] font-semibold uppercase tracking-wide">
                          {m.department}
                        </span>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAccess(m)}
                          className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-50 text-slate-700 font-bold rounded-xl hover:bg-indigo-600 hover:text-white transition-all group"
                        >
                          Access
                          <ExternalLink size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </button>
                        <button
                          onClick={() => handleDownload(m)}
                          className="px-4 py-3 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 transition-colors"
                          title="Download ZIP"
                        >
                          <Download size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="px-6 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400">
                        {new Date(m.upload_date).toLocaleDateString()}
                      </span>
                      <span className="text-[10px] font-bold text-indigo-600 uppercase">
                        {m.resource_type}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-20 text-center">
          <BookOpen size={48} className="mx-auto text-slate-200 mb-4" />
          <h3 className="text-xl font-bold text-slate-900">No materials found</h3>
          <p className="text-slate-500">Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  );
}
