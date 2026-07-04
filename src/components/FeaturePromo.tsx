import React, { useEffect, useState } from 'react';

interface FeatureDef {
  id: string;
  version: string;
  title: string;
  description: string;
  type: 'info' | 'config';
  configKey?: string;
  defaultValue?: any;
  options?: { label: string; value: any }[];
}

export default function FeaturePromo() {
  const [features, setFeatures] = useState<FeatureDef[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [configValues, setConfigValues] = useState<Record<string, any>>({});
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!window.electronAPI) { setLoading(false); return; }
    window.electronAPI.getNewFeatures().then(r => {
      if (r.features && r.features.length > 0) {
        const config: Record<string, any> = {};
        for (const f of r.features) {
          if (f.configKey) config[f.configKey] = f.defaultValue;
        }
        setConfigValues(config);
        setFeatures(r.features);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading || done || features.length === 0) return null;

  const current = features[currentIdx];

  const handleAck = async () => {
    if (current.configKey) {
      const val = configValues[current.configKey];
      if (val !== undefined) {
        await window.electronAPI?.setFeatureConfig(current.configKey, val);
      }
    }
    await window.electronAPI?.acknowledgeFeature(current.id);
    if (currentIdx < features.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      setDone(true);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.6)',
    }}>
      <div style={{
        backgroundColor: '#1a1a2e',
        borderRadius: 12, padding: 32, maxWidth: 480, width: '90%',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
          New in v{current.version}
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 12px 0' }}>{current.title}</h2>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, margin: '0 0 20px 0' }}>
          {current.description}
        </p>
        {current.type === 'config' && current.configKey && current.configKey in configValues && (
          <div style={{ marginBottom: 20 }}>
            {current.options ? (
              <select
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8,
                  backgroundColor: '#0f0f0f', color: '#fff', border: '1px solid rgba(255,255,255,0.12)',
                  fontSize: 14,
                }}
                value={configValues[current.configKey]}
                onChange={e => {
                  const ck = current.configKey!;
                  setConfigValues(v => ({ ...v, [ck]: e.target.value }));
                }}
              >
                {current.options.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : (
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={configValues[current.configKey]}
                  onChange={e => {
                    const ck = current.configKey!;
                    setConfigValues(v => ({ ...v, [ck]: e.target.checked }));
                  }}
                  style={{ width: 18, height: 18 }}
                />
                Enable this feature
              </label>
            )}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
            {currentIdx + 1} / {features.length}
          </div>
          <button
            onClick={handleAck}
            style={{
              padding: '10px 24px', borderRadius: 8, border: 'none',
              backgroundColor: 'var(--accent-primary, #4a9eff)', color: '#fff',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {currentIdx < features.length - 1 ? 'Next' : 'Got it!'}
          </button>
        </div>
      </div>
    </div>
  );
}
