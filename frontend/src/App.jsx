import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/ToastContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Assets from './pages/Assets';
import Threats from './pages/Threats';
import Briefings from './pages/Briefings';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
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
      </ToastProvider>
    </BrowserRouter>
  );
}
