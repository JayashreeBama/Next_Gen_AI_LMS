import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Trophy, Target, History, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import { api } from '../api';
import { Progress } from '../types';

export default function StudentProgress({ role = 'staff' }: { role?: 'staff' | 'student' }) {
  const [progress, setProgress] = useState<Progress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = role === 'staff' ? await api.staff.getProgress() : await api.student.getProgress();
      setProgress(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const stats = {
    total: progress.length,
    passed: progress.filter(p => p.score > 0).length,
    avgScore: progress.length > 0 ? (progress.reduce((acc, p) => acc + p.score, 0) / progress.length * 100).toFixed(1) : 0
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Learning Progress</h1>
        <p className="text-slate-500">
          {role === 'staff' ? 'Monitor student performance across all assessments' : 'Track your personal learning journey and scores'}
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <Target size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Total Attempts</p>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <Trophy size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Correct Answers</p>
              <p className="text-2xl font-bold text-slate-900">{stats.passed}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <History size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Success Rate</p>
              <p className="text-2xl font-bold text-slate-900">{stats.avgScore}%</p>
            </div>
          </div>
        </div>
      </div>

      <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-900">Detailed Activity Log</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                {role === 'staff' && <th className="px-6 py-4 font-semibold">Student Name</th>}
                <th className="px-6 py-4 font-semibold">Subject/Topic</th>
                <th className="px-6 py-4 font-semibold">Result</th>
                <th className="px-6 py-4 font-semibold">Date & Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {progress.map((p, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  {role === 'staff' && (
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-xs">
                          {p.student_name?.charAt(0)}
                        </div>
                        <span className="text-sm font-medium text-slate-900">{p.student_name}</span>
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-slate-900">{p.topic}</div>
                    <div className="text-xs text-slate-500">{p.subject || 'General'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className={`flex items-center gap-1.5 text-sm font-bold ${
                      p.score > 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {p.score > 0 ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                      {p.score > 0 ? 'Correct' : 'Incorrect'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {new Date(p.timestamp || '').toLocaleString()}
                  </td>
                </tr>
              ))}
              {progress.length === 0 && (
                <tr>
                  <td colSpan={role === 'staff' ? 4 : 3} className="p-12 text-center text-slate-400">
                    No activity recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
