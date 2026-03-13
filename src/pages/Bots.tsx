import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, Plus, Pencil, Trash2,
  ChevronLeft, ChevronRight, RefreshCw,
  X, Check, AlertTriangle,
  Bot as BotIcon, FolderOpen, Building2, ChevronRight as Arrow,
  BookOpen, Settings, Phone, KeyRound, Loader2, Globe,
  FileText, RotateCcw, ChevronDown,
} from 'lucide-react';
import { botService }           from '../services/botService';
import { botSettingService }    from '../services/botSettingService';
import { departmentService }    from '../services/departmentService';
import { knowledgebaseService } from '../services/knowledgebaseService';
import { promptService }        from '../services/promptService';
import type { Bot, CreateBotRequest, UpdateBotRequest } from '../types/bot';
import type { BotSettingResponse } from '../types/botSetting';
import type { Department }     from '../types/department';
import type { KnowledgeBase }  from '../types/knowledgebase';
import type { Prompt, PromptType, CreatePromptRequest } from '../types/prompt';
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
   PROMPT HELPERS
══════════════════════════════════════ */
const PROMPT_TYPE_LABELS: Record<PromptType, string> = {
  CHAT_GERAL: 'Chat Geral',
  RAG_GERAL:  'RAG Geral',
};

const thS: React.CSSProperties = {
  padding: '6px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600,
  color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em',
  borderBottom: '1px solid rgba(51,65,85,0.4)', whiteSpace: 'nowrap',
};
const tdS: React.CSSProperties = {
  padding: '7px 10px', verticalAlign: 'middle',
};

/* ── Modal: ver texto completo ── */
function ViewTextModal({ prompt, onClose }: { prompt: Prompt; onClose: () => void }) {
  const { closing, close } = useModalAnimation(onClose);
  return (
    <div className={`modal-backdrop${closing ? ' modal-closing' : ''}`} onClick={close}>
      <div
        className={`modal modal-lg${closing ? ' modal-closing' : ''}`}
        style={{ maxWidth: 660 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={15} color="#93c5fd" />
              {PROMPT_TYPE_LABELS[prompt.type_prompt]}
              <span style={{ fontSize: 12, color: '#475569', fontWeight: 400 }}>v{prompt.version}</span>
            </h3>
            <p>{prompt.description ?? 'Sem descrição'}</p>
          </div>
          <button className="modal-close" onClick={close}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <pre style={{
            margin: 0, padding: '14px 16px',
            background: 'rgba(15,23,42,0.6)', borderRadius: 8,
            border: '1px solid rgba(51,65,85,0.5)',
            fontSize: 13, lineHeight: 1.7, color: '#e2e8f0',
            fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            maxHeight: 460, overflowY: 'auto',
          }}>
            {prompt.prompt_text}
          </pre>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={close}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

/* ── Modal: criar prompt (bot fixo) ── */
function BotPromptCreateModal({
  bot, onClose, onSave,
}: { bot: Bot; onClose: () => void; onSave: (b: CreatePromptRequest) => Promise<void> }) {
  const [typePrompt,  setTypePrompt]  = useState<PromptType>('CHAT_GERAL');
  const [description, setDescription] = useState('');
  const [promptText,  setPromptText]  = useState('');
  const [saving,      setSaving]      = useState(false);
  const [errors,      setErrors]      = useState<Record<string, string>>({});

  const handleSubmit = async () => {
    const e: Record<string, string> = {};
    if (!promptText.trim()) e.promptText = 'Texto do prompt é obrigatório';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await onSave({
        agent_id:    bot.id,
        type_prompt: typePrompt,
        description: description.trim() || null,
        prompt_text: promptText.trim(),
      });
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.response?.data ?? 'Erro ao salvar prompt';
      setErrors({ _api: typeof msg === 'string' ? msg : JSON.stringify(msg) });
    } finally {
      setSaving(false);
    }
  };

  const { closing, close } = useModalAnimation(onClose);
  return (
    <div className={`modal-backdrop${closing ? ' modal-closing' : ''}`} onClick={close}>
      <div
        className={`modal modal-lg${closing ? ' modal-closing' : ''}`}
        style={{ maxWidth: 640 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h3>Novo Prompt</h3>
            <p>{bot.name} · nova versão de prompt</p>
          </div>
          <button className="modal-close" onClick={close}><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {errors._api && (
            <div className="api-error-box">
              <AlertTriangle size={14} style={{ flexShrink: 0 }} /><span>{errors._api}</span>
            </div>
          )}

          <div className="form-field">
            <label className="form-label">Tipo *</label>
            <select className="form-select" value={typePrompt} onChange={e => setTypePrompt(e.target.value as PromptType)}>
              <option value="CHAT_GERAL">Chat Geral</option>
              <option value="RAG_GERAL">RAG Geral</option>
            </select>
          </div>

          <div className="form-field">
            <label className="form-label">
              Descrição<span className="form-hint" style={{ marginLeft: 4 }}>opcional</span>
            </label>
            <input
              className="form-input"
              placeholder="Ex: Atendimento ao cliente v3"
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={512}
            />
          </div>

          <div className="form-field">
            <label className="form-label">Texto do Prompt *</label>
            <textarea
              className={`form-input${errors.promptText ? ' error' : ''}`}
              placeholder="Você é um assistente de atendimento..."
              value={promptText}
              onChange={e => setPromptText(e.target.value)}
              rows={10}
              style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 13, lineHeight: 1.6 }}
            />
            {errors.promptText && <span className="form-error-msg">{errors.promptText}</span>}
            <span className="form-hint">{promptText.length} caracteres</span>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={close} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? <><span className="spinner-sm" /> Salvando…</> : <><Check size={14} /> Criar Prompt</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Painel de prompts expandido ── */
function BotPromptsPanel({ bot }: { bot: Bot }) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    promptService.list({ agentId: bot.id, size: 50 })
      .then(r => setPrompts(r.content.filter(p => p.active)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [bot.id]);

  return (
    <div style={{
      padding: '16px 24px 18px',
      background: 'var(--bg-card)',
      borderTop: '2px solid #3b82f6',
      borderBottom: '1px solid var(--border-subtle)',
      boxShadow: 'inset 0 2px 8px rgba(59,130,246,0.06)',
    }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: '#3b82f6', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
        Prompts Ativos
      </p>
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
          <Loader2 size={13} className="spin" /> Carregando…
        </div>
      ) : prompts.length === 0 ? (
        <span style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>Nenhum prompt ativo para este bot.</span>
      ) : (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {prompts.map(p => (
            <div key={p.id} style={{
              flex: 1, minWidth: 260,
              background: 'var(--bg-body)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: '10px 14px',
            }}>
              <span style={{
                display: 'inline-block', marginBottom: 8, padding: '2px 8px', borderRadius: 4,
                fontSize: 11, fontWeight: 600,
                background: p.type_prompt === 'CHAT_GERAL' ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.12)',
                color:      p.type_prompt === 'CHAT_GERAL' ? '#818cf8'              : '#34d399',
              }}>
                {PROMPT_TYPE_LABELS[p.type_prompt]}
              </span>
              <pre style={{
                margin: 0, padding: 0,
                background: 'transparent',
                fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)',
                fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                maxHeight: 100, overflowY: 'auto',
              }}>
                {p.prompt_text}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════
   BOT SETTING MODAL
══════════════════════════════════════ */
type MetaMode = 'whatsapp' | 'botapi';

function BotSettingModal({ bot, onClose }: { bot: Bot; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [setting, setSetting] = useState<BotSettingResponse | null>(null);
  const [apiError, setApiError] = useState('');

  // ── Modo de integração ─────────────────────────────
  const [metaMode, setMetaMode] = useState<MetaMode>('whatsapp');

  // ── WhatsApp / Meta API ────────────────────────────
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [verifyToken,   setVerifyToken]   = useState('');
  const [accessToken,   setAccessToken]   = useState('');
  const [apiVersion,    setApiVersion]    = useState('v23.0');

  // ── Agent API ─────────────────────────────────────
  const [agentApiUrl, setAgentApiUrl] = useState('');
  const [agentApiKey, setAgentApiKey] = useState('');

  // ── Orchestrator ──────────────────────────────────
  const [ragMaxResults,           setRagMaxResults]           = useState('9');
  const [ragMinSimilarity,        setRagMinSimilarity]        = useState('0.3');
  const [chatTokensLimit,         setChatTokensLimit]         = useState('2000');
  const [chatMessagesLimit,       setChatMessagesLimit]       = useState('30');
  const [summaryTriggerRatio,     setSummaryTriggerRatio]     = useState('0.7');
  const [conversationTimeoutMin,  setConversationTimeoutMin]  = useState('30');

  useEffect(() => {
    setLoading(true);
    botSettingService.getByBotId(bot.id)
      .then(s => {
        setSetting(s);
        // Detecta modo pelo phoneNumberId salvo
        if (s.phoneNumberId) {
          setMetaMode('whatsapp');
          setPhoneNumberId(s.phoneNumberId);
        } else {
          setMetaMode('botapi');
        }
        setVerifyToken(s.verifyToken ?? '');
        // meta_settings é criptografado — não retorna na API
        const o = s.orchestratorSettings as Record<string, unknown> | null;
        if (o) {
          if (o.rag_max_results          != null) setRagMaxResults(String(o.rag_max_results));
          if (o.rag_min_similarity       != null) setRagMinSimilarity(String(o.rag_min_similarity));
          if (o.chat_tokens_limit        != null) setChatTokensLimit(String(o.chat_tokens_limit));
          if (o.chat_messages_limit      != null) setChatMessagesLimit(String(o.chat_messages_limit));
          if (o.summary_trigger_ratio    != null) setSummaryTriggerRatio(String(o.summary_trigger_ratio));
          if (o.conversation_timeout_minutes != null) setConversationTimeoutMin(String(o.conversation_timeout_minutes));
        }
      })
      .catch(() => setSetting(null))
      .finally(() => setLoading(false));
  }, [bot.id]);

  const handleSubmit = async () => {
    setApiError('');
    setSaving(true);
    try {
      let meta_settings: Record<string, unknown> | null = null;
      const phone = phoneNumberId.trim() || null;
      const token = verifyToken.trim()   || null;

      if (metaMode === 'whatsapp') {
        // só envia meta_settings se access_token preenchido (campo criptografado)
        if (accessToken.trim()) {
          meta_settings = {
            access_token:    accessToken.trim(),
            verify_token:    token,
            phone_number_id: phone,
            api_version:     apiVersion.trim() || 'v23.0',
          };
        }
      } else {
        // agentapi — envia apenas url e key
        if (agentApiUrl.trim() || agentApiKey.trim()) {
          meta_settings = {
            agent_api_url: agentApiUrl.trim() || null,
            agent_api_key: agentApiKey.trim() || null,
          };
        }
      }

      const body = {
        agent_id:        bot.id,
        phone_number_id: phone,
        verify_token:    token,
        meta_settings,
        orchestrator_settings: {
          rag_max_results:                parseFloat(ragMaxResults)          || 9,
          rag_min_similarity:             parseFloat(ragMinSimilarity)       || 0.3,
          chat_tokens_limit:              parseInt(chatTokensLimit)          || 2000,
          chat_messages_limit:            parseInt(chatMessagesLimit)        || 30,
          summary_trigger_ratio:          parseFloat(summaryTriggerRatio)    || 0.7,
          conversation_timeout_minutes:   parseInt(conversationTimeoutMin)   || 30,
        },
      };

      if (setting) {
        await botSettingService.update(setting.id, body);
      } else {
        await botSettingService.create(body);
      }
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.response?.data ?? 'Erro ao salvar configuração';
      setApiError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
    }
  };

  const numInput = (label: string, value: string, onChange: (v: string) => void, hint?: string, step?: string) => (
    <div className="form-field" style={{ flex: 1, minWidth: 140 }}>
      <label className="form-label">{label}{hint && <span className="form-hint" style={{ marginLeft: 4 }}>{hint}</span>}</label>
      <input className="form-input" type="number" step={step ?? '1'} value={value}
        onChange={e => onChange(e.target.value)} style={{ textAlign: 'right' }} />
    </div>
  );

  const { closing, close } = useModalAnimation(onClose);
  return (
    <div className={`modal-backdrop${closing ? ' modal-closing' : ''}`} onClick={close}>
      <div className={`modal modal-lg${closing ? ' modal-closing' : ''}`} style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Settings size={16} color="#93c5fd" /> Configurações do Bot
            </h3>
            <p>{bot.name} · {setting ? 'Editar configuração' : 'Criar configuração'}</p>
          </div>
          <button className="modal-close" onClick={close}><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 10, color: '#475569' }}>
              <Loader2 size={20} className="spin" /> Carregando configuração…
            </div>
          ) : (
            <>
              {apiError && (
                <div className="api-error-box">
                  <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                  <span>{apiError}</span>
                </div>
              )}

              {/* ── Seção WhatsApp / Meta ── */}
              <div className="setting-section">
                <div className="setting-section-title">
                  <Phone size={13} /> WhatsApp · Meta API
                </div>

                <div className="form-field">
                  <label className="form-label">Phone Number ID</label>
                  <input className="form-input" placeholder="Ex: 835412666332233"
                    value={phoneNumberId} onChange={e => setPhoneNumberId(e.target.value)} />
                </div>

                <div className="form-field">
                  <label className="form-label">Verify Token</label>
                  <input className="form-input" placeholder="Token de verificação do webhook"
                    value={verifyToken} onChange={e => setVerifyToken(e.target.value)} />
                </div>

                {/* Toggle acesso */}
                <div style={{ display: 'flex', borderBottom: '1px solid rgba(51,65,85,0.6)', marginBottom: 14, gap: 0 }}>
                  {(['whatsapp', 'botapi'] as MetaMode[]).map((mode, i) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setMetaMode(mode)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '6px 14px', background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 12, fontWeight: 500,
                        color: metaMode === mode ? '#93c5fd' : '#475569',
                        borderBottom: metaMode === mode ? '2px solid #3b82f6' : '2px solid transparent',
                        marginBottom: -1,
                        borderRadius: i === 0 ? '4px 0 0 0' : '0 4px 0 0',
                        transition: 'color 0.15s',
                      }}
                    >
                      {mode === 'whatsapp' ? <KeyRound size={12} /> : <Globe size={12} />}
                      {mode === 'whatsapp' ? 'Access Token' : 'Agent API'}
                    </button>
                  ))}
                </div>

                {/* ── Campos Access Token ── */}
                {metaMode === 'whatsapp' && (
                  <>
                    <div className="form-field">
                      <label className="form-label">
                        Access Token
                        <span className="form-hint" style={{ marginLeft: 4 }}>criptografado</span>
                      </label>
                      {setting && (
                        <div className="warning-box" style={{ marginBottom: 8 }}>
                          <AlertTriangle size={12} color="#fbbf24" style={{ flexShrink: 0 }} />
                          <span style={{ fontSize: 11 }}>Token criptografado — não retorna na API. Deixe vazio para manter o valor atual.</span>
                        </div>
                      )}
                      <input className="form-input" placeholder="EAAMjQ..." type="password"
                        value={accessToken} onChange={e => setAccessToken(e.target.value)} />
                    </div>

                    <div className="form-field">
                      <label className="form-label">API Version</label>
                      <input className="form-input" placeholder="v23.0"
                        value={apiVersion} onChange={e => setApiVersion(e.target.value)} />
                    </div>
                  </>
                )}

                {/* ── Campos Agent API ── */}
                {metaMode === 'botapi' && (
                  <>
                    <div className="form-field">
                      <label className="form-label">Agent API URL</label>
                      <input className="form-input" placeholder="https://api.exemplo.com/agent"
                        value={agentApiUrl} onChange={e => setAgentApiUrl(e.target.value)} />
                    </div>

                    <div className="form-field">
                      <label className="form-label">
                        Agent API Key
                        <span className="form-hint" style={{ marginLeft: 4 }}>criptografado</span>
                      </label>
                      {setting && (
                        <div className="warning-box" style={{ marginBottom: 8 }}>
                          <AlertTriangle size={12} color="#fbbf24" style={{ flexShrink: 0 }} />
                          <span style={{ fontSize: 11 }}>Key criptografada — não retorna na API. Deixe vazio para manter o valor atual.</span>
                        </div>
                      )}
                      <input className="form-input" placeholder="sk-..." type="password"
                        value={agentApiKey} onChange={e => setAgentApiKey(e.target.value)} />
                    </div>
                  </>
                )}
              </div>

              {/* ── Seção Orchestrator ── */}
              <div className="setting-section">
                <div className="setting-section-title">
                  <Settings size={13} /> Orchestrator
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {numInput('RAG · Máx. resultados', ragMaxResults, setRagMaxResults)}
                  {numInput('RAG · Similaridade mín.', ragMinSimilarity, setRagMinSimilarity, '0–1', '0.01')}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {numInput('Limite de tokens', chatTokensLimit, setChatTokensLimit)}
                  {numInput('Limite de mensagens', chatMessagesLimit, setChatMessagesLimit)}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {numInput('Ratio de resumo', summaryTriggerRatio, setSummaryTriggerRatio, '0–1', '0.01')}
                  {numInput('Timeout (min)', conversationTimeoutMin, setConversationTimeoutMin)}
                </div>
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
  const [expandedBotId,  setExpandedBotId]  = useState<string | null>(null);

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
                    <Fragment key={b.id}>
                      <tr style={{ borderBottom: expandedBotId === b.id ? 'none' : undefined }}>
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
                            <button
                              className="btn btn-ghost btn-icon"
                              title="Prompts"
                              onClick={() => setExpandedBotId(id => id === b.id ? null : b.id)}
                              style={{ color: expandedBotId === b.id ? '#93c5fd' : undefined }}
                            >
                              <FileText size={14} />
                              <ChevronDown size={10} style={{
                                marginLeft: -2,
                                transform: expandedBotId === b.id ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 0.2s',
                              }} />
                            </button>
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
                      {expandedBotId === b.id && (
                        <tr>
                          <td colSpan={6} style={{ padding: 0 }}>
                            <BotPromptsPanel bot={b} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
