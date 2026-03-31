import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { BrainCircuit, FileText, Send, CheckCircle2, ListChecks } from 'lucide-react';
import { api } from '../api';
import { aiService } from '../services/aiService';

export default function GenerateQuestions() {
  const [formData, setFormData] = useState({
    subject: '',
    topic: '',
    syllabus: '',
    count: 10,
  });
  const [loading, setLoading] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answerKey, setAnswerKey] = useState<any>(null);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const loadSavedQuestions = async () => {
    setLoadingSaved(true);
    try {
      const saved = await api.staff.getQuestions();
      if (Array.isArray(saved)) {
        setQuestions(saved);
      }
    } catch (err) {
      console.error('Failed to load saved questions:', err);
    }
    setLoadingSaved(false);
  };

  useEffect(() => {
    loadSavedQuestions();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAnswerKey(null);
    setSaveMessage('');
    try {
      const res = await aiService.generateQuestions(formData.subject, formData.topic, formData.syllabus, formData.count);
      setQuestions(res);

      if (!Array.isArray(res) || res.length === 0) {
        setSaveMessage('No valid questions were generated. Please try again with more syllabus details.');
        return;
      }

      // Save validated questions to DB
      const saveResult = await api.staff.saveQuestions({
        subject: formData.subject,
        topic: formData.topic,
        questions: res
      });

      if (saveResult?.error) {
        setSaveMessage(`Failed to save questions: ${saveResult.error}`);
      } else {
        setSaveMessage(`Saved ${saveResult?.savedCount ?? res.length} questions successfully.`);
        await loadSavedQuestions();
      }
    } catch (err) {
      console.error(err);
      setSaveMessage('Failed to generate or save questions. Please try again.');
    }
    setLoading(false);
  };

  const handleGenerateKey = async () => {
    setGeneratingKey(true);
    try {
      const questionTexts = questions.map(q => q.question_text);
      const res = await aiService.generateAnswerKey(questionTexts);
      setAnswerKey(res);
    } catch (err) {
      console.error(err);
    }
    setGeneratingKey(false);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">AI Question Generator</h1>
        <p className="text-slate-500">Create MCQ assessments using Gemini AI</p>
        {saveMessage && (
          <p className="mt-3 text-sm font-medium text-slate-600">{saveMessage}</p>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <form onSubmit={handleGenerate} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4 sticky top-8">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
              <input
                type="text"
                required
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="e.g. Physics"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Topic</label>
              <input
                type="text"
                required
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="e.g. Quantum Mechanics"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Syllabus Text</label>
              <textarea
                required
                value={formData.syllabus}
                onChange={(e) => setFormData({ ...formData, syllabus: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none h-32 text-sm"
                placeholder="Paste syllabus or key points here..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Number of Questions</label>
              <input
                type="number"
                min="1"
                max="20"
                value={formData.count}
                onChange={(e) => setFormData({ ...formData, count: parseInt(e.target.value) })}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Generate Questions'}
              <BrainCircuit size={18} />
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {questions.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <ListChecks className="text-indigo-600" />
                  Generated MCQ Paper
                </h2>
                <button
                  onClick={handleGenerateKey}
                  disabled={generatingKey}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {generatingKey ? 'Processing...' : 'Generate Answer Key'}
                  <CheckCircle2 size={16} />
                </button>
              </div>
              
              <div className="p-6 space-y-8">
                {questions.map((q, i) => (
                  <div key={i} className="space-y-4">
                    <div className="flex gap-3">
                      <span className="flex-shrink-0 w-8 h-8 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center font-bold text-sm">
                        {i + 1}
                      </span>
                      <p className="text-lg font-medium text-slate-900 pt-1">{q.question_text}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-11">
                      {['a', 'b', 'c', 'd'].map((opt) => (
                        <div key={opt} className={`p-3 rounded-xl border ${
                          answerKey && answerKey[i + 1] === opt.toUpperCase() 
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                            : 'border-slate-100 text-slate-600'
                        }`}>
                          <span className="font-bold mr-2">{opt.toUpperCase()}.</span>
                          {q[`option_${opt}`]}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {answerKey && (
                <div className="p-6 bg-emerald-50 border-t border-emerald-100">
                  <h3 className="font-bold text-emerald-800 mb-4 flex items-center gap-2">
                    <CheckCircle2 size={20} />
                    AI Generated Answer Key
                  </h3>
                  <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
                    {Object.entries(answerKey).map(([num, ans]) => (
                      <div key={num} className="bg-white p-2 rounded-lg text-center border border-emerald-200">
                        <span className="text-[10px] block text-slate-400 font-bold">{num}</span>
                        <span className="font-bold text-emerald-600">{ans as string}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {questions.length === 0 && !loading && !loadingSaved && (
            <div className="h-full flex flex-col items-center justify-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200 text-slate-400">
              <FileText size={48} className="mb-4 opacity-20" />
              <p className="font-medium">No questions generated yet</p>
              <p className="text-sm">Fill the form and click generate to start</p>
            </div>
          )}

          {loadingSaved && (
            <div className="h-full flex items-center justify-center py-10 text-slate-400 text-sm">Loading saved questions...</div>
          )}
        </div>
      </div>
    </div>
  );
}
