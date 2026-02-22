import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, Plus, Pencil, Trash2,
  ChevronLeft, ChevronRight, RefreshCw,
  X, Check, AlertTriangle,
  Bot as BotIcon, FolderOpen, Building2, ChevronRight as Arrow,
  BookOpen, Settings, Phone, KeyRound, Loader2,
} from 'lucide-react';
import { botService }           from '../services/botService';
import { botSettingService }    from '../services/botSettingService';
import { departmentService }    from '../services/departmentService';
import { knowledgebaseService } from '../services/knowledgebaseService';
import type { Bot, CreateBotRequest, UpdateBotRequest } from '../types/bot';
import type { BotSettingResponse } from '../types/botSetting';
import type { Department }     from '../types/department';
import type { KnowledgeBase }  from '../types/knowledgebase';
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
function botInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

/* ══════════════════════════════════════
   KBS CELL — badge + popover ao hover
══════════════════════════════════════ */
function KbsCell({ kbs }: { kbs: { id: string; name: string }[] }) {
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const showPopover = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (!triggerRef.current || kbs.length === 0) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const left = Math.min(rect.left, window.innerWidth - 260);
    setPopoverPos({ top: rect.bottom + 6, left });
  };

  const hidePopover = () => {
    closeTimer.current = setTimeout(() => setPopoverPos(null), 150);
  };

  const keepPopover = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  if (kbs.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <BookOpen size={12} color="#475569" />
        <span style={{ fontSize: 13, color: '#94a3b8' }}>—</span>
      </div>
    );
  }

  return (
    <>
      <div
        ref={triggerRef}
        style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'default' }}
        onMouseEnter={showPopover}
        onMouseLeave={hidePopover}
      >
        <BookOpen size={12} color="#475569" />
        <span className="kbs-count-badge">
          {kbs.length} {kbs.length === 1 ? 'base' : 'bases'}
        </span>
      </div>
      {popoverPos && createPortal(
        <div
          className="roles-popover"
          style={{ position: 'fixed', top: popoverPos.top, left: popoverPos.left }}
          onMouseEnter={keepPopover}
          onMouseLeave={hidePopover}
        >
          <div className="roles-popover-title">Bases de Conhecimento · {kbs.length}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
            {kbs.map(kb => (
              <div key={kb.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BookOpen size={11} color="#60a5fa" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.3 }}>{kb.name}</span>
              </div>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/* ══════════════════════════════════════
   BOT FORM MODAL
══════════════════════════════════════ */
interface BotModalProps {
  bot: Bot | null;
  allDepartments: Department[];
  defaultDeptId?: string;
  defaultCompanyId?: string;
  defaultCompanyName?: string;
  isCustomer?: boolean;
  onClose: () => void;
  onSave: (data: CreateBotRequest | UpdateBotRequest, id?: string) => Promise<Bot>;
}

function BotModal({ bot, allDepartments, defaultDeptId, defaultCompanyId, defaultCompanyName, isCustomer, onClose, onSave }: BotModalProps) {
  const isEdit = !!bot;

  // Determina empresa inicial: do bot (edit) ou do contexto/filtro (create)
  const initialCompanyId = bot?.department?.company?.id ?? defaultCompanyId ?? '';
  const initialDeptId    = bot?.department?.id ?? defaultDeptId ?? '';

  const [form, setForm] = useState({
    name:         bot?.name   ?? '',
    companyId:    initialCompanyId,
    departmentId: initialDeptId,
    active:       bot?.active ?? true,
    kbIds:        (bot?.knowledgeBases ?? []).map(k => k.id) as string[],
  });
  const [saving,     setSaving]     = useState(false);
  const [errors,     setErrors]     = useState<Record<string, string>>({});
  const [kbs,        setKbs]        = useState<KnowledgeBase[]>([]);
  const [loadingKbs, setLoadingKbs] = useState(false);

  const set = (k: keyof typeof form, v: string | boolean | string[]) =>
    setForm(p => ({ ...p, [k]: v }));

  // Deriva empresas únicas a partir dos departamentos já carregados
  const companies = Array.from(
    new Map(
      allDepartments
        .filter(d => d.company?.id)
        .map(d => [d.company!.id, { id: d.company!.id, name: d.company!.name }])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  // Departamentos filtrados pela empresa selecionada
  const deptsByCompany = form.companyId
    ? allDepartments.filter(d => d.company?.id === form.companyId)
    : allDepartments;

  // Ao trocar empresa, limpa departamento e KBs
  const handleCompanyChange = (id: string) => {
    setForm(p => ({ ...p, companyId: id, departmentId: '', kbIds: [] }));
  };

  // Ao trocar departamento, limpa KBs selecionadas
  const handleDeptChange = (id: string) => {
    setForm(p => ({ ...p, departmentId: id, kbIds: [] }));
  };

  // Carrega KBs do departamento selecionado
  useEffect(() => {
    if (!form.departmentId) { setKbs([]); return; }
    setLoadingKbs(true);
    knowledgebaseService.list({ departmentId: form.departmentId, size: 100 })
      .then(r => setKbs(r.content.filter(k => k.active)))
      .catch(() => setKbs([]))
      .finally(() => setLoadingKbs(false));
  }, [form.departmentId]);

  const toggleKb = (id: string) => {
    setForm(p => ({
      ...p,
      kbIds: p.kbIds.includes(id) ? p.kbIds.filter(k => k !== id) : [...p.kbIds, id],
    }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim())       e.name         = 'Nome é obrigatório';
    else if (form.name.trim().length < 3)  e.name = 'Mínimo 3 caracteres';
    else if (form.name.trim().length > 60) e.name = 'Máximo 60 caracteres';
    if (!isEdit && !form.companyId)  e.companyId    = 'Selecione uma empresa';
    if (!form.departmentId)      e.departmentId = 'Selecione um departamento';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (isEdit) {
        const body: UpdateBotRequest = {
          name:               form.name.trim(),
          active:             form.active,
          department_id:      form.departmentId,
          knowledge_base_ids: form.kbIds,
        };
        await onSave(body, bot!.id);
      } else {
        const body: CreateBotRequest = {
          name:               form.name.trim(),
          active:             true,
          department_id:      form.departmentId,
          knowledge_base_ids: form.kbIds,
        };
        await onSave(body);
      }
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.response?.data ?? 'Erro ao salvar bot';
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
            <h3>{isEdit ? 'Editar Bot' : 'Novo Bot'}</h3>
            <p>{isEdit ? `Editando ${bot!.name}` : 'Configure um novo agente de IA para um departamento'}</p>
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

          {/* Nome */}
          <div className="form-field">
            <label className="form-label">Nome do Bot *</label>
            <input
              className={`form-input ${errors.name ? 'error' : ''}`}
              placeholder="Ex: Assistente de Atendimento"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              maxLength={60}
            />
            {errors.name && <span className="form-error-msg">{errors.name}</span>}
          </div>

          {/* Empresa (readonly para clientes; dropdown para sistema no create; info no edit) */}
          {isCustomer ? (
            <div className="form-field">
              <label className="form-label">Empresa</label>
              <div className="form-input" style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.7, cursor: 'not-allowed' }}>
                <Building2 size={13} color="#475569" />
                <span style={{ fontSize: 13 }}>{defaultCompanyName ?? bot?.department?.company?.name ?? '—'}</span>
              </div>
            </div>
          ) : !isEdit ? (
            <div className="form-field">
              <label className="form-label">Empresa *</label>
              <select
                className={`form-select ${errors.companyId ? 'error' : ''}`}
                value={form.companyId}
                onChange={e => handleCompanyChange(e.target.value)}
              >
                <option value="">Selecione uma empresa...</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {errors.companyId && <span className="form-error-msg">{errors.companyId}</span>}
            </div>
          ) : (
            <div className="form-field">
              <label className="form-label">Empresa</label>
              <div className="form-input" style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.6, cursor: 'default' }}>
                <Building2 size={13} color="#475569" />
                <span style={{ fontSize: 13 }}>{bot!.department?.company?.name ?? '—'}</span>
              </div>
            </div>
          )}

          {/* Departamento */}
          <div className="form-field">
            <label className="form-label">Departamento *</label>
            <select
              className={`form-select ${errors.departmentId ? 'error' : ''}`}
              value={form.departmentId}
              onChange={e => handleDeptChange(e.target.value)}
              disabled={isEdit || (!isEdit && !form.companyId)}
            >
              <option value="">
                {!form.companyId && !isEdit ? 'Selecione uma empresa primeiro...' : 'Selecione um departamento...'}
              </option>
              {deptsByCompany.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            {errors.departmentId && <span className="form-error-msg">{errors.departmentId}</span>}
            {isEdit && <span className="form-hint">O departamento não pode ser alterado após a criação</span>}
          </div>

          {/* Bases de Conhecimento */}
          <div className="form-field">
            <label className="form-label">
              Bases de Conhecimento
              <span className="form-hint" style={{ marginLeft: 4 }}>opcional</span>
            </label>
            {!form.departmentId ? (
              <p style={{ fontSize: 12, color: '#475569', fontStyle: 'italic' }}>Selecione um departamento para ver as bases disponíveis</p>
            ) : loadingKbs ? (
              <p style={{ fontSize: 12, color: '#475569' }}>Carregando bases...</p>
            ) : kbs.length === 0 ? (
              <p style={{ fontSize: 12, color: '#475569', fontStyle: 'italic' }}>Nenhuma base de conhecimento ativa neste departamento</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto', padding: '4px 0' }}>
                {kbs.map(kb => {
                  const on = form.kbIds.includes(kb.id);
                  return (
                    <div
                      key={kb.id}
                      className={`role-item ${on ? 'on' : ''}`}
                      style={{ padding: '8px 10px' }}
                      onClick={() => toggleKb(kb.id)}
                    >
                      <div className={`role-checkbox ${on ? 'checked' : ''}`}>
                        {on && <Check size={9} />}
                      </div>
                      <div className="role-item-text">
                        <span className="role-name" style={{ fontSize: 13 }}>{kb.name}</span>
                      </div>
                      <BookOpen size={12} color="#475569" style={{ flexShrink: 0 }} />
                    </div>
                  );
                })}
              </div>
            )}
            <span className="form-hint">{form.kbIds.length} base{form.kbIds.length !== 1 ? 's' : ''} selecionada{form.kbIds.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Status (só no edit) */}
          {isEdit && (
            <div className="toggle-wrap">
              <span>Bot ativo</span>
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
            {saving ? <><span className="spinner-sm" /> Salvando…</> : <><Check size={14} />{isEdit ? 'Salvar' : 'Criar Bot'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   BOT SETTING MODAL
══════════════════════════════════════ */
function BotSettingModal({ bot, onClose }: { bot: Bot; onClose: () => void }) {
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [setting,  setSetting]  = useState<BotSettingResponse | null>(null);
  const [errors,   setErrors]   = useState<Record<string, string>>({});

  // Campos do form como strings (JSON editável em textarea)
  const [form, setForm] = useState({
    phoneNumberId:        '',
    verifyToken:          '',
    metaSettings:         '{}',
    orchestratorSettings: '{}',
  });

  const setF = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  // Carrega setting existente (404 = ainda não foi criado)
  useEffect(() => {
    setLoading(true);
    botSettingService.getByBotId(bot.id)
      .then(s => {
        setSetting(s);
        setForm({
          phoneNumberId:        s.phoneNumberId ?? '',
          verifyToken:          s.verifyToken   ?? '',
          metaSettings:         '{}',  // metaSettings é criptografado, não retorna no response
          orchestratorSettings: s.orchestratorSettings
            ? JSON.stringify(s.orchestratorSettings, null, 2)
            : '{}',
        });
      })
      .catch(() => {
        // 404 = sem setting ainda → modo create
        setSetting(null);
      })
      .finally(() => setLoading(false));
  }, [bot.id]);

  const parseJson = (str: string, field: string): Record<string, unknown> | null => {
    if (!str.trim() || str.trim() === '{}') return null;
    try { return JSON.parse(str); }
    catch { setErrors(p => ({ ...p, [field]: 'JSON inválido' })); return undefined as any; }
  };

  const handleSubmit = async () => {
    setErrors({});
    const meta  = parseJson(form.metaSettings,         'metaSettings');
    const orch  = parseJson(form.orchestratorSettings,  'orchestratorSettings');
    if (meta === undefined || orch === undefined) return; // JSON inválido

    setSaving(true);
    try {
      const body = {
        bot_id:                 bot.id,
        phone_number_id:        form.phoneNumberId.trim()  || null,
        verify_token:           form.verifyToken.trim()    || null,
        meta_settings:          meta,
        orchestrator_settings:  orch,
      };
      if (setting) {
        await botSettingService.update(setting.id, body);
      } else {
        await botSettingService.create(body);
      }
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.response?.data ?? 'Erro ao salvar configuração';
      setErrors({ _api: typeof msg === 'string' ? msg : JSON.stringify(msg) });
    } finally {
      setSaving(false);
    }
  };

  const { closing, close } = useModalAnimation(onClose);
  return (
    <div className={`modal-backdrop${closing ? ' modal-closing' : ''}`} onClick={close}>
      <div className={`modal modal-lg${closing ? ' modal-closing' : ''}`} style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Settings size={16} color="#93c5fd" /> Configurações do Bot
            </h3>
            <p>{bot.name} · {setting ? 'Editar configuração existente' : 'Criar configuração'}</p>
          </div>
          <button className="modal-close" onClick={close}><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 10, color: '#475569' }}>
              <Loader2 size={20} className="spin" /> Carregando configuração…
            </div>
          ) : (
            <>
              {errors._api && (
                <div className="api-error-box">
                  <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                  <span>{errors._api}</span>
                </div>
              )}

              {/* Phone Number ID */}
              <div className="form-field">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Phone size={12} /> Phone Number ID
                  <span className="form-hint" style={{ marginLeft: 4 }}>opcional · max 32</span>
                </label>
                <input
                  className="form-input"
                  placeholder="Ex: 123456789012345"
                  value={form.phoneNumberId}
                  onChange={e => setF('phoneNumberId', e.target.value)}
                  maxLength={32}
                />
              </div>

              {/* Verify Token */}
              <div className="form-field">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <KeyRound size={12} /> Verify Token
                  <span className="form-hint" style={{ marginLeft: 4 }}>opcional</span>
                </label>
                <input
                  className="form-input"
                  placeholder="Token de verificação do webhook"
                  value={form.verifyToken}
                  onChange={e => setF('verifyToken', e.target.value)}
                />
              </div>

              {/* Meta Settings */}
              <div className="form-field">
                <label className="form-label">
                  Meta Settings
                  <span className="form-hint" style={{ marginLeft: 4 }}>JSON · criptografado · opcional</span>
                </label>
                {setting && (
                  <div className="warning-box" style={{ marginBottom: 8 }}>
                    <AlertTriangle size={12} color="#fbbf24" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 11 }}>Este campo é criptografado e não é retornado pela API. Preencha apenas se quiser <strong>atualizar</strong> o valor.</span>
                  </div>
                )}
                <textarea
                  className={`form-input form-textarea ${errors.metaSettings ? 'error' : ''}`}
                  placeholder={'{\n  "token": "...",\n  "appId": "..."\n}'}
                  value={form.metaSettings}
                  onChange={e => setF('metaSettings', e.target.value)}
                  rows={4}
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                />
                {errors.metaSettings && <span className="form-error-msg">{errors.metaSettings}</span>}
              </div>

              {/* Orchestrator Settings */}
              <div className="form-field">
                <label className="form-label">
                  Orchestrator Settings
                  <span className="form-hint" style={{ marginLeft: 4 }}>JSON · opcional</span>
                </label>
                <textarea
                  className={`form-input form-textarea ${errors.orchestratorSettings ? 'error' : ''}`}
                  placeholder={'{\n  "model": "gpt-4o",\n  "temperature": 0.7\n}'}
                  value={form.orchestratorSettings}
                  onChange={e => setF('orchestratorSettings', e.target.value)}
                  rows={5}
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                />
                {errors.orchestratorSettings && <span className="form-error-msg">{errors.orchestratorSettings}</span>}
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={close} disabled={saving || loading}>Cancelar</button>
          {!loading && (
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving
                ? <><span className="spinner-sm" /> Salvando…</>
                : <><Check size={14} />{setting ? 'Salvar Configuração' : 'Criar Configuração'}</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   DELETE MODAL
══════════════════════════════════════ */
function DeleteModal({ bot, onClose, onConfirm }: { bot: Bot; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const handle = async () => {
    setLoading(true);
    try { await onConfirm(); onClose(); }
    catch (err: any) { setError(err?.response?.data?.message ?? 'Erro ao desativar bot'); }
    finally { setLoading(false); }
  };
  const { closing, close } = useModalAnimation(onClose);
  return (
    <div className={`modal-backdrop${closing ? ' modal-closing' : ''}`} onClick={close}>
      <div className={`modal confirm-modal${closing ? ' modal-closing' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="modal-body" style={{ textAlign: 'center', padding: '32px 28px 20px' }}>
          <div className="confirm-icon"><Trash2 size={22} color="#f87171" /></div>
          <h4>Desativar Bot?</h4>
          <p style={{ marginTop: 8 }}>O bot <strong style={{ color: '#f1f5f9' }}>{bot.name}</strong> será desativado. Esta ação pode ser revertida editando o bot.</p>
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
   BOTS PAGE
══════════════════════════════════════ */
export default function Bots() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterDeptId = searchParams.get('departmentId') ?? '';
  const { selectedCompany, isCustomer } = useCompany();

  const [bots,           setBots]           = useState<Bot[]>([]);
  const [allDepartments, setAllDepartments] = useState<Department[]>([]); // todos (sem filtro de empresa)
  const [search,         setSearch]         = useState('');
  const [selDept,        setSelDept]        = useState(filterDeptId);
  const [page,           setPage]           = useState(0);
  const [total,          setTotal]          = useState(0);
  const [totalPg,        setTotalPg]        = useState(1);
  const [loading,        setLoading]        = useState(false);
  const [creating,       setCreating]       = useState(false);
  const [editing,        setEditing]        = useState<Bot | null>(null);
  const [deleting,       setDeleting]       = useState<Bot | null>(null);
  const [settingBot,     setSettingBot]     = useState<Bot | null>(null);

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

  // Departamentos exibidos no select de filtro da tabela (filtrados pela empresa do contexto)
  const departments = selectedCompany?.id
    ? allDepartments.filter(d => d.company?.id === selectedCompany.id)
    : allDepartments;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, size: 15 };
      if (search)              params.name         = search;
      if (selDept)             params.departmentId = selDept;
      if (selectedCompany?.id) params.companyId    = selectedCompany.id;
      const r = await botService.list(params);
      setBots(r.content);
      setTotal(r.totalElements);
      setTotalPg(r.totalPages || 1);
    } catch {
      push('Erro ao carregar bots', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, selDept, selectedCompany, push]);

  useEffect(() => { setPage(0); }, [search, selDept, selectedCompany]);
  useEffect(() => { load(); }, [load]);

  const handleSave = async (body: CreateBotRequest | UpdateBotRequest, id?: string) => {
    if (id) {
      const res = await botService.update(id, body as UpdateBotRequest);
      push('Bot atualizado!'); load(); return res;
    } else {
      const res = await botService.create(body as CreateBotRequest);
      push('Bot criado!'); load(); return res;
    }
  };

  const handleDelete = async () => {
    await botService.remove(deleting!.id);
    push('Bot desativado'); load();
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
                  <button className="hierarchy-crumb-link" onClick={() => navigate('/companies')}>
                    <Building2 size={13} /> Empresas
                  </button>
                  <Arrow size={13} style={{ color: '#334155' }} />
                </>
              )}
              <button
                className="hierarchy-crumb-link"
                onClick={() => navigate(currentDept?.company?.id ? `/departments?companyId=${currentDept.company.id}` : '/departments')}
              >
                <FolderOpen size={13} /> {currentDept?.name ?? 'Departamentos'}
              </button>
              <Arrow size={13} style={{ color: '#334155' }} />
              <span className="hierarchy-crumb-active"><BotIcon size={13} /> Bots</span>
            </div>
            <h1 style={{ marginTop: 6 }}>Bots</h1>
            <p>{currentDept ? `Bots do departamento ${currentDept.name}` : 'Todos os agentes de IA da plataforma'}</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" onClick={load} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'spin' : ''} /> Atualizar
            </button>
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              <Plus size={14} /> Novo Bot
            </button>
          </div>
        </div>

        <div className="page-section-pad" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>

          {/* Filtros */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="search-input-wrap" style={{ flex: 1, minWidth: 200, maxWidth: 300 }}>
              <Search size={14} />
              <input
                className="search-input"
                placeholder="Buscar por nome..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              className="form-select"
              style={{ height: 38, width: 'auto', minWidth: 220, maxWidth: 300 }}
              value={selDept}
              onChange={e => setSelDept(e.target.value)}
            >
              <option value="">Todos os departamentos</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>
                  {!selectedCompany && d.company?.name ? `${d.company.name} › ` : ''}{d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tabela */}
          <div className="table-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="table-wrap" style={{ flex: 1, overflowY: 'auto' }}>
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Bot</th>
                    <th>Departamento</th>
                    <th>Empresa</th>
                    <th>Bases de Conhecimento</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr className="loading-row">
                      <td colSpan={6}><div className="spinner" />Carregando...</td>
                    </tr>
                  ) : bots.length === 0 ? (
                    <tr><td colSpan={6}>
                      <div className="table-empty">
                        <BotIcon size={28} />
                        <p>Nenhum bot encontrado</p>
                        {selDept && (
                          <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => setSelDept('')}>
                            Ver todos
                          </button>
                        )}
                      </div>
                    </td></tr>
                  ) : bots.map(b => (
                    <tr key={b.id}>
                      <td>
                        <div className="user-name-cell">
                          <div className="bot-avatar-sm">{botInitials(b.name)}</div>
                          <div>
                            <div className="user-name">{b.name}</div>
                            <div className="user-email">
                              {new Date(b.createdAt.replace(/(\.\d{3})\d+/, '$1')).toLocaleDateString('pt-BR')}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td data-label="Departamento">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <FolderOpen size={12} color="#475569" />
                          <span style={{ fontSize: 13, color: '#94a3b8' }}>{b.department?.name ?? '—'}</span>
                        </div>
                      </td>
                      <td data-label="Empresa">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Building2 size={12} color="#475569" />
                          <span style={{ fontSize: 13, color: '#94a3b8' }}>{b.department?.company?.name ?? '—'}</span>
                        </div>
                      </td>
                      <td data-label="Bases">
                        <KbsCell kbs={b.knowledgeBases ?? []} />
                      </td>
                      <td data-label="Status">
                        <span className={`pill ${b.active ? 'pill-green' : 'pill-gray'}`}>
                          {b.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td>
                        <div className="actions-cell">
                          <button className="btn btn-ghost btn-icon" title="Configurações" onClick={() => setSettingBot(b)}>
                            <Settings size={14} />
                          </button>
                          <button className="btn btn-ghost btn-icon" title="Editar" onClick={() => setEditing(b)}>
                            <Pencil size={14} />
                          </button>
                          <button className="btn btn-danger-ghost btn-icon" title="Desativar" onClick={() => setDeleting(b)}>
                            <Trash2 size={14} />
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
                <span className="pagination-info">{total} bot{total !== 1 ? 's' : ''} · pág {page + 1}/{totalPg}</span>
                <div className="pagination-btns">
                  <button className="page-btn" onClick={() => setPage(p => p - 1)} disabled={page === 0}>
                    <ChevronLeft size={13} />
                  </button>
                  {pageNums.map(n => (
                    <button key={n} className={`page-btn ${n === page ? 'current' : ''}`} onClick={() => setPage(n)}>
                      {n + 1}
                    </button>
                  ))}
                  <button className="page-btn" onClick={() => setPage(p => p + 1)} disabled={page >= totalPg - 1}>
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Info card */}
          <div className="hierarchy-info-card">
            <div className="hierarchy-info-steps">
              <div className="hierarchy-step">
                <div className="hierarchy-step-icon" style={{ background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.25)' }}>
                  <Building2 size={14} color="#38bdf8" />
                </div>
                <span>Empresa</span>
              </div>
              <Arrow size={14} style={{ color: '#1e293b', flexShrink: 0 }} />
              <div className="hierarchy-step">
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
              <Arrow size={14} style={{ color: '#1e293b', flexShrink: 0 }} />
              <div className="hierarchy-step hierarchy-step-current">
                <div className="hierarchy-step-icon" style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.35)' }}>
                  <BotIcon size={14} color="#93c5fd" />
                </div>
                <span>Bot</span>
              </div>
            </div>
            <p className="hierarchy-info-text">
              Cada bot pertence a um departamento e pode usar múltiplas bases de conhecimento para responder com contexto.
            </p>
          </div>
        </div>
      </div>

      {/* Modais */}
      {(creating || editing) && (
        <BotModal
          bot={editing}
          allDepartments={allDepartments}
          defaultDeptId={selDept}
          defaultCompanyId={selectedCompany?.id}
          defaultCompanyName={selectedCompany?.name}
          isCustomer={isCustomer}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}
      {deleting && (
        <DeleteModal bot={deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} />
      )}
      {settingBot && (
        <BotSettingModal bot={settingBot} onClose={() => setSettingBot(null)} />
      )}

      {/* Toasts */}
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
