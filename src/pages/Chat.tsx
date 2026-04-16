import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bot, User, UserCheck, RefreshCw, ChevronLeft, ChevronRight,
  MessageCircle, Zap, Search, MessagesSquare,
} from 'lucide-react';
import { chatService } from '../services/chatService';
import { botService }  from '../services/botService';
import type { ChatSession, ChatMessage, SessionStatus, Channel } from '../types/chat';
import type { Bot as BotType } from '../types/bot';
import type { Page } from '../types/user';
import AppShell from '../components/AppShell';
import { useCompany } from '../context/CompanyContext';

/* ── helpers ────────────────────────────────────────── */
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return fmtTime(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
function shortId(id: string) {
  return id.slice(-8).toUpperCase();
}

const STATUS_LABELS: Record<SessionStatus, string> = {
  ACTIVE:    'Ativo',
  CLOSED:    'Encerrado',
  ABANDONED: 'Abandonado',
  EXPIRED:   'Expirado',
};
const STATUS_PILL: Record<SessionStatus, string> = {
  ACTIVE:    'pill-green',
  CLOSED:    'pill-gray',
  ABANDONED: 'pill-amber',
  EXPIRED:   'pill-red',
};

const CHANNEL_LABELS: Record<Channel, string> = {
  WHATSAPP: 'WhatsApp',
  TEAMS:    'Teams',
  WEB:      'Web',
};
const CHANNEL_COLOR: Record<Channel, string> = {
  WHATSAPP: '#25d366',
  TEAMS:    '#6264a7',
  WEB:      '#3b82f6',
};

// cor do avatar derivada do account_id
const AVATAR_COLORS = ['#2563eb','#7c3aed','#db2777','#059669','#d97706','#dc2626','#0891b2'];
function avatarColor(id: string) {
  const n = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

/* ── SessionItem ────────────────────────────────────── */
function SessionItem({
  session, selected, onClick,
}: { session: ChatSession; selected: boolean; onClick: () => void }) {
  return (
    <button
      className={`chat-session-item${selected ? ' selected' : ''}`}
      onClick={onClick}
    >
      <div
        className="chat-session-avatar"
        style={{ background: avatarColor(session.account_id) }}
      >
        <User size={14} color="#fff" />
      </div>
      <div className="chat-session-info">
        <div className="chat-session-row1">
          <span className="chat-session-id">#{shortId(session.id)}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtDate(session.updated_at)}</span>
        </div>
        <div className="chat-session-row2">
          <Bot size={11} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
          <span className="chat-session-agent">{session.agent_name}</span>
        </div>
        <div className="chat-session-row3">
          <span className={`pill ${STATUS_PILL[session.interaction_status]}`} style={{ fontSize: 9, padding: '1px 6px' }}>
            {STATUS_LABELS[session.interaction_status]}
          </span>
          {session.channel && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
              background: `${CHANNEL_COLOR[session.channel]}22`,
              color: CHANNEL_COLOR[session.channel],
              border: `1px solid ${CHANNEL_COLOR[session.channel]}44`,
            }}>
              {CHANNEL_LABELS[session.channel]}
            </span>
          )}
          <span className="chat-session-tokens">
            <Zap size={10} />{session.total_tokens.toLocaleString()}
          </span>
        </div>
      </div>
    </button>
  );
}

/* ── MessageBubble ──────────────────────────────────── */
function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser  = msg.type_message === 'USER';
  const isHuman = msg.type_message === 'HUMAN_AGENT';

  const bubbleClass = isUser
    ? 'chat-bubble chat-bubble-user'
    : isHuman
      ? 'chat-bubble chat-bubble-human'
      : 'chat-bubble chat-bubble-bot';

  const icon = isUser
    ? <User size={13} />
    : isHuman
      ? <UserCheck size={13} />
      : <Bot size={13} />;

  const senderLabel = isUser ? 'Usuário' : isHuman ? 'Agente' : 'Bot';

  return (
    <div className={`chat-bubble-wrap${isUser ? ' chat-bubble-wrap-user' : ''}`}>
      {!isUser && (
        <div className="chat-bubble-avatar">{icon}</div>
      )}
      <div className={bubbleClass}>
        <div className="chat-bubble-sender">{senderLabel}</div>
        <div className="chat-bubble-content">{msg.content}</div>
        <div className="chat-bubble-meta">
          <span>{fmtTime(msg.created_at)}</span>
          {msg.total_tokens > 0 && (
            <span><Zap size={9} />{msg.total_tokens}</span>
          )}
        </div>
      </div>
      {isUser && (
        <div className="chat-bubble-avatar chat-bubble-avatar-user">{icon}</div>
      )}
    </div>
  );
}

/* ── EmptyMessages ──────────────────────────────────── */
function EmptyMessages({ hasBot }: { hasBot: boolean }) {
  return (
    <div className="chat-empty">
      <MessagesSquare size={40} style={{ opacity: 0.2 }} />
      <p>{hasBot ? 'Selecione uma sessão para ver a conversa' : 'Selecione um bot para carregar as sessões'}</p>
    </div>
  );
}

/* ── Chat Page ──────────────────────────────────────── */
export default function Chat() {
  const { selectedCompany } = useCompany();

  // bots disponíveis
  const [bots, setBots]               = useState<BotType[]>([]);
  const [selectedBotId, setSelectedBotId] = useState('');

  // sessions
  const [sessions, setSessions]         = useState<Page<ChatSession> | null>(null);
  const [sessionPage, setSessionPage]   = useState(0);
  const [statusFilter, setStatusFilter] = useState<SessionStatus | ''>('');
  const [channelFilter, setChannelFilter] = useState<Channel | ''>('');
  const [fromDate, setFromDate]         = useState('');
  const [toDate, setToDate]             = useState('');
  const [loadingSessions, setLoadingSessions] = useState(false);

  // sessão e mensagens selecionadas
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [messages, setMessages]       = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // carrega bots
  useEffect(() => {
    botService.list({ size: 100, companyId: selectedCompany?.id })
      .then(data => {
        setBots(data.content);
        if (data.content.length > 0 && !selectedBotId) {
          setSelectedBotId(data.content[0].id);
        }
      })
      .catch(() => setBots([]));
  }, [selectedCompany]);

  // carrega sessões
  const loadSessions = useCallback(async () => {
    if (!selectedBotId) { setSessions(null); return; }
    setLoadingSessions(true);
    try {
      const data = await chatService.getSessions({
        agentId: selectedBotId,
        page:    sessionPage,
        size:    20,
        status:  statusFilter  || undefined,
        channel: channelFilter || undefined,
        from:    fromDate ? new Date(`${fromDate}T00:00:00`).toISOString() : undefined,
        to:      toDate   ? new Date(`${toDate}T23:59:59`).toISOString()   : undefined,
      });
      setSessions(data);
      setSelectedSession(null);
      setMessages([]);
    } catch {
      setSessions(null);
    } finally {
      setLoadingSessions(false);
    }
  }, [selectedBotId, sessionPage, statusFilter, channelFilter, fromDate, toDate]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // qualquer mudança de filtro reseta para page 0
  const handleBotChange     = (id: string)          => { setSelectedBotId(id);   setSessionPage(0); };
  const handleStatusChange  = (s: SessionStatus | '') => { setStatusFilter(s);   setSessionPage(0); };
  const handleChannelChange = (c: Channel | '')      => { setChannelFilter(c);   setSessionPage(0); };
  const handleFromChange    = (v: string)            => { setFromDate(v);         setSessionPage(0); };
  const handleToChange      = (v: string)            => { setToDate(v);           setSessionPage(0); };

  // carrega mensagens da sessão selecionada
  useEffect(() => {
    if (!selectedSession) return;
    setLoadingMessages(true);
    setMessages([]);
    chatService.getMessages(selectedSession.id)
      .then(msgs => {
        setMessages(msgs);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
      })
      .catch(() => setMessages([]))
      .finally(() => setLoadingMessages(false));
  }, [selectedSession]);

  const sessionList = sessions?.content ?? [];
  const totalPages  = sessions?.totalPages ?? 1;

  return (
    <AppShell>
      <div className="chat-page">

        {/* ── Filtros ─────────────────────────────── */}
        <div className="chat-filters">
          {/* linha 1: bot + refresh */}
          <div className="chat-filters-row">
            <Bot size={14} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
            <select
              className="form-select"
              value={selectedBotId}
              onChange={e => handleBotChange(e.target.value)}
              style={{ flex: 1, minWidth: 0 }}
            >
              {bots.length === 0 && <option value="">Nenhum bot disponível</option>}
              {bots.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            <select
              className="form-select"
              value={statusFilter}
              onChange={e => handleStatusChange(e.target.value as SessionStatus | '')}
              style={{ width: 148 }}
            >
              <option value="">Todos os status</option>
              <option value="ACTIVE">Ativos</option>
              <option value="CLOSED">Encerrados</option>
              <option value="ABANDONED">Abandonados</option>
              <option value="EXPIRED">Expirados</option>
            </select>

            <select
              className="form-select"
              value={channelFilter}
              onChange={e => handleChannelChange(e.target.value as Channel | '')}
              style={{ width: 130 }}
            >
              <option value="">Todos os canais</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="TEAMS">Teams</option>
              <option value="WEB">Web</option>
            </select>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="date"
                className="form-input"
                value={fromDate}
                onChange={e => handleFromChange(e.target.value)}
                title="Data início"
                style={{ width: 140, fontSize: 12 }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>até</span>
              <input
                type="date"
                className="form-input"
                value={toDate}
                onChange={e => handleToChange(e.target.value)}
                title="Data fim"
                style={{ width: 140, fontSize: 12 }}
              />
            </div>

            <button className="btn btn-secondary btn-icon" onClick={loadSessions} disabled={loadingSessions} title="Atualizar">
              <RefreshCw size={14} className={loadingSessions ? 'spin' : ''} />
            </button>
          </div>
        </div>

        {/* ── Layout ──────────────────────────────── */}
        <div className="chat-layout">

          {/* Lista de sessões */}
          <div className="chat-sessions-panel">
            <div className="chat-sessions-header">
              <MessageCircle size={13} />
              <span>Conversas</span>
              {sessions && <span className="chat-count-badge">{sessions.totalElements}</span>}
            </div>

            <div className="chat-sessions-list">
              {loadingSessions ? (
                <div className="chat-list-empty">
                  <div className="spinner" style={{ width: 20, height: 20 }} />
                </div>
              ) : sessionList.length === 0 ? (
                <div className="chat-list-empty">
                  <Search size={22} style={{ opacity: 0.2 }} />
                  <span>Nenhuma sessão encontrada</span>
                </div>
              ) : sessionList.map(s => (
                <SessionItem
                  key={s.id}
                  session={s}
                  selected={selectedSession?.id === s.id}
                  onClick={() => setSelectedSession(s)}
                />
              ))}
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="chat-sessions-pagination">
                <button
                  className="btn btn-ghost btn-icon"
                  disabled={sessionPage === 0}
                  onClick={() => setSessionPage(p => p - 1)}
                >
                  <ChevronLeft size={14} />
                </button>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {sessionPage + 1} / {totalPages}
                </span>
                <button
                  className="btn btn-ghost btn-icon"
                  disabled={sessionPage >= totalPages - 1}
                  onClick={() => setSessionPage(p => p + 1)}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Painel de mensagens */}
          <div className="chat-messages-panel">
            {!selectedSession ? (
              <EmptyMessages hasBot={!!selectedBotId} />
            ) : (
              <>
                {/* Header da sessão */}
                <div className="chat-messages-header">
                  <div
                    className="chat-session-avatar"
                    style={{ background: avatarColor(selectedSession.account_id), width: 36, height: 36 }}
                  >
                    <User size={16} color="#fff" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                        #{shortId(selectedSession.id)}
                      </span>
                      <span className={`pill ${STATUS_PILL[selectedSession.interaction_status]}`} style={{ fontSize: 10 }}>
                        {STATUS_LABELS[selectedSession.interaction_status]}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 2, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Bot size={11} /> {selectedSession.agent_name}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {new Date(selectedSession.created_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Zap size={10} /> {selectedSession.total_tokens.toLocaleString()} tokens
                      </span>
                    </div>
                  </div>
                </div>

                {/* Mensagens */}
                <div className="chat-messages-body">
                  {loadingMessages ? (
                    <div className="chat-empty">
                      <div className="spinner" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="chat-empty">
                      <MessagesSquare size={32} style={{ opacity: 0.2 }} />
                      <p>Sem mensagens nesta sessão</p>
                    </div>
                  ) : (
                    <>
                      {messages.map(m => (
                        <MessageBubble key={m.id} msg={m} />
                      ))}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
