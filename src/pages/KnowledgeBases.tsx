import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, Plus, Pencil, Trash2,
  ChevronLeft, ChevronRight, RefreshCw,
  X, Check, AlertTriangle,
  BookOpen, FolderOpen, Building2, ChevronRight as Arrow,
  Cpu, Lock, FileText, Upload,
  Cloud, FolderTree, RotateCw, PlugZap, Folder,
} from 'lucide-react';
import { knowledgebaseService } from '../services/knowledgebaseService';
import { departmentService }    from '../services/departmentService';
import { sharepointSourceService } from '../services/sharepointSourceService';
import type { KnowledgeBase, CreateKnowledgeBaseRequest, UpdateKnowledgeBaseRequest, EmbedModelType } from '../types/knowledgebase';
import { EMBED_MODEL_OPTIONS }  from '../types/knowledgebase';
import type { Department }      from '../types/department';
import type { SharepointSource, SharepointSourceRequest, SharepointTestConnectionResponse, SharepointSyncStatus } from '../types/sharepointSource';
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

function syncStatusColor(s: SharepointSyncStatus) {
  switch (s) {
    case 'SYNCED':       return 'pill-green';
    case 'SYNCING':      return 'pill-blue';
    case 'ERROR':        return 'pill-red';
    case 'NEVER_SYNCED':
    default:              return 'pill-gray';
  }
}
function syncStatusLabel(s: SharepointSyncStatus) {
  switch (s) {
    case 'SYNCED':       return 'Sincronizado';
    case 'SYNCING':      return 'Sincronizando';
    case 'ERROR':        return 'Erro na sync';
    case 'NEVER_SYNCED':
    default:              return 'Nunca sincronizado';
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
   SHAREPOINT SOURCE MODAL
   1 fonte por base de conhecimento — aponta pra um site/biblioteca/pasta do
   SharePoint, usando as credenciais da Connection do departamento da KB.
══════════════════════════════════════ */
function SharepointSourceModal({ kb, onClose, push, onChanged }: {
  kb: KnowledgeBase; onClose: () => void;
  push: (msg: string, type?: 'success' | 'error') => void;
  onChanged: () => void;
}) {
  const [loading,  setLoading]  = useState(true);
  const [source,   setSource]   = useState<SharepointSource | null>(null);
  const [editing,  setEditing]  = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [removing, setRemoving] = useState(false);
  const [testing,  setTesting]  = useState(false);
  const [syncing,  setSyncing]  = useState(false);
  const [testResult, setTestResult] = useState<SharepointTestConnectionResponse | null>(null);
  const [syncMsg,  setSyncMsg]  = useState('');
  const [errors,   setErrors]   = useState<Record<string, string>>({});

  const [form, setForm] = useState({ siteHostname: '', sitePath: '', libraryName: '', folderPaths: [] as string[], enabled: true });
  const set = (k: 'siteHostname' | 'sitePath' | 'libraryName', v: string) => setForm(p => ({ ...p, [k]: v }));
  const setEnabled = (v: boolean) => setForm(p => ({ ...p, enabled: v }));

  const [folderInput, setFolderInput] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState('');
  const [pickerItems, setPickerItems] = useState<SharepointTestConnectionResponse['items']>([]);
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set());

  const buildRequestBody = (folderPaths: string[] = form.folderPaths): SharepointSourceRequest => ({
    knowledgeBaseId: kb.id,
    siteHostname: form.siteHostname.trim(),
    sitePath: form.sitePath.trim(),
    libraryName: form.libraryName.trim() || null,
    folderPaths,
    enabled: form.enabled,
  });

  /**
   * Atualiza a lista de pastas local E, se a Source já existe, salva na hora --
   * sem isso, escolher pastas (ou digitar/remover uma) ficava só no formulário até um
   * clique manual em "Salvar", e um "Sincronizar Agora" nesse meio-tempo usava o que
   * já estava salvo no banco (a raiz inteira, se a Source acabou de ser criada pelo
   * seletor com folderPaths ainda vazio) em vez das pastas recém-escolhidas.
   */
  const persistFolderPaths = async (folderPaths: string[]) => {
    setForm(p => ({ ...p, folderPaths }));
    if (!source) return;
    try {
      const r = await sharepointSourceService.update(source.id, buildRequestBody(folderPaths));
      setSource(r);
      onChanged();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.response?.data ?? 'Erro ao salvar pastas selecionadas';
      push(typeof msg === 'string' ? msg : 'Erro ao salvar pastas selecionadas', 'error');
    }
  };

  const addFolder = (path: string) => {
    const trimmed = path.trim();
    if (!trimmed || form.folderPaths.includes(trimmed)) return;
    persistFolderPaths([...form.folderPaths, trimmed]);
  };
  const removeFolder = (path: string) => persistFolderPaths(form.folderPaths.filter(f => f !== path));

  /**
   * root-items precisa de uma Source já salva (lê site/biblioteca/conexão do banco).
   * Se o usuário ainda está criando, salva automaticamente com os dados já
   * preenchidos (silencioso, sem fechar o formulário) pra poder abrir o seletor sem
   * exigir um clique extra em "Salvar" antes.
   */
  const ensureSourceForPicker = async (): Promise<SharepointSource | null> => {
    if (source) return source;
    if (!validate()) return null;
    setSaving(true);
    try {
      const r = await sharepointSourceService.create(buildRequestBody());
      setSource(r);
      push('Fonte SharePoint conectada!');
      onChanged();
      return r;
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.response?.data ?? 'Erro ao salvar fonte';
      setErrors({ _api: typeof msg === 'string' ? msg : JSON.stringify(msg) });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const openPicker = async () => {
    const src = await ensureSourceForPicker();
    if (!src) return;
    setPickerOpen(true);
    setPickerLoading(true);
    setPickerError('');
    setPickerSelected(new Set(form.folderPaths));
    try {
      const r = await sharepointSourceService.listRootItems(src.id);
      if (r.success) setPickerItems(r.items.filter(it => it.folder));
      else setPickerError(r.error ?? 'Falha ao listar pastas');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Erro ao listar pastas da raiz';
      setPickerError(typeof msg === 'string' ? msg : 'Erro ao listar pastas da raiz');
    } finally {
      setPickerLoading(false);
    }
  };
  const togglePickerItem = (name: string) => setPickerSelected(p => {
    const next = new Set(p);
    if (next.has(name)) next.delete(name); else next.add(name);
    return next;
  });
  const confirmPicker = () => {
    persistFolderPaths(Array.from(new Set([...form.folderPaths, ...pickerSelected])));
    setPickerOpen(false);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await sharepointSourceService.getByKnowledgeBase(kb.id);
      setSource(r);
      setForm({ siteHostname: r.siteHostname, sitePath: r.sitePath, libraryName: r.libraryName ?? '', folderPaths: r.folderPaths ?? [], enabled: r.enabled });
    } catch (err: any) {
      if (err?.response?.status === 404) setSource(null);
      else push('Erro ao carregar fonte SharePoint', 'error');
    } finally {
      setLoading(false);
    }
  }, [kb.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const isCreate = !source;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.siteHostname.trim()) e.siteHostname = 'Hostname do site é obrigatório';
    if (!form.sitePath.trim()) e.sitePath = 'Caminho do site é obrigatório';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const body = buildRequestBody();
      const r = source
        ? await sharepointSourceService.update(source.id, body)
        : await sharepointSourceService.create(body);
      setSource(r);
      push(source ? 'Fonte SharePoint atualizada!' : 'Fonte SharePoint conectada!');
      // Ao criar, mantém o formulário aberto -- só agora (com a Source salva) o botão
      // "Escolher pastas" fica disponível, e fechar aqui forçaria reabrir em modo Editar
      // pra usá-lo. Num update normal, fecha e volta pra visualização.
      if (!isCreate) setEditing(false);
      onChanged();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.response?.data ?? 'Erro ao salvar fonte';
      setErrors({ _api: typeof msg === 'string' ? msg : JSON.stringify(msg) });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setRemoving(true);
    try {
      await sharepointSourceService.remove(source!.id);
      push('Fonte SharePoint removida — base voltou a ser MANUAL');
      setSource(null);
      setTestResult(null);
      setForm({ siteHostname: '', sitePath: '', libraryName: '', folderPaths: [], enabled: true });
      setDeleting(false);
      onChanged();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Erro ao remover fonte';
      setErrors({ _api: typeof msg === 'string' ? msg : JSON.stringify(msg) });
    } finally {
      setRemoving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!source) return;
    setTesting(true);
    setTestResult(null);
    try {
      const r = await sharepointSourceService.testConnection(source.id);
      setTestResult(r);
      if (!r.success) push(r.error ?? 'Falha ao testar conexão', 'error');
      // driveId pode ter sido resolvido/cacheado — recarrega a fonte
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Erro ao testar conexão';
      push(typeof msg === 'string' ? msg : 'Erro ao testar conexão', 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleSync = async () => {
    if (!source) return;
    setSyncing(true);
    setSyncMsg('');
    try {
      const r = await sharepointSourceService.sync(source.id);
      setSource(r);
      push('Sincronização disparada!');
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message ?? 'Erro ao disparar sincronização';
      if (status === 429) setSyncMsg(msg);
      else if (status === 503) setSyncMsg('Serviço de sincronização indisponível no momento. Tente novamente em instantes.');
      else push(typeof msg === 'string' ? msg : 'Erro ao disparar sincronização', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const { closing, close } = useModalAnimation(onClose);
  const showForm = isCreate || editing;

  return (
    <>
    <div className={`modal-backdrop${closing ? ' modal-closing' : ''}`} onClick={close}>
      <div className={`modal modal-lg${closing ? ' modal-closing' : ''}`} style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Cloud size={16} color="#60a5fa" /> Fonte SharePoint
            </h3>
            <p>{kb.name}</p>
          </div>
          <button className="modal-close" onClick={close}><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#334155' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} />Carregando…
            </div>
          ) : (
            <>
              {errors._api && (
                <div className="api-error-box">
                  <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                  <span>{errors._api}</span>
                </div>
              )}

              {!showForm && source && (
                <>
                  <div className="model-locked-display" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className={`pill ${syncStatusColor(source.syncStatus)}`}>{syncStatusLabel(source.syncStatus)}</span>
                      <span className={`pill ${source.enabled ? 'pill-green' : 'pill-gray'}`}>{source.enabled ? 'Ativa' : 'Inativa'}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Site</span>
                      <p style={{ fontSize: 13, color: '#e2e8f0', fontFamily: 'monospace', marginTop: 2 }}>{source.siteHostname}{source.sitePath}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 24 }}>
                      <div>
                        <span style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Biblioteca</span>
                        <p style={{ fontSize: 13, color: '#e2e8f0', marginTop: 2 }}>{source.libraryName || 'Documents'}</p>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pastas sincronizadas</span>
                        {source.folderPaths.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                            {source.folderPaths.map(fp => (
                              <span key={fp} className="pill pill-gray" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Folder size={11} />{fp}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p style={{ fontSize: 13, color: '#e2e8f0', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Folder size={11} color="#475569" />Sincronizando a biblioteca inteira
                          </p>
                        )}
                      </div>
                    </div>
                    {source.lastSyncedAt && (
                      <p style={{ fontSize: 11, color: '#475569' }}>Última sync: {new Date(source.lastSyncedAt).toLocaleString('pt-BR')}</p>
                    )}
                    {source.lastSyncError && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, color: '#fca5a5' }}>
                        <AlertTriangle size={11} style={{ flexShrink: 0, marginTop: 1 }} />
                        <span>{source.lastSyncError}</span>
                      </div>
                    )}
                  </div>

                  {syncMsg && (
                    <div className="warning-box">
                      <AlertTriangle size={13} color="#fbbf24" style={{ flexShrink: 0 }} />
                      <span>{syncMsg}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-secondary" onClick={handleTestConnection} disabled={testing}>
                      <PlugZap size={14} className={testing ? 'spin' : ''} /> {testing ? 'Testando…' : 'Testar Conexão'}
                    </button>
                    <button className="btn btn-secondary" onClick={handleSync} disabled={syncing}>
                      <RotateCw size={14} className={syncing ? 'spin' : ''} /> {syncing ? 'Sincronizando…' : 'Sincronizar Agora'}
                    </button>
                  </div>

                  {testResult && (
                    <div className={testResult.success ? 'model-locked-display' : 'api-error-box'} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                      {testResult.success ? (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Check size={13} color="#6ee7b7" />
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{testResult.siteDisplayName}</span>
                          </div>
                          <p style={{ fontSize: 11, color: '#475569' }}>Biblioteca: {testResult.driveName}</p>
                          {testResult.items.length > 0 && (
                            <div className="docs-list" style={{ maxHeight: 160, overflowY: 'auto' }}>
                              {testResult.items.map((it, i) => (
                                <div key={i} className="doc-item" style={{ padding: '6px 10px' }}>
                                  <div className="doc-item-icon">
                                    {it.folder ? <FolderTree size={13} color="#fbbf24" /> : <FileText size={13} color="#60a5fa" />}
                                  </div>
                                  <div className="doc-item-info">
                                    <p className="doc-item-name" style={{ fontSize: 12 }}>{it.name}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                          <span>{testResult.error ?? 'Falha ao testar a conexão'}</span>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}

              {!showForm && !source && (
                <div className="table-empty" style={{ padding: '20px 0' }}>
                  <Cloud size={26} />
                  <p>Esta base ainda não está conectada ao SharePoint</p>
                </div>
              )}

              {showForm && (
                <div className="form-grid">
                  <div className="form-field form-grid-full">
                    <label className="form-label">Hostname do Site *</label>
                    <input
                      className={`form-input ${errors.siteHostname ? 'error' : ''}`}
                      placeholder="ex: empresa.sharepoint.com"
                      value={form.siteHostname}
                      onChange={e => set('siteHostname', e.target.value)}
                      style={{ fontFamily: 'monospace' }}
                    />
                    {errors.siteHostname && <span className="form-error-msg">{errors.siteHostname}</span>}
                    <span className="form-hint">Aceita colar com https:// na frente — é limpo automaticamente</span>
                  </div>
                  <div className="form-field form-grid-full">
                    <label className="form-label">Caminho do Site *</label>
                    <input
                      className={`form-input ${errors.sitePath ? 'error' : ''}`}
                      placeholder="ex: /sites/NomeDoSite"
                      value={form.sitePath}
                      onChange={e => set('sitePath', e.target.value)}
                      style={{ fontFamily: 'monospace' }}
                    />
                    {errors.sitePath && <span className="form-error-msg">{errors.sitePath}</span>}
                  </div>
                  <div className="form-field">
                    <label className="form-label">Biblioteca <span className="form-hint" style={{ marginLeft: 4 }}>opcional</span></label>
                    <input className="form-input" placeholder="Documents" value={form.libraryName} onChange={e => set('libraryName', e.target.value)} />
                    <span className="form-hint">Default "Documents" se omitido</span>
                  </div>
                  <div className="form-field form-grid-full">
                    <label className="form-label">Pastas sincronizadas <span className="form-hint" style={{ marginLeft: 4 }}>opcional</span></label>
                    {form.folderPaths.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                        {form.folderPaths.map(fp => (
                          <span key={fp} className="pill pill-gray" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Folder size={11} />{fp}
                            <button type="button" onClick={() => removeFolder(fp)} style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit' }}>
                              <X size={11} />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="form-hint" style={{ marginBottom: 8 }}>Vazio = sincroniza a biblioteca inteira</p>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="btn btn-secondary" onClick={openPicker} disabled={!form.siteHostname.trim() || !form.sitePath.trim() || saving}>
                        <FolderTree size={14} /> {saving && !source ? 'Salvando…' : 'Escolher pastas'}
                      </button>
                      <input
                        className="form-input"
                        placeholder="ou digite o nome da pasta"
                        value={folderInput}
                        onChange={e => setFolderInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFolder(folderInput); setFolderInput(''); } }}
                      />
                      <button type="button" className="btn btn-secondary" onClick={() => { addFolder(folderInput); setFolderInput(''); }}>
                        <Plus size={14} /> Adicionar
                      </button>
                    </div>
                    {!source && <span className="form-hint">Preencha hostname e caminho do site para escolher pastas — a fonte é salva automaticamente ao clicar</span>}
                  </div>
                  <div className="form-field" style={{ justifyContent: 'flex-end' }}>
                    <label className="form-label">Status</label>
                    <div className="toggle-wrap">
                      <span>Fonte ativa</span>
                      <label className="toggle">
                        <input type="checkbox" checked={form.enabled} onChange={e => setEnabled(e.target.checked)} />
                        <span className="toggle-track" /><span className="toggle-thumb" />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {deleting && (
                <div className="warning-box">
                  <AlertTriangle size={13} color="#fbbf24" style={{ flexShrink: 0 }} />
                  <span>Remover a fonte? A base volta sozinha para MANUAL e libera upload de novo.</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <div>
            {!loading && source && !showForm && !deleting && (
              <button className="btn btn-danger-ghost" onClick={() => setDeleting(true)}><Trash2 size={14} /> Remover</button>
            )}
            {deleting && (
              <button className="btn btn-danger" onClick={handleDelete} disabled={removing}>
                {removing ? <><span className="spinner-sm" /> Removendo…</> : <><Trash2 size={14} /> Confirmar remoção</>}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {deleting ? (
              <button className="btn btn-secondary" onClick={() => setDeleting(false)} disabled={removing}>Cancelar</button>
            ) : showForm ? (
              <>
                <button className="btn btn-secondary" onClick={() => (source ? setEditing(false) : close())} disabled={saving}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleSubmit} disabled={saving || loading}>
                  {saving ? <><span className="spinner-sm" /> Salvando…</> : <><Check size={14} />{isCreate ? 'Conectar' : 'Salvar'}</>}
                </button>
              </>
            ) : source ? (
              <>
                <button className="btn btn-secondary" onClick={close}>Fechar</button>
                <button className="btn btn-primary" onClick={() => setEditing(true)}><Pencil size={14} /> Editar</button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={() => setEditing(true)} disabled={loading}><Plus size={14} /> Conectar SharePoint</button>
            )}
          </div>
        </div>
      </div>
    </div>

    {pickerOpen && (
      <div className="modal-backdrop" onClick={() => setPickerOpen(false)} style={{ zIndex: 210 }}>
        <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div><h3>Escolher pastas</h3><p>Marque as pastas da raiz da biblioteca que devem sincronizar</p></div>
            <button className="modal-close" onClick={() => setPickerOpen(false)}><X size={16} /></button>
          </div>
          <div className="modal-body">
            {pickerLoading ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#334155' }}>
                <div className="spinner" style={{ margin: '0 auto 12px' }} />Carregando pastas…
              </div>
            ) : pickerError ? (
              <div className="api-error-box">
                <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                <span>{pickerError}</span>
              </div>
            ) : pickerItems.length === 0 ? (
              <div className="table-empty" style={{ padding: '16px 0' }}>
                <FolderTree size={22} />
                <p>Nenhuma pasta encontrada na raiz da biblioteca</p>
              </div>
            ) : (
              <div className="docs-list" style={{ maxHeight: 320, overflowY: 'auto' }}>
                {pickerItems.map(it => (
                  <label key={it.name} className="doc-item" style={{ padding: '8px 10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={pickerSelected.has(it.name)}
                      onChange={() => togglePickerItem(it.name)}
                      style={{ marginRight: 8 }}
                    />
                    <div className="doc-item-icon"><FolderTree size={13} color="#fbbf24" /></div>
                    <div className="doc-item-info"><p className="doc-item-name" style={{ fontSize: 13 }}>{it.name}</p></div>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setPickerOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={confirmPicker} disabled={pickerLoading}>
              <Check size={14} /> Adicionar selecionadas
            </button>
          </div>
        </div>
      </div>
    )}
    </>
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
          name:          form.name.trim(),
          description:   form.description.trim() || null,
          active:        form.active,
          // API exige esses dois no PUT mesmo sendo imutáveis — reenvia os valores atuais
          model_type:    kb!.model_type,
          department_id: kb!.department_id,
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
  const [selActive,      setSelActive]      = useState<'active' | 'inactive' | 'all'>('active');
  const [page,           setPage]           = useState(0);
  const [total,          setTotal]          = useState(0);
  const [totalPg,        setTotalPg]        = useState(1);
  const [loading,        setLoading]        = useState(false);
  const [creating,       setCreating]       = useState(false);
  const [editing,        setEditing]        = useState<KnowledgeBase | null>(null);
  const [deleting,       setDeleting]       = useState<KnowledgeBase | null>(null);
  const [spKb,           setSpKb]           = useState<KnowledgeBase | null>(null);

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
      if (selActive !== 'all')   params.active       = selActive === 'active';
      const r = await knowledgebaseService.list(params);
      setBases(r.content);
      setTotal(r.totalElements);
      setTotalPg(r.totalPages || 1);
    } catch {
      push('Erro ao carregar bases de conhecimento', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, selDept, selActive, selectedCompany, push]);

  useEffect(() => { setPage(0); }, [search, selDept, selActive, selectedCompany]);
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
            <select className="form-select" style={{ height: 38, width: 'auto', minWidth: 160 }} value={selActive} onChange={e => setSelActive(e.target.value as 'active' | 'inactive' | 'all')}>
              <option value="active">Somente ativas</option>
              <option value="inactive">Somente inativas</option>
              <option value="all">Todas</option>
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
                    <th>SharePoint</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr className="loading-row"><td colSpan={8}><div className="spinner" />Carregando...</td></tr>
                  ) : bases.length === 0 ? (
                    <tr><td colSpan={8}>
                      <div className="table-empty">
                        <BookOpen size={28} />
                        <p>Nenhuma base de conhecimento encontrada</p>
                        {(selDept || selActive !== 'all') && (
                          <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => { setSelDept(''); setSelActive('all'); }}>Ver todas</button>
                        )}
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
                        {b.source_type === 'SHAREPOINT' ? (
                          <span style={{ fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Lock size={11} /> via SharePoint
                          </span>
                        ) : (
                          <button className="btn-kb-link" onClick={() => navigate(`/uploads?knowledgeBaseId=${b.id}`)} title="Ver e enviar documentos">
                            <Upload size={13} /> Documentos <Arrow size={11} />
                          </button>
                        )}
                      </td>
                      <td>
                        <button className="btn-kb-link" onClick={() => setSpKb(b)} title="Gerenciar fonte SharePoint">
                          <Cloud size={13} /> {b.source_type === 'SHAREPOINT' ? 'Gerenciar' : 'Conectar'} <Arrow size={11} />
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
      {spKb     && <SharepointSourceModal kb={spKb} onClose={() => setSpKb(null)} push={push} onChanged={load} />}

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
