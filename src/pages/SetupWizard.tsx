import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ServerConfig } from '../types/electron';
import ServerCreationProgress, { ProgressStep } from '../components/ServerCreationProgress';

interface SetupWizardProps {
  onComplete: () => void;
}

const LOADER_DISPLAY: Record<string, { icon: string; label: string; desc: string }> = {
  vanilla: { icon: 'stadia_controller', label: 'wizard:vanilla', desc: 'wizard:vanillaDesc' },
  paper: { icon: 'description', label: 'wizard:paper', desc: 'wizard:paperDesc' },
  fabric: { icon: 'nightlight', label: 'wizard:fabric', desc: 'wizard:fabricDesc' },
  forge: { icon: 'build', label: 'wizard:forge', desc: 'wizard:forgeDesc' },
  spigot: { icon: 'extension', label: 'wizard:spigot', desc: 'wizard:spigotDesc' },
  purpur: { icon: 'diamond', label: 'wizard:purpur', desc: 'wizard:purpurDesc' },
  neoforge: { icon: 'neurology', label: 'wizard:neoforge', desc: 'wizard:neoforgeDesc' },
};

const GAMEMODES = ['survival', 'creative', 'adventure', 'spectator'];
const DIFFICULTIES = ['peaceful', 'easy', 'normal', 'hard'];

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const [loader, setLoader] = useState<ServerConfig['loader'] | ''>('');
  const [versions, setVersions] = useState<Array<{ version: string; stable: boolean }>>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [version, setVersion] = useState('');
  const [name, setName] = useState('');
  const [port, setPort] = useState('25565');
  const [portAvailable, setPortAvailable] = useState<boolean | null>(null);
  const [maxPlayers, setMaxPlayers] = useState('20');
  const [motd, setMotd] = useState('');
  const [gamemode, setGamemode] = useState<ServerConfig['gamemode']>('survival');
  const [difficulty, setDifficulty] = useState<ServerConfig['difficulty']>('easy');
  const [icon, setIcon] = useState('');
  const [iconPreview, setIconPreview] = useState('');
  const [ram, setRam] = useState(2);
  const [systemRam, setSystemRam] = useState({ totalRam: 8, freeRam: 4, maxServerRam: 4, recommendedRam: 2 });
  const [tunnelEnabled, setTunnelEnabled] = useState(true);
  const [autoRestart, setAutoRestart] = useState(true);

  const [showProgress, setShowProgress] = useState(false);
  const [progressExpanded, setProgressExpanded] = useState(false);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const progressUnsubRef = useRef<(() => void) | null>(null);

  const totalSteps = 6;

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getSystemRam().then(setSystemRam);
    }
  }, []);

  useEffect(() => {
    return () => progressUnsubRef.current?.();
  }, []);

  useEffect(() => {
    if (loader) {
      setVersion('');
      setVersionsLoading(true);
      setVersions([]);
      if (window.electronAPI) {
        window.electronAPI.getVersions(loader).then(result => {
          if (result.success && result.versions) {
            setVersions(result.versions);
          }
          setVersionsLoading(false);
        });
      }
    }
  }, [loader]);

  useEffect(() => {
    if (port && window.electronAPI) {
      const portNum = parseInt(port, 10);
      if (portNum >= 1024 && portNum <= 65535) {
        const timer = setTimeout(async () => {
          const result = await window.electronAPI.checkPort(portNum);
          setPortAvailable(!result.inUse);
        }, 500);
        return () => clearTimeout(timer);
      } else {
        setPortAvailable(null);
      }
    }
  }, [port]);

  const canProceed = () => {
    switch (step) {
      case 0:
        return !!loader;
      case 1:
        return !!version;
      case 2:
        return !!name && name.length >= 2 && portAvailable === true;
      case 3:
        return true;
      case 4:
        return ram >= 1 && ram <= systemRam.maxServerRam;
      case 5:
        return true;
      default:
        return false;
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    setShowProgress(true);
    setProgressExpanded(false);

    const initialSteps: ProgressStep[] = [
      { id: 'dirs', label: 'Creating server directories', status: 'pending' },
      { id: 'download', label: `Downloading ${loader} ${version} server jar`, status: 'pending' },
      { id: 'config', label: 'Configuring server settings', status: 'pending' },
      { id: 'scripts', label: 'Writing startup scripts', status: 'pending' },
      { id: 'eula', label: 'Accepting Minecraft EULA', status: 'pending' },
      { id: 'save', label: 'Saving server configuration', status: 'pending' },
      ...(tunnelEnabled ? [{ id: 'tunnel' as const, label: 'Setting up tunneling', status: 'pending' as const }] : []),
      { id: 'done', label: 'Server ready!', status: 'pending' },
    ];
    setProgressSteps(initialSteps);

    const updateStep = (stepId: string, status: ProgressStep['status'], detail?: string) => {
      setProgressSteps(prev => prev.map(s => (s.id === stepId ? { ...s, status, detail } : s)));
    };

    if (window.electronAPI) {
      progressUnsubRef.current = window.electronAPI.onCreationProgress(data => {
        const stepMap: Record<string, string> = {
          dirs: 'dirs',
          download: 'download',
          config: 'config',
          scripts: 'scripts',
          eula: 'eula',
          save: 'save',
          done: 'done',
        };

        if (data.step === 'error') {
          updateStep(progressSteps.find(p => p.status === 'active')?.id || 'download', 'error', data.message);
          setError(data.message);
          setCreating(false);
          return;
        }

        const currentId = stepMap[data.step];
        if (currentId) {
          setProgressSteps(prev => {
            let found = false;
            return prev.map(s => {
              if (s.id === currentId) {
                found = true;
                return { ...s, status: 'completed', detail: data.message };
              }
              if (!found && s.status === 'pending') {
                return { ...s, status: 'active', detail: data.message };
              }
              return s;
            });
          });
        }

        if (data.step === 'done') {
          setCreating(false);
        }
      });
    }

    try {
      const result = await window.electronAPI.createServer({
        name,
        loader: loader as ServerConfig['loader'],
        version,
        port: parseInt(port, 10),
        maxPlayers: parseInt(maxPlayers, 10),
        motd: motd || 'Welcome to my server!',
        gamemode: gamemode as ServerConfig['gamemode'],
        difficulty: difficulty as ServerConfig['difficulty'],
        ram,
        icon: icon || undefined,
        tunnelEnabled,
        autoRestart,
      });

      if (result.success) {
        if (tunnelEnabled && result.server) {
          updateStep('tunnel', 'active', 'Starting tunnel...');
          const tunnelResult = await window.electronAPI.startTunnel(result.server.id, result.server.port);
          if (tunnelResult.success && tunnelResult.url) {
            updateStep('tunnel', 'completed', `Tunnel active: ${tunnelResult.url}`);
          } else {
            updateStep('tunnel', 'completed', 'Tunnel will start when server runs');
          }
        }
        updateStep('done', 'completed', 'Your server is ready!');
      } else {
        const activeStep = progressSteps.find(p => p.status === 'active');
        if (activeStep) updateStep(activeStep.id, 'error', result.error || 'Failed');
        setError(result.error || t('wizard.error'));
        setCreating(false);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const activeStep = progressSteps.find(p => p.status === 'active');
      if (activeStep) updateStep(activeStep.id, 'error', msg);
      setError(msg || t('wizard.error'));
      setCreating(false);
    }
  };

  const handleProgressClose = () => {
    setShowProgress(false);
    onComplete();
  };

  const handleIconSelect = async () => {
    if (window.electronAPI) {
      const result = await window.electronAPI.openFileDialog({
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['png'] }],
      });
      if (!result.canceled && result.filePaths[0]) {
        setIcon(result.filePaths[0]);
        setIconPreview(`file://${result.filePaths[0]}`);
      }
    }
  };

  const groupVersions = (versions: Array<{ version: string; stable: boolean }>) => {
    const major: Record<string, Array<{ version: string; stable: boolean }>> = {};
    for (const v of versions) {
      const parts = v.version.split('.');
      const key = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : v.version;
      if (!major[key]) major[key] = [];
      major[key].push(v);
    }
    return major;
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="fade-in">
            <h2 className="wizard-step-title">{t('wizard.loader')}</h2>
            <p className="wizard-step-desc">{t('wizard.loaderDesc')}</p>
            <div className="loader-grid">
              {Object.entries(LOADER_DISPLAY).map(([id, info]) => (
                <div
                  key={id}
                  className={`loader-card ${loader === id ? 'selected' : ''}`}
                  onClick={() => setLoader(id as ServerConfig['loader'])}
                >
                  <span className="material-symbols-outlined icon">{info.icon}</span>
                  <h4>{t(info.label)}</h4>
                  <p>{t(info.desc)}</p>
                </div>
              ))}
            </div>
          </div>
        );

      case 1:
        return (
          <div className="fade-in">
            <h2 className="wizard-step-title">{t('wizard.version')}</h2>
            <p className="wizard-step-desc">{t('wizard.versionDesc')}</p>
            <div className="mt-16">
              <label className="label">{t('wizard.version_label')}</label>
              {versionsLoading ? (
                <div className="flex items-center gap-8" style={{ padding: '12px 0' }}>
                  <div className="spinner" />
                  <span className="text-muted">{t('wizard.fetchingVersions')}</span>
                </div>
              ) : versions.length > 0 ? (
                <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {Object.entries(groupVersions(versions)).map(([major, vers]) => (
                    <div key={major}>
                      <div
                        style={{
                          padding: '6px 10px',
                          fontSize: 11,
                          fontWeight: 600,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          background: 'var(--bg-surface)',
                          borderRadius: 'var(--border-radius-sm)',
                          marginBottom: 4,
                          marginTop: 4,
                        }}
                      >
                        Minecraft {major}.x
                      </div>
                      {vers.map(v => (
                        <div
                          key={v.version}
                          className={`loader-card`}
                          style={{
                            padding: '8px 12px',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            border: `2px solid ${version === v.version ? 'var(--accent-primary)' : 'transparent'}`,
                            background: version === v.version ? 'rgba(79, 195, 247, 0.08)' : 'transparent',
                          }}
                          onClick={() => setVersion(v.version)}
                        >
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: 18, color: v.stable ? 'var(--accent-success)' : 'var(--accent-warning)' }}
                          >
                            {v.stable ? 'check_circle' : 'warning'}
                          </span>
                          <span style={{ fontWeight: 500 }}>{v.version}</span>
                          {!v.stable && (
                            <span className="badge badge-stopped" style={{ marginLeft: 'auto' }}>
                              Experimental
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted">{t('wizard.fetchingVersions')}</p>
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="fade-in">
            <h2 className="wizard-step-title">{t('wizard.basic')}</h2>
            <p className="wizard-step-desc">{t('wizard.basicDesc')}</p>
            <div className="flex flex-col gap-16">
              <div>
                <label className="label">{t('wizard.serverName')}</label>
                <input
                  className="input"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={t('wizard.serverNamePlaceholder')}
                />
                <p className="hint">{t('wizard.serverNameDesc')}</p>
              </div>
              <div>
                <label className="label">{t('wizard.port')}</label>
                <input
                  className="input"
                  type="number"
                  value={port}
                  onChange={e => {
                    setPort(e.target.value);
                    setPortAvailable(null);
                  }}
                  min={1024}
                  max={65535}
                />
                {port && parseInt(port, 10) >= 1024 && parseInt(port, 10) <= 65535 && (
                  <p
                    className="hint"
                    style={{
                      color: portAvailable === true ? 'var(--accent-success)' : portAvailable === false ? 'var(--accent-error)' : undefined,
                    }}
                  >
                    {portAvailable === null
                      ? t('wizard.portCheck')
                      : portAvailable
                        ? t('wizard.portAvailable', { port })
                        : t('wizard.portInUse', { port })}
                  </p>
                )}
                {port && (parseInt(port, 10) < 1024 || parseInt(port, 10) > 65535) && (
                  <p className="error-text">{t('wizard.portInvalid')}</p>
                )}
              </div>
              <div>
                <label className="label">{t('wizard.maxPlayers')}</label>
                <input
                  className="input"
                  type="number"
                  value={maxPlayers}
                  onChange={e => setMaxPlayers(e.target.value)}
                  min={1}
                  max={1000}
                />
              </div>
              <div>
                <label className="label">{t('wizard.motd')}</label>
                <input
                  className="input"
                  type="text"
                  value={motd}
                  onChange={e => setMotd(e.target.value)}
                  placeholder={t('wizard.motdPlaceholder')}
                />
              </div>
              <div className="flex gap-16">
                <div style={{ flex: 1 }}>
                  <label className="label">{t('wizard.gamemode')}</label>
                  <select className="select" value={gamemode} onChange={e => setGamemode(e.target.value as ServerConfig['gamemode'])}>
                    {GAMEMODES.map(gm => (
                      <option key={gm} value={gm}>
                        {t(`wizard.${gm}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label">{t('wizard.difficulty')}</label>
                  <select className="select" value={difficulty} onChange={e => setDifficulty(e.target.value as ServerConfig['difficulty'])}>
                    {DIFFICULTIES.map(d => (
                      <option key={d} value={d}>
                        {t(`wizard.${d}`)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">{t('wizard.icon')}</label>
                <p className="hint mb-8">{t('wizard.iconDesc')}</p>
                <div className="flex gap-12 items-center">
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 10,
                      background: 'var(--bg-surface)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      border: '2px dashed var(--border-color)',
                      flexShrink: 0,
                    }}
                  >
                    {iconPreview ? (
                      <img src={iconPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--text-muted)' }}>
                        image
                      </span>
                    )}
                  </div>
                  <div className="flex gap-8">
                    <button className="btn btn-ghost" onClick={handleIconSelect}>
                      <span className="material-symbols-outlined icon-sm">upload</span>
                      {t('wizard.iconSelect')}
                    </button>
                    {icon && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setIcon('');
                          setIconPreview('');
                        }}
                      >
                        {t('wizard.iconRemove')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="fade-in">
            <h2 className="wizard-step-title">{t('wizard.ram')}</h2>
            <p className="wizard-step-desc">{t('wizard.ramDesc')}</p>
            <div className="alert alert-info mb-16">
              <span className="material-symbols-outlined icon-sm">info</span>
              <span>{t('wizard.systemRam', { total: systemRam.totalRam, free: systemRam.freeRam })}</span>
            </div>
            <div className="slider-container">
              <div className="flex justify-between mb-8">
                <span style={{ fontSize: 24, fontWeight: 700 }}>{ram} GB</span>
                <span className="text-sm text-muted">{t('wizard.maxRam', { max: systemRam.maxServerRam })}</span>
              </div>
              <input
                type="range"
                className="slider"
                min={1}
                max={systemRam.maxServerRam}
                value={ram}
                onChange={e => setRam(parseInt(e.target.value, 10))}
              />
              <div className="slider-labels">
                <span>1 GB</span>
                <span style={{ color: ram === systemRam.recommendedRam ? 'var(--accent-success)' : undefined }}>
                  {t('wizard.ramHint', { ram: systemRam.recommendedRam })}
                </span>
                <span>{systemRam.maxServerRam} GB</span>
              </div>
            </div>
            {ram > systemRam.recommendedRam + 2 && (
              <div className="alert alert-warning mt-16">
                <span className="material-symbols-outlined icon-sm">warning</span>
                <span>{t('wizard.ramTooHigh')}</span>
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div className="fade-in">
            <h2 className="wizard-step-title">{t('wizard.tunneling')}</h2>
            <p className="wizard-step-desc">{t('wizard.tunnelingDesc')}</p>
            <div className="alert alert-info mb-16">
              <span className="material-symbols-outlined icon-sm">public</span>
              <span>{t('wizard.tunnelingInfo')}</span>
            </div>
            <div className="flex items-center gap-12 mb-16">
              <label className="switch">
                <input type="checkbox" checked={tunnelEnabled} onChange={e => setTunnelEnabled(e.target.checked)} />
                <span className="switch-slider"></span>
              </label>
              <div>
                <div style={{ fontWeight: 500 }}>{t('wizard.tunnelingEnabled')}</div>
                <div className="text-sm text-muted">{t('wizard.tunnelAuto')}</div>
              </div>
            </div>
            <div className="flex items-center gap-12">
              <label className="switch">
                <input type="checkbox" checked={autoRestart} onChange={e => setAutoRestart(e.target.checked)} />
                <span className="switch-slider"></span>
              </label>
              <div>
                <div style={{ fontWeight: 500 }}>Auto-Restart</div>
                <div className="text-sm text-muted">Automatically restart server after a crash</div>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="fade-in">
            <h2 className="wizard-step-title">{t('wizard.confirm')}</h2>
            <p className="wizard-step-desc">{t('wizard.confirmDesc')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="flex justify-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span className="text-muted">{t('wizard.loader_label')}</span>
                <span style={{ fontWeight: 500 }}>{t(`wizard.${loader}`)}</span>
              </div>
              <div className="flex justify-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span className="text-muted">{t('wizard.version_label')}</span>
                <span style={{ fontWeight: 500 }}>{version}</span>
              </div>
              <div className="flex justify-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span className="text-muted">{t('wizard.serverName')}</span>
                <span style={{ fontWeight: 500 }}>{name}</span>
              </div>
              <div className="flex justify-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span className="text-muted">{t('wizard.port')}</span>
                <span style={{ fontWeight: 500 }}>{port}</span>
              </div>
              <div className="flex justify-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span className="text-muted">{t('wizard.ram_label')}</span>
                <span style={{ fontWeight: 500 }}>{ram} GB</span>
              </div>
              <div className="flex justify-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span className="text-muted">{t('wizard.maxPlayers')}</span>
                <span style={{ fontWeight: 500 }}>{maxPlayers}</span>
              </div>
              <div className="flex justify-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span className="text-muted">{t('wizard.tunnel_label')}</span>
                <span style={{ fontWeight: 500 }}>{tunnelEnabled ? t('common.enabled') : t('common.disabled')}</span>
              </div>
              <div className="flex justify-between" style={{ padding: '10px 0' }}>
                <span className="text-muted">Auto-Restart</span>
                <span style={{ fontWeight: 500 }}>{autoRestart ? t('common.yes') : t('common.no')}</span>
              </div>
            </div>
            {error && (
              <div className="alert alert-error mt-16">
                <span className="material-symbols-outlined icon-sm">error</span>
                <span>{error}</span>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="page-content" style={{ display: 'flex', justifyContent: 'center' }}>
      <div className="wizard-container">
        <div className="wizard-header">
          <h1>{t('wizard.title')}</h1>
          <p>{t('wizard.step', { current: step + 1, total: totalSteps })}</p>
        </div>

        <div className="wizard-progress">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <React.Fragment key={i}>
              <div className={`wizard-step-dot ${i === step ? 'active' : ''} ${i < step ? 'completed' : ''}`}>
                {i < step ? (
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    check
                  </span>
                ) : (
                  i + 1
                )}
              </div>
              {i < totalSteps - 1 && <div className={`wizard-step-line ${i < step ? 'completed' : ''}`} />}
            </React.Fragment>
          ))}
        </div>

        <div className="wizard-body">
          {renderStep()}

          <div className="wizard-footer">
            <button
              className="btn btn-ghost"
              onClick={() => {
                if (step === 0) {
                  onComplete();
                } else {
                  setStep(step - 1);
                }
              }}
            >
              {step === 0 ? t('wizard.cancel') : t('wizard.back')}
            </button>

            {step < totalSteps - 1 ? (
              <button className="btn btn-primary" disabled={!canProceed()} onClick={() => setStep(step + 1)}>
                {t('wizard.next')}
              </button>
            ) : (
              <button className="btn btn-success btn-lg" disabled={creating} onClick={handleCreate}>
                {creating ? (
                  <>
                    <div className="spinner" style={{ width: 16, height: 16 }} />
                    {t('wizard.creating')}
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">check</span>
                    {t('wizard.create')}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
      {showProgress && (
        <ServerCreationProgress
          steps={progressSteps}
          expanded={progressExpanded}
          onToggleExpand={() => setProgressExpanded(!progressExpanded)}
          onClose={handleProgressClose}
        />
      )}
    </div>
  );
}
