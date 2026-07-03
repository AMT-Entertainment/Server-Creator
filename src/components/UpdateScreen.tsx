import React, { useEffect, useState, useRef } from 'react';

interface UpdateScreenProps {
  onComplete: () => void;
}

export default function UpdateScreen({ onComplete }: UpdateScreenProps) {
  const [phase, setPhase] = useState<'checking' | 'available' | 'downloading' | 'downloaded' | 'error' | 'done'>('checking');
  const [version, setVersion] = useState('');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [fadeOut, setFadeOut] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!window.electronAPI) {
      setPhase('done');
      return;
    }

    const unsub = window.electronAPI.onUpdateState((state) => {
      if (state.status === 'available') {
        setVersion(state.version || '');
        setPhase('available');
      } else if (state.status === 'idle') {
        setPhase('done');
      } else if (state.status === 'downloading') {
        setProgress(state.progress || 0);
        setPhase('downloading');
      } else if (state.status === 'downloaded') {
        setVersion(state.version || '');
        setPhase('downloaded');
      } else if (state.status === 'error') {
        setErrorMsg(state.error || 'Update check failed');
        setPhase('error');
      }
    });

    window.electronAPI.checkForUpdates();

    const fallback = setTimeout(() => {
      setPhase(prev => prev === 'checking' ? 'done' : prev);
    }, 10000);

    return () => {
      unsub();
      clearTimeout(fallback);
    };
  }, []);

  useEffect(() => {
    if (phase === 'done' && !doneRef.current) {
      doneRef.current = true;
      setFadeOut(true);
      const t = setTimeout(onComplete, 400);
      return () => clearTimeout(t);
    }
  }, [phase, onComplete]);

  const handleDownload = () => window.electronAPI?.downloadUpdate();
  const handleInstall = () => window.electronAPI?.installUpdate();

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: fadeOut ? 'transparent' : 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)',
      transition: 'background 0.4s ease',
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 16,
        boxShadow: 'var(--shadow-lg)',
        padding: 36,
        width: 380,
        textAlign: 'center',
        opacity: fadeOut ? 0 : 1,
        transform: fadeOut ? 'scale(0.9)' : 'scale(1)',
        transition: 'opacity 0.4s ease, transform 0.4s ease',
      }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-primary)', marginBottom: 20 }}>
          Server Creator
        </div>

        {phase === 'checking' && (
          <>
            <div className="spinner" style={{ width: 28, height: 28, margin: '8px auto 16px' }} />
            <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Checking for updates...</div>
          </>
        )}

        {phase === 'available' && (
          <>
            <span className="material-symbols-outlined" style={{ fontSize: 40, color: 'var(--accent-warning)', marginBottom: 12 }}>
              system_update
            </span>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Update Available</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 20 }}>
              Server Creator v{version} is ready to download
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={handleDownload}>
                <span className="material-symbols-outlined icon-sm">download</span>
                Download Update
              </button>
              <button className="btn btn-ghost" onClick={() => setPhase('done')}>
                Skip
              </button>
            </div>
          </>
        )}

        {phase === 'downloading' && (
          <div style={{ textAlign: 'center' }}>
            <div className="spinner" style={{ width: 22, height: 22, margin: '8px auto 16px' }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Downloading Update...</div>
            <div style={{
              width: '100%', height: 6, background: 'var(--bg-surface)',
              borderRadius: 3, overflow: 'hidden',
            }}>
              <div style={{
                width: `${progress}%`, height: '100%',
                background: 'var(--accent-primary)',
                borderRadius: 3, transition: 'width 0.3s ease',
              }} />
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>{progress}%</div>
          </div>
        )}

        {phase === 'downloaded' && (
          <>
            <span className="material-symbols-outlined" style={{ fontSize: 40, color: 'var(--accent-success)', marginBottom: 12 }}>
              check_circle
            </span>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Update Ready</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 20 }}>
              v{version} downloaded — restart to install
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={handleInstall}>
                <span className="material-symbols-outlined icon-sm">restart_alt</span>
                Restart Now
              </button>
              <button className="btn btn-ghost" onClick={() => setPhase('done')}>
                Later
              </button>
            </div>
          </>
        )}

        {phase === 'error' && (
          <>
            <span className="material-symbols-outlined" style={{ fontSize: 40, color: 'var(--accent-error)', marginBottom: 12 }}>
              error
            </span>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Update Check Failed</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 20 }}>
              {errorMsg}
            </div>
            <button className="btn btn-primary" onClick={() => setPhase('done')}>
              Launch Anyway
            </button>
          </>
        )}
      </div>
    </div>
  );
}
