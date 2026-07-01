import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Home from './pages/Home';
import ServerDetail from './pages/ServerDetail';
import SetupWizard from './pages/SetupWizard';
import Settings from './pages/Settings';
import { ToastProvider } from './components/Toast';
import UpdateScreen from './components/UpdateScreen';

function App() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [servers, setServers] = useState<any[]>([]);
  const [ready, setReady] = useState(false);
  const [sidebarUpdate, setSidebarUpdate] = useState<{ type: 'downloading' | 'downloaded'; progress?: number } | null>(null);

  const loadServers = async () => {
    if (window.electronAPI) {
      const list = await window.electronAPI.getServers();
      setServers(list);
    }
  };

  useEffect(() => {
    loadServers();
  }, []);

  useEffect(() => {
    if (!window.electronAPI) return;
    const unsub1 = window.electronAPI.onUpdateProgress((p) => {
      setSidebarUpdate({ type: 'downloading', progress: Math.round(p) });
    });
    const unsub2 = window.electronAPI.onUpdateDownloaded((v) => {
      setSidebarUpdate({ type: 'downloaded' });
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  const refreshServers = () => loadServers();

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  if (!ready) {
    return <UpdateScreen onComplete={() => setReady(true)} />;
  }

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
            {sidebarUpdate?.type === 'downloading' && (
              <div style={{ fontSize: 11, padding: '4px 0', textAlign: 'center', color: 'var(--accent-info)' }}>
                Updating... {sidebarUpdate.progress}%
              </div>
            )}
            {sidebarUpdate?.type === 'downloaded' && (
              <div style={{ fontSize: 11, padding: '4px 0', textAlign: 'center' }}>
                <span style={{ color: 'var(--accent-success)' }}>Update ready</span>
                <button className="btn btn-primary btn-sm" style={{ marginLeft: 6, fontSize: 10, padding: '2px 6px' }}
                  onClick={() => { window.electronAPI?.installUpdate(); }}>
                  Restart
                </button>
              </div>
            )}
            <div style={{ fontSize: 10, color: 'var(--accent-warning)', textAlign: 'center', padding: '2px 0', opacity: 0.7 }}>
              Public Beta - Data is not permanent
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '4px 0' }}>
              AMT Entertainment v1.0.3
            </div>
          </div>
        </aside>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home servers={servers} onServersChange={refreshServers} />} />
            <Route path="/setup" element={<SetupWizard onComplete={() => { refreshServers(); navigate('/'); }} />} />
            <Route path="/server/:id" element={<ServerDetail onServersChange={refreshServers} />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </ToastProvider>
  );
}

export default App;
