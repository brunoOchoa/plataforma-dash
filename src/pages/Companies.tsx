import { useState, useEffect, useCallback } from 'react';
import {
  Search, Plus, Pencil, Trash2, Building2,
  ChevronLeft, ChevronRight, RefreshCw,
  X, Check, AlertTriangle, Eye, EyeOff,
  Copy, CheckCheck, Database, Mail, Hash,
} from 'lucide-react';
import { companyService } from '../services/companyService';
import type { Company, CreateCompanyRequest, UpdateCompanyRequest, Page } from '../types/company';
import AppShell from '../components/AppShell';

/* ══════════════════════════════════════
   TOAST
══════════════════════════════════════ */
interface Toast { id: number; msg: string; type: 'success' | 'error' }
function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3800);
  }, []);
  return { toasts, push };
}

/* ══════════════════════════════════════
   HELPERS
══════════════════════════════════════ */
function formatCnpj(v: string | null | undefined) {
  if (!v) return '—';
  const d = v.replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

// ZonedDateTime do Java pode ter nanosegundos (ex: 2024-01-15T10:30:00.123456789-03:00)
// JS só suporta milissegundos → trunca a parte fracionária para 3 dígitos
function formatDate(v: string | null | undefined) {
  if (!v) return '—';
  // trunca fração para no máximo 3 casas decimais antes do offset/Z
  const normalized = v.replace(/(\.\d{3})\d+/, '$1');
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

// storageQuotas é armazenado em GB diretamente no banco
function formatStorageGb(gb: number | null | undefined) {
  if (gb == null || gb <= 0) return '—';
  return `${gb} GB`;
}

function companyInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

/* ══════════════════════════════════════
   PASSWORD REVEAL MODAL
   Exibido após criação com a senha gerada
══════════════════════════════════════ */
function PasswordModal({ company, onClose }: { company: Company; onClose: () => void }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied]   = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(company.password ?? '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Empresa criada com sucesso!</h3>
            <p>Guarde a senha do administrador antes de fechar</p>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          {/* company card */}
          <div className="company-created-card">
            <div className="company-avatar">{companyInitials(company.name)}</div>
            <div>
              <p style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 15 }}>{company.name}</p>
              <p style={{ fontSize: 12, color: '#475569' }}>{company.email}</p>
            </div>
          </div>

          <p style={{ fontSize: 13, color: '#64748b', margin: '16px 0 8px' }}>
            Um usuário <strong style={{ color: '#93c5fd' }}>CUSTOMER_ADMIN_FULL</strong> foi criado automaticamente. Senha gerada:
          </p>

          <div className="password-reveal-box">
            <span className="password-value" style={{ letterSpacing: visible ? 2 : 4 }}>
              {visible ? company.password : '•'.repeat((company.password ?? '').length)}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-ghost btn-icon" onClick={() => setVisible(v => !v)} title={visible ? 'Ocultar' : 'Mostrar'}>
                {visible ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button className={`btn btn-ghost btn-icon ${copied ? 'copied-btn' : ''}`} onClick={copy} title="Copiar">
                {copied ? <CheckCheck size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          <div className="warning-box">
            <AlertTriangle size={14} color="#fbbf24" style={{ flexShrink: 0 }} />
            <span>Esta senha <strong>não poderá ser recuperada</strong> depois que fechar esta janela.</span>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>
            <Check size={14} /> Entendido, fechar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   COMPANY FORM MODAL (criar / editar)
══════════════════════════════════════ */
interface CompanyModalProps {
  company: Company | null;   // null = criar
  onClose: () => void;
  onSave: (data: CreateCompanyRequest | UpdateCompanyRequest, id?: string) => Promise<Company>;
}

function CompanyModal({ company, onClose, onSave }: CompanyModalProps) {
  const isEdit = !!company;

  const [form, setForm] = useState({
    name:          company?.name          ?? '',
    cpfCnpj:       company ? formatCnpj(company.cpfCnpj) : '',
    email:         company?.email         ?? '',
    storageQuotas: company?.storageQuotas != null ? String(company.storageQuotas) : '',
    active:        company?.active        ?? true,
  });
  const [saving,  setSaving]  = useState(false);
  const [errors,  setErrors]  = useState<Record<string, string>>({});

  const set = (k: keyof typeof form, v: string | boolean) =>
    setForm(p => ({ ...p, [k]: v }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim())    e.name    = 'Nome é obrigatório';
    if (!form.cpfCnpj.trim()) e.cpfCnpj = 'CNPJ é obrigatório';
    else if (form.cpfCnpj.replace(/\D/g, '').length !== 14) e.cpfCnpj = 'CNPJ deve ter 14 dígitos';
    if (!form.email.trim())   e.email   = 'E-mail é obrigatório';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'E-mail inválido';
    if (isEdit && form.storageQuotas && isNaN(Number(form.storageQuotas)))
      e.storageQuotas = 'Valor inválido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      // storageQuotas é armazenado em GB diretamente no banco
      const quotaGB = form.storageQuotas ? Number(form.storageQuotas) : null;
      if (isEdit) {
        const body: UpdateCompanyRequest = {
          name: form.name.trim(),
          cpfCnpj: form.cpfCnpj.replace(/\D/g, ''),
          email: form.email.trim(),
          storageQuotas: quotaGB,
          active: form.active,
        };
        await onSave(body, company!.id);
      } else {
        const body: CreateCompanyRequest = {
          name: form.name.trim(),
          cpfCnpj: form.cpfCnpj.replace(/\D/g, ''),
          email: form.email.trim(),
          storageQuotas: quotaGB,
        };
        await onSave(body);
      }
      onClose();
    } catch (err: any) {
      // exibe msg da API se disponível
      const msg = err?.response?.data?.message ?? err?.response?.data ?? 'Erro ao salvar empresa';
      setErrors({ _api: typeof msg === 'string' ? msg : JSON.stringify(msg) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>{isEdit ? 'Editar Empresa' : 'Nova Empresa'}</h3>
            <p>{isEdit ? `Editando ${company!.name}` : 'Preencha os dados da nova empresa'}</p>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          {errors._api && (
            <div className="api-error-box">
              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
              <span>{errors._api}</span>
            </div>
          )}

          <div className="form-grid">
            {/* Nome */}
            <div className="form-field form-grid-full">
              <label className="form-label">Nome da Empresa *</label>
              <input
                className={`form-input ${errors.name ? 'error' : ''}`}
                placeholder="Ex: Acme Corporation"
                value={form.name}
                onChange={e => set('name', e.target.value)}
              />
              {errors.name && <span className="form-error-msg">{errors.name}</span>}
            </div>

            {/* CNPJ */}
            <div className="form-field">
              <label className="form-label">CNPJ *</label>
              <input
                className={`form-input ${errors.cpfCnpj ? 'error' : ''}`}
                placeholder="00.000.000/0000-00"
                value={form.cpfCnpj}
                onChange={e => set('cpfCnpj', formatCnpj(e.target.value))}
                maxLength={18}
              />
              {errors.cpfCnpj && <span className="form-error-msg">{errors.cpfCnpj}</span>}
            </div>

            {/* E-mail */}
            <div className="form-field">
              <label className="form-label">E-mail *</label>
              <input
                className={`form-input ${errors.email ? 'error' : ''}`}
                placeholder="admin@empresa.com"
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
              />
              {errors.email && <span className="form-error-msg">{errors.email}</span>}
            </div>

            {/* Storage quota */}
            <div className="form-field">
              <label className="form-label">Cota de Storage (GB){!isEdit && <span className="form-hint" style={{ marginLeft: 4 }}>opcional</span>}</label>
              <input
                className={`form-input ${errors.storageQuotas ? 'error' : ''}`}
                placeholder="Ex: 10 (= 10 GB)"
                type="number"
                min="0"
                step="1"
                value={form.storageQuotas}
                onChange={e => set('storageQuotas', e.target.value)}
              />
              {errors.storageQuotas && <span className="form-error-msg">{errors.storageQuotas}</span>}
              <span className="form-hint">Deixe vazio para sem limite</span>
            </div>

            {/* Ativo (só no edit) */}
            {isEdit && (
              <div className="form-field form-grid-full">
                <div className="toggle-wrap">
                  <span>Empresa ativa</span>
                  <label className="toggle">
                    <input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} />
                    <span className="toggle-track" />
                    <span className="toggle-thumb" />
                  </label>
                </div>
              </div>
            )}
          </div>

          {!isEdit && (
            <div className="info-hint-box">
              <Check size={13} color="#34d399" style={{ flexShrink: 0 }} />
              <span>Ao criar a empresa, um usuário administrador (<strong>CUSTOMER_ADMIN_FULL</strong>) será gerado automaticamente com senha aleatória.</span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? <><span className="spinner-sm" /> Salvando…</> : <><Check size={14} />{isEdit ? 'Salvar' : 'Criar Empresa'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   DELETE MODAL
══════════════════════════════════════ */
function DeleteModal({ company, onClose, onConfirm }: {
  company: Company; onClose: () => void; onConfirm: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handle = async () => {
    setLoading(true);
    try { await onConfirm(); onClose(); }
    catch (err: any) {
      setError(err?.response?.data?.message ?? err?.response?.data ?? 'Erro ao desativar empresa');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal confirm-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-body" style={{ textAlign: 'center', padding: '32px 28px 20px' }}>
          <div className="confirm-icon"><Trash2 size={22} color="#f87171" /></div>
          <h4>Desativar Empresa?</h4>
          <p style={{ marginTop: 8 }}>
            A empresa <strong style={{ color: '#f1f5f9' }}>{company.name}</strong> será desativada.
            Esta ação pode ser revertida editando a empresa.
          </p>
          {error && (
            <div className="api-error-box" style={{ marginTop: 16, textAlign: 'left' }}>
              <AlertTriangle size={13} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
          <button className="btn btn-danger" onClick={handle} disabled={loading}>
            {loading ? <><span className="spinner-sm" /> Desativando…</> : <><Trash2 size={14} /> Desativar</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   COMPANIES PAGE
══════════════════════════════════════ */
type ActiveFilter = 'all' | 'active' | 'inactive';

export default function Companies() {
  const [data,    setData]    = useState<Page<Company> | null>(null);
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState<ActiveFilter>('all');
  const [page,    setPage]    = useState(0);
  const [loading, setLoading] = useState(false);

  // modais
  const [creating,  setCreating]  = useState(false);
  const [editing,   setEditing]   = useState<Company | null>(null);
  const [deleting,  setDeleting]  = useState<Company | null>(null);
  const [newCompany, setNewCompany] = useState<Company | null>(null);  // após criar

  const { toasts, push } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, size: 10 };
      if (search) params.name = search;
      if (filter === 'active')   params.active = true;
      if (filter === 'inactive') params.active = false;
      setData(await companyService.list(params));
    } catch {
      push('Erro ao carregar empresas', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, filter, push]);

  useEffect(() => { setPage(0); }, [search, filter]);
  useEffect(() => { load(); }, [load]);

  /* ── CRUD handlers ── */
  const handleSave = async (body: CreateCompanyRequest | UpdateCompanyRequest, id?: string) => {
    if (id) {
      const res = await companyService.update(id, body as UpdateCompanyRequest);
      push('Empresa atualizada!');
      load();
      return res;
    } else {
      const res = await companyService.create(body as CreateCompanyRequest);
      push('Empresa criada!');
      setNewCompany(res);   // mostra modal com senha
      load();
      return res;
    }
  };

  const handleDelete = async () => {
    await companyService.remove(deleting!.id);
    push('Empresa desativada');
    load();
  };

  const companies = data?.content ?? [];
  const totalEl   = data?.totalElements ?? 0;
  const totalPg   = data?.totalPages ?? 1;
  const pageNums  = (() => {
    const out = [];
    for (let i = Math.max(0, page - 2); i <= Math.min(totalPg - 1, page + 2); i++) out.push(i);
    return out;
  })();

  return (
    <AppShell>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* ── Header ── */}
        <div className="page-header" style={{ padding: '28px 28px 0', marginBottom: 0 }}>
          <div className="page-header-left">
            <h1>Empresas</h1>
            <p>Gerencie as empresas clientes da plataforma</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" onClick={load} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              Atualizar
            </button>
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              <Plus size={14} /> Nova Empresa
            </button>
          </div>
        </div>

        <div style={{ padding: '20px 28px 28px', flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>

          {/* ── Toolbar ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="search-input-wrap" style={{ flex: 1, minWidth: 200, maxWidth: 340 }}>
              <Search size={14} />
              <input
                className="search-input"
                placeholder="Buscar por nome..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* filtro ativo/inativo */}
            <div className="tab-bar" style={{ marginBottom: 0 }}>
              <button className={`tab-btn ${filter === 'all'      ? 'active' : ''}`} onClick={() => setFilter('all')}>Todos</button>
              <button className={`tab-btn ${filter === 'active'   ? 'active' : ''}`} onClick={() => setFilter('active')}>Ativos</button>
              <button className={`tab-btn ${filter === 'inactive' ? 'active' : ''}`} onClick={() => setFilter('inactive')}>Inativos</button>
            </div>
          </div>

          {/* ── Table ── */}
          <div className="table-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="table-wrap" style={{ flex: 1, overflowY: 'auto' }}>
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>CNPJ</th>
                    <th>E-mail</th>
                    <th>Storage</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr className="loading-row">
                      <td colSpan={6}><div className="spinner" />Carregando...</td>
                    </tr>
                  ) : companies.length === 0 ? (
                    <tr><td colSpan={6}>
                      <div className="table-empty">
                        <Building2 size={28} />
                        <p>Nenhuma empresa encontrada</p>
                      </div>
                    </td></tr>
                  ) : companies.map(c => (
                    <tr key={c.id}>
                      <td>
                        <div className="user-name-cell">
                          <div className="company-avatar-sm">{companyInitials(c.name)}</div>
                          <div>
                            <div className="user-name">{c.name}</div>
                            <div className="user-email">
                              {formatDate(c.createdAt)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td data-label="CNPJ">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Hash size={12} color="#475569" />
                          <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>
                            {formatCnpj(c.cpfCnpj)}
                          </span>
                        </div>
                      </td>
                      <td data-label="E-mail">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Mail size={12} color="#475569" />
                          <span style={{ fontSize: 13, color: '#94a3b8' }}>{c.email}</span>
                        </div>
                      </td>
                      <td data-label="Storage">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Database size={12} color="#475569" />
                          <span style={{ fontSize: 13, color: '#94a3b8' }}>{formatStorageGb(c.storageQuotas)}</span>
                        </div>
                      </td>
                      <td data-label="Status">
                        <span className={`pill ${c.active ? 'pill-green' : 'pill-gray'}`}>
                          {c.active ? 'Ativa' : 'Inativa'}
                        </span>
                      </td>
                      <td>
                        <div className="actions-cell">
                          <button className="btn btn-ghost btn-icon" title="Editar" onClick={() => setEditing(c)}>
                            <Pencil size={14} />
                          </button>
                          <button className="btn btn-danger-ghost btn-icon" title="Desativar" onClick={() => setDeleting(c)}>
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
            {totalPg > 1 && (
              <div className="pagination">
                <span className="pagination-info">{totalEl} empresa{totalEl !== 1 ? 's' : ''} · pág {page + 1}/{totalPg}</span>
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

      {/* ── Modais ── */}
      {(creating || editing) && (
        <CompanyModal
          company={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}
      {deleting && (
        <DeleteModal
          company={deleting}
          onClose={() => setDeleting(null)}
          onConfirm={handleDelete}
        />
      )}
      {newCompany?.password && (
        <PasswordModal
          company={newCompany}
          onClose={() => setNewCompany(null)}
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
    </AppShell>
  );
}
