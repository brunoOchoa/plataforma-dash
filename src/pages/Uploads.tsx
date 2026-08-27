import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, Trash2, ChevronLeft, ChevronRight, RefreshCw,
  X, Check, AlertTriangle, Upload as UploadIcon, FileText, File, Loader2,
  BookOpen, Cloud, User, RotateCw, Lock, Building2, FolderOpen, ChevronRight as Arrow,
} from 'lucide-react';
import { uploadService } from '../services/uploadService';
import { knowledgebaseService } from '../services/knowledgebaseService';
import { departmentService } from '../services/departmentService';
import type { DocumentUpload, DocumentStatus } from '../services/uploadService';
import type { KnowledgeBase } from '../types/knowledgebase';
import type { Department } from '../types/department';
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
function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
  if (bytes >= 1_048_576)     return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024)         return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function statusColor(s: DocumentStatus) {
  switch (s) {
    case 'AVAILABLE':  return 'pill-green';
    case 'PROCESSED':  return 'pill-blue';
    case 'PENDING':    return 'pill-amber';
    case 'ERROR':      return 'pill-red';
    default:           return 'pill-gray';
  }
}
function statusLabel(s: DocumentStatus) {
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
   UPLOAD MODAL — escolhe a KB e envia o arquivo
══════════════════════════════════════ */
function UploadModal({ knowledgeBases, defaultKbId, onClose, onUploaded }: {
  knowledgeBases: KnowledgeBase[];
  defaultKbId?: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  // KBs com source_type SHAREPOINT não aceitam upload manual (API rejeita com 400)
  const availableKbs = knowledgeBases.filter(kb => kb.source_type !== 'SHAREPOINT');

  const [kbId,      setKbId]      = useState(defaultKbId && availableKbs.some(k => k.id === defaultKbId) ? defaultKbId : (availableKbs[0]?.id ?? ''));
  const [uploading, setUploading] = useState(false);
  const [dragOver,  setDragOver]  = useState(false);
  const [error,     setError]     = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!kbId) { setError('Selecione uma base de conhecimento'); return; }
    const file = files[0];
    const allowed = [
      'application/pdf', 'image/png', 'image/jpeg',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    ];
    if (!allowed.includes(file.type)) {
      setError('Apenas PDF, PNG, JPEG, DOCX e PPTX são permitidos');
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setError('Arquivo deve ter no máximo 5 MB');
      return;
    }
    setError('');
    setUploading(true);
    try {
      await uploadService.upload(file, kbId);
      onUploaded();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.response?.data ?? 'Erro ao enviar arquivo';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const { closing, close } = useModalAnimation(onClose);
  return (
    <div className={`modal-backdrop${closing ? ' modal-closing' : ''}`} onClick={close}>
      <div className={`modal${closing ? ' modal-closing' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Novo Upload</h3>
            <p>Envie um documento para uma base de conhecimento</p>
          </div>
          <button className="modal-close" onClick={close}><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div className="api-error-box" style={{ marginBottom: 0 }}>
              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <div className="form-field">
            <label className="form-label">Base de Conhecimento *</label>
            <select className="form-select" value={kbId} onChange={e => setKbId(e.target.value)} disabled={uploading}>
              <option value="">Selecione uma base...</option>
              {availableKbs.map(kb => (
                <option key={kb.id} value={kb.id}>
                  {kb.department_name ? `${kb.department_name} › ` : ''}{kb.name}
                </option>
              ))}
            </select>
            {knowledgeBases.length > availableKbs.length && (
              <span className="form-hint">Bases conectadas ao SharePoint não aceitam upload manual</span>
            )}
          </div>

          <div
            className={`upload-dropzone ${dragOver ? 'dragover' : ''} ${uploading ? 'uploading' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => !uploading && kbId && fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.docx,.pptx" style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
            {uploading ? (
              <><Loader2 size={28} color="#60a5fa" className="spin" /><p className="upload-zone-text">Enviando arquivo…</p></>
            ) : (
              <>
                <UploadIcon size={28} color={dragOver ? '#60a5fa' : '#334155'} />
                <p className="upload-zone-text">{dragOver ? 'Solte o arquivo aqui' : 'Clique ou arraste um arquivo'}</p>
                <p className="upload-zone-hint">PDF, PNG, JPEG, DOCX, PPTX · máx 5 MB por arquivo</p>
              </>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={close} disabled={uploading}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   DELETE MODAL
══════════════════════════════════════ */
function DeleteModal({ doc, onClose, onConfirm }: { doc: DocumentUpload; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const handle = async () => {
    setLoading(true);
    try { await onConfirm(); onClose(); }
    catch (err: any) { setError(err?.response?.data?.message ?? 'Erro ao remover documento'); }
    finally { setLoading(false); }
  };
  const { closing, close } = useModalAnimation(onClose);
  return (
    <div className={`modal-backdrop${closing ? ' modal-closing' : ''}`} onClick={close}>
      <div className={`modal confirm-modal${closing ? ' modal-closing' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="modal-body" style={{ textAlign: 'center', padding: '32px 28px 20px' }}>
          <div className="confirm-icon"><Trash2 size={22} color="#f87171" /></div>
          <h4>Remover Documento?</h4>
          <p style={{ marginTop: 8 }}>O arquivo <strong style={{ color: '#f1f5f9' }}>{doc.filename}</strong> será removido permanentemente.</p>
          {error && <div className="api-error-box" style={{ marginTop: 16, textAlign: 'left' }}><AlertTriangle size={13} style={{ flexShrink: 0 }} /><span>{error}</span></div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={close} disabled={loading}>Cancelar</button>
          <button className="btn btn-danger" onClick={handle} disabled={loading}>
            {loading ? <><span className="spinner-sm" /> Removendo…</> : <><Trash2 size={14} /> Remover</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   UPLOADS PAGE
══════════════════════════════════════ */
export default function Uploads() {
  const navigate = useNavigate();
  const { isCustomer, selectedCompany } = useCompany();
  const [searchParams] = useSearchParams();
  const filterKbId = searchParams.get('knowledgeBaseId') ?? '';

  const [docs,           setDocs]           = useState<DocumentUpload[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [departments,    setDepartments]    = useState<Department[]>([]);
  const [search,         setSearch]         = useState('');
  const [selKb,          setSelKb]          = useState(filterKbId);
  const [selStatus,      setSelStatus]      = useState('');
  const [page,           setPage]           = useState(0);
  const [total,          setTotal]          = useState(0);
  const [totalPg,        setTotalPg]        = useState(1);
  const [loading,        setLoading]        = useState(false);
  const [uploadOpen,     setUploadOpen]     = useState(false);
  const [deleting,       setDeleting]       = useState<DocumentUpload | null>(null);
  const [retryingIds,    setRetryingIds]    = useState<Set<string>>(new Set());

  const { toasts, push } = useToast();

  useEffect(() => {
    const params: Record<string, any> = { size: 100 };
    if (selectedCompany?.id) params.companyId = selectedCompany.id;
    knowledgebaseService.list(params)
      .then(r => setKnowledgeBases(r.content))
      .catch(() => {});
    departmentService.list({ size: 100 })
      .then(r => setDepartments(r.content))
      .catch(() => {});
  }, [selectedCompany]);

  // reseta o filtro de base ao trocar a empresa no contexto global — evita ficar com
  // uma KB selecionada que não pertence mais à empresa atual
  useEffect(() => { setSelKb(''); }, [selectedCompany]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, size: 15 };
      if (selKb) params.knowledgeBaseId = selKb;
      const r = await uploadService.list(params);
      setDocs(r.content);
      setTotal(r.totalElements);
      setTotalPg(r.totalPages || 1);
    } catch {
      push('Erro ao carregar uploads', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, selKb, push]);

  useEffect(() => { setPage(0); }, [selKb]);
  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    await uploadService.remove(deleting!.id);
    push('Documento removido'); load();
  };

  const handleRetry = async (doc: DocumentUpload) => {
    setRetryingIds(p => new Set(p).add(doc.id));
    try {
      await uploadService.retry(doc.id);
      push('Reprocessamento disparado — o arquivo volta pra fila em instantes');
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Erro ao reprocessar documento';
      push(typeof msg === 'string' ? msg : 'Erro ao reprocessar documento', 'error');
    } finally {
      setRetryingIds(p => { const next = new Set(p); next.delete(doc.id); return next; });
    }
  };

  // filtro rápido por nome/status dentro da página carregada — a API não pagina por esses campos
  const visibleDocs = docs.filter(d => {
    if (search && !d.filename.toLowerCase().includes(search.toLowerCase())) return false;
    if (selStatus && d.status !== selStatus) return false;
    return true;
  });

  const currentKb = knowledgeBases.find(k => k.id === selKb);
  const currentDept = departments.find(d => d.id === currentKb?.department_id);

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
              <button className="hierarchy-crumb-link"
                onClick={() => navigate(currentKb?.department_id ? `/knowledge-bases?departmentId=${currentKb.department_id}` : '/knowledge-bases')}>
                <BookOpen size={13} /> {currentKb?.name ?? 'Base de Conhecimento'}
              </button>
              <Arrow size={13} style={{ color: '#334155' }} />
              <span className="hierarchy-crumb-active"><UploadIcon size={13} /> Uploads</span>
            </div>
            <h1 style={{ marginTop: 6 }}>Uploads</h1>
            <p>{currentKb ? `Documentos da base ${currentKb.name}` : 'Todos os documentos enviados para as bases de conhecimento'}</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={14} className={loading ? 'spin' : ''} /> Atualizar</button>
            <button className="btn btn-primary" onClick={() => setUploadOpen(true)}><UploadIcon size={14} /> Novo Upload</button>
          </div>
        </div>

        <div className="page-section-pad" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="search-input-wrap" style={{ flex: 1, minWidth: 200, maxWidth: 300 }}>
              <Search size={14} />
              <input className="search-input" placeholder="Buscar por nome do arquivo..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="form-select" style={{ height: 38, width: 'auto', minWidth: 220, maxWidth: 300 }} value={selKb} onChange={e => setSelKb(e.target.value)}>
              <option value="">Todas as bases</option>
              {knowledgeBases.map(kb => (
                <option key={kb.id} value={kb.id}>
                  {kb.department_name ? `${kb.department_name} › ` : ''}{kb.name}
                </option>
              ))}
            </select>
            <select className="form-select" style={{ height: 38, width: 'auto', minWidth: 160 }} value={selStatus} onChange={e => setSelStatus(e.target.value)}>
              <option value="">Todos os status</option>
              <option value="AVAILABLE">Disponível</option>
              <option value="PROCESSED">Processado</option>
              <option value="PENDING">Pendente</option>
              <option value="ERROR">Erro</option>
              <option value="TRASH">Lixo</option>
            </select>
          </div>

          <div className="table-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="table-wrap" style={{ flex: 1, overflowY: 'auto' }}>
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Arquivo</th>
                    <th>Base de Conhecimento</th>
                    <th>Origem</th>
                    <th>Tamanho</th>
                    <th>Status</th>
                    <th>Enviado em</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr className="loading-row"><td colSpan={7}><div className="spinner" />Carregando...</td></tr>
                  ) : visibleDocs.length === 0 ? (
                    <tr><td colSpan={7}>
                      <div className="table-empty">
                        <File size={28} />
                        <p>Nenhum documento encontrado</p>
                        {(search || selStatus || selKb) && (
                          <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => { setSearch(''); setSelStatus(''); setSelKb(''); }}>Limpar filtros</button>
                        )}
                      </div>
                    </td></tr>
                  ) : visibleDocs.map(d => (
                    <tr key={d.id}>
                      <td>
                        <div className="user-name-cell">
                          <div className="doc-item-icon" style={{ flexShrink: 0 }}><FileText size={15} color="#60a5fa" /></div>
                          <div>
                            <div className="user-name">{d.filename}</div>
                            {d.status === 'ERROR' && d.error_message && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#fca5a5', marginTop: 2 }}>
                                <AlertTriangle size={10} style={{ flexShrink: 0 }} />{d.error_message}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <BookOpen size={12} color="#475569" />
                          <span style={{ fontSize: 13, color: '#94a3b8' }}>{d.knowledgeBaseName ?? '—'}</span>
                        </div>
                      </td>
                      <td>
                        {d.from_sharepoint ? (
                          <span className="pill pill-blue"><Cloud size={10} /> SharePoint</span>
                        ) : (
                          <span className="pill pill-gray"><User size={10} /> Manual</span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: 13, color: '#94a3b8' }}>{formatBytes(d.sizeBytes)}</span>
                      </td>
                      <td>
                        <span className={`pill ${statusColor(d.status)}`}>{statusLabel(d.status)}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: 13, color: '#94a3b8' }}>
                          {new Date(d.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td>
                        <div className="actions-cell">
                          {d.from_sharepoint && d.status === 'ERROR' && (
                            <button
                              className="btn btn-ghost btn-icon"
                              title="Baixar novamente do SharePoint"
                              onClick={() => handleRetry(d)}
                              disabled={retryingIds.has(d.id)}
                            >
                              <RotateCw size={14} className={retryingIds.has(d.id) ? 'spin' : ''} />
                            </button>
                          )}
                          <button
                            className="btn btn-danger-ghost btn-icon"
                            title={d.from_sharepoint ? 'Origem SharePoint — remova pela fonte ou desabilite-a' : 'Remover'}
                            onClick={() => setDeleting(d)}
                            disabled={d.from_sharepoint}
                          >
                            {d.from_sharepoint ? <Lock size={14} /> : <Trash2 size={14} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPg > 1 && (
              <div className="pagination">
                <span className="pagination-info">{total} documento{total !== 1 ? 's' : ''} · pág {page + 1}/{totalPg}</span>
                <div className="pagination-btns">
                  <button className="page-btn" onClick={() => setPage(p => p - 1)} disabled={page === 0}><ChevronLeft size={13} /></button>
                  {pageNums.map(n => <button key={n} className={`page-btn ${n === page ? 'current' : ''}`} onClick={() => setPage(n)}>{n + 1}</button>)}
                  <button className="page-btn" onClick={() => setPage(p => p + 1)} disabled={page >= totalPg - 1}><ChevronRight size={13} /></button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {uploadOpen && (
        <UploadModal
          knowledgeBases={knowledgeBases}
          defaultKbId={selKb}
          onClose={() => setUploadOpen(false)}
          onUploaded={() => { push('Documento enviado!'); load(); }}
        />
      )}
      {deleting && <DeleteModal doc={deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} />}

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
