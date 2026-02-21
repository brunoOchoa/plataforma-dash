import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, Plus, Pencil, Trash2,
  ChevronLeft, ChevronRight, RefreshCw,
  X, Check, AlertTriangle, Database,
  FolderOpen, BookOpen, Building2, ChevronRight as Arrow,
} from 'lucide-react';
import { departmentService } from '../services/departmentService';
import { companyService }    from '../services/companyService';
import type { Department, CreateDepartmentRequest, UpdateDepartmentRequest } from '../types/department';
import type { Company } from '../types/company';
import AppShell from '../components/AppShell';
import { useCompany } from '../context/CompanyContext';
import { useModalAnimation } from '../hooks/useModalAnimation';

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
/* storage_quotas vem em KB */
function formatKb(kb: number | null) {
  if (!kb) return '—';
  if (kb >= 1_048_576) return `${(kb / 1_048_576).toFixed(1)} GB`;
  if (kb >= 1_024)     return `${(kb / 1_024).toFixed(1)} MB`;
  return `${kb} KB`;
}

function deptInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

/* ══════════════════════════════════════
   DEPARTMENT FORM MODAL
══════════════════════════════════════ */
interface DepartmentModalProps {
  dept: Department | null;
  companies: Company[];
  defaultCompanyId?: string;
  defaultCompanyName?: string;
  isCustomer?: boolean;
  onClose: () => void;
  onSave: (data: CreateDepartmentRequest | UpdateDepartmentRequest, id?: string) => Promise<Department>;
}

function DepartmentModal({ dept, companies, defaultCompanyId, defaultCompanyName, isCustomer, onClose, onSave }: DepartmentModalProps) {
  const isEdit = !!dept;

  /* storage_quotas vem em KB — mostramos em MB para o usuário */
  const [form, setForm] = useState({
    name:      dept?.name         ?? '',
    storageMb: dept?.storageQuotas != null ? String(Math.round(dept.storageQuotas / 1024)) : '',
    active:    dept?.active       ?? true,
    companyId: dept?.company?.id  ?? defaultCompanyId ?? (companies[0]?.id ?? ''),
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: keyof typeof form, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Nome é obrigatório';
    else if (form.name.trim().length < 3)  e.name = 'Mínimo 3 caracteres';
    else if (form.name.trim().length > 60) e.name = 'Máximo 60 caracteres';
    if (!form.companyId) e.companyId = 'Selecione uma empresa';
    if (form.storageMb && isNaN(Number(form.storageMb))) e.storageMb = 'Valor inválido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      /* usuário digita MB → API espera KB */
      const quotaKb = form.storageMb ? Math.round(Number(form.storageMb) * 1024) : null;

      if (isEdit) {
        const body: UpdateDepartmentRequest = {
          name:           form.name.trim(),
          storage_quotas: quotaKb,
          active:         form.active,
          company_id:     form.companyId,
        };
        await onSave(body, dept!.id);
      } else {
        const body: CreateDepartmentRequest = {
          name:           form.name.trim(),
          storage_quotas: quotaKb,
          company_id:     form.companyId,
        };
        await onSave(body);
      }
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.response?.data ?? 'Erro ao salvar departamento';
      setErrors({ _api: typeof msg === 'string' ? msg : JSON.stringify(msg) });
    } finally {
      setSaving(false);
    }
  };

  const { closing, close } = useModalAnimation(onClose);
  return (
    <div className={`modal-backdrop${closing ? ' modal-closing' : ''}`} onClick={close}>
      <div className={`modal${closing ? ' modal-closing' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>{isEdit ? 'Editar Departamento' : 'Novo Departamento'}</h3>
            <p>{isEdit ? `Editando ${dept!.name}` : 'Preencha os dados do novo departamento'}</p>
          </div>
          <button className="modal-close" onClick={close}><X size={16} /></button>
        </div>

        <div className="modal-body">
          {errors._api && (
            <div className="api-error-box">
              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
              <span>{errors._api}</span>
            </div>
          )}

          <div className="form-grid">
            <div className="form-field form-grid-full">
              <label className="form-label">Nome do Departamento *</label>
              <input
                className={`form-input ${errors.name ? 'error' : ''}`}
                placeholder="Ex: Tecnologia da Informação"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                maxLength={60}
              />
              {errors.name && <span className="form-error-msg">{errors.name}</span>}
            </div>

            <div className="form-field form-grid-full">
              <label className="form-label">Empresa *</label>
              {isCustomer ? (
                <input
                  className="form-input"
                  value={defaultCompanyName ?? dept?.company?.name ?? ''}
                  readOnly
                  style={{ opacity: 0.7, cursor: 'not-allowed' }}
                />
              ) : (
              <select
                className={`form-select ${errors.companyId ? 'error' : ''}`}
                value={form.companyId}
                onChange={e => set('companyId', e.target.value)}
                disabled={isEdit}
              >
                <option value="">Selecione uma empresa...</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              )}
              {errors.companyId && <span className="form-error-msg">{errors.companyId}</span>}
              {!isCustomer && isEdit && <span className="form-hint">A empresa não pode ser alterada após a criação</span>}
            </div>

            <div className="form-field">
              <label className="form-label">Cota de Storage (MB) <span className="form-hint" style={{ marginLeft: 4 }}>opcional</span></label>
              <input
                className={`form-input ${errors.storageMb ? 'error' : ''}`}
                placeholder="Ex: 512 (= 512 MB)"
                type="number"
                min="0"
                step="1"
                value={form.storageMb}
                onChange={e => set('storageMb', e.target.value)}
              />
              {errors.storageMb && <span className="form-error-msg">{errors.storageMb}</span>}
              <span className="form-hint">Deixe vazio para sem limite</span>
            </div>

            {isEdit && (
              <div className="form-field" style={{ justifyContent: 'flex-end' }}>
                <label className="form-label">Status</label>
                <div className="toggle-wrap">
                  <span>Departamento ativo</span>
                  <label className="toggle">
                    <input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} />
                    <span className="toggle-track" /><span className="toggle-thumb" />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={close} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? <><span className="spinner-sm" /> Salvando…</> : <><Check size={14} />{isEdit ? 'Salvar' : 'Criar Departamento'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   DELETE MODAL
══════════════════════════════════════ */
function DeleteModal({ dept, onClose, onConfirm }: { dept: Department; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const handle = async () => {
    setLoading(true);
    try { await onConfirm(); onClose(); }
    catch (err: any) { setError(err?.response?.data?.message ?? 'Erro ao desativar departamento'); }
    finally { setLoading(false); }
  };
  const { closing, close } = useModalAnimation(onClose);
  return (
    <div className={`modal-backdrop${closing ? ' modal-closing' : ''}`} onClick={close}>
      <div className={`modal confirm-modal${closing ? ' modal-closing' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="modal-body" style={{ textAlign: 'center', padding: '32px 28px 20px' }}>
          <div className="confirm-icon"><Trash2 size={22} color="#f87171" /></div>
          <h4>Desativar Departamento?</h4>
          <p style={{ marginTop: 8 }}>O departamento <strong style={{ color: '#f1f5f9' }}>{dept.name}</strong> será desativado. Esta ação pode ser revertida editando o departamento.</p>
          {error && <div className="api-error-box" style={{ marginTop: 16, textAlign: 'left' }}><AlertTriangle size={13} style={{ flexShrink: 0 }} /><span>{error}</span></div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={close} disabled={loading}>Cancelar</button>
          <button className="btn btn-danger" onClick={handle} disabled={loading}>
            {loading ? <><span className="spinner-sm" /> Desativando…</> : <><Trash2 size={14} /> Desativar</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   DEPARTMENTS PAGE
══════════════════════════════════════ */
export default function Departments() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterCompanyId = searchParams.get('companyId') ?? '';
  const { selectedCompany, setSelectedCompany, isCustomer } = useCompany();

  const [depts,      setDepts]      = useState<Department[]>([]);
  const [companies,  setCompanies]  = useState<Company[]>([]);
  const [search,     setSearch]     = useState('');
  // selCompany é DERIVADO do contexto global — não tem estado local próprio
  // URL param tem prioridade sobre o contexto (deep-link)
  const selCompany = filterCompanyId || selectedCompany?.id || '';
  const [page,       setPage]       = useState(0);
  const [total,      setTotal]      = useState(0);
  const [totalPg,    setTotalPg]    = useState(1);
  const [loading,    setLoading]    = useState(false);
  const [creating,   setCreating]   = useState(false);
  const [editing,    setEditing]    = useState<Department | null>(null);
  const [deleting,   setDeleting]   = useState<Department | null>(null);

  const { toasts, push } = useToast();

  useEffect(() => {
    if (isCustomer) return; // cliente não tem acesso a /company
    companyService.list({ size: 100, active: true })
      .then(r => setCompanies(r.content))
      .catch(() => {});
  }, [isCustomer]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, size: 15 };
      if (search)     params.name      = search;
      if (selCompany) params.companyId = selCompany;
      const r = await departmentService.list(params);
      setDepts(r.content);
      setTotal(r.totalElements);
      setTotalPg(r.totalPages || 1);
    } catch {
      push('Erro ao carregar departamentos', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, selCompany, push]);

  useEffect(() => { setPage(0); }, [search, selCompany]);
  useEffect(() => { load(); }, [load]);

  const handleSave = async (body: CreateDepartmentRequest | UpdateDepartmentRequest, id?: string) => {
    if (id) {
      const res = await departmentService.update(id, body as UpdateDepartmentRequest);
      push('Departamento atualizado!'); load(); return res;
    } else {
      const res = await departmentService.create(body as CreateDepartmentRequest);
      push('Departamento criado!'); load(); return res;
    }
  };

  const handleDelete = async () => {
    await departmentService.remove(deleting!.id);
    push('Departamento desativado'); load();
  };

  const currentCompany = companies.find(c => c.id === selCompany);

  const pageNums = (() => {
    const out = [];
    for (let i = Math.max(0, page - 2); i <= Math.min(totalPg - 1, page + 2); i++) out.push(i);
    return out;
  })();

  return (
    <AppShell>
      <div className="page-flex-col">

        <div className="page-header page-header-pad" style={{ marginBottom: 0 }}>
          <div className="page-header-left">
            <div className="hierarchy-breadcrumb">
              {!isCustomer && (
                <>
                  <button className="hierarchy-crumb-link" onClick={() => navigate('/companies')}>
                    <Building2 size={13} /> Empresas
                  </button>
                  <Arrow size={13} style={{ color: '#334155' }} />
                </>
              )}
              {currentCompany ? (
                <span className="hierarchy-crumb-active"><FolderOpen size={13} />{currentCompany.name}</span>
              ) : (
                <span className="hierarchy-crumb-active"><FolderOpen size={13} />Todos os Departamentos</span>
              )}
            </div>
            <h1 style={{ marginTop: 6 }}>Departamentos</h1>
            <p>{currentCompany ? `Departamentos de ${currentCompany.name}` : 'Todos os departamentos da plataforma'}</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={14} className={loading ? 'spin' : ''} /> Atualizar</button>
            <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={14} /> Novo Departamento</button>
          </div>
        </div>

        <div className="page-section-pad" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="search-input-wrap" style={{ flex: 1, minWidth: 200, maxWidth: 300 }}>
              <Search size={14} />
              <input className="search-input" placeholder="Buscar por nome..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {!isCustomer && (
              <select
                className="form-select"
                style={{ height: 38, width: 'auto', minWidth: 200, maxWidth: 280 }}
                value={selCompany}
                onChange={e => {
                  const id = e.target.value;
                  if (!id) { setSelectedCompany(null); }
                  else {
                    const found = companies.find(c => c.id === id);
                    if (found) setSelectedCompany({ id: found.id, name: found.name });
                  }
                }}
              >
                <option value="">Todas as empresas</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>

          <div className="table-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="table-wrap" style={{ flex: 1, overflowY: 'auto' }}>
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Departamento</th>
                    <th>Empresa</th>
                    <th>Storage</th>
                    <th>Status</th>
                    <th>Base de Conhecimento</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr className="loading-row"><td colSpan={6}><div className="spinner" />Carregando...</td></tr>
                  ) : depts.length === 0 ? (
                    <tr><td colSpan={6}>
                      <div className="table-empty">
                        <FolderOpen size={28} />
                        <p>Nenhum departamento encontrado</p>
                        {selCompany && <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => setSelectedCompany(null)}>Ver todos</button>}
                      </div>
                    </td></tr>
                  ) : depts.map(d => (
                    <tr key={d.id}>
                      <td>
                        <div className="user-name-cell">
                          <div className="dept-avatar-sm">{deptInitials(d.name)}</div>
                          <div>
                            <div className="user-name">{d.name}</div>
                            <div className="user-email">{new Date(d.createdAt).toLocaleDateString('pt-BR')}</div>
                          </div>
                        </div>
                      </td>
                      {/* company vem aninhado no response */}
                      <td data-label="Empresa">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Building2 size={12} color="#475569" />
                          <span style={{ fontSize: 13, color: '#94a3b8' }}>{d.company?.name ?? '—'}</span>
                        </div>
                      </td>
                      {/* storage_quotas em KB */}
                      <td data-label="Storage">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Database size={12} color="#475569" />
                          <span style={{ fontSize: 13, color: '#94a3b8' }}>{formatKb(d.storageQuotas)}</span>
                        </div>
                      </td>
                      <td data-label="Status">
                        <span className={`pill ${d.active ? 'pill-green' : 'pill-gray'}`}>{d.active ? 'Ativo' : 'Inativo'}</span>
                      </td>
                      <td data-label="Base de Conhecimento">
                        <button className="btn-kb-link" onClick={() => navigate(`/knowledge-bases?departmentId=${d.id}`)} title="Ver Bases de Conhecimento">
                          <BookOpen size={13} /> Ver bases <Arrow size={11} />
                        </button>
                      </td>
                      <td>
                        <div className="actions-cell">
                          <button className="btn btn-ghost btn-icon" title="Editar" onClick={() => setEditing(d)}><Pencil size={14} /></button>
                          <button className="btn btn-danger-ghost btn-icon" title="Desativar" onClick={() => setDeleting(d)}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPg > 1 && (
              <div className="pagination">
                <span className="pagination-info">{total} departamento{total !== 1 ? 's' : ''} · pág {page + 1}/{totalPg}</span>
                <div className="pagination-btns">
                  <button className="page-btn" onClick={() => setPage(p => p - 1)} disabled={page === 0}><ChevronLeft size={13} /></button>
                  {pageNums.map(n => <button key={n} className={`page-btn ${n === page ? 'current' : ''}`} onClick={() => setPage(n)}>{n + 1}</button>)}
                  <button className="page-btn" onClick={() => setPage(p => p + 1)} disabled={page >= totalPg - 1}><ChevronRight size={13} /></button>
                </div>
              </div>
            )}
          </div>

          {/* Card hierarquia */}
          <div className="hierarchy-info-card">
            <div className="hierarchy-info-steps">
              <div className="hierarchy-step">
                <div className="hierarchy-step-icon" style={{ background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.25)' }}>
                  <Building2 size={14} color="#38bdf8" />
                </div>
                <span>Empresa</span>
              </div>
              <Arrow size={14} style={{ color: '#1e293b', flexShrink: 0 }} />
              <div className="hierarchy-step hierarchy-step-current">
                <div className="hierarchy-step-icon" style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.35)' }}>
                  <FolderOpen size={14} color="#a5b4fc" />
                </div>
                <span>Departamento</span>
              </div>
              <Arrow size={14} style={{ color: '#1e293b', flexShrink: 0 }} />
              <div className="hierarchy-step">
                <div className="hierarchy-step-icon" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <BookOpen size={14} color="#6ee7b7" />
                </div>
                <span>Base de Conhecimento</span>
              </div>
            </div>
            <p className="hierarchy-info-text">
              Cada departamento pertence a uma empresa e pode ter múltiplas bases de conhecimento.
              Clique em <strong>Ver bases</strong> para gerenciar as bases de conhecimento de um departamento.
            </p>
          </div>
        </div>
      </div>

      {(creating || editing) && (
        <DepartmentModal
          dept={editing}
          companies={companies}
          defaultCompanyId={selCompany}
          defaultCompanyName={selectedCompany?.name}
          isCustomer={isCustomer}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}
      {deleting && <DeleteModal dept={deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} />}

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
