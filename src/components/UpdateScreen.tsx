import React, { useEffect, useState } from 'react';

interface UpdateScreenProps {
  onComplete: () => void;
}

type Phase = 'checking' | 'available' | 'downloading' | 'downloaded' | 'error' | 'done';

export default function UpdateScreen({ onComplete }: UpdateScreenProps) {
  const [phase, setPhase] = useState<Phase>('checking');
  const [version, setVersion] = useState('');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (!window.electronAPI) {
      setPhase('done');
      return;
    }
    const unsub1 = window.electronAPI.onUpdateAvailable((v) => {
      setVersion(v);
      setPhase('available');
    });
    const unsub2 = window.electronAPI.onUpdateNotAvailable(() => {
      setPhase('done');
    });
    const unsub3 = window.electronAPI.onUpdateProgress((p) => {
      setProgress(p);
      setPhase('downloading');
    });
    const unsub4 = window.electronAPI.onUpdateDownloaded((v) => {
      setVersion(v);
      setPhase('downloaded');
    });
    const unsub5 = window.electronAPI.onUpdateError((err) => {
      setErrorMsg(err);
      setPhase('error');
    });

    window.electronAPI.checkForUpdates();

    const fallback = setTimeout(() => {
      setPhase(prev => prev === 'checking' ? 'done' : prev);
    }, 8000);

    return () => {
      unsub1(); unsub2(); unsub3(); unsub4(); unsub5();
      clearTimeout(fallback);
    };
  }, []);

  useEffect(() => {
    if (phase === 'done') {
      setFadeOut(true);
      const t = setTimeout(onComplete, 500);
      return () => clearTimeout(t);
    }
  }, [phase, onComplete]);

  const handleDownload = () => {
    window.electronAPI?.downloadUpdate();
    setPhase('downloading');
  };

  const handleInstall = () => {
    window.electronAPI?.installUpdate();
  };

  const handleSkip = () => {
    setPhase('done');
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary)',
      opacity: fadeOut ? 0 : 1,
      transition: 'opacity 0.5s ease',
    }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent-primary)', marginBottom: 8 }}>
        Server Creator
      </div>

      {phase === 'checking' && (
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ width: 32, height: 32, margin: '24px auto' }} />
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Checking for updates...</div>
        </div>
      )}

      {phase === 'available' && (
        <div style={{ textAlign: 'center' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--accent-warning)', marginBottom: 16 }}>
            system_update
          </span>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Update Available</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>
            Server Creator v{version} is ready to download
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-primary btn-lg" onClick={handleDownload}>
              <span className="material-symbols-outlined icon-sm">download</span>
              Download Update
            </button>
            <button className="btn btn-ghost btn-lg" onClick={handleSkip}>
              Skip & Launch
            </button>
          </div>
        </div>
      )}

      {phase === 'downloading' && (
        <div style={{ textAlign: 'center', width: 320 }}>
          <div className="spinner" style={{ width: 24, height: 24, margin: '16px auto' }} />
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
        <div style={{ textAlign: 'center' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--accent-success)', marginBottom: 16 }}>
            check_circle
          </span>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Update Ready</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>
            v{version} downloaded — restart to install
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-primary btn-lg" onClick={handleInstall}>
              <span className="material-symbols-outlined icon-sm">restart_alt</span>
              Restart Now
            </button>
            <button className="btn btn-ghost btn-lg" onClick={handleSkip}>
              Later
            </button>
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div style={{ textAlign: 'center' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--accent-error)', marginBottom: 16 }}>
            error
          </span>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Update Check Failed</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 24 }}>
            {errorMsg || 'Could not check for updates'}
          </div>
          <button className="btn btn-primary btn-lg" onClick={handleSkip}>
            Launch Anyway
          </button>
        </div>
      )}

      <div style={{
        position: 'absolute', bottom: 24,
        fontSize: 11, color: 'var(--text-muted)', opacity: 0.5,
      }}>
        Public Beta — Data is not permanent
      </div>
    </div>
  );
}
