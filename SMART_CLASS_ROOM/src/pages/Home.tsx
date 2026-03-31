import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  GraduationCap, 
  UserCog, 
  ShieldCheck, 
  BrainCircuit, 
  BookOpen, 
  Trophy,
  ArrowRight
} from 'lucide-react';

export default function Home() {
  const loginOptions = [
    {
      title: 'Student Portal',
      description: 'Access your learning materials, take AI-generated quizzes, and track your progress.',
      icon: GraduationCap,
      role: 'student',
      color: 'bg-blue-500',
      hover: 'hover:border-blue-500'
    },
    {
      title: 'Staff Portal',
      description: 'Create content with AI, manage materials, and monitor student performance.',
      icon: UserCog,
      role: 'staff',
      color: 'bg-orange-500',
      hover: 'hover:border-orange-500'
    },
    {
      title: 'Admin Portal',
      description: 'Manage users, oversee system activities, and ensure smooth operations.',
      icon: ShieldCheck,
      role: 'admin',
      color: 'bg-slate-800',
      hover: 'hover:border-slate-800'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-50 text-orange-600 font-semibold text-sm mb-6"
            >
              <BrainCircuit size={18} />
              <span>Powered by Gemini AI</span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-5xl md:text-7xl font-extrabold text-slate-900 tracking-tight mb-6"
            >
              Next Gen <span className="text-orange-600">AI Learning</span> <br />
              Management System
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-xl text-slate-600 max-w-3xl mx-auto mb-10"
            >
              Empowering students and educators with intelligent content generation, 
              personalized study guides, and real-time progress tracking.
            </motion.p>
          </div>
        </div>
        
        {/* Background Decoration */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-100/50 rounded-full blur-3xl" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100/50 rounded-full blur-3xl" />
        </div>
      </section>

      {/* Login Options Grid */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {loginOptions.map((option, idx) => (
            <motion.div
              key={option.role}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`bg-white p-8 rounded-3xl border-2 border-transparent transition-all shadow-sm hover:shadow-xl ${option.hover} group`}
            >
              <div className={`${option.color} w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg`}>
                <option.icon size={32} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">{option.title}</h3>
              <p className="text-slate-600 mb-8 leading-relaxed">
                {option.description}
              </p>
              <Link
                to={`/login?role=${option.role}`}
                className="inline-flex items-center gap-2 font-bold text-slate-900 group-hover:text-orange-600 transition-colors"
              >
                Sign in to Portal
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            <div>
              <div className="bg-white/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <BrainCircuit size={32} className="text-orange-400" />
              </div>
              <h4 className="text-xl font-bold mb-2">AI Content Generation</h4>
              <p className="text-slate-400">Automatically generate lesson plans and study guides from resources.</p>
            </div>
            <div>
              <div className="bg-white/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <BookOpen size={32} className="text-blue-400" />
              </div>
              <h4 className="text-xl font-bold mb-2">Smart Quizzes</h4>
              <p className="text-slate-400">Personalized assessments generated by AI to test your knowledge.</p>
            </div>
            <div>
              <div className="bg-white/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trophy size={32} className="text-emerald-400" />
              </div>
              <h4 className="text-xl font-bold mb-2">Progress Analytics</h4>
              <p className="text-slate-400">Detailed insights into learning performance for both students and staff.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-500 text-sm">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="p-1 bg-orange-500 rounded">
              <BrainCircuit className="text-white" size={16} />
            </div>
            <span className="font-bold text-slate-900">AI LMS</span>
          </div>
          <p>© 2026 AI Learning Management System. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
