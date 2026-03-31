import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Upload, Link as LinkIcon, FileText, Youtube, Globe, BrainCircuit, CheckCircle2 } from 'lucide-react';
import { api } from '../api';
import { aiService } from '../services/aiService';

export default function UploadMaterial() {
  const [formData, setFormData] = useState({
    subject: '',
    topic: '',
    description: '',
    resource_type: 'pdf',
    link: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<any>(null);
  const [suggesting, setSuggesting] = useState(false);

  const suggestionYoutube = suggestions?.youtube || suggestions?.resources?.youtube || [];
  const suggestionWebsites = suggestions?.websites || suggestions?.resources?.websites || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const data = new FormData();
    Object.entries(formData).forEach(([key, value]) => data.append(key, value as string));
    if (file) data.append('file', file);

    try {
      await api.staff.uploadMaterial(data);
      alert('Material uploaded successfully!');
      setFormData({ subject: '', topic: '', description: '', resource_type: 'pdf', link: '' });
      setFile(null);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleSuggest = async () => {
    if (!formData.topic) return;
    setSuggesting(true);
    try {
      const res = await aiService.suggestResources(formData.topic);
      setSuggestions(res);
    } catch (err) {
      console.error(err);
    }
    setSuggesting(false);
  };

  const resourceTypes = [
    { id: 'pdf', label: 'PDF Document', icon: FileText },
    { id: 'youtube', label: 'YouTube Video', icon: Youtube },
    { id: 'website', label: 'Educational Website', icon: Globe },
    { id: 'image', label: 'Image File', icon: Upload },
    { id: 'video', label: 'Video File', icon: Upload },
    { id: 'zip', label: 'ZIP Archive', icon: Upload },
  ];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Upload Learning Material</h1>
        <p className="text-slate-500">Share resources with your students</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="e.g. Computer Science"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Topic</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={formData.topic}
                    onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="e.g. Machine Learning"
                  />
                  <button
                    type="button"
                    onClick={handleSuggest}
                    disabled={suggesting || !formData.topic}
                    className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors disabled:opacity-50"
                    title="AI Suggestions"
                  >
                    <BrainCircuit size={20} />
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none h-32"
                placeholder="Briefly describe the resource..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Resource Type</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {resourceTypes.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, resource_type: type.id })}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-sm font-medium ${
                      formData.resource_type === type.id
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-600'
                        : 'border-slate-100 text-slate-500 hover:border-slate-200'
                    }`}
                  >
                    <type.icon size={18} />
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {['youtube', 'website'].includes(formData.resource_type) ? (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Resource URL</label>
                <div className="relative">
                  <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="url"
                    required
                    value={formData.link}
                    onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="https://..."
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Upload File</label>
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center hover:border-indigo-300 transition-all cursor-pointer relative">
                  <input
                    type="file"
                    required
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center">
                    <Upload className="text-slate-400 mb-2" size={32} />
                    <p className="text-slate-600 font-medium">
                      {file ? file.name : 'Click or drag to upload file'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Max file size: 50MB</p>
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Uploading...' : 'Publish Material'}
              {!loading && <CheckCircle2 size={20} />}
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="bg-indigo-900 text-white p-6 rounded-2xl shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <BrainCircuit className="text-indigo-300" size={24} />
              <h3 className="font-bold text-lg">AI Support</h3>
            </div>
            <p className="text-indigo-100 text-sm leading-relaxed mb-6">
              Enter a topic and click the brain icon to get AI-suggested learning resources instantly.
            </p>
            
            {suggesting && (
              <div className="flex items-center gap-2 text-indigo-300 text-sm">
                <div className="w-4 h-4 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />
                Generating suggestions...
              </div>
            )}

            {suggestions && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300 mb-2">YouTube Videos</h4>
                  <div className="space-y-2">
                    {suggestionYoutube.map((v: any, i: number) => (
                      <a key={i} href={v.url} target="_blank" className="block p-2 bg-indigo-800/50 rounded-lg text-xs hover:bg-indigo-800 transition-colors truncate">
                        {v.title}
                      </a>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300 mb-2">Websites</h4>
                  <div className="space-y-2">
                    {suggestionWebsites.map((w: any, i: number) => (
                      <a key={i} href={w.url} target="_blank" className="block p-2 bg-indigo-800/50 rounded-lg text-xs hover:bg-indigo-800 transition-colors truncate">
                        {w.title}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
