import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div style={{
        minHeight: '100vh', background: '#080c14', color: '#f87171',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', padding: 32, fontFamily: 'monospace',
      }}>
        <h2 style={{ color: '#fbbf24', marginBottom: 16, fontFamily: 'system-ui' }}>
          ⚠ Erro de renderização
        </h2>
        <pre style={{
          background: '#0d1220', border: '1px solid rgba(248,113,113,0.3)',
          borderRadius: 8, padding: 20, maxWidth: 800, width: '100%',
          overflowX: 'auto', fontSize: 13, color: '#fca5a5', lineHeight: 1.6,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {error.message}
          {'\n\n'}
          {error.stack}
        </pre>
        <button
          onClick={() => this.setState({ error: null })}
          style={{
            marginTop: 20, padding: '10px 20px', background: '#1e3a5f',
            border: '1px solid #3b82f6', borderRadius: 8, color: '#93c5fd',
            cursor: 'pointer', fontSize: 14,
          }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }
}
