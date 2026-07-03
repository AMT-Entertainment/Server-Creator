import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function Settings() {
  const { t, i18n } = useTranslation();
  const [updateState, setUpdateState] = useState<{ status: string; version?: string; progress?: number; error?: string }>({ status: 'idle' });
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.getUpdateState().then(setUpdateState);
    const unsub = window.electronAPI.onUpdateState(setUpdateState);
    return unsub;
  }, []);

  const handleCheck = async () => {
    setChecking(true);
    if (window.electronAPI) {
      await window.electronAPI.checkForUpdates();
    }
    setTimeout(() => setChecking(false), 3000);
  };

  const handleDownload = () => window.electronAPI?.downloadUpdate();
  const handleInstall = () => window.electronAPI?.installUpdate();

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('server-creator-lang', lang);
  };

  return (
    <div className="page-content">
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>{t('nav.settings')}</h1>

      <div className="card" style={{ maxWidth: 500 }}>
        <div className="settings-item">
          <div>
            <div className="settings-label">{t('settings.language')}</div>
            <div className="settings-desc">{t('settings.languageDesc')}</div>
          </div>
          <select
            className="select"
            value={i18n.language}
            onChange={e => changeLanguage(e.target.value)}
            style={{ width: 140 }}
          >
            <option value="de">Deutsch</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>

      <div className="card mt-16" style={{ maxWidth: 500 }}>
        <div className="card-header">
          <span className="card-title">Server Creator</span>
        </div>
        <div className="flex flex-col gap-8">
          <div className="flex justify-between">
            <span className="text-muted">Version</span>
            <span>1.1.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Developer</span>
            <span>AMT Entertainment</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Data Directory</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>~/.server-creator</span>
          </div>
        </div>
      </div>

      <div className="card mt-16" style={{ maxWidth: 500 }}>
        <div className="card-header">
          <span className="card-title">Updates</span>
        </div>
        <div className="flex flex-col gap-8">
          <div className="flex justify-between items-center">
            <div>
              <div style={{ fontWeight: 500 }}>
                {updateState.status === 'checking' && 'Checking for updates...'}
                {updateState.status === 'available' && `Update v${updateState.version} available`}
                {updateState.status === 'downloading' && `Downloading... ${updateState.progress}%`}
                {updateState.status === 'downloaded' && `v${updateState.version} ready to install`}
                {updateState.status === 'error' && `Update failed: ${updateState.error}`}
                {updateState.status === 'idle' && 'No updates available'}
              </div>
              {updateState.status === 'error' && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Check your internet connection or try again later
                </div>
              )}
            </div>
            <div className="flex gap-8">
              {updateState.status === 'available' && (
                <button className="btn btn-primary btn-sm" onClick={handleDownload}>
                  <span className="material-symbols-outlined icon-sm">download</span>
                  Download
                </button>
              )}
              {updateState.status === 'downloaded' && (
                <button className="btn btn-success btn-sm" onClick={handleInstall}>
                  <span className="material-symbols-outlined icon-sm">restart_alt</span>
                  Install
                </button>
              )}
              {(updateState.status === 'idle' || updateState.status === 'error') && (
                <button className="btn btn-ghost btn-sm" onClick={handleCheck} disabled={checking}>
                  {checking ? (
                    <div className="spinner" style={{ width: 14, height: 14 }} />
                  ) : (
                    <><span className="material-symbols-outlined icon-sm">refresh</span> Check</>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
