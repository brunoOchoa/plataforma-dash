import { useState, useEffect, useCallback } from 'react';
import {
  Search, Plus, Pencil, Trash2, KeyRound, Users as UsersIcon,
  X, Check, AlertTriangle, ChevronLeft, ChevronRight, RefreshCw,
  UserCheck, UserX, Building2,
} from 'lucide-react';
import { systemUserService, customerUserService } from '../services/userService';
import { customerRoleService } from '../services/roleService';
import { departmentService }   from '../services/departmentService';
import type {
  SystemUser, CustomerUser, Role, Department,
  CreateSystemUserRequest, CreateCustomerUserRequest, ChangePasswordRequest,
} from '../types/user';
import type { Department as DeptType } from '../types/department';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import AppShell from '../components/AppShell';

/* ─── Toast ─── */
type ToastType = 'success' | 'error';
interface Toast { id: number; type: ToastType; msg: string; }
function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  let id = 0;
  const show = useCallback((type: ToastType, msg: string) => {
    const t = { id: ++id, type, msg };
    setToasts(p => [...p, t]);
    setTimeout(() => setToasts(p => p.filter(x => x.id !== t.id)), 3500);
  }, []);
  return { toasts, show };
}

/* ─── helpers ─── */
function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ─── Toggle component ─── */
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="toggle-track" />
      <span className="toggle-thumb" />
    </label>
  );
}

/* ─── Badge ─── */
function Badge({ active }: { active: boolean }) {
  return (
    <span className={`pill ${active ? 'pill-green' : 'pill-gray'}`}>
      {active ? <><UserCheck size={10} /> Ativo</> : <><UserX size={10} /> Inativo</>}
    </span>
  );
}

/* ════════════════════════════════════════
   MODAL — Criar / Editar SystemUser
════════════════════════════════════════ */
function SystemUserModal({
  user, onClose, onSaved,
}: { user?: SystemUser; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!user;
  const [form, setForm] = useState<CreateSystemUserRequest>({
    name: user?.name ?? '',
    email: user?.email ?? '',
    password: '',
    active: user?.active ?? true,
    force_password_change: user?.forcePasswordChange ?? false,
    role_ids: user?.roles?.map(r => r.id) ?? [],
    group_ids: user?.groups?.map(g => g.id) ?? [],
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const set = (k: keyof CreateSystemUserRequest, v: unknown) =>
    setForm(p => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const body = { ...form };
      if (!body.password) delete body.password;
      if (isEdit) await systemUserService.update(user!.id, body);
      else        await systemUserService.create(body);
      onSaved();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setErr(err.response?.data?.message ?? 'Erro ao salvar usuário.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <div>
            <h3>{isEdit ? 'Editar Usuário' : 'Novo Usuário do Sistema'}</h3>
            <p>{isEdit ? `Editando ${user!.name}` : 'Preencha os dados para criar um novo usuário'}</p>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <form onSubmit={submit}>
          <div className="modal-body">
            {err && (
              <div className="login-error" style={{ marginBottom: 20 }}>
                <AlertTriangle size={15} color="#f87171" style={{ flexShrink: 0 }} />
                <p>{err}</p>
              </div>
            )}

            <p className="form-section">Dados pessoais</p>
            <div className="form-grid">
              <div className="form-field form-grid-full">
                <label className="form-label">Nome completo *</label>
                <input
                  className="form-input"
                  placeholder="Ex: João da Silva"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  required
                />
              </div>
              <div className="form-field form-grid-full">
                <label className="form-label">E-mail *</label>
                <input
                  className="form-input"
                  type="email"
                  placeholder="usuario@empresa.com"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  required
                />
              </div>
              <div className="form-field form-grid-full">
                <label className="form-label">{isEdit ? 'Nova senha (deixe em branco para manter)' : 'Senha *'}</label>
                <input
                  className="form-input"
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  required={!isEdit}
                />
              </div>
            </div>

            <p className="form-section" style={{ marginTop: 20 }}>Configurações</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="toggle-wrap">
                <span>Usuário ativo</span>
                <Toggle checked={form.active ?? true} onChange={v => set('active', v)} />
              </div>
              <div className="toggle-wrap">
                <span>Forçar troca de senha no próximo acesso</span>
                <Toggle checked={form.force_password_change ?? false} onChange={v => set('force_password_change', v)} />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><span className="spinner" style={{ width: 14, height: 14, margin: 0 }} /> Salvando…</> : <><Check size={15} /> {isEdit ? 'Salvar alterações' : 'Criar usuário'}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   MODAL — Criar / Editar CustomerUser
════════════════════════════════════════ */
function CustomerUserModal({
  user, defaultCompanyId, defaultCompanyName, isCustomerUser, onClose, onSaved,
}: {
  user?: CustomerUser;
  defaultCompanyId?: string;
  defaultCompanyName?: string;
  isCustomerUser?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!user;
  const { companies } = useCompany();

  const [form, setForm] = useState<CreateCustomerUserRequest>({
    name:                  user?.name            ?? '',
    email:                 user?.email           ?? '',
    password:              '',
    company_id:            user?.company?.id     ?? defaultCompanyId ?? '',
    active:                user?.active          ?? true,
    force_password_change: user?.forcePasswordChange ?? false,
    role_ids:              user?.roles?.map(r => r.id)       ?? [],
    department_ids:        user?.departments?.map(d => d.id) ?? [],
  });

  const [loading,     setLoading]     = useState(false);
  const [err,         setErr]         = useState('');
  const [roles,       setRoles]       = useState<Role[]>([]);
  const [depts,       setDepts]       = useState<DeptType[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [roleSearch,  setRoleSearch]  = useState('');

  const set = (k: keyof CreateCustomerUserRequest, v: unknown) =>
    setForm(p => ({ ...p, [k]: v }));

  // Carrega roles e departamentos
  useEffect(() => {
    setLoadingMeta(true);
    Promise.all([
      customerRoleService.list().catch(() => [] as Role[]),
      form.company_id
        ? departmentService.list({ size: 100, active: true, companyId: form.company_id })
            .then(r => r.content).catch(() => [] as DeptType[])
        : Promise.resolve([] as DeptType[]),
    ]).then(([r, d]) => {
      setRoles(r);
      setDepts(d);
    }).finally(() => setLoadingMeta(false));
  }, [form.company_id]);

  const toggleId = (field: 'role_ids' | 'department_ids', id: string) => {
    setForm(p => {
      const cur = p[field] ?? [];
      return {
        ...p,
        [field]: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id],
      };
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const body = { ...form };
      if (!body.password) delete (body as any).password;
      if (isEdit) await customerUserService.update(user!.id, body);
      else        await customerUserService.create(body);
      onSaved();
    } catch (e: unknown) {
      const error = e as { response?: { data?: { message?: string } } };
      setErr(error.response?.data?.message ?? 'Erro ao salvar usuário.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" style={{ maxWidth: 720, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <div>
            <h3>{isEdit ? 'Editar Usuário Cliente' : 'Novo Usuário Cliente'}</h3>
            <p>{isEdit ? `Editando ${user!.name}` : 'Preencha os dados para criar um novo usuário'}</p>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {/* corpo com scroll */}
          <div className="modal-body" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
            {err && (
              <div className="login-error" style={{ marginBottom: 16 }}>
                <AlertTriangle size={15} color="#f87171" style={{ flexShrink: 0 }} />
                <p>{err}</p>
              </div>
            )}

            {/* ── Layout 2 colunas ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>

              {/* ── Coluna esquerda: dados básicos ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p className="form-section" style={{ margin: '0 0 2px' }}>Dados do usuário</p>

                {/* Empresa */}
                <div className="form-field">
                  <label className="form-label">Empresa *</label>
                  {(isEdit || isCustomerUser) ? (
                    <div className="form-input" style={{ opacity: 0.6, cursor: 'default', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Building2 size={13} color="#475569" />
                      <span style={{ fontSize: 13 }}>
                        {isEdit
                          ? (user!.company?.name ?? '—')
                          : (defaultCompanyName ?? '—')}
                      </span>
                    </div>
                  ) : (
                    <select
                      className="form-select"
                      value={form.company_id}
                      onChange={e => set('company_id', e.target.value)}
                      required
                    >
                      <option value="">Selecione uma empresa...</option>
                      {companies.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Nome */}
                <div className="form-field">
                  <label className="form-label">Nome completo *</label>
                  <input
                    className="form-input"
                    placeholder="Ex: João da Silva"
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    required
                  />
                </div>

                {/* Email */}
                <div className="form-field">
                  <label className="form-label">E-mail *</label>
                  <input
                    className="form-input"
                    type="email"
                    placeholder="usuario@empresa.com"
                    value={form.email}
                    onChange={e => set('email', e.target.value)}
                    required
                  />
                </div>

                {/* Senha */}
                <div className="form-field">
                  <label className="form-label">{isEdit ? 'Nova senha (opcional)' : 'Senha *'}</label>
                  <input
                    className="form-input"
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    value={form.password}
                    onChange={e => set('password', e.target.value)}
                    required={!isEdit}
                    minLength={8}
                  />
                  {isEdit && <span className="form-hint">Deixe em branco para manter a senha atual</span>}
                </div>

                {/* Separador */}
                <div style={{ borderTop: '1px solid #1e293b', margin: '4px 0' }} />
                <p className="form-section" style={{ margin: '0 0 2px' }}>Configurações</p>

                <div className="toggle-wrap">
                  <span>Usuário ativo</span>
                  <Toggle checked={form.active ?? true} onChange={v => set('active', v)} />
                </div>
                <div className="toggle-wrap">
                  <span>Forçar troca de senha no login</span>
                  <Toggle checked={form.force_password_change ?? false} onChange={v => set('force_password_change', v)} />
                </div>
              </div>

              {/* ── Coluna direita: permissões e departamentos ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Permissões */}
                <div className="form-field" style={{ flex: 1 }}>
                  <p className="form-section" style={{ margin: '0 0 6px' }}>
                    Permissões
                    <span className="form-hint" style={{ marginLeft: 6, textTransform: 'none', fontWeight: 400 }}>
                      {(form.role_ids ?? []).length} selecionada{(form.role_ids ?? []).length !== 1 ? 's' : ''}
                    </span>
                  </p>
                  {loadingMeta ? (
                    <p style={{ fontSize: 12, color: '#475569' }}>Carregando...</p>
                  ) : roles.length === 0 ? (
                    <p style={{ fontSize: 12, color: '#475569', fontStyle: 'italic' }}>Nenhuma role disponível</p>
                  ) : (
                    <>
                      {/* Busca de roles */}
                      <div className="search-input-wrap" style={{ marginBottom: 6, height: 30 }}>
                        <Search size={12} />
                        <input
                          className="search-input"
                          placeholder="Filtrar permissões..."
                          value={roleSearch}
                          onChange={e => setRoleSearch(e.target.value)}
                          style={{ fontSize: 11 }}
                        />
                        {roleSearch && (
                          <button
                            type="button"
                            onClick={() => setRoleSearch('')}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#475569', display: 'flex' }}
                          >
                            <X size={11} />
                          </button>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 200, overflowY: 'auto' }}>
                        {roles
                          .filter(r => r.name.toLowerCase().includes(roleSearch.toLowerCase()))
                          .map(r => {
                            const on = (form.role_ids ?? []).includes(r.id);
                            const label = r.name.replace(/^CUSTOMER_/, '').replace(/_/g, ' ');
                            return (
                              <div
                                key={r.id}
                                className={`role-item ${on ? 'on' : ''}`}
                                style={{ padding: '5px 8px', cursor: 'pointer' }}
                                onClick={() => toggleId('role_ids', r.id)}
                              >
                                <div className={`role-checkbox ${on ? 'checked' : ''}`}>{on && <Check size={9} />}</div>
                                <span className="role-name" style={{ fontSize: 11, letterSpacing: '0.02em' }}>{label}</span>
                              </div>
                            );
                          })}
                        {roles.filter(r => r.name.toLowerCase().includes(roleSearch.toLowerCase())).length === 0 && (
                          <p style={{ fontSize: 11, color: '#475569', fontStyle: 'italic', padding: '6px 8px' }}>
                            Nenhuma permissão encontrada para "{roleSearch}"
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Departamentos */}
                <div className="form-field" style={{ flex: 1 }}>
                  <p className="form-section" style={{ margin: '0 0 6px' }}>
                    Departamentos
                    <span className="form-hint" style={{ marginLeft: 6, textTransform: 'none', fontWeight: 400 }}>
                      {(form.department_ids ?? []).length} selecionado{(form.department_ids ?? []).length !== 1 ? 's' : ''}
                    </span>
                  </p>
                  {!form.company_id ? (
                    <p style={{ fontSize: 12, color: '#475569', fontStyle: 'italic' }}>Selecione uma empresa primeiro</p>
                  ) : loadingMeta ? (
                    <p style={{ fontSize: 12, color: '#475569' }}>Carregando...</p>
                  ) : depts.length === 0 ? (
                    <p style={{ fontSize: 12, color: '#475569', fontStyle: 'italic' }}>Nenhum departamento ativo</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 150, overflowY: 'auto' }}>
                      {depts.map(d => {
                        const on = (form.department_ids ?? []).includes(d.id);
                        return (
                          <div
                            key={d.id}
                            className={`role-item ${on ? 'on' : ''}`}
                            style={{ padding: '5px 8px', cursor: 'pointer' }}
                            onClick={() => toggleId('department_ids', d.id)}
                          >
                            <div className={`role-checkbox ${on ? 'checked' : ''}`}>{on && <Check size={9} />}</div>
                            <span className="role-name" style={{ fontSize: 11 }}>{d.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer" style={{ flexShrink: 0 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading
                ? <><span className="spinner" style={{ width: 14, height: 14, margin: 0 }} /> Salvando…</>
                : <><Check size={15} /> {isEdit ? 'Salvar alterações' : 'Criar usuário'}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   MODAL — Trocar Senha
════════════════════════════════════════ */
function ChangePasswordModal({
  userId, userName, type, onClose, onSaved,
}: { userId: string; userName: string; type: 'system' | 'customer'; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<ChangePasswordRequest>({ old_password: '', new_password: '' });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const svc = type === 'system' ? systemUserService : customerUserService;
      await svc.changePassword(userId, form);
      onSaved();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setErr(err.response?.data?.message ?? 'Erro ao trocar senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <h3>Trocar Senha</h3>
            <p>Usuário: {userName}</p>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {err && (
              <div className="login-error" style={{ marginBottom: 20 }}>
                <AlertTriangle size={15} color="#f87171" style={{ flexShrink: 0 }} />
                <p>{err}</p>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-field">
                <label className="form-label">Senha atual *</label>
                <input
                  className="form-input"
                  type="password"
                  placeholder="••••••••"
                  value={form.old_password}
                  onChange={e => setForm(p => ({ ...p, old_password: e.target.value }))}
                  required
                />
              </div>
              <div className="form-field">
                <label className="form-label">Nova senha *</label>
                <input
                  className="form-input"
                  type="password"
                  placeholder="••••••••"
                  value={form.new_password}
                  onChange={e => setForm(p => ({ ...p, new_password: e.target.value }))}
                  required
                />
                <span className="form-hint">Mínimo 8 caracteres</span>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Salvando…' : <><KeyRound size={14} /> Trocar senha</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   MODAL — Confirmar exclusão
════════════════════════════════════════ */
function DeleteModal({
  name, onClose, onConfirm, loading,
}: { name: string; onClose: () => void; onConfirm: () => void; loading: boolean }) {
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal confirm-modal">
        <div className="modal-body">
          <div className="confirm-icon"><Trash2 size={22} color="#f87171" /></div>
          <h4>Excluir usuário?</h4>
          <p>Você está prestes a excluir <strong style={{ color: '#e2e8f0' }}>{name}</strong>. Esta ação não pode ser desfeita.</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? 'Excluindo…' : <><Trash2 size={14} /> Excluir</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   TELA PRINCIPAL — USUÁRIOS
════════════════════════════════════════ */
export default function Users() {
  const { user: authUser } = useAuth();
  const isSystem = authUser?.type === 'system';
  const { selectedCompany, isCustomer } = useCompany();

  // tab: 'system' | 'customer' — para clientes, sempre 'customer'
  const [tab, setTab] = useState<'system' | 'customer'>(isCustomer ? 'customer' : 'system');

  // list state
  const [rows, setRows]     = useState<(SystemUser | CustomerUser)[]>([]);
  const [total, setTotal]   = useState(0);
  const [pages, setPages]   = useState(0);
  const [page, setPage]     = useState(0);
  const [search, setSearch] = useState('');
  const [listLoading, setListLoading] = useState(false);

  // modals
  const [createOpen,     setCreateOpen]     = useState(false);
  const [editUser,       setEditUser]       = useState<SystemUser | null>(null);
  const [editCustomer,   setEditCustomer]   = useState<CustomerUser | null>(null);
  const [pwdUser,        setPwdUser]        = useState<{ id: string; name: string } | null>(null);
  const [deleteUser,     setDeleteUser]     = useState<{ id: string; name: string } | null>(null);
  const [deleteLoading,  setDeleteLoading]  = useState(false);

  const { toasts, show } = useToast();
  const PAGE_SIZE = 10;

  /* ── fetch ── */
  const fetchUsers = useCallback(async () => {
    setListLoading(true);
    try {
      const params = { name: search || undefined, page, size: PAGE_SIZE };
      if (tab === 'system') {
        const data = await systemUserService.list(params);
        setRows(data.content);
        setTotal(data.totalElements);
        setPages(data.totalPages);
      } else {
        const data = await customerUserService.list({
          ...params,
          companyId: selectedCompany?.id || undefined,
        });
        setRows(data.content);
        setTotal(data.totalElements);
        setPages(data.totalPages);
      }
    } catch {
      show('error', 'Erro ao carregar usuários.');
    } finally {
      setListLoading(false);
    }
  }, [tab, search, page, selectedCompany]);

  useEffect(() => { setPage(0); }, [tab, search, selectedCompany]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  /* ── delete ── */
  const confirmDelete = async () => {
    if (!deleteUser) return;
    setDeleteLoading(true);
    try {
      if (tab === 'system') await systemUserService.remove(deleteUser.id);
      else                  await customerUserService.remove(deleteUser.id);
      show('success', 'Usuário excluído com sucesso.');
      setDeleteUser(null);
      fetchUsers();
    } catch {
      show('error', 'Erro ao excluir usuário.');
    } finally {
      setDeleteLoading(false);
    }
  };

  /* ── saved callback ── */
  const onSaved = (msg: string) => () => {
    show('success', msg);
    setCreateOpen(false);
    setEditUser(null);
    setEditCustomer(null);
    setPwdUser(null);
    fetchUsers();
  };

  const isSystemUser = (u: SystemUser | CustomerUser): u is SystemUser => tab === 'system';

  /* paginação */
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to   = Math.min((page + 1) * PAGE_SIZE, total);
  const pageNumbers = Array.from({ length: Math.min(pages, 5) }, (_, i) => {
    const start = Math.max(0, Math.min(page - 2, pages - 5));
    return start + i;
  });

  return (
    <AppShell>
    <div className="page-inner" style={{ padding: '0' }}>

      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>Usuários</h1>
          <p>Gerencie os usuários do sistema e clientes</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
          <Plus size={15} /> Novo usuário
        </button>
      </div>

      {/* Tabs — cliente só vê "Usuários" (tab customer sem troca) */}
      <div className="tab-bar">
        {!isCustomer && (
          <button className={`tab-btn ${tab === 'system' ? 'active' : ''}`} onClick={() => setTab('system')}>
            <UsersIcon size={13} style={{ display: 'inline', marginRight: 6 }} />
            Sistema
          </button>
        )}
        {(isSystem || isCustomer) && (
          <button className={`tab-btn ${tab === 'customer' ? 'active' : ''}`} onClick={() => setTab('customer')}>
            <Building2 size={13} style={{ display: 'inline', marginRight: 6 }} />
            {isCustomer ? 'Usuários' : 'Clientes'}
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-input-wrap">
          <Search size={14} />
          <input
            className="search-input"
            placeholder="Buscar por nome…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button className="btn btn-secondary btn-icon" onClick={fetchUsers} title="Atualizar">
          <RefreshCw size={14} className={listLoading ? 'spin' : ''} />
        </button>
        <span style={{ fontSize: 12, color: '#334155', marginLeft: 4 }}>
          {total} {total === 1 ? 'usuário' : 'usuários'}
        </span>
      </div>

      {/* Table */}
      <div className="table-card">
        <div className="table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>Usuário</th>
                {tab === 'customer' && <th>Empresa</th>}
                <th>Status</th>
                <th>Criado em</th>
                <th>Roles</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {listLoading ? (
                <tr className="loading-row">
                  <td colSpan={tab === 'customer' ? 6 : 5}>
                    <div className="spinner" />
                    Carregando usuários…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={tab === 'customer' ? 6 : 5}>
                    <div className="table-empty">
                      <UsersIcon size={32} />
                      <p>Nenhum usuário encontrado{search ? ` para "${search}"` : '.'}</p>
                    </div>
                  </td>
                </tr>
              ) : rows.map(u => (
                <tr key={u.id}>
                  <td>
                    <div className="user-name-cell">
                      <div className="user-avatar-sm">{initials(u.name)}</div>
                      <div>
                        <div className="user-name">{u.name}</div>
                        <div className="user-email">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  {tab === 'customer' && (
                    <td data-label="Empresa" style={{ color: '#64748b', fontSize: 12 }}>
                      {(u as CustomerUser).company?.name ?? '—'}
                    </td>
                  )}
                  <td data-label="Status"><Badge active={u.active} /></td>
                  <td data-label="Criado em" style={{ fontSize: 12 }}>{fmtDate(u.createdAt)}</td>
                  <td data-label="Roles">
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {(isSystemUser(u) ? u.roles : (u as CustomerUser).roles)
                        .slice(0, 2)
                        .map(r => (
                          <span key={r.id} className="pill pill-blue" style={{ fontSize: 10 }}>
                            {r.name.replace(/^(SYSTEM_|CUSTOMER_)/, '')}
                          </span>
                        ))}
                      {(isSystemUser(u) ? u.roles : (u as CustomerUser).roles).length > 2 && (
                        <span className="pill pill-gray" style={{ fontSize: 10 }}>
                          +{(isSystemUser(u) ? u.roles : (u as CustomerUser).roles).length - 2}
                        </span>
                      )}
                      {(isSystemUser(u) ? u.roles : (u as CustomerUser).roles).length === 0 && (
                        <span style={{ fontSize: 12, color: '#334155' }}>—</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="actions-cell">
                      <button
                        className="btn btn-ghost btn-icon"
                        title="Editar"
                        onClick={() => tab === 'system'
                          ? setEditUser(u as SystemUser)
                          : setEditCustomer(u as CustomerUser)
                        }
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="btn btn-ghost btn-icon"
                        title="Trocar senha"
                        onClick={() => setPwdUser({ id: u.id, name: u.name })}
                      >
                        <KeyRound size={14} />
                      </button>
                      <button
                        className="btn btn-danger-ghost btn-icon"
                        title="Excluir"
                        onClick={() => setDeleteUser({ id: u.id, name: u.name })}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 0 && (
          <div className="pagination">
            <span className="pagination-info">
              Exibindo {from}–{to} de {total} usuários
            </span>
            <div className="pagination-btns">
              <button className="page-btn" onClick={() => setPage(p => p - 1)} disabled={page === 0}>
                <ChevronLeft size={14} />
              </button>
              {pageNumbers.map(n => (
                <button
                  key={n}
                  className={`page-btn ${n === page ? 'current' : ''}`}
                  onClick={() => setPage(n)}
                >
                  {n + 1}
                </button>
              ))}
              <button className="page-btn" onClick={() => setPage(p => p + 1)} disabled={page >= pages - 1}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {createOpen && tab === 'system' && (
        <SystemUserModal onClose={() => setCreateOpen(false)} onSaved={onSaved('Usuário criado com sucesso!')} />
      )}
      {createOpen && tab === 'customer' && (
        <CustomerUserModal
          defaultCompanyId={selectedCompany?.id}
          defaultCompanyName={selectedCompany?.name}
          isCustomerUser={isCustomer}
          onClose={() => setCreateOpen(false)}
          onSaved={onSaved('Usuário criado com sucesso!')}
        />
      )}
      {editUser && (
        <SystemUserModal user={editUser} onClose={() => setEditUser(null)} onSaved={onSaved('Usuário atualizado!')} />
      )}
      {editCustomer && (
        <CustomerUserModal user={editCustomer} onClose={() => setEditCustomer(null)} onSaved={onSaved('Usuário atualizado!')} />
      )}
      {pwdUser && (
        <ChangePasswordModal
          userId={pwdUser.id}
          userName={pwdUser.name}
          type={tab}
          onClose={() => setPwdUser(null)}
          onSaved={onSaved('Senha alterada com sucesso!')}
        />
      )}
      {deleteUser && (
        <DeleteModal
          name={deleteUser.name}
          onClose={() => setDeleteUser(null)}
          onConfirm={confirmDelete}
          loading={deleteLoading}
        />
      )}

      {/* ── Toasts ── */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.type === 'success' ? <Check size={14} /> : <AlertTriangle size={14} />}
            {t.msg}
          </div>
        ))}
      </div>
    </div>
    </AppShell>
  );
}
