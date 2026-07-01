import React from 'react';
import { useTranslation } from 'react-i18next';

export default function Settings() {
  const { t, i18n } = useTranslation();

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
            <span>1.0.0</span>
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
    </div>
  );
}
