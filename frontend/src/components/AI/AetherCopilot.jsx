import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, Sparkles, X, Send, Trash2, ChevronDown, ExternalLink, 
  ShieldCheck, AlertCircle, RefreshCw, FileText, CheckCircle2,
  Cpu, DollarSign, Package, Truck, ArrowRight, Minimize2, Maximize2
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
  const messagesEndRef = useRef(null);

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
      const response = await api.post('/ai/chat', { message: text });
      
      if (response && response.success) {
        const botMsg = {
          id: 'bot-' + Date.now(),
          role: 'assistant',
          content: response.data.reply,
          toolCalls: response.data.toolCalls || [],
          citations: response.data.citations || [],
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

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'welcome-' + Date.now(),
        role: 'assistant',
        content: `Đã làm mới phiên hội thoại. Tôi sẵn sàng hỗ trợ các câu hỏi tra cứu dữ liệu & tài liệu SOP của bạn.`,
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

  return (
    <>
      {/* Floating Action Button (FAB) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Mở Trợ Lý AI AetherCopilot"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9980,
            backgroundColor: '#0f172a',
            color: '#ffffff',
            border: '1.5px solid #38bdf8',
            borderRadius: '9999px',
            padding: '10px 18px 10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 10px 25px -3px rgba(14, 165, 233, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
            cursor: 'pointer',
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: 'scale(1)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.boxShadow = '0 15px 30px -3px rgba(14, 165, 233, 0.6)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 10px 25px -3px rgba(14, 165, 233, 0.4)';
          }}
        >
          <div style={{
            position: 'relative',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff'
          }}>
            <Bot size={20} />
            <span style={{
              position: 'absolute',
              top: '-1px',
              right: '-1px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              border: '2px solid #0f172a'
            }} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.3px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>AetherCopilot</span>
              <Sparkles size={13} style={{ color: '#38bdf8' }} />
            </div>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>
              AI Tri Thức & Live ERP
            </div>
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
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            padding: '12px 16px',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
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
                boxShadow: '0 0 12px rgba(37, 99, 235, 0.5)'
              }}>
                <Bot size={22} color="#ffffff" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: 800, letterSpacing: '0.2px' }}>AetherCopilot</span>
                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: '#1e3a8a',
                    color: '#93c5fd',
                    border: '1px solid #3b82f6'
                  }}>
                    {user?.role || 'USER'}
                  </span>
                </div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                  <span>Sẵn sàng kết nối SOP & Live DB</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={handleClearHistory}
                title="Làm mới đoạn chat"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex'
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#ffffff'}
                onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
              >
                <Trash2 size={16} />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? 'Thu nhỏ' : 'Mở rộng'}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex'
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#ffffff'}
                onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
              >
                {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Đóng Copilot"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex'
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
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
                          return t.name;
                        }).join(', ')}
                      </span>
                    </div>
                  )}

                  {/* Message body */}
                  <div>
                    {renderFormattedText(msg.content)}
                  </div>

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
