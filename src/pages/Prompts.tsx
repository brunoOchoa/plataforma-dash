import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, RefreshCw,
  ChevronLeft, ChevronRight,
  X, Check, AlertTriangle,
  Bot as BotIcon, FolderOpen, Building2, ChevronRight as Arrow,
  FileText, RotateCcw, Loader2,
} from 'lucide-react';
import { promptService }    from '../services/promptService';
import { botService }       from '../services/botService';
import type { Prompt, PromptType, CreatePromptRequest } from '../types/prompt';
import type { Bot }         from '../types/bot';
import AppShell             from '../components/AppShell';
import { useCompany }       from '../context/CompanyContext';
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
const TYPE_LABELS: Record<PromptType, string> = {
  CHAT_GERAL: 'Chat Geral',
  RAG_GERAL:  'RAG Geral',
};

/* ══════════════════════════════════════
   PROMPT MODAL
══════════════════════════════════════ */
interface PromptModalProps {
  bots: Bot[];
  defaultBotId?: string;
  onClose: () => void;
  onSave: (body: CreatePromptRequest) => Promise<void>;
}

function PromptModal({ bots, defaultBotId, onClose, onSave }: PromptModalProps) {
  const [botId,       setBotId]       = useState(defaultBotId ?? '');
  const [typePrompt,  setTypePrompt]  = useState<PromptType>('CHAT_GERAL');
  const [description, setDescription] = useState('');
  const [promptText,  setPromptText]  = useState('');
  const [saving,      setSaving]      = useState(false);
  const [errors,      setErrors]      = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!botId)              e.botId      = 'Selecione um bot';
    if (!promptText.trim())  e.promptText = 'Texto do prompt é obrigatório';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave({
        bot_id:      botId,
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
            <p>Cria uma nova versão de prompt para um bot</p>
          </div>
          <button className="modal-close" onClick={close}><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {errors._api && (
            <div className="api-error-box">
              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
              <span>{errors._api}</span>
            </div>
          )}

          {/* Bot */}
          <div className="form-field">
            <label className="form-label">Bot *</label>
            <select
              className={`form-select ${errors.botId ? 'error' : ''}`}
              value={botId}
              onChange={e => setBotId(e.target.value)}
            >
              <option value="">Selecione um bot...</option>
              {bots.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            {errors.botId && <span className="form-error-msg">{errors.botId}</span>}
          </div>

          {/* Tipo */}
          <div className="form-field">
            <label className="form-label">Tipo *</label>
            <select
              className="form-select"
              value={typePrompt}
              onChange={e => setTypePrompt(e.target.value as PromptType)}
            >
              <option value="CHAT_GERAL">Chat Geral</option>
              <option value="RAG_GERAL">RAG Geral</option>
            </select>
          </div>

          {/* Descrição */}
          <div className="form-field">
            <label className="form-label">
              Descrição
              <span className="form-hint" style={{ marginLeft: 4 }}>opcional</span>
            </label>
            <input
              className="form-input"
              placeholder="Ex: Prompt de atendimento ao cliente v2"
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={512}
            />
          </div>

          {/* Prompt Text */}
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
            {saving
              ? <><span className="spinner-sm" /> Salvando…</>
              : <><Check size={14} /> Criar Prompt</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   PROMPT TEXT MODAL (visualizar)
══════════════════════════════════════ */
function ViewPromptModal({ prompt, onClose }: { prompt: Prompt; onClose: () => void }) {
  const { closing, close } = useModalAnimation(onClose);
  return (
    <div className={`modal-backdrop${closing ? ' modal-closing' : ''}`} onClick={close}>
      <div
        className={`modal modal-lg${closing ? ' modal-closing' : ''}`}
        style={{ maxWidth: 680 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={16} color="#93c5fd" />
              {TYPE_LABELS[prompt.type_prompt]}
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
            maxHeight: 480, overflowY: 'auto',
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

/* ══════════════════════════════════════
   PROMPTS PAGE
══════════════════════════════════════ */
export default function Prompts() {
  const navigate = useNavigate();
  const { selectedCompany } = useCompany();

  const [prompts,   setPrompts]   = useState<Prompt[]>([]);
  const [bots,      setBots]      = useState<Bot[]>([]);
  const [selBot,    setSelBot]    = useState('');
  const [selType,   setSelType]   = useState<PromptType | ''>('');
  const [page,      setPage]      = useState(0);
  const [total,     setTotal]     = useState(0);
  const [totalPg,   setTotalPg]   = useState(1);
  const [loading,   setLoading]   = useState(false);
  const [creating,  setCreating]  = useState(false);
  const [viewing,   setViewing]   = useState<Prompt | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);

  const { toasts, push } = useToast();

  /* Carrega bots para o filtro/select — filtra pela empresa do contexto */
  useEffect(() => {
    const params: Record<string, any> = { size: 100 };
    if (selectedCompany?.id) params.companyId = selectedCompany.id;
    botService.list(params)
      .then(r => setBots(r.content.filter(b => b.active)))
      .catch(() => {});
  }, [selectedCompany]);

  /* Reseta página e bot ao trocar empresa */
  useEffect(() => {
    setSelBot('');
    setPage(0);
  }, [selectedCompany]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, size: 15 };
      if (selBot)  params.botId      = selBot;
      if (selType) params.typePrompt = selType;
      const r = await promptService.list(params);
      setPrompts(r.content);
      setTotal(r.totalElements);
      setTotalPg(r.totalPages || 1);
    } catch {
      push('Erro ao carregar prompts', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, selBot, selType, push]);

  useEffect(() => { setPage(0); }, [selBot, selType, selectedCompany]);
  useEffect(() => { load(); }, [load]);

  const handleCreate = async (body: CreatePromptRequest) => {
    await promptService.create(body);
    push('Prompt criado!');
    load();
  };

  const handleRestore = async (id: string) => {
    setRestoring(id);
    try {
      await promptService.restore(id);
      push('Prompt restaurado!');
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Erro ao restaurar prompt';
      push(typeof msg === 'string' ? msg : JSON.stringify(msg), 'error');
    } finally {
      setRestoring(null);
    }
  };

  const pageNums = (() => {
    const out = [];
    for (let i = Math.max(0, page - 2); i <= Math.min(totalPg - 1, page + 2); i++) out.push(i);
    return out;
  })();

  const selectedBotName = bots.find(b => b.id === selBot)?.name;

  return (
    <AppShell>
      <div className="page-flex-col">

        <div className="page-header page-header-pad" style={{ marginBottom: 0 }}>
          <div className="page-header-left">
            <div className="hierarchy-breadcrumb">
              <button className="hierarchy-crumb-link" onClick={() => navigate('/bots')}>
                <BotIcon size={13} /> Bots
              </button>
              <Arrow size={13} style={{ color: '#334155' }} />
              <span className="hierarchy-crumb-active"><FileText size={13} /> Prompts</span>
            </div>
            <h1 style={{ marginTop: 6 }}>Prompts</h1>
            <p>
              {selectedBotName
                ? `Histórico de prompts do bot ${selectedBotName}`
                : 'Histórico de versões de prompts de todos os bots'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" onClick={load} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'spin' : ''} /> Atualizar
            </button>
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              <Plus size={14} /> Novo Prompt
            </button>
          </div>
        </div>

        <div className="page-section-pad" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>

          {/* Filtros */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 300 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none' }} />
              <select
                className="form-select"
                style={{ paddingLeft: 32, height: 38 }}
                value={selBot}
                onChange={e => setSelBot(e.target.value)}
              >
                <option value="">Todos os bots</option>
                {bots.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <select
              className="form-select"
              style={{ height: 38, width: 'auto', minWidth: 160 }}
              value={selType}
              onChange={e => setSelType(e.target.value as PromptType | '')}
            >
              <option value="">Todos os tipos</option>
              <option value="CHAT_GERAL">Chat Geral</option>
              <option value="RAG_GERAL">RAG Geral</option>
            </select>
          </div>

          {/* Tabela */}
          <div className="table-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="table-wrap" style={{ flex: 1, overflowY: 'auto' }}>
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Versão</th>
                    <th>Bot</th>
                    <th>Tipo</th>
                    <th>Descrição</th>
                    <th>Status</th>
                    <th>Criado em</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr className="loading-row">
                      <td colSpan={7}><div className="spinner" />Carregando...</td>
                    </tr>
                  ) : prompts.length === 0 ? (
                    <tr><td colSpan={7}>
                      <div className="table-empty">
                        <FileText size={28} />
                        <p>Nenhum prompt encontrado</p>
                        {(selBot || selType) && (
                          <button
                            className="btn btn-secondary"
                            style={{ marginTop: 12 }}
                            onClick={() => { setSelBot(''); setSelType(''); }}
                          >
                            Limpar filtros
                          </button>
                        )}
                      </div>
                    </td></tr>
                  ) : prompts.map(p => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="bot-avatar-sm" style={{ fontSize: 11, minWidth: 30, height: 30 }}>
                            v{p.version}
                          </div>
                        </div>
                      </td>
                      <td data-label="Bot">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <BotIcon size={12} color="#475569" />
                          <span style={{ fontSize: 13, color: '#94a3b8' }}>
                            {bots.find(b => b.id === p.bot_id)?.name ?? p.bot_id.slice(0, 8) + '…'}
                          </span>
                        </div>
                      </td>
                      <td data-label="Tipo">
                        <span className="pill pill-blue" style={{ fontSize: 11 }}>
                          {TYPE_LABELS[p.type_prompt]}
                        </span>
                      </td>
                      <td data-label="Descrição">
                        <span style={{ fontSize: 13, color: p.description ? '#94a3b8' : '#334155', fontStyle: p.description ? 'normal' : 'italic' }}>
                          {p.description ?? '—'}
                        </span>
                      </td>
                      <td data-label="Status">
                        <span className={`pill ${p.active ? 'pill-green' : 'pill-gray'}`}>
                          {p.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td data-label="Criado em">
                        <span style={{ fontSize: 13, color: '#64748b' }}>
                          {new Date(p.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </td>
                      <td>
                        <div className="actions-cell">
                          <button
                            className="btn btn-ghost btn-icon"
                            title="Ver prompt"
                            onClick={() => setViewing(p)}
                          >
                            <FileText size={14} />
                          </button>
                          {!p.active && (
                            <button
                              className="btn btn-ghost btn-icon"
                              title="Restaurar esta versão"
                              onClick={() => handleRestore(p.id)}
                              disabled={restoring === p.id}
                            >
                              {restoring === p.id
                                ? <Loader2 size={14} className="spin" />
                                : <RotateCcw size={14} />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPg > 1 && (
              <div className="pagination">
                <span className="pagination-info">{total} prompt{total !== 1 ? 's' : ''} · pág {page + 1}/{totalPg}</span>
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
                <div className="hierarchy-step-icon" style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.35)' }}>
                  <BotIcon size={14} color="#93c5fd" />
                </div>
                <span>Bot</span>
              </div>
              <Arrow size={14} style={{ color: '#1e293b', flexShrink: 0 }} />
              <div className="hierarchy-step hierarchy-step-current">
                <div className="hierarchy-step-icon" style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.35)' }}>
                  <FileText size={14} color="#c4b5fd" />
                </div>
                <span>Prompt</span>
              </div>
            </div>
            <p className="hierarchy-info-text">
              Cada bot pode ter múltiplas versões de prompt. Apenas uma versão por tipo fica ativa por vez — ao criar, a anterior é desativada automaticamente. Use Restaurar para reativar uma versão anterior.
            </p>
          </div>
        </div>
      </div>

      {/* Modais */}
      {creating && (
        <PromptModal
          bots={bots}
          defaultBotId={selBot}
          onClose={() => setCreating(false)}
          onSave={handleCreate}
        />
      )}
      {viewing && (
        <ViewPromptModal prompt={viewing} onClose={() => setViewing(null)} />
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
