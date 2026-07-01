import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

interface ToastData {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface ToastContextType {
  showToast: (message: string, type?: ToastData['type']) => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const idRef = useRef(0);

  const showToast = useCallback((message: string, type: ToastData['type'] = 'info') => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding: '12px 20px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            color: '#fff',
            background: t.type === 'error' ? 'var(--accent-danger, #e53935)' :
                        t.type === 'warning' ? 'var(--accent-warning, #ff9800)' :
                        t.type === 'success' ? 'var(--accent-success, #43a047)' :
                        'var(--accent-info, #29b6f6)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            pointerEvents: 'auto',
            animation: 'toast-in 0.3s ease',
            maxWidth: 360,
          }}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
