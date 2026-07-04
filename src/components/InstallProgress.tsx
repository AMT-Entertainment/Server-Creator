import React from 'react';

export interface InstallStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  detail?: string;
}

interface InstallProgressProps {
  title: string;
  steps: InstallStep[];
  showActions: boolean;
  onClose: () => void;
  onEditConfig: () => void;
  onApproveRestart: () => void;
  onDenyRestart: () => void;
  needsRestartApproval: boolean;
}

export default function InstallProgress({
  title,
  steps,
  showActions,
  onClose,
  onEditConfig,
  onApproveRestart,
  onDenyRestart,
  needsRestartApproval,
}: InstallProgressProps) {
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ width: 480, maxWidth: '90vw' }}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
        </div>
        <div className="modal-body">
          {needsRestartApproval && (
            <div className="alert alert-warning mb-16">
              <span className="material-symbols-outlined icon-sm">warning</span>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Server Restart Required</div>
                <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                  The server needs to restart for the changes to take effect. Do you want to restart now?
                </div>
                <div className="flex gap-8 mt-8">
                  <button className="btn btn-success btn-sm" onClick={onApproveRestart}>
                    <span className="material-symbols-outlined icon-sm">restart_alt</span>
                    Restart Now
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={onDenyRestart}>
                    Later
                  </button>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {steps.map((step, index) => (
              <div key={step.id} style={{ display: 'flex', gap: 14, minHeight: 44 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24, flexShrink: 0 }}>
                  <div
                    style={{
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
                        step.status === 'completed'
                          ? 'var(--accent-success)'
                          : step.status === 'active'
                            ? 'var(--accent-primary)'
                            : step.status === 'error'
                              ? 'var(--accent-error)'
                              : 'var(--bg-surface)',
                      color: step.status === 'pending' ? 'var(--text-muted)' : '#fff',
                      border: step.status === 'pending' ? '2px solid var(--border-color)' : '2px solid transparent',
                    }}
                  >
                    {step.status === 'completed' ? (
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                        check
                      </span>
                    ) : step.status === 'error' ? (
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                        close
                      </span>
                    ) : step.status === 'active' ? (
                      <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                    ) : (
                      index + 1
                    )}
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      style={{
                        width: 2,
                        flex: 1,
                        minHeight: 20,
                        background: step.status === 'completed' ? 'var(--accent-success)' : 'var(--border-color)',
                        transition: 'background 0.3s ease',
                      }}
                    />
                  )}
                </div>
                <div style={{ flex: 1, paddingBottom: index < steps.length - 1 ? 12 : 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: step.status === 'active' ? 600 : 400,
                      color:
                        step.status === 'completed'
                          ? 'var(--accent-success)'
                          : step.status === 'active'
                            ? 'var(--text-primary)'
                            : step.status === 'error'
                              ? 'var(--accent-error)'
                              : 'var(--text-muted)',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    {step.label}
                  </div>
                  {step.detail && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{step.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
        {showActions && (
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>
              <span className="material-symbols-outlined icon-sm">close</span>
              Close
            </button>
            <button className="btn btn-primary" onClick={onEditConfig}>
              <span className="material-symbols-outlined icon-sm">folder</span>
              Edit Config
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
