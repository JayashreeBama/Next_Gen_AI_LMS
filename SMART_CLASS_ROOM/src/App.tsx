import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Users, 
  UserCircle, 
  BookOpen, 
  FilePlus, 
  FileText, 
  LogOut, 
  Menu, 
  X, 
  ChevronRight,
  BrainCircuit,
  GraduationCap,
  Trophy,
  History
} from 'lucide-react';
import { User } from './types';
import { auth, db, doc, getDoc, setDoc, onAuthStateChanged, signOut } from './firebase';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import AdminDashboard from './pages/AdminDashboard';
import StaffDashboard from './pages/StaffDashboard';
import StudentDashboard from './pages/StudentDashboard';
import UploadMaterial from './pages/UploadMaterial';
import GenerateQuestions from './pages/GenerateQuestions';
import ViewMaterials from './pages/ViewMaterials';
import StudentProgress from './pages/StudentProgress';
import CourseQuestions from './pages/CourseQuestions';

const Navbar = ({ user, onLogout }: { user: User | null; onLogout: () => void }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const adminLinks = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
    { name: 'Staff', icon: Users, path: '/admin/staff' },
    { name: 'Students', icon: GraduationCap, path: '/admin/students' },
  ];

  const staffLinks = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/staff' },
    { name: 'Upload', icon: FilePlus, path: '/staff/upload' },
    { name: 'AI Questions', icon: BrainCircuit, path: '/staff/questions' },
    { name: 'Progress', icon: Trophy, path: '/staff/progress' },
  ];

  const studentLinks = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/student' },
    { name: 'Materials', icon: BookOpen, path: '/student/materials' },
    { name: 'Questions', icon: FileText, path: '/student/questions' },
    { name: 'Progress', icon: History, path: '/student/progress' },
  ];

  const links = user ? (user.role === 'admin' ? adminLinks : user.role === 'staff' ? staffLinks : studentLinks) : [];

  return (
    <nav className="bg-white text-slate-900 sticky top-0 z-50 shadow-sm border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center gap-2">
              <div className="p-1.5 bg-orange-500 rounded-lg">
                <BrainCircuit className="text-white" size={24} />
              </div>
              <span className="font-bold text-xl tracking-tight text-slate-900 hidden sm:block">AI LMS</span>
            </Link>
            {user && (
              <div className="hidden md:block">
                <div className="ml-10 flex items-baseline space-x-4">
                  {links.map((link) => (
                    <Link
                      key={link.path}
                      to={link.path}
                      className="px-3 py-2 rounded-md text-sm font-medium text-slate-600 hover:text-orange-600 hover:bg-orange-50 transition-all flex items-center gap-2"
                    >
                      <link.icon size={16} />
                      {link.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="hidden md:block">
            <div className="ml-4 flex items-center md:ml-6 gap-4">
              {user ? (
                <>
                  <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-full border border-slate-200">
                    <UserCircle size={20} className="text-slate-400" />
                    <div className="text-xs">
                      <p className="font-medium leading-none text-slate-900">{user.name}</p>
                      <p className="text-[10px] text-slate-500 capitalize">{user.role}</p>
                    </div>
                  </div>
                  <button
                    onClick={onLogout}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                    title="Logout"
                  >
                    <LogOut size={20} />
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <Link 
                    to="/register?role=student" 
                    className="text-sm font-semibold text-slate-600 hover:text-orange-600 transition-colors"
                  >
                    Student Register
                  </Link>
                  <Link 
                    to="/register?role=staff" 
                    className="px-4 py-2 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 transition-colors shadow-lg shadow-orange-200"
                  >
                    Staff Register
                  </Link>
                </div>
              )}
            </div>
          </div>
          <div className="-mr-2 flex md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 focus:outline-none"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t border-slate-100 overflow-hidden"
          >
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {user ? (
                links.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setIsMenuOpen(false)}
                    className="block px-3 py-2 rounded-md text-base font-medium text-slate-600 hover:text-orange-600 hover:bg-orange-50 flex items-center gap-3"
                  >
                    <link.icon size={20} />
                    {link.name}
                  </Link>
                ))
              ) : (
                <>
                  <Link
                    to="/register?role=student"
                    onClick={() => setIsMenuOpen(false)}
                    className="block px-3 py-2 rounded-md text-base font-medium text-slate-600 hover:text-orange-600 hover:bg-orange-50"
                  >
                    Student Register
                  </Link>
                  <Link
                    to="/register?role=staff"
                    onClick={() => setIsMenuOpen(false)}
                    className="block px-3 py-2 rounded-md text-base font-medium text-slate-600 hover:text-orange-600 hover:bg-orange-50"
                  >
                    Staff Register
                  </Link>
                </>
              )}
            </div>
            {user && (
              <div className="pt-4 pb-3 border-t border-slate-100">
                <div className="flex items-center px-5">
                  <div className="flex-shrink-0">
                    <UserCircle size={32} className="text-slate-400" />
                  </div>
                  <div className="ml-3">
                    <div className="text-base font-medium leading-none text-slate-900">{user.name}</div>
                    <div className="text-sm font-medium leading-none text-slate-500 capitalize mt-1">{user.role}</div>
                  </div>
                  <button
                    onClick={onLogout}
                    className="ml-auto flex-shrink-0 p-1 text-slate-400 hover:text-red-500"
                  >
                    <LogOut size={24} />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          setUser({ ...userData, id: firebaseUser.uid });
        } else if (firebaseUser.email === 'admin@gmail.com') {
          // Auto-provision the admin Firestore document on first login
          const adminData = { name: 'Admin', email: 'admin@gmail.com', role: 'admin' as const };
          await setDoc(userDocRef, adminData);
          setUser({ ...adminData, id: firebaseUser.uid });
        } else {
          // User exists in Auth but has no Firestore profile yet
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
  };

  if (loading) return <div className="h-screen flex items-center justify-center">Loading...</div>;

  return (
    <Router>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar user={user} onLogout={handleLogout} />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={!user ? <Login /> : <Navigate to={`/${user.role}`} />} />
            <Route path="/register" element={!user ? <Register /> : <Navigate to={`/${user.role}`} />} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/login" />} />
            <Route path="/admin/staff" element={user?.role === 'admin' ? <AdminDashboard view="staff" /> : <Navigate to="/login" />} />
            <Route path="/admin/students" element={user?.role === 'admin' ? <AdminDashboard view="students" /> : <Navigate to="/login" />} />

            {/* Staff Routes */}
            <Route path="/staff" element={user?.role === 'staff' ? <StaffDashboard /> : <Navigate to="/login" />} />
            <Route path="/staff/upload" element={user?.role === 'staff' ? <UploadMaterial /> : <Navigate to="/login" />} />
            <Route path="/staff/questions" element={user?.role === 'staff' ? <GenerateQuestions /> : <Navigate to="/login" />} />
            <Route path="/staff/progress" element={user?.role === 'staff' ? <StudentProgress /> : <Navigate to="/login" />} />

            {/* Student Routes */}
            <Route path="/student" element={user?.role === 'student' ? <StudentDashboard /> : <Navigate to="/login" />} />
            <Route path="/student/materials" element={user?.role === 'student' ? <ViewMaterials /> : <Navigate to="/login" />} />
            <Route path="/student/questions" element={user?.role === 'student' ? <StudentDashboard view="questions" /> : <Navigate to="/login" />} />
            <Route path="/student/progress" element={user?.role === 'student' ? <StudentProgress role="student" /> : <Navigate to="/login" />} />
            <Route path="/course/:subject" element={user?.role === 'student' ? <CourseQuestions /> : <Navigate to="/login" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
