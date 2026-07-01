import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import InstallProgress, { InstallStep } from '../components/InstallProgress';
import { useToast } from '../components/Toast';

interface ServerDetailProps {
  onServersChange: () => void;
}

type Tab = 'console' | 'logs' | 'players' | 'mods' | 'config' | 'advanced';

export default function ServerDetail({ onServersChange }: ServerDetailProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('console');
  const [server, setServer] = useState<any>(null);
  const [status, setStatus] = useState<string>('stopped');
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [command, setCommand] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [tunnelStatus, setTunnelStatus] = useState<string>('stopped');
  const [tunnelUrl, setTunnelUrl] = useState<string>('');
  const [publicIp, setPublicIp] = useState<string | null>(null);
  const [localIp, setLocalIp] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    loadServer();
  }, [id]);

  const loadServer = async () => {
    if (!id || !window.electronAPI) return;
    const s = await window.electronAPI.getServer(id);
    if (!s) {
      navigate('/');
      return;
    }
    setServer(s);

    const statusResult = await window.electronAPI.getServerStatus(id);
    setStatus(statusResult.status);

    const termOutput = await window.electronAPI.getTerminalOutput(id);
    setTerminalLines(termOutput);

    const logData = await window.electronAPI.getLogs(id);
    setLogs(logData);

    const tStatus = await window.electronAPI.getTunnelStatus(id);
    setTunnelStatus(tStatus.status);
    setTunnelUrl(tStatus.url || '');

    window.electronAPI.getPublicIp().then(setPublicIp).catch(() => {});
    setLocalIp(window.electronAPI.getLocalIp());

    if (statusResult.status === 'running' && !tStatus.url) {
      startTunnelForServer();
    }

    await window.electronAPI.listenToTerminal(id);

    setLoading(false);
  };

  useEffect(() => {
    if (!window.electronAPI || !id) return;
    const unsubTerm = window.electronAPI.onTerminalOutput((sid, output) => {
      if (sid === id) {
        setTerminalLines(prev => [...prev, output]);
      }
    });
    const unsubStatus = window.electronAPI.onServerStatusChanged((sid, newStatus, data) => {
      if (sid === id) {
        setStatus(newStatus);
        if (newStatus === 'crashed') {
          showToast(`Server crashed!`, 'error');
        }
      }
    });
    return () => {
      unsubTerm();
      unsubStatus();
    };
  }, [id]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLines]);

  useEffect(() => {
    if (!id || !window.electronAPI) return;
    const interval = setInterval(async () => {
      const t = await window.electronAPI.getTunnelStatus(id);
      setTunnelStatus(t.status);
      if (t.url) setTunnelUrl(t.url);
    }, 10000);
    return () => clearInterval(interval);
  }, [id]);

  const handleCommand = async () => {
    if (!command.trim() || !id || !window.electronAPI) return;
    await window.electronAPI.sendCommand(id, command.trim());
    setCommand('');
  };

  const getIpAddress = () => {
    if (tunnelStatus === 'running' && tunnelUrl) {
      return tunnelUrl.includes(':') ? tunnelUrl : `${tunnelUrl}:${server.port}`;
    }
    if (publicIp) return `${publicIp}:${server.port}`;
    if (localIp) return `${localIp}:${server.port}`;
    return server.port === 25565 ? 'localhost' : `localhost:${server.port}`;
  };

  const copyIp = async () => {
    const addr = getIpAddress();
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(true);
      showToast(`Copied: ${addr}`, 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Failed to copy', 'error');
    }
  };

  const startTunnelForServer = async () => {
    if (!id || !window.electronAPI || !server) return;
    try {
      const result = await window.electronAPI.startTunnel(id, server.port);
      if (result.success && result.url) {
        setTunnelStatus('running');
        setTunnelUrl(result.url);
      }
    } catch {}
  };

  const handleStart = async () => {
    if (!id || !window.electronAPI) return;
    setStatus('starting');
    const result = await window.electronAPI.startServer(id);
    if (result.success) {
      startTunnelForServer();
    } else {
      showToast(result.error || 'Failed to start server', 'error');
      const s = await window.electronAPI.getServerStatus(id);
      setStatus(s.status);
    }
  };

  const handleStop = async () => {
    if (!id || !window.electronAPI) return;
    setStatus('stopping');
    await window.electronAPI.stopServer(id);
  };

  const handleRestart = async () => {
    if (!id || !window.electronAPI) return;
    setStatus('stopping');
    await window.electronAPI.restartServer(id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCommand();
    }
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      running: 'badge-running',
      stopped: 'badge-stopped',
      starting: 'badge-starting',
      stopping: 'badge-stopping',
      crashed: 'badge-crashed',
    };
    return `badge ${map[s] || 'badge-stopped'}`;
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'console', label: t('server.console'), icon: 'terminal' },
    { id: 'logs', label: t('server.logs'), icon: 'article' },
    { id: 'players', label: t('server.players'), icon: 'groups' },
    { id: 'mods', label: t('server.mods'), icon: 'extension' },
    { id: 'config', label: t('server.config'), icon: 'folder' },
    { id: 'advanced', label: t('server.advanced'), icon: 'tune' },
  ];

  if (loading || !server) {
    return (
      <div className="page-content flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="server-detail">
      <div className="toolbar">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="toolbar-title">
          {server.name}
        </div>
        <span className={statusBadge(status)}>
          {t(`home.status.${status}`)}
        </span>
        <div className="toolbar-actions">
          {(status === 'stopped' || status === 'crashed') && (
            <button className="btn btn-success" onClick={handleStart}>
              <span className="material-symbols-outlined icon-sm">play_arrow</span>
              {t('server.start')}
            </button>
          )}
          {status === 'running' && (
            <button className="btn btn-warning" onClick={handleRestart}>
              <span className="material-symbols-outlined icon-sm">refresh</span>
              {t('server.restart')}
            </button>
          )}
          {(status === 'running' || status === 'starting') && (
            <button className="btn btn-danger" onClick={handleStop}>
              <span className="material-symbols-outlined icon-sm">stop</span>
              {t('server.stop')}
            </button>
          )}
        </div>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        padding: '10px 24px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-color)',
        fontSize: 13,
      }}>
        {tunnelStatus === 'running' && tunnelUrl ? (
          <div className="flex items-center gap-4" style={{ color: 'var(--accent-success)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>public</span>
            <span style={{ fontWeight: 500 }}>
              {tunnelUrl.includes(':') ? tunnelUrl : `${tunnelUrl}:${server.port}`}
            </span>
            <span className={`material-symbols-outlined copy-btn ${copied ? 'copied' : ''}`} onClick={copyIp}>content_copy</span>
          </div>
        ) : publicIp ? (
          <div className="flex items-center gap-4" style={{ color: 'var(--accent-info)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>globe</span>
            <span style={{ fontWeight: 500 }}>
              {publicIp}:{server.port}
            </span>
            <span className={`material-symbols-outlined copy-btn ${copied ? 'copied' : ''}`} onClick={copyIp}>content_copy</span>
          </div>
        ) : localIp ? (
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--text-muted)' }}>cable</span>
            <span style={{ fontWeight: 500 }}>
              {localIp}:{server.port}
            </span>
            <span className={`material-symbols-outlined copy-btn ${copied ? 'copied' : ''}`} onClick={copyIp}>content_copy</span>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--text-muted)' }}>cable</span>
            <span style={{ fontWeight: 500 }}>
              {server.port === 25565 ? 'localhost' : `localhost:${server.port}`}
            </span>
            <span className={`material-symbols-outlined copy-btn ${copied ? 'copied' : ''}`} onClick={copyIp}>content_copy</span>
          </div>
        )}
        <div className="flex items-center gap-4">
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--text-muted)' }}>memory</span>
          <span>{server.ram} GB</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--text-muted)' }}>groups</span>
          <span>0/{server.maxPlayers}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--text-muted)' }}>description</span>
          <span>{server.loader} {server.version}</span>
        </div>
      </div>

      <div className="server-detail-tabs">
        <div className="tabs">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="material-symbols-outlined icon-sm">{tab.icon}</span>
              {tab.label}
            </div>
          ))}
        </div>
      </div>

      <div className="server-detail-content">
        {activeTab === 'console' && (
          <div className="terminal" style={{ height: 'calc(100vh - 200px)' }}>
            <div className="terminal-header">
              <span>{t('server.terminal')}</span>
              <span style={{ fontSize: 11 }}>{server.loader} {server.version}</span>
            </div>
            <div className="terminal-body" ref={terminalRef}>
              {terminalLines.length === 0 ? (
                <span style={{ color: 'var(--text-muted)' }}>
                  {t('common.loading')}
                </span>
              ) : (
                terminalLines.map((line, i) => (
                  <React.Fragment key={i}>{line}</React.Fragment>
                ))
              )}
            </div>
            <div className="terminal-input-row">
              <span className="terminal-prompt">&gt;</span>
              <input
                className="terminal-input"
                value={command}
                onChange={e => setCommand(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('server.commandPlaceholder')}
              />
              <button className="btn btn-ghost btn-sm" onClick={handleCommand} style={{ margin: 4 }}>
                {t('server.send')}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'logs' && <LogsView id={id!} logs={logs} setLogs={setLogs} />}
        {activeTab === 'players' && <PlayersView id={id!} server={server} />}
        {activeTab === 'mods' && <ModsView id={id!} server={server} />}
        {activeTab === 'config' && <ConfigView id={id!} />}
        {activeTab === 'advanced' && <AdvancedView id={id!} server={server} navigate={navigate} />}
      </div>
    </div>
  );
}

function LogsView({ id, logs, setLogs }: { id: string; logs: string[]; setLogs: (l: string[]) => void }) {
  const { t } = useTranslation();
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (window.electronAPI) {
        const newLogs = await window.electronAPI.getLogs(id);
        setLogs(newLogs);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [id]);

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">{t('server.logTitle')}</span>
        <button className="btn btn-ghost btn-sm" onClick={async () => {
          if (window.electronAPI) {
            await window.electronAPI.clearLogs(id);
            setLogs([]);
          }
        }}>
          {t('server.clearLogs')}
        </button>
      </div>
      <div
        ref={logRef}
        style={{
          background: 'var(--bg-terminal)',
          borderRadius: 'var(--border-radius)',
          padding: 16,
          maxHeight: 500,
          overflowY: 'auto',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {logs.length === 0 ? (
          <span style={{ color: 'var(--text-muted)' }}>{t('server.logEmpty')}</span>
        ) : (
          logs.map((log, i) => <div key={i}>{log}</div>)
        )}
      </div>
    </div>
  );
}

function PlayersView({ id, server }: { id: string; server: any }) {
  const { t } = useTranslation();
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const parsePlayers = async () => {
      if (!window.electronAPI) return;
      const output = await window.electronAPI.getTerminalOutput(id);
      const playerList: any[] = [];
      const onlinePlayers: string[] = [];

      for (const line of output) {
        const joinMatch = line.match(/UUID of player (.+) is/i);
        if (joinMatch) {
          const name = joinMatch[1].trim();
          if (!onlinePlayers.includes(name)) {
            onlinePlayers.push(name);
          }
        }
        const leftMatch = line.match(/(.+) left the game/i);
        if (leftMatch) {
          const name = leftMatch[1].trim();
          const idx = onlinePlayers.indexOf(name);
          if (idx > -1) onlinePlayers.splice(idx, 1);
        }
      }

      for (const name of onlinePlayers) {
        playerList.push({
          name,
          online: true,
          op: false,
          lastOnline: new Date().toISOString(),
        });
      }

      setPlayers(playerList);
      setLoading(false);
    };

    parsePlayers();
    const interval = setInterval(parsePlayers, 5000);
    return () => clearInterval(interval);
  }, [id]);

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">{t('server.playersTitle')}</span>
        <span className="text-sm text-muted">{players.filter(p => p.online).length} online</span>
      </div>
      {loading ? (
        <div className="flex items-center justify-center" style={{ padding: 40 }}>
          <div className="spinner" />
        </div>
      ) : players.length === 0 ? (
        <div className="empty-state">
          <span className="material-symbols-outlined icon">groups</span>
          <h3>{t('server.playersEmpty')}</h3>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>{t('server.player')}</th>
              <th>{t('server.status')}</th>
              <th>{t('server.op')}</th>
              <th>{t('server.lastOnline')}</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 500 }}>{player.name}</td>
                <td>
                  <span className={player.online ? 'badge badge-running' : 'badge badge-stopped'}>
                    {player.online ? t('server.online') : t('server.offline')}
                  </span>
                </td>
                <td>
                  {player.op ? (
                    <span className="badge badge-running">OP</span>
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </td>
                <td className="text-sm text-muted">
                  {player.online ? t('server.online') : new Date(player.lastOnline).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ModsView({ id, server }: { id: string; server: any }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [installedMods, setInstalledMods] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedLoader, setSelectedLoader] = useState(server.loader || 'all');

  const [installProgress, setInstallProgress] = useState<{
    visible: boolean;
    steps: InstallStep[];
    showActions: boolean;
    needsRestartApproval: boolean;
    onApprove: () => void;
    onDeny: () => void;
  }>({
    visible: false,
    steps: [],
    showActions: false,
    needsRestartApproval: false,
    onApprove: () => {},
    onDeny: () => {},
  });

  const loaders = ['all', 'paper', 'fabric', 'forge', 'quilt', 'neoforge', 'spigot', 'purpur'];

  useEffect(() => {
    loadInstalledMods();
  }, [id]);

  useEffect(() => {
    if (server.loader) {
      setSelectedLoader(server.loader);
    }
  }, [server.loader]);

  const loadInstalledMods = async () => {
    if (!window.electronAPI) return;
    const files = await window.electronAPI.listFiles(id, 'mods');
    const mods = files.filter(f => f.name.endsWith('.jar')).map(f => ({
      name: f.name,
      path: f.path,
      size: f.size,
    }));
    setInstalledMods(mods);
  };

  const getSearchVersion = async (): Promise<string[]> => {
    if (!server.version) return [];
    if (server.loader === 'neoforge') {
      if (window.electronAPI) {
        const mapped = await window.electronAPI.neoToMc(server.version);
        return mapped.mcVersion ? [mapped.mcVersion] : [server.version];
      }
    }
    return [server.version];
  };

  const handleSearch = async () => {
    if (!query.trim() || !window.electronAPI) return;
    setSearching(true);
    const loaders = selectedLoader === 'all' ? [] : [selectedLoader];
    const searchVersions = await getSearchVersion();
    const result = await window.electronAPI.modrinthSearch(query, loaders, searchVersions, 40);
    if (result.success && result.results) {
      setSearchResults(result.results);
    }
    setSearching(false);
  };

  const updateInstallStep = (stepId: string, status: InstallStep['status'], detail?: string) => {
    setInstallProgress(prev => ({
      ...prev,
      steps: prev.steps.map(s => s.id === stepId ? { ...s, status, detail } : s),
    }));
  };

  const handleInstall = async (project: any) => {
    if (!window.electronAPI) return;

    const steps: InstallStep[] = [
      { id: 'download', label: `Downloading ${project.title}...`, status: 'active' },
      { id: 'install', label: 'Installing mod/plugin', status: 'pending' },
      { id: 'restart', label: 'Restarting server (needs approval)', status: 'pending' },
      { id: 'done', label: 'Installation complete', status: 'pending' },
    ];

    setInstallProgress({
      visible: true,
      steps,
      showActions: false,
      needsRestartApproval: false,
      onApprove: () => {},
      onDeny: () => {},
    });

    try {
      const searchVersions = await getSearchVersion();
      const verResult = await window.electronAPI.modrinthGetVersions(project.project_id);
      if (!verResult.success || !verResult.versions || verResult.versions.length === 0) {
        updateInstallStep('download', 'error', 'No versions found');
        return;
      }

      let compatible: any = verResult.versions.find((v: any) =>
        v.game_versions.some((gv: string) =>
          searchVersions.some((sv: string) => gv === sv || sv.startsWith(gv) || gv.startsWith(sv))
        ) &&
        v.loaders.some((l: string) => l === server.loader || l === 'paper' || l === 'fabric' || l === 'forge' || l === 'purpur' || l === 'spigot' || l === 'neoforge')
      );

      if (!compatible) {
        compatible = verResult.versions.find((v: any) =>
          v.loaders.some((l: string) => l === server.loader || l === 'paper' || l === 'fabric' || l === 'forge' || l === 'purpur' || l === 'spigot' || l === 'neoforge')
        );
      }

      if (!compatible) {
        updateInstallStep('download', 'error', 'No compatible version found');
        return;
      }

      updateInstallStep('download', 'completed', `${project.title} v${compatible.version_number}`);
      updateInstallStep('install', 'active');

      await window.electronAPI.modrinthDownload(project.project_id, compatible.id, id);
      updateInstallStep('install', 'completed', 'Mod installed to mods folder');
      loadInstalledMods();

      updateInstallStep('restart', 'active', 'Server restart required');
      setInstallProgress(prev => ({
        ...prev,
        needsRestartApproval: true,
        onApprove: async () => {
          setInstallProgress(prev => ({ ...prev, needsRestartApproval: false }));
          updateInstallStep('restart', 'active', 'Stopping server...');
          await window.electronAPI.stopServer(id);
          updateInstallStep('restart', 'active', 'Starting server...');
          await window.electronAPI.startServer(id);
          updateInstallStep('restart', 'completed', 'Server restarted successfully');
          updateInstallStep('done', 'completed', `${project.title} is now active`);
          setInstallProgress(prev => ({ ...prev, showActions: true }));
        },
        onDeny: () => {
          setInstallProgress(prev => ({ ...prev, needsRestartApproval: false }));
          updateInstallStep('restart', 'completed', 'Restart postponed - restart manually');
          updateInstallStep('done', 'completed', `${project.title} installed (restart required)`);
          setInstallProgress(prev => ({ ...prev, showActions: true }));
        },
      }));
    } catch (e: any) {
      updateInstallStep('download', 'error', e.message || 'Installation failed');
    }
  };

  const handleDeleteMod = async (modPath: string) => {
    if (!window.electronAPI) return;
    await window.electronAPI.deleteFile(id, modPath);
    loadInstalledMods();
  };

  const closeInstallProgress = () => {
    setInstallProgress(prev => ({ ...prev, visible: false }));
  };

  const openConfig = () => {
    closeInstallProgress();
    const configTab = document.querySelector('.tab:nth-child(5)') as HTMLElement;
    if (configTab) configTab.click();
  };

  return (
    <div className="flex gap-16" style={{ height: 'calc(100vh - 200px)' }}>
      <div className="card flex-1" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="card-header">
          <span className="card-title">{t('server.modsTitle')}</span>
          <span className="text-sm text-muted" style={{ color: 'var(--accent-info)' }}>
            Filtering for {server.loader} {server.version}
          </span>
        </div>
        <div className="flex gap-8 mb-16">
          <input
            className="input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder={t('server.searchMods')}
            style={{ flex: 1 }}
          />
          <select
            className="select"
            value={selectedLoader}
            onChange={e => setSelectedLoader(e.target.value)}
            style={{ width: 140 }}
          >
            {loaders.map(l => (
              <option key={l} value={l}>{l === 'all' ? 'All Loaders' : l}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={handleSearch} disabled={searching}>
            {searching ? <div className="spinner" style={{ width: 14, height: 14 }} /> : t('server.search')}
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {searchResults.length > 0 && (
            <>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{t('server.searchResults')}</h3>
              <div className="mod-search-results">
                {searchResults.map(project => (
                  <div key={project.project_id} className="mod-card">
                    {project.icon_url && (
                      <img src={project.icon_url} alt={project.title} />
                    )}
                    <div className="mod-card-info">
                      <div className="mod-card-title truncate">{project.title}</div>
                      <div className="mod-card-desc">{project.description}</div>
                      <div className="mod-card-meta">
                        <span>{project.downloads.toLocaleString()} downloads</span>
                        <span>{project.follows} follows</span>
                      </div>
                      <button
                        className="btn btn-primary btn-sm mt-8"
                        onClick={() => handleInstall(project)}
                        disabled={installProgress.visible}
                      >
                        {t('server.install')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {!searching && searchResults.length === 0 && query && (
            <div className="empty-state">
              <span className="material-symbols-outlined icon">search</span>
              <p>No results found for "{query}"</p>
            </div>
          )}
          {!searching && searchResults.length === 0 && !query && (
            <div className="empty-state">
              <span className="material-symbols-outlined icon">extension</span>
              <h3>Search for mods and plugins</h3>
              <p>Search Modrinth for mods compatible with {server.loader} {server.version}</p>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ width: 300, display: 'flex', flexDirection: 'column' }}>
        <div className="card-header">
          <span className="card-title">{t('server.installedMods')}</span>
          <span className="text-sm text-muted">{installedMods.length} mods</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {installedMods.length === 0 ? (
            <div className="empty-state" style={{ padding: 30 }}>
              <span className="material-symbols-outlined icon">extension_off</span>
              <p>{t('server.noMods')}</p>
            </div>
          ) : (
            <div className="file-browser">
              {installedMods.map(mod => (
                <div key={mod.name} className="file-item">
                  <span className="material-symbols-outlined" style={{ color: 'var(--accent-info)' }}>extension</span>
                  <span className="file-name truncate">{mod.name}</span>
                  <span className="file-size">{(mod.size / 1024 / 1024).toFixed(1)}MB</span>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleDeleteMod(mod.path)}
                    style={{ color: 'var(--accent-error)' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {installProgress.visible && (
        <InstallProgress
          title={`Installing ${installProgress.steps.find(s => s.id === 'download')?.detail?.split(' ')[0] || 'Mod'}`}
          steps={installProgress.steps}
          showActions={installProgress.showActions}
          needsRestartApproval={installProgress.needsRestartApproval}
          onApproveRestart={installProgress.onApprove}
          onDenyRestart={installProgress.onDeny}
          onClose={closeInstallProgress}
          onEditConfig={openConfig}
        />
      )}
    </div>
  );
}

function ConfigView({ id }: { id: string }) {
  const { t } = useTranslation();
  const [currentDir, setCurrentDir] = useState('');
  const [files, setFiles] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [isBinary, setIsBinary] = useState(false);
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>([]);

  useEffect(() => {
    loadFiles();
  }, [id, currentDir]);

  const loadFiles = async () => {
    if (!window.electronAPI) return;
    const list = await window.electronAPI.listFiles(id, currentDir || undefined);
    setFiles(list);
    const parts = currentDir ? currentDir.split('/').filter(Boolean) : [];
    setBreadcrumbs(parts);
  };

  const navigateDir = (dir: string) => {
    if (dir === '..') {
      const parts = currentDir.split('/').filter(Boolean);
      parts.pop();
      setCurrentDir(parts.join('/'));
    } else {
      setCurrentDir(dir);
    }
    setSelectedFile(null);
  };

  const openFile = async (filePath: string) => {
    if (!window.electronAPI) return;
    setSelectedFile(filePath);
    try {
      const result = await window.electronAPI.readFile(id, filePath);
      setFileContent(result.content);
      setIsBinary(result.isBinary);
    } catch {
      setFileContent('// Error reading file');
      setIsBinary(false);
    }
  };

  const saveFile = async () => {
    if (!selectedFile || !window.electronAPI) return;
    await window.electronAPI.writeFile(id, selectedFile, fileContent);
  };

  const deleteFile = async (filePath: string) => {
    if (!window.electronAPI) return;
    await window.electronAPI.deleteFile(id, filePath);
    if (selectedFile === filePath) {
      setSelectedFile(null);
      setFileContent('');
    }
    loadFiles();
  };

  const goUp = () => {
    if (breadcrumbs.length === 0) return;
    const parts = currentDir.split('/').filter(Boolean);
    parts.pop();
    setCurrentDir(parts.join('/'));
  };

  return (
    <div className="flex gap-16" style={{ height: 'calc(100vh - 200px)' }}>
      <div className="card" style={{ width: 320, display: 'flex', flexDirection: 'column' }}>
        <div className="card-header">
          <span className="card-title">{t('server.configTitle')}</span>
        </div>
        <div className="flex items-center gap-4 mb-8" style={{ padding: '0 0 8px', borderBottom: '1px solid var(--border-color)', fontSize: 12 }}>
          <span style={{ cursor: 'pointer', color: 'var(--accent-primary)' }} onClick={() => { setCurrentDir(''); setSelectedFile(null); }}>root</span>
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={i}>
              <span style={{ color: 'var(--text-muted)' }}>/</span>
              <span
                style={{ cursor: 'pointer', color: 'var(--accent-primary)' }}
                onClick={() => {
                  const parts = breadcrumbs.slice(0, i + 1);
                  setCurrentDir(parts.join('/'));
                  setSelectedFile(null);
                }}
              >
                {crumb}
              </span>
            </React.Fragment>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {files.length === 0 ? (
            <div className="empty-state" style={{ padding: 30 }}>
              <span className="material-symbols-outlined icon">folder_off</span>
              <p>{t('server.configEmpty')}</p>
            </div>
          ) : (
            <div className="file-browser">
              {breadcrumbs.length > 0 && (
                <div className="file-item" onClick={goUp}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--accent-warning)' }}>folder</span>
                  <span className="file-name" style={{ color: 'var(--accent-primary)' }}>..</span>
                </div>
              )}
              {files.map(file => (
                <div
                  key={file.path}
                  className="file-item"
                  onClick={() => file.isDirectory ? navigateDir(file.path) : openFile(file.path)}
                  style={{ background: selectedFile === file.path ? 'var(--bg-surface)' : undefined }}
                >
                  <span className="material-symbols-outlined" style={{
                    color: file.isDirectory ? 'var(--accent-warning)' : file.name.endsWith('.properties') ? 'var(--accent-info)' : 'var(--text-muted)',
                    fontSize: 18,
                  }}>
                    {file.isDirectory ? 'folder' : 'description'}
                  </span>
                  <span className="file-name truncate">{file.name}</span>
                  <span className="file-size">{file.isDirectory ? '' : (file.size / 1024).toFixed(1) + 'KB'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedFile && !isBinary && (
        <div className="card flex-1" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <span className="card-title">{t('server.fileEditor')}: {selectedFile}</span>
            <div className="flex gap-8">
              <button className="btn btn-primary btn-sm" onClick={saveFile}>
                <span className="material-symbols-outlined icon-sm">save</span>
                {t('server.save')}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => deleteFile(selectedFile)} style={{ color: 'var(--accent-error)' }}>
                <span className="material-symbols-outlined icon-sm">delete</span>
                {t('server.delete')}
              </button>
            </div>
          </div>
          <textarea
            className="textarea"
            value={fileContent}
            onChange={e => setFileContent(e.target.value)}
            style={{ flex: 1, minHeight: 300, fontFamily: 'var(--font-mono)', fontSize: 12 }}
          />
        </div>
      )}

      {selectedFile && isBinary && (
        <div className="card flex-1 flex items-center justify-center">
          <div className="text-center">
            <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--text-muted)', marginBottom: 12 }}>warning</span>
            <p className="text-muted">Binary file cannot be edited here</p>
          </div>
        </div>
      )}
    </div>
  );
}

function AdvancedView({ id, server, navigate }: { id: string; server: any; navigate: any }) {
  const { t } = useTranslation();
  const [jvmArgs, setJvmArgs] = useState('');
  const [tunnelUrl, setTunnelUrl] = useState('');
  const [tunnelStatus, setTunnelStatus] = useState('stopped');
  const [tunnelStarting, setTunnelStarting] = useState(false);
  const [safeStop, setSafeStop] = useState(true);

  useEffect(() => {
    loadJvm();
    loadTunnel();
  }, [id]);

  const loadJvm = async () => {
    if (!window.electronAPI) return;
    const args = await window.electronAPI.getJVMArgs(id);
    setJvmArgs(args);
  };

  const loadTunnel = async () => {
    if (!window.electronAPI) return;
    const status = await window.electronAPI.getTunnelStatus(id);
    setTunnelStatus(status.status);
    setTunnelUrl(status.url || '');
  };

  const saveJvm = async () => {
    if (!window.electronAPI) return;
    await window.electronAPI.setJVMArgs(id, jvmArgs);
  };

  const startTunnel = async () => {
    if (!window.electronAPI) return;
    setTunnelStarting(true);
    const result = await window.electronAPI.startTunnel(id, server.port);
    if (result.success && result.url) {
      setTunnelUrl(result.url);
      setTunnelStatus('running');
    }
    setTunnelStarting(false);
  };

  const stopTunnel = async () => {
    if (!window.electronAPI) return;
    await window.electronAPI.stopTunnel(id);
    setTunnelStatus('stopped');
    setTunnelUrl('');
  };

  return (
    <div className="flex flex-col gap-16" style={{ maxWidth: 700 }}>
      <div className="card">
        <div className="card-header">
          <span className="card-title">{t('server.jvmArgs')}</span>
        </div>
        <p className="text-sm text-muted mb-16">{t('server.jvmArgsDesc')}</p>
        <div className="alert alert-warning mb-16">
          <span className="material-symbols-outlined icon-sm">warning</span>
          <span>{t('server.jvmWarning')}</span>
        </div>
        <textarea
          className="textarea"
          value={jvmArgs}
          onChange={e => setJvmArgs(e.target.value)}
          placeholder={t('server.jvmPlaceholder')}
          style={{ minHeight: 80, fontFamily: 'var(--font-mono)', fontSize: 12 }}
        />
        <button className="btn btn-primary btn-sm mt-8" onClick={saveJvm}>
          <span className="material-symbols-outlined icon-sm">save</span>
          {t('server.save')}
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">{t('server.tunnelSection')}</span>
        </div>
        <div className="flex items-center gap-12 mb-16">
          <span className="material-symbols-outlined" style={{ color: tunnelStatus === 'running' ? 'var(--accent-success)' : 'var(--text-muted)' }}>
            public
          </span>
          <div>
            {tunnelStatus === 'running' && tunnelUrl ? (
              <span style={{ color: 'var(--accent-success)', fontWeight: 500 }}>
                {t('server.tunnelActive', { url: tunnelUrl })}
              </span>
            ) : (
              <span className="text-muted">{t('server.tunnelInactive')}</span>
            )}
          </div>
        </div>
        {tunnelStatus === 'running' ? (
          <button className="btn btn-danger btn-sm" onClick={stopTunnel}>
            <span className="material-symbols-outlined icon-sm">link_off</span>
            {t('server.tunnelStop')}
          </button>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={startTunnel} disabled={tunnelStarting}>
            {tunnelStarting ? (
              <><div className="spinner" style={{ width: 14, height: 14 }} /> Starting...</>
            ) : (
              <><span className="material-symbols-outlined icon-sm">link</span>{t('server.tunnelStart')}</>
            )}
          </button>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">{t('server.safeStop')}</span>
        </div>
        <p className="text-sm text-muted mb-16">{t('server.safeStopDesc')}</p>
        <div className="alert alert-info">
          <span className="material-symbols-outlined icon-sm">info</span>
          <span>{t('server.safeStopEnabled')}</span>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">{t('server.rawFiles')}</span>
        </div>
        <p className="text-sm text-muted mb-16">{t('server.rawFilesDesc')}</p>
        <div className="alert alert-warning mb-16">
          <span className="material-symbols-outlined icon-sm">warning</span>
          <span>{t('server.rawFilesWarning')}</span>
        </div>
        <button className="btn btn-ghost" onClick={() => {
          const configTab = document.querySelector('.tab:nth-child(5)') as HTMLElement;
          if (configTab) configTab.click();
        }}>
          <span className="material-symbols-outlined icon-sm">folder_open</span>
          {t('server.config')}
        </button>
      </div>

      <div className="card" style={{ borderColor: 'rgba(239,83,80,0.3)' }}>
        <div className="card-header">
          <span className="card-title" style={{ color: 'var(--accent-error)' }}>Delete Server</span>
        </div>
        <p className="text-sm text-muted mb-16">
          Permanently delete this server and all its files. This action cannot be undone.
        </p>
        <button
          className="btn btn-danger"
          onClick={async () => {
            if (window.electronAPI) {
              const confirmed = confirm('Are you sure you want to delete this server? All files, worlds, and configurations will be permanently removed.');
              if (confirmed) {
                await window.electronAPI.deleteServer(id);
                navigate('/');
              }
            }
          }}
        >
          <span className="material-symbols-outlined icon-sm">delete_forever</span>
          Delete Server
        </button>
      </div>
    </div>
  );
}
