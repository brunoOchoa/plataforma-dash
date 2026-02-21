import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, Plus, Pencil, Trash2,
  ChevronLeft, ChevronRight, RefreshCw,
  X, Check, AlertTriangle,
  BookOpen, FolderOpen, Building2, ChevronRight as Arrow,
  Cpu, Lock, FileText, Upload, File, Loader2,
} from 'lucide-react';
import { knowledgebaseService } from '../services/knowledgebaseService';
import { departmentService }    from '../services/departmentService';
import { uploadService }        from '../services/uploadService';
import type { KnowledgeBase, CreateKnowledgeBaseRequest, UpdateKnowledgeBaseRequest, EmbedModelType } from '../types/knowledgebase';
import { EMBED_MODEL_OPTIONS }  from '../types/knowledgebase';
import type { Department }      from '../types/department';
import type { DocumentUpload }  from '../services/uploadService';
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
function formatKb(kb: number) {
  if (!kb) return '0 KB';
  if (kb >= 1_048_576) return `${(kb / 1_048_576).toFixed(2)} GB`;
  if (kb >= 1_024)     return `${(kb / 1_024).toFixed(1)} MB`;
  return `${kb} KB`;
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
  if (bytes >= 1_048_576)     return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024)         return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function kbInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function modelLabel(type: EmbedModelType) {
  return EMBED_MODEL_OPTIONS.find(o => o.value === type)?.label ?? type;
}

function modelColor(type: EmbedModelType): string {
  const map: Record<EmbedModelType, string> = {
    ALL_MINILM_L6_V2_384:        'model-chip-teal',
    NOMIC_EMBED_TEXT_768:        'model-chip-violet',
    TEXT_EMBEDDING_3_SMALL_1536: 'model-chip-blue',
    TEXT_EMBEDDING_3_LARGE_3072: 'model-chip-indigo',
  };
  return map[type] ?? 'model-chip-gray';
}

function statusColor(s: string) {
  switch (s) {
    case 'AVAILABLE':  return 'pill-green';
    case 'PROCESSED':  return 'pill-blue';
    case 'PENDING':    return 'pill-amber';
    case 'ERROR':      return 'pill-red';
    default:           return 'pill-gray';
  }
}
function statusLabel(s: string) {
  switch (s) {
    case 'AVAILABLE':  return 'Disponível';
    case 'PROCESSED':  return 'Processado';
    case 'PENDING':    return 'Pendente';
    case 'ERROR':      return 'Erro';
    case 'TRASH':      return 'Lixo';
    default:           return s;
  }
}

/* ══════════════════════════════════════
   MODEL SELECTOR (create only)
══════════════════════════════════════ */
function ModelSelector({ value, onChange }: { value: EmbedModelType; onChange: (v: EmbedModelType) => void }) {
  return (
    <div className="model-selector-grid">
      {EMBED_MODEL_OPTIONS.map(opt => (
        <button
          key={opt.value}
          type="button"
          className={`model-option ${value === opt.value ? 'selected' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          <div className="model-option-header">
            <span className={`model-chip ${modelColor(opt.value)}`}>{opt.label}</span>
            <span className="model-dims">{opt.dims.toLocaleString()} dims</span>
          </div>
          <p className="model-desc">{opt.description}</p>
          {value === opt.value && (
            <div className="model-check"><Check size={10} /></div>
          )}
        </button>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════
   DOCUMENTS PANEL — upload + lista
══════════════════════════════════════ */
function DocumentsPanel({ kb, onClose }: { kb: KnowledgeBase; onClose: () => void }) {
  const [docs,      setDocs]      = useState<DocumentUpload[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver,  setDragOver]  = useState(false);
  const [error,     setError]     = useState('');
  const [deleting,  setDeleting]  = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const r = await uploadService.list({ knowledgeBaseId: kb.id, size: 50 });
      setDocs(r.content);
    } catch {
      setError('Erro ao carregar documentos');
    } finally {
      setLoading(false);
    }
  }, [kb.id]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
    if (!allowed.includes(file.type)) {
      setError('Apenas PDF, PNG e JPEG são permitidos');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Arquivo deve ter no máximo 5 MB');
      return;
    }
    setError('');
    setUploading(true);
    try {
      await uploadService.upload(file, kb.id);
      await loadDocs();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.response?.data ?? 'Erro ao enviar arquivo';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await uploadService.remove(id);
      setDocs(p => p.filter(d => d.id !== id));
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Erro ao remover documento';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setDeleting(null);
    }
  };

  const { closing, close } = useModalAnimation(onClose);
  return (
    <div className={`modal-backdrop${closing ? ' modal-closing' : ''}`} onClick={close}>
      <div className={`modal modal-lg${closing ? ' modal-closing' : ''}`} style={{ maxWidth: 640, maxHeight: '88vh' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookOpen size={16} color="#6ee7b7" /> {kb.name}
            </h3>
            <p>Documentos da base · {kb.department_name ?? '—'}</p>
          </div>
          <button className="modal-close" onClick={close}><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div className="api-error-box" style={{ marginBottom: 0 }}>
              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
              <span>{error}</span>
              <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', padding: 0 }}>
                <X size={13} />
              </button>
            </div>
          )}

          <div
            className={`upload-dropzone ${dragOver ? 'dragover' : ''} ${uploading ? 'uploading' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => !uploading && fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
            {uploading ? (
              <><Loader2 size={28} color="#60a5fa" className="spin" /><p className="upload-zone-text">Enviando arquivo…</p></>
            ) : (
              <>
                <Upload size={28} color={dragOver ? '#60a5fa' : '#334155'} />
                <p className="upload-zone-text">{dragOver ? 'Solte o arquivo aqui' : 'Clique ou arraste um arquivo'}</p>
                <p className="upload-zone-hint">PDF, PNG, JPEG · máx 5 MB por arquivo</p>
              </>
            )}
          </div>

          <div className="docs-list-header">
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Documentos ({docs.length})
            </span>
            <button className="btn btn-ghost" style={{ height: 28, padding: '0 10px', fontSize: 12 }} onClick={loadDocs} disabled={loading}>
              <RefreshCw size={12} className={loading ? 'spin' : ''} /> Atualizar
            </button>
          </div>

          <div className="docs-list">
            {loading && docs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#334155' }}>
                <div className="spinner" style={{ margin: '0 auto 12px' }} />Carregando documentos…
              </div>
            ) : docs.length === 0 ? (
              <div className="docs-empty">
                <File size={24} style={{ opacity: 0.3 }} />
                <p>Nenhum documento enviado ainda</p>
              </div>
            ) : docs.map(doc => (
              <div key={doc.id} className="doc-item">
                <div className="doc-item-icon"><FileText size={15} color="#60a5fa" /></div>
                <div className="doc-item-info">
                  <p className="doc-item-name">{doc.filename}</p>
                  <p className="doc-item-meta">
                    {formatBytes(doc.sizeBytes)}
                    <span className="doc-sep">·</span>
                    {new Date(doc.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <span className={`pill ${statusColor(doc.status)}`} style={{ flexShrink: 0, fontSize: 10 }}>
                  {statusLabel(doc.status)}
                </span>
                <button className="btn btn-danger-ghost btn-icon" title="Remover" onClick={() => handleDelete(doc.id)} disabled={deleting === doc.id} style={{ flexShrink: 0 }}>
                  {deleting === doc.id ? <span className="spinner-sm" style={{ borderTopColor: '#f87171' }} /> : <Trash2 size={14} />}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: '#475569' }}>
            Tamanho total da base: <strong style={{ color: '#94a3b8' }}>{formatKb(kb.size_kb)}</strong>
          </span>
          <button className="btn btn-secondary" onClick={close}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   KB FORM MODAL
══════════════════════════════════════ */
interface KbModalProps {
  kb: KnowledgeBase | null;
  departments: Department[];
  defaultDeptId?: string;
  onClose: () => void;
  onSave: (data: CreateKnowledgeBaseRequest | UpdateKnowledgeBaseRequest, id?: string) => Promise<KnowledgeBase>;
}

function KbModal({ kb, departments, defaultDeptId, onClose, onSave }: KbModalProps) {
  const isEdit = !!kb;

  const [form, setForm] = useState({
    name:          kb?.name            ?? '',
    description:   kb?.description     ?? '',
    modelType:     (kb?.model_type     ?? 'ALL_MINILM_L6_V2_384') as EmbedModelType,
    departmentId:  kb?.department_id   ?? defaultDeptId ?? (departments[0]?.id ?? ''),
    active:        kb?.active          ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: keyof typeof form, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Nome é obrigatório';
    else if (form.name.trim().length < 3)   e.name = 'Mínimo 3 caracteres';
    else if (form.name.trim().length > 100) e.name = 'Máximo 100 caracteres';
    if (!form.departmentId) e.departmentId = 'Selecione um departamento';
    if (form.description && form.description.length > 512) e.description = 'Máximo 512 caracteres';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (isEdit) {
        const body: UpdateKnowledgeBaseRequest = {
          name:        form.name.trim(),
          description: form.description.trim() || null,
          active:      form.active,
        };
        await onSave(body, kb!.id);
      } else {
        const body: CreateKnowledgeBaseRequest = {
          name:          form.name.trim(),
          description:   form.description.trim() || null,
          model_type:    form.modelType,
          department_id: form.departmentId,
        };
        await onSave(body);
      }
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.response?.data ?? 'Erro ao salvar';
      setErrors({ _api: typeof msg === 'string' ? msg : JSON.stringify(msg) });
    } finally {
      setSaving(false);
    }
  };

  const { closing, close } = useModalAnimation(onClose);
  return (
    <div className={`modal-backdrop${closing ? ' modal-closing' : ''}`} onClick={close}>
      <div className={`modal modal-lg${closing ? ' modal-closing' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>{isEdit ? 'Editar Base de Conhecimento' : 'Nova Base de Conhecimento'}</h3>
            <p>{isEdit ? `Editando ${kb!.name}` : 'Crie um repositório de documentos para um departamento'}</p>
          </div>
          <button className="modal-close" onClick={close}><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {errors._api && (
            <div className="api-error-box">
              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
              <span>{errors._api}</span>
            </div>
          )}

          <div className="form-field">
            <label className="form-label">Nome da Base *</label>
            <input className={`form-input ${errors.name ? 'error' : ''}`} placeholder="Ex: Manual de RH" value={form.name} onChange={e => set('name', e.target.value)} maxLength={100} />
            {errors.name && <span className="form-error-msg">{errors.name}</span>}
          </div>

          <div className="form-field">
            <label className="form-label">Departamento *</label>
            <select className={`form-select ${errors.departmentId ? 'error' : ''}`} value={form.departmentId} onChange={e => set('departmentId', e.target.value)} disabled={isEdit}>
              <option value="">Selecione um departamento...</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>
                  {d.company?.name ? `${d.company.name} › ` : ''}{d.name}
                </option>
              ))}
            </select>
            {errors.departmentId && <span className="form-error-msg">{errors.departmentId}</span>}
            {isEdit && <span className="form-hint">O departamento não pode ser alterado</span>}
          </div>

          <div className="form-field">
            <label className="form-label">Descrição <span className="form-hint" style={{ marginLeft: 4 }}>opcional · max 512</span></label>
            <textarea className={`form-input form-textarea ${errors.description ? 'error' : ''}`} placeholder="Descreva o conteúdo desta base..." value={form.description} onChange={e => set('description', e.target.value)} maxLength={512} rows={3} />
            <span className="form-hint" style={{ textAlign: 'right' }}>{form.description.length}/512</span>
            {errors.description && <span className="form-error-msg">{errors.description}</span>}
          </div>

          {!isEdit ? (
            <div className="form-field">
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Modelo de Embedding *</label>
                <span className="form-hint" style={{ color: '#f59e0b' }}>
                  <Lock size={10} style={{ display: 'inline', marginRight: 3 }} />Imutável após criação
                </span>
              </div>
              <ModelSelector value={form.modelType} onChange={v => set('modelType', v)} />
              <div className="warning-box" style={{ marginTop: 10 }}>
                <AlertTriangle size={13} color="#fbbf24" style={{ flexShrink: 0 }} />
                <span>O modelo <strong>não pode ser alterado</strong> depois que a base for criada.</span>
              </div>
            </div>
          ) : (
            <div className="form-field">
              <label className="form-label">Modelo de Embedding</label>
              <div className="model-locked-display">
                <Cpu size={14} color="#6ee7b7" style={{ flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{modelLabel(kb!.model_type)}</p>
                  <p style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{EMBED_MODEL_OPTIONS.find(o => o.value === kb!.model_type)?.description}</p>
                </div>
                <span className="pill pill-gray" style={{ marginLeft: 'auto' }}><Lock size={9} /> Fixo</span>
              </div>
            </div>
          )}

          {isEdit && (
            <div className="toggle-wrap">
              <span>Base ativa</span>
              <label className="toggle">
                <input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} />
                <span className="toggle-track" /><span className="toggle-thumb" />
              </label>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={close} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? <><span className="spinner-sm" /> Salvando…</> : <><Check size={14} />{isEdit ? 'Salvar' : 'Criar Base'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   DELETE MODAL
══════════════════════════════════════ */
function DeleteModal({ kb, onClose, onConfirm }: { kb: KnowledgeBase; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const handle = async () => {
    setLoading(true);
    try { await onConfirm(); onClose(); }
    catch (err: any) { setError(err?.response?.data?.message ?? 'Erro ao desativar base'); }
    finally { setLoading(false); }
  };
  const { closing, close } = useModalAnimation(onClose);
  return (
    <div className={`modal-backdrop${closing ? ' modal-closing' : ''}`} onClick={close}>
      <div className={`modal confirm-modal${closing ? ' modal-closing' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="modal-body" style={{ textAlign: 'center', padding: '32px 28px 20px' }}>
          <div className="confirm-icon"><Trash2 size={22} color="#f87171" /></div>
          <h4>Desativar Base de Conhecimento?</h4>
          <p style={{ marginTop: 8 }}>A base <strong style={{ color: '#f1f5f9' }}>{kb.name}</strong> será desativada. Os documentos existentes não serão excluídos.</p>
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
   KNOWLEDGE BASES PAGE
══════════════════════════════════════ */
export default function KnowledgeBases() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterDeptId = searchParams.get('departmentId') ?? '';
  const { selectedCompany, isCustomer } = useCompany();

  const [bases,          setBases]          = useState<KnowledgeBase[]>([]);
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [search,         setSearch]         = useState('');
  const [selDept,        setSelDept]        = useState(filterDeptId);
  const [page,           setPage]           = useState(0);
  const [total,          setTotal]          = useState(0);
  const [totalPg,        setTotalPg]        = useState(1);
  const [loading,        setLoading]        = useState(false);
  const [creating,       setCreating]       = useState(false);
  const [editing,        setEditing]        = useState<KnowledgeBase | null>(null);
  const [deleting,       setDeleting]       = useState<KnowledgeBase | null>(null);
  const [docsKb,         setDocsKb]         = useState<KnowledgeBase | null>(null);

  const { toasts, push } = useToast();

  // Carrega todos os departamentos uma vez (size=100, máximo da API)
  useEffect(() => {
    departmentService.list({ size: 100, active: true })
      .then(r => setAllDepartments(r.content))
      .catch(() => {});
  }, []);

  // Reseta filtro de departamento ao trocar empresa no contexto global
  useEffect(() => {
    setSelDept('');
  }, [selectedCompany]);

  // Departamentos exibidos no select de filtro (filtrados pela empresa do contexto no JS)
  const departments = selectedCompany?.id
    ? allDepartments.filter(d => d.company?.id === selectedCompany.id)
    : allDepartments;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, size: 15 };
      if (search)                params.name         = search;
      if (selDept)               params.departmentId = selDept;
      if (selectedCompany?.id)   params.companyId    = selectedCompany.id;
      const r = await knowledgebaseService.list(params);
      setBases(r.content);
      setTotal(r.totalElements);
      setTotalPg(r.totalPages || 1);
    } catch {
      push('Erro ao carregar bases de conhecimento', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, selDept, selectedCompany, push]);

  useEffect(() => { setPage(0); }, [search, selDept, selectedCompany]);
  useEffect(() => { load(); }, [load]);

  const handleSave = async (body: CreateKnowledgeBaseRequest | UpdateKnowledgeBaseRequest, id?: string) => {
    if (id) {
      const res = await knowledgebaseService.update(id, body as UpdateKnowledgeBaseRequest);
      push('Base atualizada!'); load(); return res;
    } else {
      const res = await knowledgebaseService.create(body as CreateKnowledgeBaseRequest);
      push('Base de conhecimento criada!'); load(); return res;
    }
  };

  const handleDelete = async () => {
    await knowledgebaseService.remove(deleting!.id);
    push('Base desativada'); load();
  };

  const currentDept = departments.find(d => d.id === selDept);

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
                  <button className="hierarchy-crumb-link" onClick={() => navigate('/companies')}><Building2 size={13} /> Empresas</button>
                  <Arrow size={13} style={{ color: '#334155' }} />
                </>
              )}
              <button className="hierarchy-crumb-link"
                onClick={() => navigate(currentDept?.company?.id ? `/departments?companyId=${currentDept.company.id}` : '/departments')}>
                <FolderOpen size={13} /> {currentDept?.name ?? 'Departamentos'}
              </button>
              <Arrow size={13} style={{ color: '#334155' }} />
              <span className="hierarchy-crumb-active"><BookOpen size={13} /> Base de Conhecimento</span>
            </div>
            <h1 style={{ marginTop: 6 }}>Bases de Conhecimento</h1>
            <p>{currentDept ? `Bases do departamento ${currentDept.name}` : 'Todos os repositórios de documentos da plataforma'}</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={14} className={loading ? 'spin' : ''} /> Atualizar</button>
            <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={14} /> Nova Base</button>
          </div>
        </div>

        <div className="page-section-pad" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="search-input-wrap" style={{ flex: 1, minWidth: 200, maxWidth: 300 }}>
              <Search size={14} />
              <input className="search-input" placeholder="Buscar por nome..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="form-select" style={{ height: 38, width: 'auto', minWidth: 220, maxWidth: 300 }} value={selDept} onChange={e => setSelDept(e.target.value)}>
              <option value="">Todos os departamentos</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>
                  {/* Se não há empresa selecionada no contexto, mostra "Empresa › Dept" */}
                  {!selectedCompany && d.company?.name ? `${d.company.name} › ` : ''}{d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="table-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="table-wrap" style={{ flex: 1, overflowY: 'auto' }}>
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Base de Conhecimento</th>
                    <th>Departamento</th>
                    <th>Modelo</th>
                    <th>Tamanho</th>
                    <th>Status</th>
                    <th>Documentos</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr className="loading-row"><td colSpan={7}><div className="spinner" />Carregando...</td></tr>
                  ) : bases.length === 0 ? (
                    <tr><td colSpan={7}>
                      <div className="table-empty">
                        <BookOpen size={28} />
                        <p>Nenhuma base de conhecimento encontrada</p>
                        {selDept && <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => setSelDept('')}>Ver todas</button>}
                      </div>
                    </td></tr>
                  ) : bases.map(b => (
                    <tr key={b.id}>
                      <td>
                        <div className="user-name-cell">
                          <div className="kb-avatar-sm">{kbInitials(b.name)}</div>
                          <div>
                            <div className="user-name">{b.name}</div>
                            {b.description && (
                              <div className="user-email" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {b.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* department_name — campo snake_case da API */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <FolderOpen size={12} color="#475569" />
                          <span style={{ fontSize: 13, color: '#94a3b8' }}>{b.department_name ?? '—'}</span>
                        </div>
                      </td>
                      {/* model_type — campo snake_case da API */}
                      <td>
                        <span className={`model-chip ${modelColor(b.model_type)}`}>{modelLabel(b.model_type)}</span>
                      </td>
                      {/* size_kb — campo snake_case da API */}
                      <td>
                        <span style={{ fontSize: 13, color: '#94a3b8' }}>{formatKb(b.size_kb)}</span>
                      </td>
                      <td>
                        <span className={`pill ${b.active ? 'pill-green' : 'pill-gray'}`}>{b.active ? 'Ativa' : 'Inativa'}</span>
                      </td>
                      <td>
                        <button className="btn-kb-link" onClick={() => setDocsKb(b)} title="Ver e enviar documentos">
                          <Upload size={13} /> Documentos <Arrow size={11} />
                        </button>
                      </td>
                      <td>
                        <div className="actions-cell">
                          <button className="btn btn-ghost btn-icon" title="Editar" onClick={() => setEditing(b)}><Pencil size={14} /></button>
                          <button className="btn btn-danger-ghost btn-icon" title="Desativar" onClick={() => setDeleting(b)}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPg > 1 && (
              <div className="pagination">
                <span className="pagination-info">{total} base{total !== 1 ? 's' : ''} · pág {page + 1}/{totalPg}</span>
                <div className="pagination-btns">
                  <button className="page-btn" onClick={() => setPage(p => p - 1)} disabled={page === 0}><ChevronLeft size={13} /></button>
                  {pageNums.map(n => <button key={n} className={`page-btn ${n === page ? 'current' : ''}`} onClick={() => setPage(n)}>{n + 1}</button>)}
                  <button className="page-btn" onClick={() => setPage(p => p + 1)} disabled={page >= totalPg - 1}><ChevronRight size={13} /></button>
                </div>
              </div>
            )}
          </div>

          <div className="kb-models-info">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Cpu size={14} color="#6ee7b7" />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>Modelos de Embedding disponíveis</span>
            </div>
            <div className="kb-models-grid">
              {EMBED_MODEL_OPTIONS.map(opt => (
                <div key={opt.value} className="kb-model-card">
                  <span className={`model-chip ${modelColor(opt.value)}`}>{opt.label}</span>
                  <span style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{opt.description}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {(creating || editing) && (
        <KbModal kb={editing} departments={departments} defaultDeptId={selDept}
          onClose={() => { setCreating(false); setEditing(null); }} onSave={handleSave} />
      )}
      {deleting && <DeleteModal kb={deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} />}
      {docsKb   && <DocumentsPanel kb={docsKb} onClose={() => setDocsKb(null)} />}

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
