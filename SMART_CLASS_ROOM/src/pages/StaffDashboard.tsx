import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { BookOpen, Users, BrainCircuit, ChevronRight, FileText, Sparkles, Loader2, Save, Edit2, Check, X, RefreshCw } from 'lucide-react';
import Markdown from 'react-markdown';
import { api } from '../api';
import { aiService } from '../services/aiService';
import { Material, Progress } from '../types';

export default function StaffDashboard() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // AI Planner State
  const [planner, setPlanner] = useState({ subject: '', topic: '', description: '' });
  const [recommendations, setRecommendations] = useState<any>(null);
  const [editableRecommendations, setEditableRecommendations] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  // Viewer State
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [viewingContent, setViewingContent] = useState<any>(null);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const [playingVideoWatchUrl, setPlayingVideoWatchUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const materialsData = await api.staff.getMaterials();
      const progressData = await api.staff.getProgress();
      setMaterials(materialsData);
      setProgress(progressData);
    } catch (err) {
      console.error(err);
    }
    if (isRefresh) setRefreshing(false);
    else setLoading(false);
  };

  const handleGetRecommendations = async () => {
    if (!planner.subject || !planner.topic) return;
    setAiLoading(true);
    try {
      const data = await aiService.getStaffRecommendations(planner.subject, planner.topic, planner.description);
      setRecommendations(data);
      setEditableRecommendations(data);
      setIsEditing(false);
    } catch (err) {
      console.error(err);
    }
    setAiLoading(false);
  };

  const handleViewMaterial = async (m: Material) => {
    if (m.resource_type === 'AI_GENERATED') {
      try {
        const response = await fetch(m.file_path);
        const data = await response.json();
        setViewingContent(data);
        setSelectedMaterial(m);
      } catch (err) {
        console.error(err);
      }
    } else {
      window.open(m.file_path, '_blank');
    }
  };

  const getYouTubeVideoId = (url: string) => {
    if (!url) return null;
    // handle various YouTube URL formats and embed IDs
    const ytMatch = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
    if (ytMatch && ytMatch[1]) return ytMatch[1];
    // if the url is just an ID
    if (/^[A-Za-z0-9_-]{11}$/.test(url)) return url;
    return null;
  };

  const normalizeExternalUrl = (raw: string) => {
    const value = String(raw || '').trim();
    if (!value) return '';
    if (value.startsWith('http://') || value.startsWith('https://')) return value;
    if (value.startsWith('www.')) return `https://${value}`;
    return value;
  };

  const handlePlayVideo = (url: string) => {
    const normalizedUrl = normalizeExternalUrl(url);
    const id = getYouTubeVideoId(normalizedUrl);
    if (id) {
      setPlayingVideo(`https://www.youtube.com/embed/${id}?autoplay=1`);
      setPlayingVideoWatchUrl(`https://www.youtube.com/watch?v=${id}`);
    } else if (normalizedUrl && normalizedUrl.startsWith('http')) {
      window.open(normalizedUrl, '_blank');
    } else {
      // fallback: open as text or do nothing
      console.warn('Unable to play video, invalid URL:', url);
    }
  };

  const handleSaveMaterial = async () => {
    const contentToSave = editableRecommendations || recommendations;
    if (!contentToSave) return;
    
    setSaveStatus('saving');
    try {
      const formData = new FormData();
      formData.append('subject', planner.subject);
      formData.append('topic', planner.topic);
      formData.append('description', contentToSave.summary || planner.description);
      formData.append('resource_type', 'AI_GENERATED');
      
      // Create a blob from the full JSON content to save as a file
      const blob = new Blob([JSON.stringify(contentToSave, null, 2)], { type: 'application/json' });
      formData.append('file', blob, `${planner.topic.replace(/\s+/g, '_')}_plan.json`);

      const result = await api.staff.uploadMaterial(formData);
      if (result.error) throw new Error(result.error);
      
      setSaveStatus('success');
      fetchData(true);
      
      // Reset after a delay
      setTimeout(() => {
        setPlanner({ subject: '', topic: '', description: '' });
        setRecommendations(null);
        setEditableRecommendations(null);
        setIsEditing(false);
        setSaveStatus('idle');
      }, 2000);
    } catch (err) {
      console.error('Save failed:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Staff Dashboard</h1>
          <p className="text-slate-500">Manage your courses and track student performance</p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50"
        >
          {refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          <span className="text-sm font-medium">{refreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </header>

      {selectedMaterial && viewingContent && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-8 bg-white rounded-2xl shadow-lg border-2 border-orange-100 overflow-hidden"
        >
          <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-orange-400">Material Preview</span>
              <h2 className="text-2xl font-bold">{selectedMaterial.topic}</h2>
            </div>
            <button onClick={() => setSelectedMaterial(null)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <X size={24} />
            </button>
          </div>
          <div className="p-8">
            <div className="prose prose-slate max-w-none">
              <h3 className="text-orange-600">Learning Objective</h3>
              <p>{viewingContent.objective}</p>
              
              {viewingContent.resources && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6 not-prose">
                  <div>
                    <h4 className="text-sm font-bold text-slate-500 uppercase mb-2">YouTube Resources</h4>
                    <div className="space-y-2">
                      {viewingContent.resources.youtube?.map((res: any, i: number) => (
                        <a key={i} href={res.url} target="_blank" rel="noopener noreferrer" className="block p-3 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm font-medium">
                          {res.title}
                        </a>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-500 uppercase mb-2">Websites</h4>
                    <div className="space-y-2">
                      {viewingContent.resources.websites?.map((res: any, i: number) => (
                        <a key={i} href={res.url} target="_blank" rel="noopener noreferrer" className="block p-3 bg-orange-50 text-orange-700 rounded-xl border border-orange-100 text-sm font-medium">
                          {res.title}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <h3 className="text-orange-600">Study Guide</h3>
              <Markdown>{viewingContent.studyGuide}</Markdown>
            </div>
          </div>
        </motion.div>
      )}

      {/* Video player modal for YouTube resources */}
      {playingVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="relative w-[90%] max-w-4xl bg-transparent">
            <button onClick={() => { setPlayingVideo(null); setPlayingVideoWatchUrl(null); }} className="absolute right-2 top-2 p-2 bg-white rounded-full shadow-sm z-10">
              <X />
            </button>
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              <iframe
                src={playingVideo}
                title="YouTube Player"
                allow="autoplay; encrypted-media"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
            {playingVideoWatchUrl && (
              <div className="mt-3 text-center">
                <a
                  href={playingVideoWatchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-4 py-2 bg-white text-slate-800 rounded-lg font-semibold hover:bg-slate-100"
                >
                  Open In YouTube
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
              <BookOpen size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Materials</p>
              <p className="text-2xl font-bold text-slate-900">{materials.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-50 text-green-600 rounded-xl">
              <BrainCircuit size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">AI Tasks</p>
              <p className="text-2xl font-bold text-slate-900">Ready</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
              <FileText size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Assessments</p>
              <p className="text-2xl font-bold text-slate-900">{progress.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Active Students</p>
              <p className="text-2xl font-bold text-slate-900">
                {new Set(progress.map(p => p.student_name)).size}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="text-orange-600" size={24} />
            <h2 className="text-xl font-bold text-slate-900">AI Content Planner</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
              <input
                type="text"
                value={planner.subject}
                onChange={(e) => setPlanner({ ...planner, subject: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 outline-none"
                placeholder="e.g. Physics"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Topic</label>
              <input
                type="text"
                value={planner.topic}
                onChange={(e) => setPlanner({ ...planner, topic: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 outline-none"
                placeholder="e.g. Quantum Mechanics"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
              <textarea
                value={planner.description}
                onChange={(e) => setPlanner({ ...planner, description: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 outline-none h-24"
                placeholder="Briefly describe what you want to cover..."
              />
            </div>
            <button
              onClick={handleGetRecommendations}
              disabled={aiLoading || !planner.subject || !planner.topic}
              className="w-full py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {aiLoading ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
              Get AI Recommendations
            </button>
          </div>
        </section>

        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 min-h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-slate-900">Recommendations</h2>
            {recommendations && (
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className={`p-2 rounded-lg transition-colors ${isEditing ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {isEditing ? <Check size={18} /> : <Edit2 size={18} />}
              </button>
            )}
          </div>
          
          {editableRecommendations ? (
            <div className="space-y-6">
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Objective</label>
                    <input
                      type="text"
                      value={editableRecommendations.objective}
                      onChange={(e) => setEditableRecommendations({...editableRecommendations, objective: e.target.value})}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-orange-500 outline-none"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">YouTube Resources</label>
                      {editableRecommendations.resources?.youtube?.map((res: any, idx: number) => (
                        <div key={idx} className="flex flex-col gap-1 mb-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                          <input
                            type="text"
                            value={res.title}
                            onChange={(e) => {
                              const newYoutube = editableRecommendations.resources.youtube.map((item: any, i: number) => 
                                i === idx ? { ...item, title: e.target.value } : item
                              );
                              setEditableRecommendations({
                                ...editableRecommendations,
                                resources: { ...editableRecommendations.resources, youtube: newYoutube }
                              });
                            }}
                            className="text-xs px-2 py-1 rounded border border-slate-200"
                            placeholder="Video Title"
                          />
                          <input
                            type="text"
                            value={res.url}
                            onChange={(e) => {
                              const newYoutube = editableRecommendations.resources.youtube.map((item: any, i: number) => 
                                i === idx ? { ...item, url: e.target.value } : item
                              );
                              setEditableRecommendations({
                                ...editableRecommendations,
                                resources: { ...editableRecommendations.resources, youtube: newYoutube }
                              });
                            }}
                            className="text-xs px-2 py-1 rounded border border-slate-200"
                            placeholder="URL"
                          />
                        </div>
                      ))}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Website Resources</label>
                      {editableRecommendations.resources?.websites?.map((res: any, idx: number) => (
                        <div key={idx} className="flex flex-col gap-1 mb-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                          <input
                            type="text"
                            value={res.title}
                            onChange={(e) => {
                              const newWebsites = editableRecommendations.resources.websites.map((item: any, i: number) => 
                                i === idx ? { ...item, title: e.target.value } : item
                              );
                              setEditableRecommendations({
                                ...editableRecommendations,
                                resources: { ...editableRecommendations.resources, websites: newWebsites }
                              });
                            }}
                            className="text-xs px-2 py-1 rounded border border-slate-200"
                            placeholder="Site Title"
                          />
                          <input
                            type="text"
                            value={res.url}
                            onChange={(e) => {
                              const newWebsites = editableRecommendations.resources.websites.map((item: any, i: number) => 
                                i === idx ? { ...item, url: e.target.value } : item
                              );
                              setEditableRecommendations({
                                ...editableRecommendations,
                                resources: { ...editableRecommendations.resources, websites: newWebsites }
                              });
                            }}
                            className="text-xs px-2 py-1 rounded border border-slate-200"
                            placeholder="URL"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Study Guide (Markdown)</label>
                    <textarea
                      value={editableRecommendations.studyGuide}
                      onChange={(e) => setEditableRecommendations({...editableRecommendations, studyGuide: e.target.value})}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-orange-500 outline-none h-48 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Summary</label>
                    <textarea
                      value={editableRecommendations.summary}
                      onChange={(e) => setEditableRecommendations({...editableRecommendations, summary: e.target.value})}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-orange-500 outline-none h-20"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Learning Objective</h3>
                    <p className="text-slate-900 font-medium">{editableRecommendations.objective}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">YouTube Resources</h3>
                      {editableRecommendations.resources?.youtube?.length > 0 ? (
                        <div className="space-y-2">
                          {editableRecommendations.resources.youtube.map((res: any, idx: number) => (
                            <button
                              key={idx}
                              onClick={() => handlePlayVideo(res.url)}
                              className="w-full text-left p-3 bg-red-50 text-red-700 rounded-xl border border-red-100 hover:bg-red-100 transition-colors text-sm font-medium"
                            >
                              {res.title}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500 bg-slate-50 border border-slate-100 rounded-xl p-3">
                          No valid YouTube videos found for this topic. Try regenerating with a more specific topic.
                        </p>
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Websites</h3>
                      <div className="space-y-2">
                        {editableRecommendations.resources?.websites?.map((res: any, idx: number) => (
                          <a 
                            key={idx} 
                            href={normalizeExternalUrl(res.url)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="block p-3 bg-orange-50 text-orange-700 rounded-xl border border-orange-100 hover:bg-orange-100 transition-colors text-sm font-medium"
                          >
                            {res.title}
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Study Guide</h3>
                    <div className="prose prose-slate max-w-none text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100 max-h-64 overflow-y-auto">
                      <Markdown>{editableRecommendations.studyGuide}</Markdown>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Keywords</h3>
                    <div className="flex flex-wrap gap-2">
                      {editableRecommendations.keywords?.map((k: string, i: number) => (
                        <span key={i} className="px-2 py-1 bg-orange-50 text-orange-700 text-xs font-bold rounded">
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleSaveMaterial}
                  disabled={saveStatus !== 'idle'}
                  className={`flex-1 py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 ${
                    saveStatus === 'success' ? 'bg-emerald-600 text-white' :
                    saveStatus === 'error' ? 'bg-red-600 text-white' :
                    'bg-orange-600 text-white hover:bg-orange-700'
                  } disabled:opacity-50`}
                >
                  {saveStatus === 'saving' ? <Loader2 className="animate-spin" size={20} /> : 
                   saveStatus === 'success' ? <Check size={20} /> :
                   saveStatus === 'error' ? <X size={20} /> :
                   <Save size={20} />}
                  {saveStatus === 'saving' ? 'Saving...' : 
                   saveStatus === 'success' ? 'Saved Successfully!' :
                   saveStatus === 'error' ? 'Failed to Save' :
                   'Save Final Material'}
                </button>
                {isEditing && saveStatus === 'idle' && (
                  <button
                    onClick={() => {
                      setEditableRecommendations(recommendations);
                      setIsEditing(false);
                    }}
                    className="px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center">
              <BrainCircuit size={48} className="mb-4 opacity-20" />
              <p>Enter details and click the button to get AI-powered lesson planning suggestions.</p>
            </div>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-900">Recent Materials</h2>
            <button className="text-orange-600 text-sm font-semibold hover:underline flex items-center gap-1">
              View All <ChevronRight size={16} />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {materials.slice(0, 5).map((m) => (
              <div key={m.id} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-slate-900">{m.topic}</h3>
                  <p className="text-sm text-slate-500">{m.subject}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-[10px] font-bold rounded uppercase ${
                    m.resource_type === 'AI_GENERATED' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {m.resource_type}
                  </span>
                  <button 
                    onClick={() => handleViewMaterial(m)}
                    className="p-2 text-slate-400 hover:text-orange-600 transition-colors"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            ))}
            {materials.length === 0 && (
              <div className="p-8 text-center text-slate-400">No materials uploaded yet.</div>
            )}
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-900">Student Progress</h2>
            <button className="text-orange-600 text-sm font-semibold hover:underline flex items-center gap-1">
              Full Report <ChevronRight size={16} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-semibold">Student</th>
                  <th className="px-6 py-4 font-semibold">Topic</th>
                  <th className="px-6 py-4 font-semibold">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {progress.slice(0, 5).map((p, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{p.student_name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{p.topic}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        p.score > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {p.score}/1
                      </span>
                    </td>
                  </tr>
                ))}
                {progress.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-slate-400">No progress data available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
