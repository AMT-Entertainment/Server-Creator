import React from 'react';

export interface ProgressStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  detail?: string;
}

interface ServerCreationProgressProps {
  steps: ProgressStep[];
  onClose?: () => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export default function ServerCreationProgress({ steps, onClose, expanded, onToggleExpand }: ServerCreationProgressProps) {
  return (
    <div className="modal-overlay">
      <div
        className="modal"
        style={{
          width: expanded ? '90vw' : 520,
          maxWidth: 700,
          transition: 'width 0.25s ease',
        }}
      >
        <div className="modal-header">
          <span className="modal-title">Creating Server</span>
          <div className="flex gap-8">
            {onToggleExpand && (
              <button className="btn btn-ghost btn-sm" onClick={onToggleExpand}>
                <span className="material-symbols-outlined">
                  {expanded ? 'fullscreen_exit' : 'fullscreen'}
                </span>
              </button>
            )}
            {onClose && (
              <button className="btn btn-ghost btn-sm" onClick={onClose}>
                <span className="material-symbols-outlined">close</span>
              </button>
            )}
          </div>
        </div>
        <div className="modal-body">
          {expanded && (
            <div className="alert alert-info mb-16">
              <span className="material-symbols-outlined icon-sm">info</span>
              <span>The server is being set up. This may take a moment depending on download speed.</span>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {steps.map((step, index) => (
              <div key={step.id} style={{ display: 'flex', gap: 14, minHeight: 48 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24, flexShrink: 0 }}>
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 600,
                    transition: 'all 0.3s ease',
                    background:
                      step.status === 'completed' ? 'var(--accent-success)' :
                      step.status === 'active' ? 'var(--accent-primary)' :
                      step.status === 'error' ? 'var(--accent-error)' :
                      'var(--bg-surface)',
                    color:
                      step.status === 'pending' ? 'var(--text-muted)' :
                      '#fff',
                    border: step.status === 'pending' ? '2px solid var(--border-color)' : '2px solid transparent',
                  }}>
                    {step.status === 'completed' ? (
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span>
                    ) : step.status === 'error' ? (
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                    ) : step.status === 'active' ? (
                      <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                    ) : (
                      index + 1
                    )}
                  </div>
                  {index < steps.length - 1 && (
                    <div style={{
                      width: 2,
                      flex: 1,
                      minHeight: 24,
                      background:
                        step.status === 'completed' ? 'var(--accent-success)' :
                        'var(--border-color)',
                      transition: 'background 0.3s ease',
                    }} />
                  )}
                </div>
                <div style={{ flex: 1, paddingBottom: index < steps.length - 1 ? 16 : 0 }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: step.status === 'active' ? 600 : 400,
                    color:
                      step.status === 'completed' ? 'var(--accent-success)' :
                      step.status === 'active' ? 'var(--text-primary)' :
                      step.status === 'error' ? 'var(--accent-error)' :
                      'var(--text-muted)',
                    transition: 'all 0.3s ease',
                  }}>
                    {step.label}
                  </div>
                  {step.detail && (
                    <div style={{
                      fontSize: 12,
                      color: 'var(--text-muted)',
                      marginTop: 2,
                      fontFamily: step.status === 'active' ? 'var(--font-mono)' : undefined,
                    }}>
                      {step.detail}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        {steps.every(s => s.status === 'completed') && (
          <div className="modal-footer">
            <button className="btn btn-success" onClick={onClose}>
              <span className="material-symbols-outlined icon-sm">check</span>
              Done
            </button>
          </div>
        )}
        {steps.some(s => s.status === 'error') && (
          <div className="modal-footer">
            <button className="btn btn-danger" onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
