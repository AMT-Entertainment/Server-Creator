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

    let stateReceived = false;

    const unsub = window.electronAPI.onUpdateState((state) => {
      stateReceived = true;
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
        if (state.version) {
          setVersion(state.version);
          setPhase('downloaded');
        } else {
          setPhase('done');
        }
      }
    });

    window.electronAPI.checkForUpdates();

    const fallback = setTimeout(() => {
      if (!stateReceived) setPhase('done');
    }, 12000);

    return () => {
      unsub();
      clearTimeout(fallback);
    };
  }, []);

  useEffect(() => {
    if (phase === 'done' && !doneRef.current) {
      doneRef.current = true;
      setFadeOut(true);
      const t = setTimeout(onComplete, 300);
      return () => clearTimeout(t);
    }
  }, [phase, onComplete]);

  const handleDownload = () => window.electronAPI?.downloadUpdate();
  const handleInstall = () => window.electronAPI?.installUpdate();

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: fadeOut ? 'transparent' : '#0f0f0f',
      transition: 'background 0.3s ease',
    }}>
      <div style={{
        background: '#1a1a2e',
        border: '1px solid #2a2a4a',
        borderRadius: 16,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        padding: 36,
        width: 380,
        textAlign: 'center',
        opacity: fadeOut ? 0 : 1,
        transform: fadeOut ? 'scale(0.9)' : 'scale(1)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
      }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#4fc3f7', marginBottom: 20 }}>
          Server Creator
        </div>

        {phase === 'checking' && (
          <>
            <div className="spinner" style={{ width: 28, height: 28, margin: '8px auto 16px' }} />
            <div style={{ color: '#9e9e9e', fontSize: 13 }}>Checking for updates...</div>
          </>
        )}

        {phase === 'available' && (
          <>
            <span className="material-symbols-outlined" style={{ fontSize: 40, color: '#ffa726', marginBottom: 12 }}>
              system_update
            </span>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Update Available</div>
            <div style={{ color: '#9e9e9e', fontSize: 12, marginBottom: 20 }}>
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
              width: '100%', height: 6, background: '#2a2a4a',
              borderRadius: 3, overflow: 'hidden',
            }}>
              <div style={{
                width: `${progress}%`, height: '100%',
                background: '#4fc3f7',
                borderRadius: 3, transition: 'width 0.3s ease',
              }} />
            </div>
            <div style={{ color: '#9e9e9e', fontSize: 12, marginTop: 8 }}>{progress}%</div>
          </div>
        )}

        {phase === 'downloaded' && (
          <>
            <span className="material-symbols-outlined" style={{ fontSize: 40, color: '#66bb6a', marginBottom: 12 }}>
              check_circle
            </span>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Update Ready</div>
            <div style={{ color: '#9e9e9e', fontSize: 12, marginBottom: 20 }}>
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
            <span className="material-symbols-outlined" style={{ fontSize: 40, color: '#ef5350', marginBottom: 12 }}>
              error
            </span>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Update Failed</div>
            <div style={{ color: '#9e9e9e', fontSize: 12, marginBottom: 20 }}>
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
