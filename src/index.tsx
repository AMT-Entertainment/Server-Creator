import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './i18n';
import App from './App';
import './styles/global.css';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crashed:', error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100vh', background: '#0f0f0f', color: '#e0e0e0', fontFamily: 'Inter, sans-serif',
          padding: 40, textAlign: 'center',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#ef5350', marginBottom: 16 }}>error</span>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ color: '#707070', fontSize: 13, marginBottom: 24, maxWidth: 400 }}>
            {this.state.error}
          </p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Restart App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <HashRouter>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </HashRouter>
);
