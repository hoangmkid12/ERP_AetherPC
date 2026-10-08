import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, Sparkles, X, Send, Trash2, ChevronDown, ExternalLink, 
  ShieldCheck, AlertCircle, RefreshCw, FileText, CheckCircle2,
  Cpu, DollarSign, Package, Truck, ArrowRight, Minimize2, Maximize2,
  ThumbsUp, ThumbsDown, ClipboardCheck, MessageSquare
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { notify } from '../../context/NotificationContext';

export default function AetherCopilot() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Xin chào **${user?.name || 'bạn'}**! Tôi là **AetherCopilot** — Trợ lý AI Điều Hành & Tri Thức Nội Bộ AetherPC.\n\nTôi có thể hỗ trợ bạn:\n- 📖 Tra cứu quy định, chính sách bảo hành 1 đổi 1, chiết khấu VIP, SOP đối soát COD...\n- 🔍 Kiểm tra tồn kho sản phẩm, thông số linh kiện theo thời gian thực.\n- ⚙️ Kiểm tra tương thích cấu hình PC.\n- 📊 Truy vấn doanh thu, dòng tiền & đơn hàng theo đúng quyền hạn vai trò **${user?.role || 'NHÂN VIÊN'}** của bạn.`,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      citations: []
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [promptChips, setPromptChips] = useState([]);
  const [selectedDocModal, setSelectedDocModal] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [feedbackDraftId, setFeedbackDraftId] = useState(null);
  const [feedbackDraft, setFeedbackDraft] = useState('');
  const [feedbackBusyId, setFeedbackBusyId] = useState(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [feedbackQueue, setFeedbackQueue] = useState([]);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [reviewForm, setReviewForm] = useState({ title: '', category: 'GENERAL', content: '' });
  const [reviewBusy, setReviewBusy] = useState(false);
  const messagesEndRef = useRef(null);
  const canReviewAiFeedback = ['ADMIN', 'CEO'].includes(user?.role);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Load role-tailored prompt chips
  useEffect(() => {
    const fetchChips = async () => {
      try {
        const res = await api.get('/ai/prompt-chips');
        if (res.success && Array.isArray(res.data)) {
          setPromptChips(res.data);
        }
      } catch (err) {
        // Fallback default chips based on role
        setPromptChips([
          'Chính sách bảo hành 1 đổi 1 trong bao nhiêu ngày?',
          'Kiểm tra tồn kho linh kiện CPU và VGA hiện tại',
          'Quy định chiết khấu cho khách VIP là bao nhiêu?',
          'Quy trình đối soát COD và bàn giao tiền của Shipper'
        ]);
      }
    };
    if (user) {
      fetchChips();
    }
  }, [user]);

  // Handle user send message
  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || inputValue).trim();
    if (!text || loading) return;

    const userMsgId = 'msg-' + Date.now();
    const newUserMsg = {
      id: userMsgId,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, newUserMsg]);
    setInputValue('');
    setLoading(true);

    try {
      const response = await api.post('/ai/chat', { 
        message: text,
        sessionId: `session_${user?.id || 'anon'}`,
        conversationHistory: messages.slice(-6).map(m => ({
          role: m.role,
          content: m.content
        }))
      });
      
      if (response && response.success) {
        const replyText = response.data?.reply || response.data?.response || response.data?.message || (typeof response.data === 'string' ? response.data : '');
        const botMsg = {
          id: 'bot-' + Date.now(),
          role: 'assistant',
          prompt: text,
          content: replyText || 'Đã ghi nhận yêu cầu nhưng không có nội dung văn bản phản hồi.',
          toolCalls: response.data?.toolCalls || [],
          citations: response.data?.citations || [],
          auditLogId: response.data?.auditLogId || null,
          isCached: response.data?.isCached || false,
          matchSource: response.data?.matchSource || null,
          latencyMs: response.data?.latencyMs || null,
          skillId: response.data?.skillId || null,
          followUps: response.data?.followUps || [],
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, botMsg]);
      } else {
        throw new Error(response?.message || 'Không nhận được phản hồi từ Copilot');
      }
    } catch (err) {
      console.error('Copilot Chat Error:', err);
      const errorMsg = {
        id: 'err-' + Date.now(),
        role: 'assistant',
        content: `⚠️ Rất tiếc, đã có lỗi kết nối với máy chủ AI: ${err.message || 'Vui lòng thử lại sau.'}`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    try {
      api.post('/ai/session/clear', { sessionId: `session_${user?.id || 'anon'}` }).catch(() => {});
    } catch {
      // Bỏ qua lỗi ngầm
    }

    setMessages([
      {
        id: 'welcome-' + Date.now(),
        role: 'assistant',
        content: `Đã làm mới phiên hội thoại và bộ nhớ đệm AI. Tôi sẵn sàng hỗ trợ các câu hỏi tra cứu dữ liệu & tài liệu SOP của bạn.`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        citations: []
      }
    ]);
  };

  // Open referenced knowledge document
  const handleOpenDocModal = async (docIdOrSlug) => {
    setModalLoading(true);
    try {
      const res = await api.get(`/knowledge/${docIdOrSlug}`);
      if (res.success && res.data) {
        setSelectedDocModal(res.data);
      } else {
        notify('Không thể tải chi tiết tài liệu này hoặc bạn chưa có quyền xem.', 'warning');
      }
    } catch (err) {
      notify(err.message || 'Không thể mở tài liệu.', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const submitFeedback = async (msg, rating, correction = '') => {
    setFeedbackBusyId(msg.id);
    try {
      await api.post('/ai/feedback', {
        chatLogId: msg.auditLogId,
        prompt: msg.prompt,
        response: msg.content,
        rating,
        correction
      });
      setMessages(prev => prev.map(item => item.id === msg.id ? { ...item, feedbackSubmitted: true } : item));
      setFeedbackDraftId(null);
      setFeedbackDraft('');
      notify('Cảm ơn bạn đã góp ý cho AetherCopilot.', 'success');
    } catch (err) {
      notify(err.message || 'Không thể lưu phản hồi AI.', 'error');
    } finally {
      setFeedbackBusyId(null);
    }
  };

  const loadFeedbackQueue = async () => {
    try {
      const res = await api.get('/ai/feedback/pending');
      const queue = res.data || [];
      setFeedbackQueue(queue);
      if (queue.length > 0) {
        const next = queue[0];
        setSelectedFeedback(next);
        setReviewForm({
          title: next.prompt.slice(0, 80),
          category: 'GENERAL',
          content: next.correction || ''
        });
      } else {
        setSelectedFeedback(null);
        setReviewForm({ title: '', category: 'GENERAL', content: '' });
      }
    } catch (err) {
      notify(err.message || 'Không thể tải phản hồi đang chờ duyệt.', 'error');
    }
  };

  const openFeedbackReview = async () => {
    setReviewModalOpen(true);
    await loadFeedbackQueue();
  };

  const selectFeedbackForReview = (item) => {
    setSelectedFeedback(item);
    setReviewForm({
      title: item.prompt.slice(0, 80),
      category: 'GENERAL',
      content: item.correction || ''
    });
  };

  const reviewFeedback = async (action) => {
    if (!selectedFeedback) return;
    setReviewBusy(true);
    try {
      await api.post(`/ai/feedback/${selectedFeedback.id}/review`, action === 'APPROVE'
        ? { action, ...reviewForm }
        : { action });
      notify(action === 'APPROVE' ? 'Đã duyệt và bổ sung vào kho tri thức.' : 'Đã từ chối phản hồi.', 'success');
      await loadFeedbackQueue();
    } catch (err) {
      notify(err.message || 'Không thể xử lý phản hồi.', 'error');
    } finally {
      setReviewBusy(false);
    }
  };

  // Render markdown-like simple formatting (bold, bullet, code, line breaks)
  const renderFormattedText = (text) => {
    if (!text) return null;

    // Split paragraphs
    const paragraphs = text.split('\n');

    return paragraphs.map((line, pIdx) => {
      // Empty line
      if (!line.trim()) {
        return <div key={pIdx} style={{ height: '6px' }} />;
      }

      // Bullet points
      const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('* ');
      const cleanLine = isBullet ? line.trim().substring(2) : line;

      // Simple inline bold replacement (**text**)
      const parts = cleanLine.split(/(\*\*[^*]+\*\*)/g);

      const formattedContent = parts.map((part, partIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={partIdx} style={{ color: '#0f172a', fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
        }
        return part;
      });

      if (isBullet) {
        return (
          <div key={pIdx} style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start', margin: '3px 0' }}>
            <span style={{ color: '#2563eb', fontWeight: 'bold' }}>•</span>
            <div style={{ flex: 1 }}>{formattedContent}</div>
          </div>
        );
      }

      return (
        <p key={pIdx} style={{ margin: '0 0 6px 0', lineHeight: 1.55 }}>
          {formattedContent}
        </p>
      );
    });
  };

  // Ẩn hoàn toàn chat Copilot đối với actor giao hàng (DELIVERY)
  if (user?.role === 'DELIVERY') {
    return null;
  }

  return (
    <>
      {/* Floating Action Button (FAB) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="copilot-fab"
          aria-label="Mở Trợ Lý AI AetherCopilot"
          title="Mở Trợ Lý AI AetherCopilot"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9980,
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            color: '#1e293b',
            border: '1.5px solid rgba(226, 232, 240, 0.9)',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 10px 25px -4px rgba(37, 99, 235, 0.2), 0 4px 12px rgba(0, 0, 0, 0.08)',
            cursor: 'pointer',
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: 'scale(1)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.08)';
            e.currentTarget.style.boxShadow = '0 14px 30px -4px rgba(37, 99, 235, 0.35), 0 6px 16px rgba(0, 0, 0, 0.1)';
            e.currentTarget.style.borderColor = '#38bdf8';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 10px 25px -4px rgba(37, 99, 235, 0.2), 0 4px 12px rgba(0, 0, 0, 0.08)';
            e.currentTarget.style.borderColor = 'rgba(226, 232, 240, 0.9)';
          }}
        >
          <div style={{
            position: 'relative',
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #2563eb, #06b6d4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)'
          }}>
            <MessageSquare size={19} />
            <span style={{
              position: 'absolute',
              top: '0',
              right: '0',
              width: '9px',
              height: '9px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              border: '2px solid #ffffff'
            }} />
          </div>
        </button>
      )}

      {/* Copilot Drawer Window */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: isExpanded ? '650px' : '440px',
            maxWidth: 'calc(100vw - 32px)',
            height: isExpanded ? '85vh' : '620px',
            maxHeight: 'calc(100vh - 40px)',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(148, 163, 184, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 9990,
            overflow: 'hidden',
            transition: 'width 0.3s ease, height 0.3s ease',
            fontFamily: 'inherit'
          }}
        >
          {/* Header */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            padding: '12px 16px',
            color: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #2563eb, #06b6d4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)'
              }}>
                <Bot size={22} color="#ffffff" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: 800, letterSpacing: '0.2px', color: '#0f172a' }}>AetherCopilot</span>
                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: '#eff6ff',
                    color: '#2563eb',
                    border: '1px solid #bfdbfe'
                  }}>
                    {user?.role || 'USER'}
                  </span>
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                  <span>Sẵn sàng kết nối SOP & Live DB</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {canReviewAiFeedback && (
                <button
                  onClick={openFeedbackReview}
                  title="Duyệt phản hồi AI"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: '6px',
                    borderRadius: '6px',
                    display: 'flex',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#0f172a'; e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <ClipboardCheck size={16} />
                </button>
              )}
              <button
                onClick={handleClearHistory}
                title="Làm mới đoạn chat"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#0f172a'; e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <Trash2 size={16} />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? 'Thu nhỏ' : 'Mở rộng'}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#0f172a'; e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Đóng Copilot"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.backgroundColor = '#fee2e2'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Security Banner */}
          <div style={{
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            padding: '6px 12px',
            fontSize: '0.68rem',
            color: '#475569',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <ShieldCheck size={13} style={{ color: '#059669' }} />
              <span>Phân quyền RBAC tự động theo vai trò <strong>{user?.role}</strong></span>
            </div>
            <span style={{ color: '#94a3b8' }}>Zero-leakage Engine</span>
          </div>

          {/* Messages Area */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            backgroundColor: '#f8fafc'
          }}>
            {messages.map(msg => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '100%'
                }}
              >
                <div
                  style={{
                    maxWidth: msg.role === 'user' ? '85%' : '94%',
                    backgroundColor: msg.role === 'user' ? '#1e293b' : '#ffffff',
                    color: msg.role === 'user' ? '#f8fafc' : '#1e293b',
                    borderRadius: msg.role === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                    padding: '10px 14px',
                    fontSize: '0.82rem',
                    lineHeight: 1.5,
                    boxShadow: msg.role === 'user' 
                      ? '0 2px 4px rgba(0,0,0,0.1)' 
                      : '0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px #e2e8f0',
                    wordBreak: 'break-word'
                  }}
                >
                  {/* Offline Engine / Cache Badge */}
                  {msg.role === 'assistant' && (msg.matchSource || msg.isCached) && (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      marginBottom: '6px',
                      padding: '2px 8px',
                      backgroundColor: msg.isCached ? '#ecfdf5' : '#f0fdf4',
                      borderRadius: '12px',
                      border: msg.isCached ? '1px solid #a7f3d0' : '1px solid #bbf7d0',
                      fontSize: '0.68rem',
                      color: msg.isCached ? '#047857' : '#15803d',
                      fontWeight: 700
                    }}>
                      <ShieldCheck size={12} style={{ color: msg.isCached ? '#059669' : '#16a34a' }} />
                      <span>
                        {msg.isCached 
                          ? `⚡ Bộ nhớ đệm (< 1ms)` 
                          : `🔒 Offline Deterministic Engine (${msg.latencyMs ? msg.latencyMs + 'ms' : '< 30ms'})`}
                      </span>
                    </div>
                  )}

                  {/* Tool execution badge */}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      marginBottom: '8px',
                      padding: '4px 8px',
                      backgroundColor: '#eff6ff',
                      borderRadius: '6px',
                      border: '1px solid #bfdbfe',
                      fontSize: '0.7rem',
                      color: '#1d4ed8',
                      fontWeight: 600
                    }}>
                      <CheckCircle2 size={13} style={{ color: '#2563eb' }} />
                      <span>
                        Đã đối chiếu dữ liệu: {msg.toolCalls.map(t => {
                          if (t.name === 'lookup_knowledge_base') return 'Cơ sở Tri thức SOP';
                          if (t.name === 'lookup_products') return 'Kho & Sản phẩm';
                          if (t.name === 'get_finance_kpi') return 'Chỉ số Tài chính';
                          if (t.name === 'lookup_order_status') return 'Trạng thái Đơn hàng';
                          if (t.name === 'get_my_delivery_tasks') return 'Đơn giao được phân công';
                          return t.name;
                        }).join(', ')}
                      </span>
                    </div>
                  )}

                  {/* Message body */}
                  <div>
                    {renderFormattedText(msg.content)}
                  </div>

                  {/* Proactive Follow-up Action Chips (Gợi ý F1 / F2 tiếp theo) */}
                  {msg.followUps && msg.followUps.length > 0 && (
                    <div style={{
                      marginTop: '10px',
                      paddingTop: '8px',
                      borderTop: '1px dashed #e2e8f0'
                    }}>
                      <div style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        color: '#64748b',
                        marginBottom: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <Sparkles size={11} style={{ color: '#0284c7' }} />
                        <span>GỢI Ý CÂU HỎI TIẾP THEO (F1/F2):</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {msg.followUps.map((chip, chipIdx) => (
                          <button
                            key={chipIdx}
                            onClick={() => handleSendMessage(chip)}
                            style={{
                              backgroundColor: '#f0f9ff',
                              border: '1px solid #bae6fd',
                              borderRadius: '12px',
                              padding: '4px 10px',
                              fontSize: '0.72rem',
                              color: '#0369a1',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.15s ease',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.backgroundColor = '#e0f2fe';
                              e.currentTarget.style.borderColor = '#38bdf8';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.backgroundColor = '#f0f9ff';
                              e.currentTarget.style.borderColor = '#bae6fd';
                              e.currentTarget.style.transform = 'translateY(0)';
                            }}
                          >
                            <span>💡 {chip}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Citations Pills */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div style={{
                      marginTop: '10px',
                      paddingTop: '8px',
                      borderTop: '1px dashed #cbd5e1'
                    }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <FileText size={12} style={{ color: '#2563eb' }} />
                        <span>TÀI LIỆU CĂN CỨ THAM CHIẾU:</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {msg.citations.map((cite, cIdx) => (
                          <button
                            key={cIdx}
                            onClick={() => handleOpenDocModal(cite.id)}
                            style={{
                              backgroundColor: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              padding: '3px 8px',
                              fontSize: '0.7rem',
                              color: '#1e40af',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.backgroundColor = '#e0f2fe';
                              e.currentTarget.style.borderColor = '#38bdf8';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.backgroundColor = '#f1f5f9';
                              e.currentTarget.style.borderColor = '#cbd5e1';
                            }}
                          >
                            <span>📄 {cite.title}</span>
                            <ExternalLink size={10} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {msg.role === 'assistant' && !msg.id.startsWith('welcome') && !msg.id.startsWith('err') && (
                  <div style={{ marginTop: '4px', padding: '0 4px', maxWidth: '94%' }}>
                    {msg.feedbackSubmitted ? (
                      <span style={{ fontSize: '0.68rem', color: '#059669' }}>Đã ghi nhận đánh giá</span>
                    ) : feedbackDraftId === msg.id ? (
                      <div style={{ display: 'flex', gap: '5px', alignItems: 'flex-start' }}>
                        <textarea
                          value={feedbackDraft}
                          onChange={e => setFeedbackDraft(e.target.value)}
                          placeholder="Góp ý hoặc câu trả lời đúng hơn (không bắt buộc)"
                          rows={2}
                          maxLength={5000}
                          style={{ width: '250px', maxWidth: '55vw', resize: 'vertical', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px', fontSize: '0.72rem' }}
                        />
                        <button
                          onClick={() => submitFeedback(msg, 'NEEDS_IMPROVEMENT', feedbackDraft)}
                          disabled={feedbackBusyId === msg.id}
                          style={{ border: 'none', borderRadius: '6px', padding: '6px 8px', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: '0.7rem' }}
                        >
                          Gửi
                        </button>
                        <button
                          onClick={() => { setFeedbackDraftId(null); setFeedbackDraft(''); }}
                          style={{ border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: '0.7rem' }}
                        >
                          Hủy
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => submitFeedback(msg, 'HELPFUL')}
                          disabled={feedbackBusyId === msg.id}
                          title="Câu trả lời hữu ích"
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: '0.68rem', padding: '2px 4px' }}
                        >
                          <ThumbsUp size={13} /> Hữu ích
                        </button>
                        <button
                          onClick={() => { setFeedbackDraftId(msg.id); setFeedbackDraft(''); }}
                          disabled={feedbackBusyId === msg.id}
                          title="Câu trả lời cần cải thiện"
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: '0.68rem', padding: '2px 4px' }}
                        >
                          <ThumbsDown size={13} /> Chưa đúng
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div style={{
                  fontSize: '0.62rem',
                  color: '#94a3b8',
                  marginTop: '3px',
                  padding: '0 4px'
                }}>
                  {msg.timestamp}
                </div>
              </div>
            ))}

            {/* Loading Indicator */}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px' }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: 'pulse 1.5s infinite'
                }}>
                  <RefreshCw size={13} color="#ffffff" style={{ animation: 'spin 1s linear infinite' }} />
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
                  AetherCopilot đang suy nghĩ và tra cứu dữ liệu...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompt Chips */}
          <div style={{
            padding: '8px 12px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            whiteSpace: 'nowrap'
          }}>
            {promptChips.slice(0, 5).map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(chip)}
                disabled={loading}
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '9999px',
                  padding: '4px 10px',
                  fontSize: '0.72rem',
                  color: '#334155',
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => {
                  if (!loading) {
                    e.currentTarget.style.backgroundColor = '#eff6ff';
                    e.currentTarget.style.borderColor = '#93c5fd';
                    e.currentTarget.style.color = '#1d4ed8';
                  }
                }}
                onMouseLeave={e => {
                  if (!loading) {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                    e.currentTarget.style.color = '#334155';
                  }
                }}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            style={{
              padding: '10px 12px',
              backgroundColor: '#ffffff',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              gap: '8px',
              alignItems: 'center'
            }}
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={`Hỏi về SOP, chính sách bảo hành, tồn kho...`}
              disabled={loading}
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.82rem',
                outline: 'none',
                transition: 'border-color 0.2s',
                backgroundColor: loading ? '#f1f5f9' : '#ffffff'
              }}
              onFocus={e => e.target.style.borderColor = '#2563eb'}
              onBlur={e => e.target.style.borderColor = '#cbd5e1'}
            />
            <button
              type="submit"
              disabled={loading || !inputValue.trim()}
              style={{
                backgroundColor: inputValue.trim() && !loading ? '#2563eb' : '#94a3b8',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                width: '38px',
                height: '38px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: inputValue.trim() && !loading ? 'pointer' : 'not-allowed',
                transition: 'background-color 0.2s',
                flexShrink: 0
              }}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}

      {reviewModalOpen && canReviewAiFeedback && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '900px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.4)' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1rem' }}>Duyệt phản hồi AetherCopilot</h3>
                <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{feedbackQueue.length} phản hồi đang chờ</span>
              </div>
              <button onClick={() => setReviewModalOpen(false)} title="Đóng" style={{ border: 0, background: 'transparent', color: '#64748b', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {feedbackQueue.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>Không có phản hồi cần duyệt.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 0.8fr) minmax(0, 1.5fr)', minHeight: '420px', overflow: 'auto' }}>
                <div style={{ borderRight: '1px solid #e2e8f0', padding: '10px', overflowY: 'auto' }}>
                  {feedbackQueue.map(item => (
                    <button
                      key={item.id}
                      onClick={() => selectFeedbackForReview(item)}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px', marginBottom: '6px', borderRadius: '7px', border: selectedFeedback?.id === item.id ? '1px solid #60a5fa' : '1px solid #e2e8f0', background: selectedFeedback?.id === item.id ? '#eff6ff' : '#fff', cursor: 'pointer' }}
                    >
                      <div style={{ color: '#0f172a', fontSize: '0.75rem', fontWeight: 700 }}>{item.userName || 'Nhân viên'} · {item.userRole || '—'}</div>
                      <div style={{ color: '#64748b', fontSize: '0.72rem', marginTop: '4px' }}>{item.prompt}</div>
                    </button>
                  ))}
                </div>

                {selectedFeedback && (
                  <div style={{ padding: '14px 18px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>Câu hỏi</div>
                      <div style={{ fontSize: '0.78rem', color: '#0f172a', marginTop: '3px' }}>{selectedFeedback.prompt}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>Câu trả lời AI</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '3px', whiteSpace: 'pre-wrap', maxHeight: '100px', overflow: 'auto' }}>{selectedFeedback.response}</div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Tiêu đề tri thức</label>
                      <input value={reviewForm.title} maxLength={255} onChange={e => setReviewForm(prev => ({ ...prev, title: e.target.value }))} style={{ width: '100%', boxSizing: 'border-box', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.78rem' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Chuyên mục</label>
                      <select value={reviewForm.category} onChange={e => setReviewForm(prev => ({ ...prev, category: e.target.value }))} style={{ width: '100%', boxSizing: 'border-box', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.78rem' }}>
                        <option value="GENERAL">Chính sách chung</option>
                        <option value="WARRANTY_RMA">Bảo hành & đổi trả</option>
                        <option value="SALES_POLICY">Bán hàng & chiết khấu</option>
                        <option value="WAREHOUSE_LOGISTICS">Kho vận & giao hàng</option>
                        <option value="TECHNICAL_SOP">Kỹ thuật & lắp ráp</option>
                        <option value="ERP_MANUAL">Hướng dẫn ERP</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Nội dung đã kiểm chứng</label>
                      <textarea value={reviewForm.content} maxLength={20000} rows={7} onChange={e => setReviewForm(prev => ({ ...prev, content: e.target.value }))} placeholder="Nhập câu trả lời đã xác minh để bổ sung vào kho tri thức" style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.78rem' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' }}>
                      <button onClick={() => reviewFeedback('REJECT')} disabled={reviewBusy} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fff', color: '#b91c1c', cursor: 'pointer' }}>Từ chối</button>
                      <button onClick={() => reviewFeedback('APPROVE')} disabled={reviewBusy || !reviewForm.title.trim() || !reviewForm.content.trim()} style={{ padding: '8px 12px', borderRadius: '6px', border: 0, background: reviewBusy || !reviewForm.title.trim() || !reviewForm.content.trim() ? '#94a3b8' : '#2563eb', color: '#fff', cursor: reviewBusy ? 'wait' : 'pointer' }}>Duyệt và thêm vào tri thức</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal View Full Knowledge Document */}
      {selectedDocModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '1rem',
          backdropFilter: 'blur(3px)'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '780px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#f8fafc'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '10px',
                    backgroundColor: '#eff6ff',
                    color: '#2563eb',
                    border: '1px solid #bfdbfe'
                  }}>
                    {selectedDocModal.category}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Mã: <strong>{selectedDocModal.slug}</strong>
                  </span>
                </div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                  {selectedDocModal.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDocModal(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1 }}>
              {selectedDocModal.summary && (
                <div style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  color: '#166534',
                  marginBottom: '1rem'
                }}>
                  <strong>Tóm tắt nội dung:</strong> {selectedDocModal.summary}
                </div>
              )}

              <div style={{
                fontSize: '0.85rem',
                lineHeight: 1.65,
                color: '#1e293b',
                whiteSpace: 'pre-wrap',
                backgroundColor: '#f8fafc',
                padding: '1rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontFamily: 'inherit'
              }}>
                {selectedDocModal.content}
              </div>

              {/* Tags & Permissions metadata */}
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>Từ khóa:</span>
                  {(selectedDocModal.tags || []).map((t, idx) => (
                    <span key={idx} style={{
                      backgroundColor: '#f1f5f9',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      color: '#475569',
                      border: '1px solid #e2e8f0'
                    }}>
                      #{t}
                    </span>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>Vai trò được xem:</span>
                  {(selectedDocModal.allowedRoles || []).map((role, idx) => (
                    <span key={idx} style={{
                      backgroundColor: '#eff6ff',
                      color: '#1e40af',
                      border: '1px solid #bfdbfe',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '0.68rem',
                      fontWeight: 700
                    }}>
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '0.75rem 1.25rem',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
              backgroundColor: '#f8fafc'
            }}>
              <button
                onClick={() => setSelectedDocModal(null)}
                style={{
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.45rem 1rem',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
