import { useState, useEffect, useCallback } from 'react';
import {
  Search, Shield, ChevronLeft, ChevronRight,
  X, Check, AlertTriangle, RefreshCw, UserCheck,
  ShieldCheck,
} from 'lucide-react';
import { systemUserService, customerUserService } from '../services/userService';
import { systemRoleService, customerRoleService } from '../services/roleService';
import type { SystemUser, CustomerUser, Role, Page } from '../types/user';
import AppShell from '../components/AppShell';

/* ═══════════════════════════════════════
   TOAST
═══════════════════════════════════════ */
interface Toast { id: number; msg: string; type: 'success' | 'error' }
function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);
  return { toasts, push };
}

/* ═══════════════════════════════════════
   ROLE GROUPING
   Usa matching exato por prefixo + '_' para
   evitar que SYSTEM_USER capture SYSTEM_USER_FULL
   quando já foi capturado em outro grupo.
═══════════════════════════════════════ */
type RoleCategory = { label: string; prefix: string; color: string };

// Prefixos terminados em '_' → captura tudo que começa com o prefixo (ex: SYSTEM_USER_FULL)
// Prefixos SEM '_' no final → captura apenas o nome exato (ex: SYSTEM_ANALYTICS)
const SYSTEM_CATEGORIES: RoleCategory[] = [
  { label: 'Admin',     prefix: 'SYSTEM_ADMIN_',    color: 'role-cat-red'    },
  { label: 'Usuários',  prefix: 'SYSTEM_USER_',     color: 'role-cat-blue'   },
  { label: 'Grupos',    prefix: 'SYSTEM_GROUP_',    color: 'role-cat-violet' },
  { label: 'Roles',     prefix: 'SYSTEM_ROLE_',     color: 'role-cat-indigo' },
  { label: 'Analytics', prefix: 'SYSTEM_ANALYTICS', color: 'role-cat-teal'   }, // nome exato
  { label: 'Empresas',  prefix: 'COMPANY_',         color: 'role-cat-orange' },
  { label: 'Bots',      prefix: 'BOT_',             color: 'role-cat-green'  },
];

const CUSTOMER_CATEGORIES: RoleCategory[] = [
  { label: 'Admin',        prefix: 'CUSTOMER_ADMIN_',    color: 'role-cat-red'    },
  { label: 'Usuários',     prefix: 'CUSTOMER_USER_',     color: 'role-cat-blue'   },
  { label: 'Grupos',       prefix: 'CUSTOMER_GROUP_',    color: 'role-cat-violet' },
  { label: 'Roles',        prefix: 'CUSTOMER_ROLE_',     color: 'role-cat-indigo' },
  { label: 'Conhecimento', prefix: 'KNOWLEDGE_BASE_',    color: 'role-cat-teal'   },
  { label: 'Uploads',      prefix: 'UPLOAD_',            color: 'role-cat-orange' },
  { label: 'Bots',         prefix: 'BOT_',               color: 'role-cat-green'  },
  { label: 'Chat History', prefix: 'CHAT_HISTORY_',      color: 'role-cat-pink'   },
  { label: 'Analytics',    prefix: 'CUSTOMER_ANALYTICS', color: 'role-cat-amber'  }, // nome exato
];

function groupRoles(roles: Role[], categories: RoleCategory[]) {
  // 1. deduplica por id antes de qualquer coisa
  const unique = [...new Map(roles.map(r => [r.id, r])).values()];

  const used = new Set<string>();
  const result: { category: RoleCategory; roles: Role[] }[] = [];

  for (const cat of categories) {
    // match: nome começa exatamente com o prefixo (que já termina em '_' ou é exato)
    const matched = unique.filter(r => !used.has(r.id) && (
      cat.prefix.endsWith('_')
        ? r.name.startsWith(cat.prefix)                    // ex: SYSTEM_USER_FULL
        : r.name === cat.prefix || r.name.startsWith(cat.prefix + '_') // ex: SYSTEM_ANALYTICS
    ));
    if (matched.length) {
      matched.forEach(r => used.add(r.id));
      result.push({ category: cat, roles: matched });
    }
  }

  const remaining = unique.filter(r => !used.has(r.id));
  if (remaining.length) {
    result.push({ category: { label: 'Outros', prefix: '', color: 'role-cat-gray' }, roles: remaining });
  }
  return result;
}

// Exibe só o sufixo legível da role
function roleLabel(name: string) {
  const map: Record<string, string> = {
    FULL: 'Full', LISTAR: 'Listar', VISUALIZAR: 'Visualizar',
    CADASTRAR: 'Criar', EDITAR: 'Editar', EXCLUIR: 'Excluir',
    ANALYTICS: 'Analytics',
  };
  const parts = name.split('_');
  const last  = parts[parts.length - 1];
  return map[last] ?? last;
}

/* ═══════════════════════════════════════
   ROLE GROUP — seção plana, sem accordion
═══════════════════════════════════════ */
function RoleGroup({
  category, roles, selected, onToggle, onToggleAll,
}: {
  category: RoleCategory;
  roles: Role[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[]) => void;
}) {
  const ids      = roles.map(r => r.id);
  const selCount = ids.filter(id => selected.has(id)).length;
  const allSel   = selCount === ids.length;
  const someSel  = selCount > 0 && !allSel;

  return (
    <div className="role-group">
      {/* ── cabeçalho da seção ── */}
      <div className="role-group-header">
        <div
          className={`role-group-check ${allSel ? 'all' : someSel ? 'partial' : ''}`}
          onClick={() => onToggleAll(ids)}
          title={allSel ? 'Desmarcar todos' : 'Marcar todos'}
        >
          {allSel
            ? <Check size={10} />
            : someSel
              ? <span style={{ fontSize: 13, lineHeight: 1, fontWeight: 700 }}>–</span>
              : null}
        </div>

        <span className={`role-group-badge ${category.color}`}>{category.label}</span>
        <span className="role-group-count">{selCount} / {roles.length} selecionadas</span>
      </div>

      {/* ── grid de roles (sempre visível, sem overflow) ── */}
      <div className="role-group-items">
        {roles.map(role => {
          const on = selected.has(role.id);
          return (
            <div
              key={role.id}
              className={`role-item ${on ? 'on' : ''}`}
              onClick={() => onToggle(role.id)}
            >
              <div className={`role-checkbox ${on ? 'checked' : ''}`}>
                {on && <Check size={9} />}
              </div>
              <div className="role-item-text">
                <span className="role-name">{roleLabel(role.name)}</span>
                <span className="role-full-name" title={role.name}>{role.name}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   MANAGE ROLES MODAL
═══════════════════════════════════════ */
function ManageRolesModal({
  user, type, allRoles, categories, onClose, onSave,
}: {
  user: SystemUser | CustomerUser;
  type: 'system' | 'customer';
  allRoles: Role[];
  categories: RoleCategory[];
  onClose: () => void;
  onSave: (userId: string, roleIds: string[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(user.roles.map(r => r.id)));
  const [saving, setSaving]     = useState(false);
  const [search, setSearch]     = useState('');

  const filtered = search
    ? allRoles.filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
    : allRoles;

  const grouped = groupRoles(filtered, categories);

  const toggle    = (id: string) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = (ids: string[]) => {
    const allOn = ids.every(id => selected.has(id));
    setSelected(p => { const n = new Set(p); ids.forEach(id => allOn ? n.delete(id) : n.add(id)); return n; });
  };

  const changed = (() => {
    const orig = new Set(user.roles.map(r => r.id));
    if (orig.size !== selected.size) return true;
    for (const id of selected) if (!orig.has(id)) return true;
    return false;
  })();

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(user.id, [...selected]); }
    finally { setSaving(false); }
  };

  const initials  = (user.name || user.email).replace(/[^a-zA-Z\s]/g, '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'US';
  const totalSel  = selected.size;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-roles" onClick={e => e.stopPropagation()}>

        {/* ── header ── */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="user-avatar-sm">{initials}</div>
            <div>
              <h3 style={{ fontSize: 15 }}>{user.name || user.email}</h3>
              <p style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                {type === 'system' ? 'Usuário Sistema' : 'Usuário Cliente'}&nbsp;·&nbsp;
                <span style={{ color: '#60a5fa', fontWeight: 600 }}>
                  {totalSel} role{totalSel !== 1 ? 's' : ''} ativa{totalSel !== 1 ? 's' : ''}
                </span>
              </p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        {/* ── search bar ── */}
        <div className="roles-modal-toolbar">
          <div className="search-input-wrap" style={{ flex: 1, maxWidth: '100%' }}>
            <Search size={14} />
            <input
              className="search-input"
              placeholder="Filtrar roles pelo nome..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <button
            className="btn btn-ghost"
            style={{ fontSize: 12, whiteSpace: 'nowrap' }}
            onClick={() => setSelected(new Set(allRoles.map(r => r.id)))}
          >
            Tudo
          </button>
          <button
            className="btn btn-ghost"
            style={{ fontSize: 12, color: '#f87171', whiteSpace: 'nowrap' }}
            onClick={() => setSelected(new Set())}
          >
            Limpar
          </button>
        </div>

        {/* ── role groups ── */}
        <div className="roles-modal-body">
          {grouped.length === 0 && (
            <div className="table-empty" style={{ padding: 48 }}>
              <Search size={24} />
              <p style={{ marginTop: 8 }}>Nenhuma role encontrada para "{search}"</p>
            </div>
          )}
          {grouped.map(({ category, roles }) => (
            <RoleGroup
              key={category.label}
              category={category}
              roles={roles}
              selected={selected}
              onToggle={toggle}
              onToggleAll={toggleAll}
            />
          ))}
        </div>

        {/* ── footer ── */}
        <div className="modal-footer">
          <span style={{ fontSize: 12, color: '#475569', flex: 1 }}>
            {changed ? '● Há mudanças não salvas' : '✓ Sem alterações'}
          </span>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !changed}>
            {saving
              ? <><span className="spinner-sm" /> Salvando…</>
              : <><Check size={14} /> Salvar</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   USER ROW
═══════════════════════════════════════ */
function UserRow({ user, onManage }: { user: SystemUser | CustomerUser; onManage: () => void }) {
  const initials  = (user.name || user.email).replace(/[^a-zA-Z\s]/g, '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'US';
  const topRoles  = user.roles.slice(0, 4);
  const extra     = user.roles.length - 4;

  return (
    <tr>
      <td>
        <div className="user-name-cell">
          <div className="user-avatar-sm">{initials}</div>
          <div>
            <div className="user-name">{user.name || '—'}</div>
            <div className="user-email">{user.email}</div>
          </div>
        </div>
      </td>
      <td>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
          {topRoles.map(r => (
            <span key={r.id} className="role-tag">{roleLabel(r.name)}</span>
          ))}
          {extra > 0 && <span className="role-tag role-tag-more">+{extra}</span>}
          {user.roles.length === 0 && (
            <span style={{ fontSize: 12, color: '#334155', fontStyle: 'italic' }}>Sem roles</span>
          )}
        </div>
      </td>
      <td>
        <span className={`pill ${user.active ? 'pill-green' : 'pill-gray'}`}>
          {user.active ? 'Ativo' : 'Inativo'}
        </span>
      </td>
      <td>
        <div className="actions-cell">
          <button className="btn btn-secondary btn-icon" title="Gerenciar roles" onClick={onManage}>
            <Shield size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ═══════════════════════════════════════
   PERMISSIONS PAGE
═══════════════════════════════════════ */
type Tab = 'system' | 'customer';

export default function Permissions() {
  const [tab,      setTab]      = useState<Tab>('system');
  const [search,   setSearch]   = useState('');
  const [page,     setPage]     = useState(0);
  const [sysData,  setSysData]  = useState<Page<SystemUser>   | null>(null);
  const [custData, setCustData] = useState<Page<CustomerUser> | null>(null);
  const [sysRoles, setSysRoles] = useState<Role[]>([]);
  const [custRoles,setCustRoles]= useState<Role[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [managing, setManaging] = useState<SystemUser | CustomerUser | null>(null);
  const { toasts, push } = useToast();

  // carrega roles disponíveis uma vez
  useEffect(() => {
    systemRoleService.list()
      .then(data => setSysRoles([...new Map(data.map(r => [r.id, r])).values()]))
      .catch(() => {});
    customerRoleService.list()
      .then(data => setCustRoles([...new Map(data.map(r => [r.id, r])).values()]))
      .catch(() => {});
  }, []);

  // carrega usuários
  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'system') {
        setSysData(await systemUserService.list({ name: search || undefined, page, size: 10 }));
      } else {
        setCustData(await customerUserService.list({ name: search || undefined, page, size: 10 }));
      }
    } catch {
      push('Erro ao carregar usuários', 'error');
    } finally {
      setLoading(false);
    }
  }, [tab, search, page, push]);

  useEffect(() => { setPage(0); }, [tab, search]);
  useEffect(() => { load(); }, [load]);

  // salva roles do usuário
  const handleSaveRoles = async (userId: string, roleIds: string[]) => {
    const u = managing!;
    try {
      if (tab === 'system') {
        const su = u as SystemUser;
        await systemUserService.update(userId, {
          name: su.name, email: su.email, active: su.active,
          force_password_change: su.forcePasswordChange,
          role_ids: roleIds,
          group_ids: su.groups.map(g => g.id),
        });
      } else {
        const cu = u as CustomerUser;
        await customerUserService.update(userId, {
          name: cu.name, email: cu.email,
          company_id: cu.company.id,
          active: cu.active,
          force_password_change: cu.forcePasswordChange,
          role_ids: roleIds,
          group_ids: cu.groups.map(g => g.id),
        });
      }
      push('Permissões salvas com sucesso!');
      setManaging(null);
      load();
    } catch {
      push('Erro ao salvar permissões', 'error');
      throw new Error('err');
    }
  };

  const pageData   = tab === 'system' ? sysData : custData;
  const allRoles   = tab === 'system' ? sysRoles : custRoles;
  const categories = tab === 'system' ? SYSTEM_CATEGORIES : CUSTOMER_CATEGORIES;
  const users      = (pageData?.content ?? []) as (SystemUser | CustomerUser)[];
  const totalEl    = pageData?.totalElements ?? 0;
  const totalPg    = pageData?.totalPages ?? 1;

  const pageNums = (() => {
    const out = [];
    for (let i = Math.max(0, page - 2); i <= Math.min(totalPg - 1, page + 2); i++) out.push(i);
    return out;
  })();

  return (
    <AppShell>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* ── header ── */}
        <div className="page-header" style={{ padding: '28px 28px 0', marginBottom: 0 }}>
          <div className="page-header-left">
            <h1>Permissões</h1>
            <p>Gerencie as roles e acessos de cada usuário</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="perm-stat">
              <ShieldCheck size={14} color="#60a5fa" />
              <span>{sysRoles.length} system</span>
            </div>
            <div className="perm-stat">
              <ShieldCheck size={14} color="#a78bfa" />
              <span>{custRoles.length} customer</span>
            </div>
            <button className="btn btn-secondary" onClick={load} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              Atualizar
            </button>
          </div>
        </div>

        <div style={{ padding: '20px 28px 28px', flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>

          {/* ── tabs + search ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div className="tab-bar" style={{ marginBottom: 0 }}>
              <button className={`tab-btn ${tab === 'system'   ? 'active' : ''}`} onClick={() => setTab('system')}>
                Usuários Sistema
              </button>
              <button className={`tab-btn ${tab === 'customer' ? 'active' : ''}`} onClick={() => setTab('customer')}>
                Usuários Cliente
              </button>
            </div>
            <div className="search-input-wrap" style={{ flex: 1, minWidth: 180, maxWidth: 320 }}>
              <Search size={14} />
              <input
                className="search-input"
                placeholder="Buscar por nome..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* ── table ── */}
          <div className="table-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="table-wrap" style={{ flex: 1, overflowY: 'auto' }}>
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Roles ativas</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr className="loading-row">
                      <td colSpan={4}>
                        <div className="spinner" />
                        Carregando...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr><td colSpan={4}>
                      <div className="table-empty">
                        <UserCheck size={28} />
                        <p>Nenhum usuário encontrado</p>
                      </div>
                    </td></tr>
                  ) : users.map(u => (
                    <UserRow key={u.id} user={u} onManage={() => setManaging(u)} />
                  ))}
                </tbody>
              </table>
            </div>

            {totalPg > 1 && (
              <div className="pagination">
                <span className="pagination-info">{totalEl} usuário{totalEl !== 1 ? 's' : ''} · pág {page + 1}/{totalPg}</span>
                <div className="pagination-btns">
                  <button className="page-btn" onClick={() => setPage(p => p - 1)} disabled={page === 0}><ChevronLeft size={13} /></button>
                  {pageNums.map(n => (
                    <button key={n} className={`page-btn ${n === page ? 'current' : ''}`} onClick={() => setPage(n)}>{n + 1}</button>
                  ))}
                  <button className="page-btn" onClick={() => setPage(p => p + 1)} disabled={page >= totalPg - 1}><ChevronRight size={13} /></button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── modal ── */}
      {managing && (
        <ManageRolesModal
          user={managing}
          type={tab}
          allRoles={allRoles}
          categories={categories}
          onClose={() => setManaging(null)}
          onSave={handleSaveRoles}
        />
      )}

      {/* ── toasts ── */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.type === 'success' ? <Check size={14} /> : <AlertTriangle size={14} />}
            {t.msg}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
