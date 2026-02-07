import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/ToastContext';
import { AuthProvider, useAuth } from './components/AuthContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Assets from './pages/Assets';
import Threats from './pages/Threats';
import Briefings from './pages/Briefings';
import Login from './pages/Login';
import { FullPageSpinner } from './components/Spinner';

function ProtectedLayout() {
  const { user, loading } = useAuth();

  if (loading) return <FullPageSpinner message="Loading..." />;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      <Sidebar />
      <main className="ml-60 p-6 min-h-screen">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/assets" element={<Assets />} />
          <Route path="/threats" element={<Threats />} />
          <Route path="/briefings" element={<Briefings />} />
        </Routes>
      </main>
    </div>
  );
}

function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) return <FullPageSpinner message="Loading..." />;
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/*" element={<ProtectedLayout />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
