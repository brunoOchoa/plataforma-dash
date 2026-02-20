import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Loader2, AlertCircle, Zap, ShieldCheck, Bot, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/api';
import type { UserInfo } from '../types/auth';

type LoginType = 'system' | 'customer';

function parseJwtPayload(token: string): Record<string, unknown> {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64));
  } catch { return {}; }
}

const FEATURES = [
  { icon: Users,       text: 'Gestão completa de usuários e clientes' },
  { icon: ShieldCheck, text: 'Controle de permissões e grupos por empresa' },
  { icon: Bot,         text: 'Orquestração de bots com base de conhecimento' },
];

const PlatLogo = () => (
  <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
    <rect x="4"  y="4"  width="10" height="10" rx="2" fill="white" fillOpacity="0.95"/>
    <rect x="18" y="4"  width="10" height="10" rx="2" fill="white" fillOpacity="0.55"/>
    <rect x="4"  y="18" width="10" height="10" rx="2" fill="white" fillOpacity="0.55"/>
    <rect x="18" y="18" width="10" height="10" rx="2" fill="white" fillOpacity="0.2"/>
  </svg>
);

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [loginType, setLoginType]       = useState<LoginType>('system');
  const [username, setUsername]         = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const fn      = loginType === 'system' ? authService.loginSystem : authService.loginCustomer;
      const data    = await fn({ username, password });
      const payload = parseJwtPayload(data.token);
      const userInfo: UserInfo = {
        ...data,
        type:  loginType,
        email: typeof payload.sub === 'string' ? payload.sub : username,
        name:  typeof payload.sub === 'string' ? payload.sub : username,
        // Campos exclusivos do usuário cliente — presentes no JWT claim
        ...(loginType === 'customer' && {
          company_id:   typeof payload.companyId   === 'string' ? payload.companyId   : undefined,
          company_name: typeof payload.companyName === 'string' ? payload.companyName : undefined,
        }),
      };
      localStorage.setItem('refresh_token', data.refresh_token);
      login(userInfo);
      navigate('/dashboard');
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { message?: string; error?: string }; status?: number };
        code?: string; message?: string;
      };
      const s = e.response?.status;
      if (!e.response)                    setError(`Sem resposta da API (${e.code ?? 'ERR_NETWORK'}). Verifique se o servidor está rodando.`);
      else if (s === 401)                 setError('Credenciais inválidas. Verifique seu e-mail e senha.');
      else if (s === 403)                 setError('Acesso negado. Usuário sem permissão.');
      else if (s === 400)                 setError(`Requisição inválida: ${e.response?.data?.message ?? 'verifique os dados.'}`);
      else if (e.response?.data?.message) setError(`Erro ${s}: ${e.response.data.message}`);
      else                                setError(`Erro inesperado (HTTP ${s}). Tente novamente.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">

      {/* ══════════════════════
          PAINEL ESQUERDO
      ══════════════════════ */}
      <div className="login-left">
        <div className="login-glow-1" />
        <div className="login-glow-2" />

        <div className="login-left-inner">
          {/* Brand */}
          <div className="login-brand">
            <div className="login-brand-logo"><PlatLogo /></div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.3 }}>Plataforma</p>
              <p style={{ fontSize: 11, color: '#334155' }}>by HITSS</p>
            </div>
          </div>

          {/* Hero */}
          <div className="login-hero">
            <div className="login-badge">
              <Zap size={10} />
              Plataforma v3
            </div>

            <h1 className="login-headline">
              Gerencie tudo<br />em um só lugar.
            </h1>

            <p className="login-subline">
              Acesse usuários, permissões, bots e base de conhecimento através de um painel centralizado e seguro.
            </p>

            <div className="login-features">
              {FEATURES.map(({ icon: Icon, text }) => (
                <div key={text} className="login-feature-item">
                  <div className="login-feature-icon">
                    <Icon size={15} color="#60a5fa" />
                  </div>
                  <span style={{ fontSize: 14, color: '#64748b' }}>{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p style={{ fontSize: 11, color: '#1e293b' }}>
            HITSS &copy; {new Date().getFullYear()} — Todos os direitos reservados
          </p>
        </div>
      </div>

      {/* ══════════════════════
          PAINEL DIREITO
      ══════════════════════ */}
      <div className="login-right">
        <div className="login-right-glow" />

        <div className="login-form-box">

          {/* Heading */}
          <h2 className="login-title">Entrar na conta</h2>
          <p className="login-subtitle">Insira suas credenciais para acessar o painel</p>

          {/* Switcher */}
          <div className="login-switcher">
            <button
              type="button"
              className={`login-switcher-btn ${loginType === 'system' ? 'active' : ''}`}
              onClick={() => { setLoginType('system'); setError(''); }}
            >
              Sistema
            </button>
            <button
              type="button"
              className={`login-switcher-btn ${loginType === 'customer' ? 'active' : ''}`}
              onClick={() => { setLoginType('customer'); setError(''); }}
            >
              Cliente
            </button>
          </div>

          {/* Erro */}
          {error && (
            <div className="login-error">
              <AlertCircle size={15} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
              <p>{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="login-field">
              <label className="login-label">
                {loginType === 'system' ? 'E-mail ou usuário' : 'E-mail'}
              </label>
              <input
                type="text"
                className="login-input"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder={loginType === 'system' ? 'seu@email.com' : 'cliente@empresa.com'}
                required
                autoComplete="username"
              />
            </div>

            <div className="login-field">
              <label className="login-label">Senha</label>
              <div className="login-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="login-input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="login-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="login-submit" disabled={loading}>
              {loading
                ? <><Loader2 size={16} className="spin" /> Entrando…</>
                : <><LogIn size={16} /> Entrar</>
              }
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: 11, color: '#1e293b', marginTop: 36 }}>
            Plataforma v3 &nbsp;&middot;&nbsp; HITSS &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
