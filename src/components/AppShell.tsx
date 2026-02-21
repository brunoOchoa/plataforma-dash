import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Building2, Bot, Shield, Settings,
  LogOut, Bell, X, Zap, ChevronRight, ChevronDown, Menu, FolderOpen, BookOpen,
  Sun, Moon, Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import { useTheme } from '../context/ThemeContext';

/* ── helpers ── */
function getInitials(name: string) {
  return name.split('@')[0].split('.').map(p => p[0]?.toUpperCase() ?? '').join('').slice(0, 2);
}

/* ── NavItem ── */
function NavItem({ icon: Icon, label, active, onClick }: {
  icon: React.ElementType; label: string; active?: boolean; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className={`nav-item ${active ? 'active' : ''}`}>
      <Icon size={16} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{label}</span>
      {!active && <ChevronRight size={12} style={{ opacity: 0.3 }} />}
    </button>
  );
}

/* ── CompanySelector — dropdown customizado para usuários HITSS ── */
function CompanySelector() {
  const { selectedCompany, setSelectedCompany, companies } = useCompany();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (company: { id: string; name: string } | null) => {
    setSelectedCompany(company);
    setOpen(false);
  };

  const label = selectedCompany?.name ?? 'Todas Empresas';

  return (
    <div className="company-selector-wrap cs-custom" ref={ref} onClick={() => setOpen(o => !o)}>
      <Building2 size={14} color="#475569" style={{ flexShrink: 0 }} />
      <span className="cs-label">{label}</span>
      <ChevronDown size={12} className={`cs-chevron ${open ? 'open' : ''}`} />

      {open && (
        <div className="cs-dropdown" onClick={e => e.stopPropagation()}>
          {/* Todas empresas */}
          <div
            className={`cs-option ${!selectedCompany ? 'active' : ''}`}
            onClick={() => select(null)}
          >
            <span>Todas Empresas</span>
            {!selectedCompany && <Check size={12} />}
          </div>

          {companies.length > 0 && <div className="cs-divider" />}

          {companies.map(c => (
            <div
              key={c.id}
              className={`cs-option ${selectedCompany?.id === c.id ? 'active' : ''}`}
              onClick={() => select(c)}
            >
              <span>{c.name}</span>
              {selectedCompany?.id === c.id && <Check size={12} />}
            </div>
          ))}

          {companies.length === 0 && (
            <div className="cs-empty">Carregando empresas…</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── CustomerCompanyBadge — empresa fixa para usuários cliente ── */
function CustomerCompanyBadge() {
  const { selectedCompany } = useCompany();
  if (!selectedCompany) return null;
  return (
    <div className="company-selector-wrap" style={{ cursor: 'default', pointerEvents: 'none' }}>
      <Building2 size={14} color="#475569" style={{ flexShrink: 0 }} />
      <span style={{
        fontSize: 13, fontWeight: 500,
        color: 'var(--text-primary)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        maxWidth: 160,
      }}>
        {selectedCompany.name}
      </span>
    </div>
  );
}

/* ════════════════════════════════════════
   APP SHELL — layout compartilhado
════════════════════════════════════════ */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // hydrating: ProtectedRoute já cuida do caso não-autenticado;
  // aqui user nunca deve ser null, mas mantemos a guarda como fallback.
  if (!user) return null;

  const displayName = user.name || user.email || 'Usuário';
  const firstName   = displayName.split('@')[0].split('.')[0];
  const initials    = getInitials(displayName);
  const isHitss     = user.is_user_hitss;
  const isCustomer  = user.type === 'customer';

  const handleLogout = () => { logout(); navigate('/login'); };

  /* Resolve qual é a página atual para breadcrumb e active no nav */
  const path = location.pathname;
  const pageLabel =
    path.startsWith('/users')            ? 'Usuários' :
    path.startsWith('/companies')        ? 'Empresas' :
    path.startsWith('/departments')      ? 'Departamentos' :
    path.startsWith('/knowledge-bases')  ? 'Base de Conhecimento' :
    path.startsWith('/permissions')      ? 'Permissões' :
    path.startsWith('/bots')             ? 'Bots'     :
    path.startsWith('/settings')         ? 'Configurações' :
    'Dashboard';

  const navTo = (to: string) => {
    navigate(to);
    setSidebarOpen(false);
  };

  return (
    <div className="app-shell">

      {/* Mobile overlay */}
      <div
        className={`mobile-overlay ${sidebarOpen ? 'visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* ══════════════════
          SIDEBAR
      ══════════════════ */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>

        {/* Brand */}
        <div className="sidebar-brand">
          <div className="avatar" style={{ width: 32, height: 32, fontSize: 13, borderRadius: 10 }}>
            <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
              <rect x="4"  y="4"  width="10" height="10" rx="2" fill="white" fillOpacity="0.95"/>
              <rect x="18" y="4"  width="10" height="10" rx="2" fill="white" fillOpacity="0.55"/>
              <rect x="4"  y="18" width="10" height="10" rx="2" fill="white" fillOpacity="0.55"/>
              <rect x="18" y="18" width="10" height="10" rx="2" fill="white" fillOpacity="0.2"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>Plataforma</p>
            <p style={{ fontSize: 11, color: 'var(--text-nav-label)' }}>v3 · {pageLabel}</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="sidebar-close-btn"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <p className="nav-section-label">Principal</p>
          <NavItem
            icon={LayoutDashboard}
            label="Dashboard"
            active={path === '/dashboard'}
            onClick={() => navTo('/dashboard')}
          />

          <p className="nav-section-label">Gestão</p>
          {isHitss && !isCustomer && (
            <NavItem
              icon={Building2}
              label="Empresas"
              active={path.startsWith('/companies')}
              onClick={() => navTo('/companies')}
            />
          )}
          <NavItem
            icon={FolderOpen}
            label="Departamentos"
            active={path.startsWith('/departments')}
            onClick={() => navTo('/departments')}
          />
          <NavItem
            icon={BookOpen}
            label="Base de Conhecimento"
            active={path.startsWith('/knowledge-bases')}
            onClick={() => navTo('/knowledge-bases')}
          />
          <NavItem
            icon={Users}
            label="Usuários"
            active={path.startsWith('/users')}
            onClick={() => navTo('/users')}
          />
          {!isCustomer && (
            <NavItem
              icon={Shield}
              label="Permissões"
              active={path.startsWith('/permissions')}
              onClick={() => navTo('/permissions')}
            />
          )}
          <NavItem
            icon={Bot}
            label="Bots"
            active={path.startsWith('/bots')}
            onClick={() => navTo('/bots')}
          />

          <p className="nav-section-label">Sistema</p>
          <NavItem
            icon={Settings}
            label="Configurações"
            active={path.startsWith('/settings')}
            onClick={() => navTo('/settings')}
          />
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{firstName}</p>
              <p style={{ fontSize: 11, color: 'var(--text-nav-label)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '10px 12px', borderRadius: 10,
              fontSize: 13, fontWeight: 500, color: '#64748b',
              background: 'none', border: 'none', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171'; (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#64748b'; (e.currentTarget as HTMLElement).style.background = 'none'; }}
          >
            <LogOut size={15} />
            Sair da conta
          </button>
        </div>
      </aside>

      {/* ══════════════════
          MAIN AREA
      ══════════════════ */}
      <div className="main-area">

        {/* Topbar */}
        <header className="topbar">
          <button
            onClick={() => setSidebarOpen(true)}
            className="mobile-menu-btn"
          >
            <Menu size={19} />
          </button>

          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <span className="topbar-breadcrumb-sep">Plataforma</span>
            <ChevronRight size={12} style={{ color: 'var(--border-input)', flexShrink: 0 }} />
            <span className="topbar-breadcrumb-page">{pageLabel}</span>
          </div>

          {/* Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>

            {/* ── Empresa: dropdown para HITSS sistema, badge fixo para cliente ── */}
            {isHitss && !isCustomer && <CompanySelector />}
            {isCustomer             && <CustomerCompanyBadge />}

            {/* Bell */}
            <button className="topbar-bell" style={{
              position: 'relative', width: 34, height: 34,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
              borderRadius: 9, transition: 'all 0.15s',
            }}>
              <Bell size={16} />
              <span style={{
                position: 'absolute', top: 8, right: 8,
                width: 5, height: 5, background: '#3b82f6',
                borderRadius: '50%', border: '2px solid var(--bg-body)',
              }} />
            </button>

            {/* Theme toggle */}
            <button
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* User pill */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="user-pill"
              >
                <div className="avatar" style={{ width: 24, height: 24, fontSize: 10, borderRadius: 7 }}>{initials}</div>
                <span className="user-pill-name">{firstName}</span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: 'var(--text-faint)' }}>
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {userMenuOpen && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 90 }}
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="dropdown">
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <p className="dropdown-username" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</p>
                      <p className="dropdown-usertype">
                        {user.type === 'system' ? 'Usuário Sistema' : 'Usuário Cliente'}
                        {isHitss && !isCustomer && (
                          <span style={{ marginLeft: 6, color: '#60a5fa' }}>
                            <Zap size={9} style={{ display: 'inline', marginRight: 3 }} />HITSS
                          </span>
                        )}
                      </p>
                    </div>
                    <div style={{ padding: 8 }}>
                      <button
                        onClick={handleLogout}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                          padding: '10px 12px', borderRadius: 10, fontSize: 13,
                          color: '#f87171', background: 'none', border: 'none',
                          cursor: 'pointer', transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                      >
                        <LogOut size={14} />
                        Sair da conta
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content — injected via children */}
        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
}
