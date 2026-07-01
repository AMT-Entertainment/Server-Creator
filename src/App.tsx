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
  const [updateState, setUpdateState] = useState<{ type: 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'; message?: string; progress?: number } | null>(null);

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

  useEffect(() => {
    if (!window.electronAPI) return;
    const unsub1 = window.electronAPI.onUpdateAvailable((version) => {
      setUpdateState({ type: 'available', message: `Update ${version} available` });
    });
    const unsub2 = window.electronAPI.onUpdateNotAvailable(() => {
      setUpdateState(null);
    });
    const unsub3 = window.electronAPI.onUpdateProgress((percent) => {
      setUpdateState({ type: 'downloading', progress: Math.round(percent) });
    });
    const unsub4 = window.electronAPI.onUpdateDownloaded((version) => {
      setUpdateState({ type: 'downloaded', message: `Update ${version} downloaded` });
    });
    const unsub5 = window.electronAPI.onUpdateError((error) => {
      setUpdateState({ type: 'error', message: error });
    });
    window.electronAPI.checkForUpdates();
    setUpdateState({ type: 'checking', message: 'Checking for updates...' });
    const timeout = setTimeout(() => {
      setUpdateState(prev => prev?.type === 'checking' ? null : prev);
    }, 10000);
    return () => {
      unsub1(); unsub2(); unsub3(); unsub4(); unsub5();
      clearTimeout(timeout);
    };
  }, []);

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
          {updateState && updateState.type === 'available' && (
            <div style={{ fontSize: 11, padding: '4px 0', textAlign: 'center' }}>
              <span style={{ color: 'var(--accent-warning)' }}>
                {updateState.message}
              </span>
              <button className="btn btn-primary btn-sm" style={{ marginLeft: 6, fontSize: 10, padding: '2px 6px' }}
                onClick={() => { window.electronAPI?.downloadUpdate(); setUpdateState({ type: 'downloading', progress: 0 }); }}>
                Update
              </button>
            </div>
          )}
          {updateState && updateState.type === 'downloading' && (
            <div style={{ fontSize: 11, padding: '4px 0', textAlign: 'center', color: 'var(--accent-info)' }}>
              Downloading... {updateState.progress}%
            </div>
          )}
          {updateState && updateState.type === 'downloaded' && (
            <div style={{ fontSize: 11, padding: '4px 0', textAlign: 'center' }}>
              <span style={{ color: 'var(--accent-success)' }}>
                {updateState.message}
              </span>
              <button className="btn btn-primary btn-sm" style={{ marginLeft: 6, fontSize: 10, padding: '2px 6px' }}
                onClick={() => { window.electronAPI?.installUpdate(); }}>
                Restart
              </button>
            </div>
          )}
          {updateState && updateState.type === 'error' && (
            <div style={{ fontSize: 10, padding: '2px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              Update failed
            </div>
          )}
          <div style={{ fontSize: 10, color: 'var(--accent-warning)', textAlign: 'center', padding: '2px 0', opacity: 0.7 }}>
            Public Beta - Data is not permanent
          </div>
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
