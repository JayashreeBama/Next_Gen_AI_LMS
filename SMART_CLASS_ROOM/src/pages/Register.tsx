import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { UserPlus, GraduationCap, UserCog } from 'lucide-react';
import { auth, db, doc, setDoc } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';

export default function Register() {
  const location = useLocation();
  const navigate = useNavigate();
  const [role, setRole] = useState<'staff' | 'student'>('student');
  const initialFormData = {
    name: '',
    email: '',
    password: '',
    department: '',
    subject: '',
    phone: '',
    course: '',
    year: '',
  };
  const [formData, setFormData] = useState({
    ...initialFormData,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const roleParam = params.get('role');
    if (roleParam && ['staff', 'student'].includes(roleParam)) {
      setRole(roleParam as 'staff' | 'student');
    }
  }, [location]);

  const handleRoleChange = (nextRole: 'staff' | 'student') => {
    setRole(nextRole);
    setError('');
    setFormData((prev) => ({
      ...prev,
      ...(nextRole === 'staff'
        ? { course: '', year: '' }
        : { department: '', subject: '', phone: '' }),
    }));
  };

  const formatAuthError = (err: any) => {
    const code = err?.code as string | undefined;
    if (code === 'auth/email-already-in-use') return 'This email is already registered.';
    if (code === 'auth/invalid-email') return 'Please enter a valid email address.';
    if (code === 'auth/weak-password') return 'Password should be at least 6 characters.';
    return err?.message || 'Registration failed';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const payload = {
      name: formData.name.trim(),
      email: formData.email.trim().toLowerCase(),
      password: formData.password,
      department: formData.department.trim(),
      subject: formData.subject.trim(),
      phone: formData.phone.trim(),
      course: formData.course.trim(),
      year: formData.year.trim(),
    };

    if (!payload.name || !payload.email || !payload.password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (role === 'staff' && (!payload.department || !payload.subject || !payload.phone)) {
      setError('Department, subject, and phone number are required for staff registration.');
      return;
    }

    if (role === 'student' && (!payload.course || !payload.year)) {
      setError('Course and year are required for student registration.');
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, payload.email, payload.password);
      const user = userCredential.user;

      // Create user profile in Firestore
      const userProfile = {
        uid: user.uid,
        email: payload.email,
        role: role,
        name: payload.name,
        ...(role === 'staff' ? {
          department: payload.department,
          subject: payload.subject,
          phone: payload.phone
        } : {
          course: payload.course,
          year: payload.year
        })
      };

      await setDoc(doc(db, 'users', user.uid), userProfile);
      navigate(`/${role}`);
    } catch (err: any) {
      console.error('Registration Error:', err);
      setError(formatAuthError(err));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-2xl shadow-xl shadow-slate-200 p-8"
      >
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-slate-900">Create Account</h2>
          <p className="text-slate-500 mt-2">Join our learning community today</p>
        </div>

        <div className="flex gap-2 mb-8">
          <button
            type="button"
            onClick={() => handleRoleChange('student')}
            className={`flex-1 flex flex-col items-center p-3 rounded-xl border-2 transition-all ${
              role === 'student' 
                ? 'border-orange-600 bg-orange-50 text-orange-600' 
                : 'border-slate-100 text-slate-400 hover:border-slate-200'
            }`}
          >
            <GraduationCap size={24} />
            <span className="text-xs font-semibold mt-1">Student</span>
          </button>
          <button
            type="button"
            onClick={() => handleRoleChange('staff')}
            className={`flex-1 flex flex-col items-center p-3 rounded-xl border-2 transition-all ${
              role === 'staff' 
                ? 'border-orange-600 bg-orange-50 text-orange-600' 
                : 'border-slate-100 text-slate-400 hover:border-slate-200'
            }`}
          >
            <UserCog size={24} />
            <span className="text-xs font-semibold mt-1">Staff</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
              placeholder="name@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          {role === 'staff' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                <input
                  type="text"
                  required
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
                  placeholder="Enter department name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
                  placeholder="Enter subject name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
                  placeholder="+1 234 567 890"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Course</label>
                <input
                  type="text"
                  required
                  value={formData.course}
                  onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
                  placeholder="B.Tech CS"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Year</label>
                <input
                  type="text"
                  required
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
                  placeholder="3rd Year"
                />
              </div>
            </>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            className="w-full bg-orange-600 text-white py-3 rounded-xl font-semibold hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
          >
            <UserPlus size={20} />
            Register
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-slate-500 text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-orange-600 font-semibold hover:underline">
              Sign in here
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
