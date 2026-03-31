import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { LogIn, GraduationCap, UserCog, ShieldCheck } from 'lucide-react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

const ADMIN_EMAIL = 'admin@gmail.com';

export default function Login() {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'staff' | 'student'>('student');
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const roleParam = params.get('role');
    if (roleParam && ['admin', 'staff', 'student'].includes(roleParam)) {
      setRole(roleParam as any);
    }
  }, [location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // App.tsx onAuthStateChanged handles Firestore lookup and navigation
    } catch (err: any) {
      // Admin account may not exist yet — create it on first login
      if (
        (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') &&
        email === ADMIN_EMAIL
      ) {
        try {
          await createUserWithEmailAndPassword(auth, email, password);
          // App.tsx onAuthStateChanged will create the Firestore doc and redirect
        } catch (createErr: any) {
          console.error('Admin account creation error:', createErr);
          setError(createErr.message || 'Failed to create admin account');
        }
      } else {
        console.error('Login Error:', err);
        setError(err.message || 'Invalid email or password');
      }
    }
  };

  const roles = [
    { id: 'student', label: 'Student', icon: GraduationCap },
    { id: 'staff', label: 'Staff', icon: UserCog },
    { id: 'admin', label: 'Admin', icon: ShieldCheck },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-2xl shadow-xl shadow-slate-200 p-8"
      >
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-slate-900">Welcome Back</h2>
          <p className="text-slate-500 mt-2">Sign in to your account to continue</p>
        </div>

        <div className="flex gap-2 mb-8">
          {roles.map((r) => (
            <button
              key={r.id}
              onClick={() => setRole(r.id as any)}
              className={`flex-1 flex flex-col items-center p-3 rounded-xl border-2 transition-all ${
                role === r.id 
                  ? 'border-orange-600 bg-orange-50 text-orange-600' 
                  : 'border-slate-100 text-slate-400 hover:border-slate-200'
              }`}
            >
              <r.icon size={24} />
              <span className="text-xs font-semibold mt-1">{r.label}</span>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
              placeholder="name@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            className="w-full bg-orange-600 text-white py-3 rounded-xl font-semibold hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
          >
            <LogIn size={20} />
            Sign In
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-slate-500 text-sm">
            Don't have an account?{' '}
            <Link to="/register" className="text-orange-600 font-semibold hover:underline">
              Register here
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
