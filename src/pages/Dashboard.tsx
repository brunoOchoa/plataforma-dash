import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, BadgeCheck, Clock, Key,
  UserCircle2, Zap, Copy, CheckCheck,
  ChevronRight, Fingerprint, ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AppShell from '../components/AppShell';

/* ── helpers ── */
function formatExpiry(ms: number) {
  const h = Math.floor(ms / 3_600_000);
  return h >= 24 ? `${Math.floor(h / 24)}d` : `${h}h`;
}
function getInitials(name: string) {
  return name.split('@')[0].split('.').map(p => p[0]?.toUpperCase() ?? '').join('').slice(0, 2);
}
function useClipboard() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };
  return { copied, copy };
}

/* ── StatCard ── */
function StatCard({ icon: Icon, label, value, sub, colorClass }: {
  icon: React.ElementType; label: string; value: string; sub?: string; colorClass: string;
}) {
  return (
    <div className={`stat-card ${colorClass}`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="stat-card-icon"><Icon size={18} color="rgba(255,255,255,0.9)" /></div>
        <ArrowUpRight size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />
      </div>
      <div>
        <div className="stat-card-value">{value}</div>
        {sub && <div className="stat-card-sub">{sub}</div>}
      </div>
      <div className="stat-card-label">{label}</div>
    </div>
  );
}

/* ── KVRow ── */
function KVRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="kv-row">
      <span className="kv-label">{label}</span>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>{children}</div>
    </div>
  );
}

/* ── Pill ── */
function Pill({ children, color }: { children: React.ReactNode; color: 'blue' | 'green' | 'amber' | 'gray' }) {
  return <span className={`pill pill-${color}`}>{children}</span>;
}

/* ── TokenBox ── */
function TokenBox({ label, value, copyKey, copied, onCopy }: {
  label: string; value: string; copyKey: string; copied: string | null;
  onCopy: (v: string, k: string) => void;
}) {
  const ok = copied === copyKey;
  return (
    <div>
      <div className="token-label-row">
        <span className="token-label">{label}</span>
        <button onClick={() => onCopy(value, copyKey)} className={`token-copy-btn ${ok ? 'copied' : ''}`}>
          {ok ? <CheckCheck size={11} /> : <Copy size={11} />}
          {ok ? 'Copiado!' : 'Copiar'}
        </button>
      </div>
      <div className="token-value">{value.slice(0, 80)}<span style={{ opacity: 0.3 }}>…</span></div>
    </div>
  );
}

/* ══════════════════════════════════
   DASHBOARD PAGE
══════════════════════════════════ */
export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { copied, copy } = useClipboard();

  if (!user) return null;

  const displayName = user.name || user.email || 'Usuário';
  const firstName   = displayName.split('@')[0].split('.')[0];
  const initials    = getInitials(displayName);
  const isHitss     = user.is_user_hitss;
  const expiry      = formatExpiry(user.expires_in);
  const loginAt     = new Date().toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  // logout is handled inside AppShell too, but keep here for the welcome banner nav
  void logout; void navigate;

  return (
    <AppShell>
      <div className="page-inner">

        {/* Welcome banner */}
        <div className="welcome-banner">
          <div
            style={{
              position: 'absolute', top: -60, right: -60,
              width: 240, height: 240,
              background: 'rgba(59,130,246,0.08)',
              borderRadius: '50%', filter: 'blur(60px)',
              pointerEvents: 'none',
            }}
          />
          <div className="avatar" style={{ width: 52, height: 52, fontSize: 20, borderRadius: 14, boxShadow: '0 8px 24px rgba(59,130,246,0.3)' }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>Olá, {firstName}! 👋</h1>
              {isHitss && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 11, fontWeight: 700, color: '#93c5fd',
                  background: 'rgba(59,130,246,0.12)',
                  border: '1px solid rgba(59,130,246,0.25)',
                  padding: '3px 10px', borderRadius: 999,
                }}>
                  <Zap size={10} /> HITSS
                </span>
              )}
            </div>
            <p style={{ fontSize: 13, color: '#64748b' }}>
              Bem-vindo ao painel da Plataforma v3 — sessão iniciada em {loginAt}.
            </p>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.2)',
            borderRadius: 10, padding: '8px 14px', flexShrink: 0,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: '#34d399', animation: 'pulse 2s infinite',
            }} />
            <span style={{ fontSize: 13, color: '#6ee7b7', fontWeight: 500 }}>Online</span>
          </div>
        </div>

        {/* Stat cards */}
        <div className="stats-grid">
          <StatCard icon={UserCircle2} label="Tipo de acesso"   value={user.type === 'system' ? 'Sistema' : 'Cliente'} colorClass="stat-blue" />
          <StatCard icon={Key}         label="Token válido"      value={expiry} sub="a partir do login"               colorClass="stat-violet" />
          <StatCard icon={BadgeCheck}  label="Conta HITSS"       value={isHitss ? 'Sim' : 'Não'}                      colorClass={isHitss ? 'stat-green' : 'stat-slate'} />
          <StatCard icon={Clock}       label="Status da sessão"  value="Online" sub={loginAt}                          colorClass="stat-green" />
        </div>

        {/* Info + Token */}
        <div className="info-grid">

          {/* Dados da sessão */}
          <div className="info-card">
            <div className="info-card-header">
              <div className="info-card-icon" style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)' }}>
                <UserCircle2 size={15} color="#60a5fa" />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>Dados da Sessão</p>
                <p style={{ fontSize: 11, color: '#3a4563' }}>Informações do usuário autenticado</p>
              </div>
            </div>
            <div className="info-card-body">
              <KVRow label="ID do usuário">
                <span className="kv-mono" title={user.id}>{user.id.split('-')[0]}<span style={{ opacity: 0.3 }}>…</span></span>
              </KVRow>
              <KVRow label="E-mail / Usuário">
                <span className="kv-value">{user.email}</span>
              </KVRow>
              <KVRow label="Tipo de acesso">
                <Pill color="blue">{user.type === 'system' ? 'Sistema' : 'Cliente'}</Pill>
              </KVRow>
              <KVRow label="Conta HITSS">
                <Pill color={isHitss ? 'green' : 'gray'}>{isHitss ? '✓ Verificado' : 'Não'}</Pill>
              </KVRow>
              <KVRow label="Troca de senha">
                <Pill color={user.force_change_password ? 'amber' : 'green'}>
                  {user.force_change_password ? '⚠ Requerida' : '✓ OK'}
                </Pill>
              </KVRow>
              <KVRow label="Token válido por">
                <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{expiry}</span>
              </KVRow>
            </div>
          </div>

          {/* Tokens JWT */}
          <div className="info-card">
            <div className="info-card-header">
              <div className="info-card-icon" style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)' }}>
                <Fingerprint size={15} color="#a78bfa" />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>Tokens JWT</p>
                <p style={{ fontSize: 11, color: '#3a4563' }}>Clique em copiar para usar nos testes</p>
              </div>
            </div>
            <div className="token-section">
              <TokenBox label="Access Token"  value={user.token}         copyKey="access"  copied={copied} onCopy={copy} />
              <TokenBox label="Refresh Token" value={user.refresh_token} copyKey="refresh" copied={copied} onCopy={copy} />
              <div className="session-status">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', animation: 'pulse 2s infinite', display: 'block' }} />
                  <span style={{ fontSize: 13, color: '#6ee7b7', fontWeight: 500 }}>Sessão autenticada</span>
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 700, color: '#34d399',
                  background: 'rgba(16,185,129,0.12)',
                  border: '1px solid rgba(16,185,129,0.2)',
                  padding: '4px 10px', borderRadius: 8,
                }}>{expiry}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Quick nav cards */}
        <div className="quick-nav-grid">
          <div className="quick-nav-card" onClick={() => navigate('/users')}>
            <div className="quick-nav-icon" style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)' }}>
              <Activity size={16} color="#60a5fa" />
            </div>
            <div style={{ flex: 1 }}>
              <p className="quick-nav-title">Gerenciar Usuários</p>
              <p className="quick-nav-sub">Criar, editar e remover usuários do sistema e clientes</p>
            </div>
            <ChevronRight size={15} style={{ color: '#3a4563', flexShrink: 0 }} />
          </div>
        </div>

      </div>
    </AppShell>
  );
}
