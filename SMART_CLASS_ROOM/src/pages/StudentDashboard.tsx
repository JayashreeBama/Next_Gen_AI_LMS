import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { BookOpen, FileText, History, ChevronRight, PlayCircle, Globe, File, Sparkles, X, RefreshCw, Loader2, MessageCircle, Send, Edit2, Check, Save } from 'lucide-react';
import Markdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Material, Question, Progress } from '../types';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export default function StudentDashboard({ view }: { view?: 'questions' }) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [aiContent, setAiContent] = useState<any>(null);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<any>(null);
  const [questionSubjectFilter, setQuestionSubjectFilter] = useState('all');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Hi! I am your study assistant. Ask me any topic, concept, or question.' }
  ]);

  const navigate = useNavigate();

  // AI Planner (student-facing) — copied helpers from StaffDashboard
  const [planner, setPlanner] = useState({ subject: '', topic: '', description: '' });
  const [recommendations, setRecommendations] = useState<any>(null);
  const [editableRecommendations, setEditableRecommendations] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const handleGetRecommendations = async () => {
    if (!planner.subject || !planner.topic) return;
    setAiLoading(true);
    try {
      const data = await (await import('../services/aiService')).aiService.getStaffRecommendations(planner.subject, planner.topic, planner.description);
      setRecommendations(data);
      setEditableRecommendations(data);
      setIsEditing(false);
    } catch (err) {
      console.error(err);
    }
    setAiLoading(false);
  };

  const getYouTubeVideoId = (url: string) => {
    if (!url) return null;
    const value = String(url || '').trim();
    const ytMatch = value.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
    if (ytMatch && ytMatch[1]) return ytMatch[1];
    if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;
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
    const normalized = normalizeExternalUrl(url);
    const id = getYouTubeVideoId(normalized);
    if (id) {
      try { window.open(`https://www.youtube.com/watch?v=${id}`, '_blank'); } catch {}
    } else if (normalized && normalized.startsWith('http')) {
      try { window.open(normalized, '_blank'); } catch {}
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
      const blob = new Blob([JSON.stringify(contentToSave, null, 2)], { type: 'application/json' });
      formData.append('file', blob, `${planner.topic.replace(/\s+/g, '_')}_plan.json`);
      const result = await api.staff.uploadMaterial(formData);
      if (result.error) throw new Error(result.error);
      setSaveStatus('success');
      fetchData(true);
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

  useEffect(() => {
    fetchData();
  }, [view]);

  useEffect(() => {
    if (questionSubjectFilter === 'all') return;
    const exists = questionSubjects.some((subject) => subject === questionSubjectFilter);
    if (!exists) setQuestionSubjectFilter('all');
  }, [questions, questionSubjectFilter]);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      if (!view) {
        const materialsData = await api.student.getMaterials();
        setMaterials(materialsData);
      } else {
        const questionsData = await api.student.getQuestions();
        setQuestions(questionsData);
      }
      const progressData = await api.student.getProgress();
      setProgress(progressData);
    } catch (err) {
      console.error(err);
    }
    if (isRefresh) setRefreshing(false);
    else setLoading(false);
  };

  const handleAccess = async (m: Material) => {
    await api.student.logAccess(m.id);
    if (m.resource_type === 'AI_GENERATED') {
      try {
        const response = await fetch(m.file_path);
        const data = await response.json();
        setAiContent(data);
        setSelectedMaterial(m);
      } catch (err) {
        console.error('Failed to load AI content', err);
        // Fallback to description if file fails
        setAiContent({ objective: m.description, studyGuide: 'Content could not be loaded.' });
        setSelectedMaterial(m);
      }
      return;
    }
    
    if (m.file_path.startsWith('http')) {
      window.open(m.file_path, '_blank');
    } else {
      window.open(m.file_path, '_blank');
    }
  };

  const handleSubmitAnswer = async () => {
    if (!selectedQuestion || !answer) return;
    const res = await api.student.submitAnswer({
      question_id: selectedQuestion.id,
      selected_answer: answer
    });
    setResult(res);
    fetchData(true);
  };

  const handleSendChat = async () => {
    const message = chatInput.trim();
    if (!message || chatLoading) return;

    const nextMessages = [...chatMessages, { role: 'user' as const, content: message }];
    setChatMessages(nextMessages);
    setChatInput('');
    setChatLoading(true);

    try {
      const history = nextMessages.slice(-8, -1).map((m) => ({ role: m.role, content: m.content }));
      const res = await api.student.chatbotAsk(message, history);
      if (res?.error) {
        setChatMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${res.error}` }]);
      } else {
        setChatMessages((prev) => [...prev, { role: 'assistant', content: String(res?.reply || 'No response.') }]);
      }
    } catch (err) {
      console.error('Chatbot error:', err);
      setChatMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, I could not respond right now.' }]);
    }

    setChatLoading(false);
  };

  const questionSubjects = Array.from(
    new Set(questions.map((q) => (q.subject || '').trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const filteredQuestions = questions.filter((q) => {
    if (questionSubjectFilter === 'all') return true;
    return (q.subject || '').trim().toLowerCase() === questionSubjectFilter.toLowerCase();
  });

  const groupedQuestions = filteredQuestions.reduce<Record<string, Question[]>>((acc, q) => {
    const key = (q.subject || 'General').trim() || 'General';
    if (!acc[key]) acc[key] = [];
    acc[key].push(q);
    return acc;
  }, {});

  const groupedQuestionEntries = Object.entries(groupedQuestions).sort((a, b) => a[0].localeCompare(b[0]));

  groupedQuestionEntries.forEach((entry) => {
    entry[1].sort((a, b) => (a.topic || '').localeCompare(b.topic || ''));
  });

  const aiGeneratedMaterials = materials.filter((m) => String(m.resource_type || '').toUpperCase() === 'AI_GENERATED');
  const otherMaterials = materials.filter((m) => String(m.resource_type || '').toUpperCase() !== 'AI_GENERATED');

  const groupedAiMaterials = aiGeneratedMaterials.reduce<Record<string, Material[]>>((acc, material) => {
    const key = (material.subject || 'General').trim() || 'General';
    if (!acc[key]) acc[key] = [];
    acc[key].push(material);
    return acc;
  }, {});

  const groupedAiEntries = Object.entries(groupedAiMaterials).sort((a, b) => a[0].localeCompare(b[0]));

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Student Dashboard</h1>
          <p className="text-slate-500">Access your learning resources and assessments</p>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
              <BookOpen size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Available Materials</p>
              <p className="text-2xl font-bold text-slate-900">{materials.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
              <FileText size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Assigned Questions</p>
              <p className="text-2xl font-bold text-slate-900">{questions.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <History size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Completed Tasks</p>
              <p className="text-2xl font-bold text-slate-900">{progress.length}</p>
            </div>
          </div>
        </div>
      </div>

      {!view ? (
        <>
          {selectedMaterial && aiContent && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 bg-white rounded-2xl shadow-lg border-2 border-orange-100 overflow-hidden"
            >
              <div className="p-6 bg-orange-600 text-white flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles size={20} />
                    <span className="text-xs font-bold uppercase tracking-widest opacity-80">AI Generated Study Guide</span>
                  </div>
                  <h2 className="text-2xl font-bold">{selectedMaterial.topic}</h2>
                </div>
                <button onClick={() => setSelectedMaterial(null)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                  <X size={24} />
                </button>
              </div>
              <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <BookOpen size={20} className="text-orange-600" />
                      Learning Objective
                    </h3>
                    <p className="text-slate-700 text-lg leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100 italic">
                      "{aiContent.objective}"
                    </p>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <FileText size={20} className="text-orange-600" />
                      Study Content
                    </h3>
                    
                    {aiContent.resources && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Video Resources</h4>
                          {aiContent.resources.youtube?.map((res: any, i: number) => (
                            <a key={i} href={res.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl border border-red-100 hover:bg-red-100 transition-colors text-sm font-medium">
                              <PlayCircle size={16} />
                              <span className="truncate">{res.title}</span>
                            </a>
                          ))}
                        </div>
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Learning Websites</h4>
                          {aiContent.resources.websites?.map((res: any, i: number) => (
                            <a key={i} href={res.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 bg-orange-50 text-orange-700 rounded-xl border border-orange-100 hover:bg-orange-100 transition-colors text-sm font-medium">
                              <Globe size={16} />
                              <span className="truncate">{res.title}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed">
                      <Markdown>{aiContent.studyGuide}</Markdown>
                    </div>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Key Keywords</h3>
                    <div className="flex flex-wrap gap-2">
                      {aiContent.keywords?.map((k: string, i: number) => (
                        <span key={i} className="px-3 py-1 bg-white text-orange-600 border border-orange-100 text-sm font-bold rounded-full shadow-sm">
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
                    <h3 className="text-sm font-bold text-emerald-600 uppercase tracking-widest mb-4">Summary</h3>
                    <p className="text-emerald-800 text-sm font-medium leading-relaxed">
                      {aiContent.summary}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

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
              <Sparkles size={48} className="mb-4 opacity-20" />
              <p>Enter details and click the button to get AI-powered lesson planning suggestions.</p>
            </div>
          )}
        </section>
      </div>

      <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-xl font-bold text-slate-900">Learning Materials</h2>
          </div>
          <div className="p-6 space-y-8">
            {groupedAiEntries.length > 0 && (
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-slate-900">AI Generated Materials (Subject-wise)</h3>
                {groupedAiEntries.map(([subject, subjectMaterials]) => (
                  <div key={subject} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-slate-700 uppercase tracking-wider">{subject}</p>
                      <span className="text-xs font-semibold text-slate-500">{subjectMaterials.length} materials</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {subjectMaterials.map((m) => (
                        <div key={m.id} className="group border border-purple-100 rounded-xl p-4 hover:border-purple-300 hover:shadow-md transition-all cursor-pointer" onClick={() => handleAccess(m)}>
                          <div className="flex items-start justify-between mb-3">
                            <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                              <Sparkles size={20} />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-500">AI_GENERATED</span>
                          </div>
                          <h3 className="font-bold text-slate-900 group-hover:text-purple-700 transition-colors">{m.topic}</h3>
                          <p className="text-sm text-slate-500 mt-1 line-clamp-2">{m.description}</p>
                          <div className="mt-4 flex items-center text-xs font-semibold text-slate-400">
                            <span className="mr-2">{m.subject}</span>
                            <ChevronRight size={14} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {otherMaterials.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-900">Other Learning Materials</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {otherMaterials.map((m) => (
                    <div key={m.id} className="group border border-slate-100 rounded-xl p-4 hover:border-orange-200 hover:shadow-md transition-all cursor-pointer" onClick={() => handleAccess(m)}>
                      <div className="flex items-start justify-between mb-3">
                        <div className={`p-2 rounded-lg ${
                          m.resource_type === 'youtube' ? 'bg-red-50 text-red-600' :
                          m.resource_type === 'website' ? 'bg-orange-50 text-orange-600' :
                          'bg-slate-50 text-slate-600'
                        }`}>
                          {m.resource_type === 'youtube' ? <PlayCircle size={20} /> :
                           m.resource_type === 'website' ? <Globe size={20} /> :
                           <File size={20} />}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{m.resource_type}</span>
                      </div>
                      <h3 className="font-bold text-slate-900 group-hover:text-orange-600 transition-colors">{m.topic}</h3>
                      <p className="text-sm text-slate-500 mt-1 line-clamp-2">{m.description}</p>
                      <div className="mt-4 flex items-center text-xs font-semibold text-slate-400">
                        <span className="mr-2">{m.subject}</span>
                        <ChevronRight size={14} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {materials.length === 0 && (
              <div className="py-12 text-center text-slate-400">No materials available yet.</div>
            )}
          </div>
        </section>
        </>
      ) : (
        <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-xl font-bold text-slate-900">AI Generated Question Papers</h2>
          </div>
          <div className="p-6">
            {!selectedQuestion ? (
              <div className="space-y-6">
                <div className="flex justify-end">
                  <select
                    value={questionSubjectFilter}
                    onChange={(e) => setQuestionSubjectFilter(e.target.value)}
                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                  >
                    <option value="all">All Subjects</option>
                    {questionSubjects.map((subject) => (
                      <option key={subject} value={subject}>{subject}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {groupedQuestionEntries.map(([subject, subjectQuestions]) => (
                    <div key={subject} className="group border border-slate-100 rounded-xl p-4 hover:shadow-md transition-all flex flex-col justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">{subject}</h3>
                          <p className="text-sm text-slate-500 mt-2 line-clamp-2">{subjectQuestions[0]?.topic ?? `Practice important topics in ${subject}`}</p>
                          <p className="text-xs text-slate-400 mt-3">{subjectQuestions.length} questions</p>
                        </div>
                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={() => navigate(`/course/${encodeURIComponent(subject)}`)}
                          className="px-4 py-2 bg-orange-600 text-white text-sm font-semibold rounded-lg hover:bg-orange-700 transition-colors"
                        >
                          Open Assessment
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {filteredQuestions.length === 0 && (
                  <div className="py-12 text-center text-slate-400">No questions assigned for this subject yet.</div>
                )}
              </div>
            ) : (
              <div className="max-w-2xl mx-auto">
                <button onClick={() => setSelectedQuestion(null)} className="mb-6 text-orange-600 font-semibold flex items-center gap-1">
                  <ChevronRight size={16} className="rotate-180" /> Back to list
                </button>
                <div className="bg-slate-50 p-8 rounded-2xl">
                  <p className="text-sm font-bold text-orange-600 uppercase mb-2">{selectedQuestion.subject} • {selectedQuestion.topic}</p>
                  <h3 className="text-xl font-bold text-slate-900 mb-8">{selectedQuestion.question_text}</h3>
                  
                  <div className="space-y-3">
                    {['A', 'B', 'C', 'D'].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => !result && setAnswer(opt)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between ${
                          answer === opt 
                            ? 'border-orange-600 bg-orange-50 text-orange-600' 
                            : 'border-white bg-white text-slate-600 hover:border-slate-200'
                        } ${result && opt === result.correct_answer ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : ''}
                          ${result && answer === opt && opt !== result.correct_answer ? 'border-red-500 bg-red-50 text-red-700' : ''}
                        `}
                      >
                        <span>{opt}. {(selectedQuestion as any)[`option_${opt.toLowerCase()}`]}</span>
                      </button>
                    ))}
                  </div>

                  {!result ? (
                    <button
                      onClick={handleSubmitAnswer}
                      disabled={!answer}
                      className="w-full mt-8 bg-orange-600 text-white py-4 rounded-xl font-bold hover:bg-orange-700 disabled:opacity-50 transition-all"
                    >
                      Submit Answer
                    </button>
                  ) : (
                    <div className={`mt-8 p-4 rounded-xl text-center font-bold ${result.score > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {result.score > 0 ? 'Correct Answer!' : `Wrong! The correct answer was ${result.correct_answer}`}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
      <div className="fixed bottom-6 right-6 z-50">
        {chatOpen ? (
          <div className="w-[340px] sm:w-[380px] h-[520px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            <div className="px-4 py-3 bg-orange-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold">
                <MessageCircle size={18} />
                Student Chatbot
              </div>
              <button onClick={() => setChatOpen(false)} className="p-1 rounded hover:bg-white/10">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 p-3 space-y-3 overflow-y-auto bg-slate-50">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${msg.role === 'user' ? 'ml-auto bg-orange-600 text-white' : 'mr-auto bg-white border border-slate-200 text-slate-700'}`}>
                  {msg.content}
                </div>
              ))}
              {chatLoading && (
                <div className="mr-auto bg-white border border-slate-200 text-slate-500 rounded-xl px-3 py-2 text-sm flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> Thinking...
                </div>
              )}
            </div>

            <div className="p-3 border-t border-slate-200 bg-white flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChat();
                  }
                }}
                placeholder="Ask a study question..."
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 outline-none text-sm"
              />
              <button
                onClick={handleSendChat}
                disabled={!chatInput.trim() || chatLoading}
                className="px-3 py-2 bg-orange-600 text-white rounded-xl hover:bg-orange-700 disabled:opacity-50"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setChatOpen(true)}
            className="h-14 w-14 rounded-full bg-orange-600 text-white shadow-xl hover:bg-orange-700 flex items-center justify-center"
            title="Open Student Chatbot"
          >
            <MessageCircle size={24} />
          </button>
        )}
      </div>
    </div>
  );
}
