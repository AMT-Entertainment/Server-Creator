import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Home from './pages/Home';
import ServerDetail from './pages/ServerDetail';
import SetupWizard from './pages/SetupWizard';
import Settings from './pages/Settings';
import { ToastProvider } from './components/Toast';

function App() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [servers, setServers] = useState<any[]>([]);

  const loadServers = async () => {
    if (window.electronAPI) {
      const list = await window.electronAPI.getServers();
      setServers(list);
    }
  };

  useEffect(() => {
    loadServers();
  }, []);

  const refreshServers = () => loadServers();

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <ToastProvider>
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">Server Creator</div>
          <div className="sidebar-subtitle">{t('app.subtitle')}</div>
        </div>
        <nav className="sidebar-nav">
          <div
            className={`sidebar-nav-item ${location.pathname === '/' ? 'active' : ''}`}
            onClick={() => navigate('/')}
          >
            <span className="material-symbols-outlined icon">dns</span>
            <span>{t('nav.home')}</span>
          </div>
          <div
            className={`sidebar-nav-item ${isActive('/settings') ? 'active' : ''}`}
            onClick={() => navigate('/settings')}
          >
            <span className="material-symbols-outlined icon">settings</span>
            <span>{t('nav.settings')}</span>
          </div>
        </nav>
        <div className="sidebar-footer">
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '4px 0' }}>
            AMT Entertainment v1.0
          </div>
        </div>
      </aside>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home servers={servers} onServersChange={refreshServers} />} />
          <Route path="/setup" element={<SetupWizard onComplete={() => { refreshServers(); navigate('/'); }} />} />
          <Route path="/server/:id/*" element={<ServerDetail onServersChange={refreshServers} />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
    </ToastProvider>
  );
}

export default App;
