import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface ServerConfig {
  id: string;
  name: string;
  loader: string;
  version: string;
  port: number;
  maxPlayers: number;
  motd: string;
  gamemode: string;
  difficulty: string;
  ram: number;
  icon?: string;
  tunnelEnabled: boolean;
  autoRestart: boolean;
}

interface HomeProps {
  servers: ServerConfig[];
  onServersChange: () => void;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  running: { label: 'Running', className: 'badge-running' },
  stopped: { label: 'Stopped', className: 'badge-stopped' },
  starting: { label: 'Starting', className: 'badge-starting' },
  stopping: { label: 'Stopping', className: 'badge-stopping' },
  crashed: { label: 'Crashed', className: 'badge-crashed' },
};

export default function Home({ servers, onServersChange }: HomeProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [serverStatuses, setServerStatuses] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    const checkStatuses = async () => {
      if (!window.electronAPI) return;
      const statuses: Record<string, string> = {};
      for (const server of servers) {
        try {
          const status = await window.electronAPI.getServerStatus(server.id);
          statuses[server.id] = status.status;
        } catch {
          statuses[server.id] = 'stopped';
        }
      }
      setServerStatuses(statuses);
    };

    checkStatuses();
    const interval = setInterval(checkStatuses, 5000);
    return () => clearInterval(interval);
  }, [servers]);

  React.useEffect(() => {
    if (!window.electronAPI) return;
    const unsub = window.electronAPI.onServerStatusChanged((id, status) => {
      setServerStatuses(prev => ({ ...prev, [id]: status }));
    });
    return unsub;
  }, []);

  const getStatusLabel = (id: string) => {
    const status = serverStatuses[id] || 'stopped';
    return t(`home.status.${status}`);
  };

  const getStatusClass = (id: string) => {
    const status = serverStatuses[id] || 'stopped';
    return `badge ${statusConfig[status]?.className || 'badge-stopped'}`;
  };

  const loaderIcons: Record<string, string> = {
    vanilla: 'stadia_controller',
    paper: 'description',
    fabric: 'nightlight',
    forge: 'build',
    spigot: 'extension',
    purpur: 'diamond',
    neoforge: 'neurology',
  };

  return (
    <div className="page-content">
      <div className="flex items-center justify-between mb-16">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>{t('home.title')}</h1>
          <p className="text-muted text-sm mt-8">
            {servers.length > 0
              ? t('home.serverCount', { count: servers.length })
              : t('home.noServers')}
          </p>
        </div>
        <button className="btn btn-primary btn-lg" onClick={() => navigate('/setup')}>
          <span className="material-symbols-outlined">add</span>
          {t('home.createServer')}
        </button>
      </div>

      {servers.length === 0 ? (
        <div className="empty-state fade-in">
          <span className="material-symbols-outlined icon">dns</span>
          <h3>{t('home.noServers')}</h3>
          <p>{t('home.noServersDesc')}</p>
          <button
            className="btn btn-primary btn-lg mt-24"
            onClick={() => navigate('/setup')}
          >
            <span className="material-symbols-outlined">add</span>
            {t('home.createServer')}
          </button>
        </div>
      ) : (
        <div className="grid">
          {servers.map(server => (
            <div
              key={server.id}
              className="card server-card fade-in"
              onClick={() => navigate(`/server/${server.id}`)}
            >
              <div className="server-card-header">
                <div className="server-icon">
                  {server.icon ? (
                    <img src={server.icon} alt={server.name} />
                  ) : (
                    <span className="material-symbols-outlined default-icon">
                      {loaderIcons[server.loader] || 'dns'}
                    </span>
                  )}
                </div>
                <div className="server-info">
                  <div className="server-name truncate">{server.name}</div>
                  <div className="server-meta">
                    {server.loader} {server.version}
                  </div>
                </div>
                <span className={getStatusClass(server.id)}>
                  {getStatusLabel(server.id)}
                </span>
              </div>
              <div className="server-stats">
                <div className="server-stat">
                  <span className="material-symbols-outlined icon">cable</span>
                  <span>Port {server.port}</span>
                </div>
                <div className="server-stat">
                  <span className="material-symbols-outlined icon">memory</span>
                  <span>{server.ram}GB</span>
                </div>
                <div className="server-stat">
                  <span className="material-symbols-outlined icon">groups</span>
                  <span>{server.maxPlayers}</span>
                </div>
                {server.tunnelEnabled && (
                  <div className="server-stat" style={{ color: 'var(--accent-success)' }}>
                    <span className="material-symbols-outlined icon">public</span>
                    <span>Tunnel</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
