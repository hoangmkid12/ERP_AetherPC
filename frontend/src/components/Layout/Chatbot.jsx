import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { optimizePCBuild } from '../../config/pcBuilderAIKnowledge';
import { MessageSquare, X, Send, Sparkles, ShoppingCart, ArrowRight, Headphones, UserCheck } from 'lucide-react';

// ============================================================================
//  TEXT RENDERING: Parse bold (**), bullet points (- / *), high contrast light mode
// ============================================================================
const renderMessageText = (text, isUserMessage = false) => {
  if (!text) return null;
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    let content = line;
    let isBullet = false;
    if (content.trim().startsWith('* ') || content.trim().startsWith('- ')) {
      isBullet = true;
      content = content.trim().substring(2);
    }
    const parts = content.split('**');
    const renderedLine = parts.map((part, partIdx) => {
      if (partIdx % 2 === 1) {
        return <strong key={partIdx} style={{ color: isUserMessage ? '#ffffff' : '#0f172a', fontWeight: 800 }}>{part}</strong>;
      }
      return part;
    });
    if (isBullet) {
      return (
        <div key={lineIdx} style={{ display: 'flex', gap: '0.4rem', marginLeft: '0.5rem', marginBottom: '0.25rem' }}>
          <span style={{ color: isUserMessage ? '#bfdbfe' : '#2563eb', flexShrink: 0, fontWeight: 800 }}>•</span>
          <span style={{ flex: 1, minWidth: 0, color: isUserMessage ? '#ffffff' : '#0f172a' }}>{renderedLine}</span>
        </div>
      );
    }
    return (
      <div key={lineIdx} style={{ marginBottom: line.trim() === '' ? '0.5rem' : '0.25rem', minHeight: line.trim() === '' ? '0.5rem' : 'auto', color: isUserMessage ? '#ffffff' : '#0f172a' }}>
        {renderedLine}
      </div>
    );
  });
};

// ============================================================================
//  CATEGORY DETECTION: Identify product category from user text
// ============================================================================
const detectCategoryAndKeywords = (text) => {
  const cleanText = text.toLowerCase();
  
  if (cleanText.includes('lót chuột') || cleanText.includes('lot chuot') || cleanText.includes('mousepad') || cleanText.includes('bàn di')) {
    return { category: 'OTHER', search: 'lót chuột', label: 'Lót chuột' };
  }
  if (cleanText.includes('tai nghe') || cleanText.includes('headphone') || cleanText.includes('earphone')) {
    return { category: 'OTHER', search: 'tai nghe', label: 'Tai nghe' };
  }
  if (cleanText.includes('màn hình') || cleanText.includes('man hinh') || cleanText.includes('monitor') || cleanText.includes('hiển thị')) {
    return { category: 'MONITOR', label: 'Màn hình' };
  }
  if (cleanText.includes('chuột') || cleanText.includes('chuot') || cleanText.includes('mouse')) {
    return { category: 'MOUSE', label: 'Chuột máy tính' };
  }
  if (cleanText.includes('bàn phím') || cleanText.includes('ban phim') || cleanText.includes('keyboard')) {
    return { category: 'KEYBOARD', label: 'Bàn phím' };
  }
  if (cleanText.includes('tản nhiệt') || cleanText.includes('tan nhiet') || cleanText.includes('cooler') || cleanText.includes('quạt') || cleanText.includes('quat')) {
    return { category: 'COOLER', label: 'Tản nhiệt' };
  }
  if (cleanText.includes('vga') || cleanText.includes('card màn hình') || cleanText.includes('card đồ họa') || cleanText.includes('gpu') || cleanText.includes('geforce') || cleanText.includes('radeon')) {
    return { category: 'VGA', label: 'Card đồ họa' };
  }
  if (cleanText.includes('cpu') || cleanText.includes('bộ vi xử lý') || cleanText.includes('vi xử lý')) {
    return { category: 'CPU', label: 'Bộ vi xử lý' };
  }
  if (cleanText.includes('mainboard') || cleanText.includes('main') || cleanText.includes('bo mạch chủ') || cleanText.includes('bo mach chu')) {
    return { category: 'MAINBOARD', label: 'Bo mạch chủ' };
  }
  if (cleanText.includes('ram') || cleanText.includes('bộ nhớ trong')) {
    return { category: 'RAM', label: 'RAM' };
  }
  if (cleanText.includes('ssd') || cleanText.includes('hdd') || cleanText.includes('ổ cứng') || cleanText.includes('nvme')) {
    return { category: 'STORAGE', label: 'Ổ cứng' };
  }
  if (cleanText.includes('nguồn') || cleanText.includes('nguon') || cleanText.includes('psu')) {
    return { category: 'PSU', label: 'Nguồn máy tính' };
  }
  if (cleanText.includes('case') || cleanText.includes('vỏ máy') || cleanText.includes('thùng máy')) {
    return { category: 'CASE', label: 'Vỏ case' };
  }
  return null;
};

// ============================================================================
//  BUDGET EXTRACTION: Parse budget from Vietnamese text
// ============================================================================
const extractBudget = (text) => {
  const cleanText = text.toLowerCase();
  let budget = 0;

  const trMatch = cleanText.match(/(\d+(?:\.\d+)?)\s*(triệu|trieu|tr)\b/);
  if (trMatch) {
    const num = parseFloat(trMatch[1]);
    if (!isNaN(num) && num >= 1 && num <= 500) budget = num * 1000000;
  }

  if (budget === 0) {
    const tMatch = cleanText.match(/(\d+)\s*t\b/);
    if (tMatch) {
      const num = parseInt(tMatch[1]);
      if (!isNaN(num) && num >= 1 && num <= 500) budget = num * 1000000;
    }
  }

  if (budget === 0) {
    const dotNum = cleanText.match(/(\d{1,3}(?:\.\d{3}){1,})/);
    if (dotNum) {
      const val = parseInt(dotNum[1].replace(/\./g, ''));
      if (!isNaN(val) && val >= 500000 && val <= 500000000) budget = val;
    }
  }
  if (budget === 0) {
    const rawNum = cleanText.match(/\b(\d{7,10})\b/);
    if (rawNum) {
      const val = parseInt(rawNum[1]);
      if (!isNaN(val) && val >= 500000 && val <= 500000000) budget = val;
    }
  }

  return budget;
};

const formatPrice = (price) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
};

const detectIntent = (text) => {
  const cleanText = text.toLowerCase();
  
  if (cleanText.includes('gặp cskh') || cleanText.includes('liên hệ cskh') || cleanText.includes('nhân viên cskh') || cleanText.includes('gặp nhân viên')) {
    return 'cskh';
  }

  const pcBuildKeywords = [
    'build pc', 'cấu hình pc', 'cấu hình máy tính', 'lắp ráp pc', 'lắp ráp máy tính',
    'bộ máy tính', 'bộ pc', 'tư vấn pc', 'tư vấn máy tính', 'tu van pc', 'tu van may tinh',
    'cau hinh pc', 'cau hinh may tinh', 'lap rap pc', 'lap rap may tinh',
    'ráp pc', 'ráp máy', 'rap pc', 'rap may',
    'build máy', 'build may', 'bộ case', 'full bộ', 'full bo',
    'case gaming', 'pc gaming'
  ];
  if (pcBuildKeywords.some(kw => cleanText.includes(kw))) {
    return 'pc_build';
  }

  const policyKeywords = ['bảo hành', 'bao hanh', 'đổi trả', 'doi tra', 'giao hàng', 'giao hang',
    'ship', 'vận chuyển', 'van chuyen', 'phí ship', 'phi ship', 'trả góp', 'tra gop',
    'thanh toán', 'thanh toan', 'cod', 'giờ mở cửa', 'gio mo cua', 'liên hệ', 'lien he',
    'hotline', 'điện thoại', 'địa chỉ', 'dia chi', 'chính sách', 'chinh sach',
    'khuyến mãi', 'khuyen mai', 'giảm giá', 'giam gia', 'ưu đãi', 'thành viên', 'thanh vien',
    'tích điểm', 'tich diem'];
  if (policyKeywords.some(kw => cleanText.includes(kw))) {
    return 'policy';
  }

  const addCartKeywords = ['thêm vào giỏ', 'them vao gio', 'thêm giỏ hàng', 'them gio hang',
    'mua hết', 'mua het', 'mua cấu hình này', 'thêm những món đó', 'mua cau hinh nay',
    'mua bộ này', 'mua bo nay', 'lấy hết', 'lay het'];
  if (addCartKeywords.some(kw => cleanText.includes(kw))) {
    return 'add_to_cart';
  }

  const detectedCategory = detectCategoryAndKeywords(cleanText);
  if (detectedCategory) {
    return 'product_search';
  }

  const searchKeywords = ['tìm', 'tim', 'có bán', 'co ban', 'mua', 'cần', 'can', 'gợi ý', 'goi y', 'tư vấn', 'tu van', 'chọn', 'chon', 'so sánh', 'so sanh'];
  if (searchKeywords.some(kw => cleanText.includes(kw))) {
    return 'product_search';
  }

  return 'general';
};

// ============================================================================
//  MAIN COMPONENT - Modern Light Theme Chatbot & Realtime CSKH Support
// ============================================================================
export default function Chatbot() {
  const authContext = useAuth();
  const user = authContext?.user || null;
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chatMode, setChatMode] = useState('ai'); // 'ai' or 'cskh'
  
  const [products, setProducts] = useState(() => {
    const cached = localStorage.getItem('aetherpc_products');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.length > 0 && typeof parsed[0].price === 'string') {
          localStorage.removeItem('aetherpc_products');
          return [];
        }
        return parsed;
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: 'Xin chào! Tôi là Trợ lý AI của AetherPC. Tôi có thể giúp gì cho bạn? Bạn có thể yêu cầu tôi tìm kiếm sản phẩm, giải đáp chính sách hoặc tự động thiết kế cấu hình PC theo nhu cầu & ngân sách của bạn nhé!',
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const [cskhMessages, setCskhMessages] = useState([
    {
      sender: 'cskh',
      text: 'Xin chào! Bạn đang kết nối trực tiếp với Chuyên viên CSKH AetherPC (Trực tuyến 24/7). Hãy gửi thắc mắc của bạn, nhân viên CSKH sẽ phản hồi trong thời gian sớm nhất.',
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const [consultAnswers, setConsultAnswers] = useState({ usage: '', budget: 0, brand: '' });

  const navigate = useNavigate();
  const { addToCart } = useCart();
  const messagesEndRef = useRef(null);

  // Helper to add entire build to cart
  const addWholeBuildToCart = (buildData) => {
    if (!buildData) return;
    let count = 0;
    let total = 0;
    Object.values(buildData).forEach(item => {
      if (item) {
        addToCart(item, 1, { pc_build_bundle: 'custom_pc' });
        count++;
        total += (parseFloat(item.price) || 0);
      }
    });
    setMessages(prev => [...prev, {
      sender: 'bot',
      text: `Đã thêm toàn bộ **${count} linh kiện** trong cấu hình (~${formatPrice(total)}) vào giỏ hàng của bạn. Hãy mở giỏ hàng để tiến hành chốt đơn.`,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    }]);
  };

  const applyBuildToPCBuilder = (buildData) => {
    if (!buildData) return;
    try {
      localStorage.setItem('aetherpc_active_build', JSON.stringify(buildData));
      localStorage.setItem('aetherpc_ai_selected_build', JSON.stringify(buildData));
      
      window.dispatchEvent(new CustomEvent('aetherpc_apply_ai_build', { detail: buildData }));
      
      setIsOpen(false);
      if (window.location.pathname === '/pc-builder') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        navigate('/pc-builder');
      }
    } catch (e) {
      console.warn("Failed to save active build", e);
    }
  };

  const wsRef = useRef(null);

  // Get dynamic session ID & customer name based on logged in user
  const getCSKHSessionInfo = () => {
    let sessId = 'session_guest';
    let custName = 'Khách Hàng Website';

    let currentUser = user;
    if (!currentUser) {
      try {
        const stored = localStorage.getItem('user');
        if (stored) currentUser = JSON.parse(stored);
      } catch (e) {}
    }

    if (currentUser) {
      const displayName = currentUser.fullname || currentUser.fullName || currentUser.name || currentUser.username || (currentUser.email ? currentUser.email.split('@')[0] : null);

      if (displayName && String(displayName) !== 'undefined' && String(displayName).trim() !== '') {
        const cleanUserSlug = String(displayName).toLowerCase().replace(/[^a-z0-9_]/g, '_');
        sessId = `session_user_${cleanUserSlug}`;
        custName = `${displayName} (Khách Hàng)`;
        return { sessId, custName };
      }
    }

    let storedGuestId = localStorage.getItem('aetherpc_cskh_guest_id');
    if (!storedGuestId) {
      storedGuestId = `session_guest_${Math.floor(1000 + Math.random() * 9000)}`;
      localStorage.setItem('aetherpc_cskh_guest_id', storedGuestId);
    }
    sessId = storedGuestId;
    custName = `Khách Hàng Trực Tuyến (#${storedGuestId.replace('session_guest_', '')})`;
    return { sessId, custName };
  };

  // Reset CSKH messages when user switches accounts
  useEffect(() => {
    const { custName } = getCSKHSessionInfo();
    setCskhMessages([
      {
        sender: 'cskh',
        text: `Xin chào ${custName.replace(' (Khách Hàng)', '')}! Bạn đang kết nối trực tiếp với Chuyên viên CSKH AetherPC (Trực tuyến 24/7). Hãy gửi thắc mắc của bạn, nhân viên CSKH sẽ phản hồi trong thời gian sớm nhất.`,
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  }, [user]);

  // WebSocket Realtime CSKH connection
  useEffect(() => {
    let reconnectTimeout = null;

    const connectWS = () => {
      try {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/cskh`);
        wsRef.current = ws;

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'INIT_SESSIONS' || data.type === 'UPDATE_SESSIONS') {
              const { sessId, custName } = getCSKHSessionInfo();
              const currentSession = data.sessions?.find(s => s.id === sessId);

              if (currentSession && currentSession.messages && currentSession.messages.length > 0) {
                const mapped = currentSession.messages.map(m => ({
                  sender: m.sender === 'staff' ? 'cskh' : 'user',
                  text: m.text,
                  time: m.time
                }));
                setCskhMessages(mapped);
              } else {
                setCskhMessages([
                  {
                    sender: 'cskh',
                    text: `Xin chào ${custName.replace(' (Khách Hàng)', '')}! Bạn đang kết nối trực tiếp với Chuyên viên CSKH AetherPC (Trực tuyến 24/7). Hãy gửi thắc mắc của bạn, nhân viên CSKH sẽ phản hồi trong thời gian sớm nhất.`,
                    time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                  }
                ]);
              }
            }
          } catch (e) {}
        };

        ws.onclose = () => {
          reconnectTimeout = setTimeout(connectWS, 3000);
        };
      } catch (e) {
        reconnectTimeout = setTimeout(connectWS, 3000);
      }
    };

    connectWS();

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [user]);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        if (products.length === 0) {
          const res = await api.get('/products');
          if (res && res.length > 0) {
            setProducts(res);
            localStorage.setItem('aetherpc_products', JSON.stringify(res));
          }
        }
      } catch (err) {
        console.warn("Failed to load products for chatbot", err);
      }
    };
    loadProducts();
  }, [products.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, cskhMessages, isTyping, chatMode]);

  // Handle user send message
  const handleSend = async (textToSend) => {
    const text = textToSend || input;
    if (!text.trim()) return;

    const cleanText = text.toLowerCase();

    // Check CSKH transfer intent
    if (chatMode === 'cskh' || cleanText.includes('gặp cskh') || cleanText.includes('liên hệ cskh') || cleanText.includes('nhân viên cskh') || cleanText.includes('gặp nhân viên')) {
      if (chatMode !== 'cskh') setChatMode('cskh');
      
      const cskhUserMsg = {
        sender: 'user',
        text: text,
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      };
      setCskhMessages(prev => [...prev, cskhUserMsg]);
      if (!textToSend) setInput('');

      const { sessId, custName } = getCSKHSessionInfo();
      const payload = {
        sessionId: sessId,
        sender: 'customer',
        text: text,
        time: cskhUserMsg.time,
        customerName: custName
      };

      // 1. Send via WebSocket Realtime
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'CUSTOMER_SEND_MSG',
          payload
        }));
      } else {
        // Fallback to HTTP API
        try {
          api.post('/chat/cskh/send', payload);
        } catch (e) {
          console.warn("Failed to send CSKH msg to backend", e);
        }
      }
      return;
    }

    const userMsg = {
      sender: 'user',
      text: text,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInput('');

    // Check PC build prompt & Budget extraction
    const pcBuildKeywords = [
      'build pc', 'cấu hình pc', 'cấu hình máy tính', 'lắp ráp pc', 'lắp ráp máy tính',
      'bộ máy tính', 'bộ pc', 'tư vấn pc', 'tư vấn máy tính', 'tu van pc', 'tu van may tinh',
      'cau hinh pc', 'cau hinh may tinh', 'lap rap pc', 'lap rap may tinh',
      'ráp pc', 'ráp máy', 'rap pc', 'rap may', 'tư vấn nhu cầu',
      'build máy', 'build may', 'bộ case', 'full bộ', 'full bo',
      'case gaming', 'pc gaming'
    ];

    const extractedBudget = extractBudget(cleanText);
    const isBuildIntent = pcBuildKeywords.some(kw => cleanText.includes(kw)) || (extractedBudget > 0 && (cleanText.includes('pc') || cleanText.includes('máy') || cleanText.includes('dàn')));

    if (isBuildIntent) {
      if (extractedBudget > 0) {
        setIsTyping(true);
        const botTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        
        let recommendedBuild = null;
        let totalPrice = 0;

        try {
          const result = optimizePCBuild({
            promptText: text,
            budgetInput: extractedBudget,
            workloadInput: cleanText.includes('đồ họa') || cleanText.includes('3d') ? 'RENDER_3D' : cleanText.includes('ai') ? 'AI_DEEP_LEARNING' : 'GAMING',
            brandInput: cleanText.includes('intel') ? 'intel' : cleanText.includes('amd') ? 'amd' : 'all',
            cpuBrandInput: cleanText.includes('intel') ? 'intel' : cleanText.includes('amd') ? 'amd' : 'all',
            gpuBrandInput: 'all',
            mfgBrandInput: 'all',
            availableProducts: products,
            allProducts: products
          });

          if (result && result.build) {
            recommendedBuild = result.build;
            totalPrice = result.totalPrice;
          }
        } catch (e) {
          console.warn("Failed to generate direct build", e);
        }

        setTimeout(() => {
          setMessages(prev => [...prev, {
            sender: 'bot',
            text: `Trợ lý AI đã tự động phân tích và thiết kế cấu hình PC tối ưu nhất cho mức ngân sách **${formatPrice(extractedBudget)}** (~${formatPrice(totalPrice)}).\n\nBạn có thể xem danh sách từng linh kiện bên dưới và nhấn **"Thêm Toàn Bộ Vào Giỏ Hàng"** để chốt đơn.`,
            time: botTime,
            layout: 'build_recommendation',
            buildData: recommendedBuild,
            totalPrice: totalPrice
          }]);
          setIsTyping(false);
        }, 400);
        return;
      } else {
        startInteractiveQuiz();
        return;
      }
    }

    // Call Backend API / Gemini
    setIsTyping(true);
    const botTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    try {
      const filteredHistory = messages.map(msg => ({
        sender: msg.sender,
        text: msg.text
      }));

      const res = await api.post('/chat', {
        message: text,
        history: filteredHistory
      });

      if (res && res.success && !res.fallback && res.reply) {
        const botMsg = {
          sender: 'bot',
          text: res.reply,
          time: botTime,
        };

        if (res.products && res.products.length > 0) {
          botMsg.layout = 'product_list';
          botMsg.productsData = res.products.map(p => ({
            id: p.productId || p.id,
            name: p.name,
            brand: p.brand,
            price: p.price,
            originalPrice: p.originalPrice,
            image: p.image,
            category: p.categorySlug,
            specs: p.specs,
          }));
        }

        setMessages(prev => [...prev, botMsg]);
      } else {
        const reply = {
          sender: 'bot',
          text: 'Tôi đã tiếp nhận thắc mắc của bạn. Bạn có thể xem thêm danh mục sản phẩm trên website hoặc bấm **"Gặp NV CSKH"** để trò chuyện trực tiếp với chuyên viên CSKH AetherPC.',
          time: botTime
        };
        setMessages(prev => [...prev, reply]);
      }
    } catch (err) {
      console.warn("Backend chat API error:", err);
      setMessages(prev => [...prev, {
        sender: 'bot',
        text: 'Cảm ơn bạn đã nhắn tin! Để hỗ trợ chính xác nhất, bạn có thể chọn các nút tư vấn nhanh bên dưới hoặc nhấp **"Gặp NV CSKH"** để nhân viên hỗ trợ ngay nhé!',
        time: botTime
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const startInteractiveQuiz = () => {
    const botTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    setIsTyping(true);
    setTimeout(() => {
      setMessages(prev => [...prev, {
        sender: 'bot',
        text: 'Dạ, tôi rất vui lòng hỗ trợ bạn! Hãy trả lời một vài câu hỏi ngắn để tôi thiết kế cấu hình PC tối ưu nhất cho nhu cầu của bạn nhé.\n\n**Câu hỏi 1**: Nhu cầu chính của bạn khi mua bộ máy tính này là gì?',
        time: botTime,
        layout: 'quiz_usage'
      }]);
      setIsTyping(false);
    }, 400);
  };

  const handleQuizAnswer = (step, val, textLabel) => {
    const botTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const userMsg = {
      sender: 'user',
      text: textLabel,
      time: botTime
    };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    setTimeout(() => {
      if (step === 1) {
        setConsultAnswers(prev => ({ ...prev, usage: val }));
        setMessages(prev => [...prev, {
          sender: 'bot',
          text: `Tuyệt vời! Tôi đã ghi nhận nhu cầu của bạn là **${textLabel}**. Tiếp theo, bạn muốn đầu tư khoảng ngân sách bao nhiêu cho cấu hình này?`,
          time: botTime,
          layout: 'quiz_budget'
        }]);
      } else if (step === 2) {
        setConsultAnswers(prev => ({ ...prev, budget: val }));
        setMessages(prev => [...prev, {
          sender: 'bot',
          text: `Đã ghi nhận tầm giá **${textLabel}**. Cuối cùng, bạn có ưu tiên thương hiệu vi xử lý (CPU) nào không?`,
          time: botTime,
          layout: 'quiz_brand'
        }]);
      } else if (step === 3) {
        const finalAnswers = { ...consultAnswers, brand: val };
        setConsultAnswers({ usage: '', budget: 0, brand: '' });
        
        let recommendedBuild = null;
        let totalPrice = 0;

        try {
          const result = optimizePCBuild({
            promptText: '',
            budgetInput: finalAnswers.budget || 20000000,
            workloadInput: finalAnswers.usage === 'gaming' ? 'GAMING' : finalAnswers.usage === 'graphics' ? 'RENDER_3D' : finalAnswers.usage === 'ai' ? 'AI_DEEP_LEARNING' : 'OFFICE_STUDENT',
            brandInput: finalAnswers.brand,
            cpuBrandInput: finalAnswers.brand,
            gpuBrandInput: 'all',
            mfgBrandInput: 'all',
            availableProducts: products,
            allProducts: products
          });

          if (result && result.build) {
            recommendedBuild = result.build;
            totalPrice = result.totalPrice;
          }
        } catch (e) {
          console.warn("Failed to generate build via AI Knowledge", e);
        }

        setMessages(prev => [...prev, {
          sender: 'bot',
          text: `Trợ lý AI đã thiết kế xong cấu hình máy tính tối ưu nhất cho bạn (~${formatPrice(totalPrice)}).\n\nBạn có thể xem danh sách từng linh kiện bên dưới và nhấn **"Thêm Toàn Bộ Vào Giỏ Hàng"** để chốt đơn.`,
          time: botTime,
          layout: 'build_recommendation',
          buildData: recommendedBuild,
          totalPrice: totalPrice
        }]);
      }
      setIsTyping(false);
    }, 400);
  };

  const currentActiveMessages = chatMode === 'cskh' ? cskhMessages : messages;

  return (
    <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 9999 }}>
      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            width: '62px',
            height: '62px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
            border: 'none',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 8px 25px rgba(37, 99, 235, 0.4)',
            transition: 'transform 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <MessageSquare size={28} />
        </button>
      )}

      {/* Expandable Chat Window - Modern Bright Theme */}
      {isOpen && (
        <div style={{
          width: '415px',
          height: '540px',
          backgroundColor: '#ffffff',
          border: '1.5px solid #cbd5e1',
          borderRadius: '20px',
          boxShadow: '0 16px 45px rgba(15, 23, 42, 0.18)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'all 0.3s'
        }}>
          {/* Header with Mode Switching (AI / CSKH) */}
          <div style={{
            padding: '0.85rem 1rem',
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            color: '#ffffff'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: 0 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563eb'
                }}>
                  {chatMode === 'ai' ? <Sparkles size={20} /> : <Headphones size={20} />}
                </div>
                <div style={{ width: '10px', height: '10px', background: '#22c55e', borderRadius: '50%', border: '2px solid #2563eb', position: 'absolute', bottom: 0, right: 0 }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {chatMode === 'ai' ? 'Trợ lý AI AetherPC' : 'CSKH AetherPC'}
                </h4>
                <div style={{ fontSize: '0.72rem', color: '#dbeafe', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {chatMode === 'ai' ? 'Hỗ trợ tự động 24/7' : 'Sẵn sàng chat live'}
                </div>
              </div>
            </div>

            {/* Mode Switch Pills & Close */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              <div style={{ display: 'flex', backgroundColor: 'rgba(255,255,255,0.22)', padding: '3px', borderRadius: '20px' }}>
                <button
                  onClick={() => setChatMode('ai')}
                  style={{
                    padding: '0.25rem 0.65rem', borderRadius: '14px', border: 'none',
                    fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer',
                    backgroundColor: chatMode === 'ai' ? '#ffffff' : 'transparent',
                    color: chatMode === 'ai' ? '#2563eb' : '#ffffff',
                    transition: 'all 0.15s'
                  }}
                >
                  AI
                </button>
                <button
                  onClick={() => setChatMode('cskh')}
                  style={{
                    padding: '0.25rem 0.65rem', borderRadius: '14px', border: 'none',
                    fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer',
                    backgroundColor: chatMode === 'cskh' ? '#ffffff' : 'transparent',
                    color: chatMode === 'cskh' ? '#2563eb' : '#ffffff',
                    transition: 'all 0.15s'
                  }}
                >
                  CSKH
                </button>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: '0.2rem', display: 'flex', alignItems: 'center' }}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Active Mode Banner */}
          {chatMode === 'cskh' && (
            <div style={{ backgroundColor: '#eff6ff', borderBottom: '1px solid #bfdbfe', padding: '0.4rem 0.85rem', fontSize: '0.75rem', color: '#1d4ed8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <UserCheck size={14} color="#2563eb" />
              <span>Đang kết nối live chat với Chuyên viên CSKH AetherPC</span>
            </div>
          )}

          {/* Messages Body */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            backgroundColor: '#f8fafc'
          }}>
            {currentActiveMessages.map((msg, i) => (
              <div key={i} style={{
                alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '86%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                minWidth: 0
              }}>
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: msg.sender === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                  background: msg.sender === 'user' ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : '#ffffff',
                  border: msg.sender === 'user' ? 'none' : '1.5px solid #e2e8f0',
                  boxShadow: msg.sender === 'user' ? '0 4px 12px rgba(37,99,235,0.2)' : '0 2px 8px rgba(0,0,0,0.04)',
                  color: msg.sender === 'user' ? '#ffffff' : '#0f172a',
                  fontSize: '0.85rem',
                  lineHeight: '1.5',
                  whiteSpace: 'normal',
                  maxWidth: '100%',
                  minWidth: 0,
                  boxSizing: 'border-box'
                }}>
                  {renderMessageText(msg.text, msg.sender === 'user')}

                  {/* CUSTOM LAYOUTS */}
                  {msg.layout === 'quiz_usage' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.75rem' }}>
                      {[
                        { label: 'Chơi Game', val: 'gaming' },
                        { label: 'Đồ Hoạ & Thiết Kế', val: 'graphics' },
                        { label: 'Lập Trình & AI', val: 'ai' },
                        { label: 'Học Tập & Văn Phòng', val: 'office' }
                      ].map((item, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleQuizAnswer(1, item.val, item.label)}
                          style={{
                            padding: '0.4rem 0.75rem', fontSize: '0.8rem', textAlign: 'left',
                            borderRadius: '8px', border: '1.5px solid #bfdbfe',
                            backgroundColor: '#eff6ff', color: '#2563eb', cursor: 'pointer',
                            fontWeight: 700
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {msg.layout === 'quiz_budget' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginTop: '0.75rem' }}>
                      {[
                        { label: 'Dưới 15 triệu', val: 12000000 },
                        { label: '15 - 25 triệu', val: 20000000 },
                        { label: '25 - 35 triệu', val: 30000000 },
                        { label: 'Trên 35 triệu', val: 45000000 }
                      ].map((item, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleQuizAnswer(2, item.val, item.label)}
                          style={{
                            padding: '0.4rem', fontSize: '0.75rem', borderRadius: '8px',
                            border: '1.5px solid #bfdbfe', backgroundColor: '#eff6ff',
                            color: '#2563eb', cursor: 'pointer', fontWeight: 700, textAlign: 'center'
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {msg.layout === 'quiz_brand' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.75rem' }}>
                      {[
                        { label: 'Intel (Hiệu năng ổn định)', val: 'intel' },
                        { label: 'AMD / Ryzen (Đa nhiệm mạnh mẽ)', val: 'amd' },
                        { label: 'Hãng nào cũng được', val: 'all' }
                      ].map((item, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleQuizAnswer(3, item.val, item.label)}
                          style={{
                            padding: '0.4rem 0.75rem', fontSize: '0.8rem', textAlign: 'left',
                            borderRadius: '8px', border: '1.5px solid #bfdbfe',
                            backgroundColor: '#eff6ff', color: '#2563eb', cursor: 'pointer',
                            fontWeight: 700
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Product Search List Layout */}
                  {msg.layout === 'product_list' && msg.productsData && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
                      {msg.productsData.map((p, idx) => {
                        const prodId = p.id || p.productId;
                        return (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              padding: '0.6rem 0.75rem',
                              background: '#ffffff',
                              border: '1.5px solid #e2e8f0',
                              borderRadius: '10px',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {/* Clickable Image + Name + Price -> Navigates to Product Detail */}
                            <div
                              onClick={() => {
                                navigate(`/product/${prodId}`);
                                setIsOpen(false); // Close chatbot overlay to show detail page cleanly
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.6rem',
                                flex: 1,
                                minWidth: 0,
                                cursor: 'pointer'
                              }}
                              title={`Xem trang chi tiết sản phẩm: ${p.name}`}
                            >
                              <img
                                src={p.image || `https://placehold.co/40x40`}
                                alt={p.name}
                                style={{ width: '44px', height: '44px', objectFit: 'contain', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', flexShrink: 0 }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                  style={{ fontSize: '0.8rem', fontWeight: 800, color: '#2563eb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}
                                >
                                  {p.name}
                                </div>
                                <div style={{ fontSize: '0.74rem', color: '#16a34a', fontWeight: 800 }}>{formatPrice(p.price)}</div>
                              </div>
                            </div>

                            {/* Action Button: Thêm Giỏ */}
                            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flexShrink: 0 }}>
                              <button
                                onClick={() => {
                                  addToCart(p, 1);
                                  setMessages(prev => [...prev, {
                                    sender: 'bot',
                                    text: `Đã thêm sản phẩm **${p.name}** (~${formatPrice(p.price)}) vào giỏ hàng cho bạn.`,
                                    time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                                  }]);
                                }}
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  borderRadius: '6px',
                                  border: 'none',
                                  backgroundColor: '#16a34a',
                                  color: '#ffffff',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.2rem'
                                }}
                              >
                                <ShoppingCart size={12} /> Thêm Giỏ
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* AI Build Recommendation Layout */}
                  {msg.layout === 'build_recommendation' && msg.buildData && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem', background: '#f1f5f9', padding: '0.65rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', width: '100%', minWidth: 0 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.35rem', display: 'flex', justifyContent: 'space-between', gap: '0.5rem', minWidth: 0 }}>
                        <span>Linh kiện PC đề xuất</span>
                        <span style={{ color: '#16a34a', fontWeight: 800 }}>{formatPrice(msg.totalPrice)}</span>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '160px', overflowY: 'auto', width: '100%', minWidth: 0 }}>
                        {Object.entries(msg.buildData).map(([slot, item]) => {
                          if (!item) return null;
                          return (
                            <div key={slot} style={{ fontSize: '0.72rem', display: 'flex', justifyContent: 'space-between', gap: '0.5rem', width: '100%', minWidth: 0 }}>
                              <span style={{ color: '#64748b', fontWeight: 700, flexShrink: 0 }}>{slot}:</span>
                              <Link
                                to={`/product/${item.id}`}
                                target="_blank"
                                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right', flex: 1, minWidth: 0, color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}
                                title={item.name}
                              >
                                {item.name} (~{formatPrice(item.price)})
                              </Link>
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', borderTop: '1px solid #cbd5e1', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                        <button
                          onClick={() => applyBuildToPCBuilder(msg.buildData)}
                          style={{
                            padding: '0.4rem 0.5rem',
                            fontSize: '0.72rem',
                            borderRadius: '6px',
                            border: '1.5px solid #2563eb',
                            backgroundColor: '#eff6ff',
                            color: '#2563eb',
                            cursor: 'pointer',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.25rem'
                          }}
                        >
                          <Sparkles size={12} /> Xem Chi Tiết
                        </button>
                        <button
                          onClick={() => addWholeBuildToCart(msg.buildData)}
                          style={{
                            padding: '0.4rem 0.5rem',
                            fontSize: '0.72rem',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: '#16a34a',
                            color: '#ffffff',
                            cursor: 'pointer',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.25rem'
                          }}
                        >
                          <ShoppingCart size={12} /> Thêm Giỏ Hàng
                        </button>
                      </div>
                    </div>
                  )}

                </div>
                <span style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.25rem', fontWeight: 600 }}>{msg.time}</span>
              </div>
            ))}

            {isTyping && (
              <div style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
                <div style={{ padding: '0.6rem 0.85rem', borderRadius: '12px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.8rem', fontWeight: 700 }}>
                  Đang phản hồi...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Options */}
          <div style={{
            padding: '0.5rem 0.75rem',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            display: 'flex',
            gap: '0.4rem',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}>
            {[
              { label: 'Gặp NV CSKH', action: () => setChatMode('cskh') },
              { label: 'Tư vấn PC', action: () => handleSend('Tư vấn nhu cầu') },
              { label: 'Chính sách bảo hành', action: () => handleSend('Chính sách bảo hành và đổi trả như thế nào?') },
              { label: 'Trả góp', action: () => handleSend('Cửa hàng có hỗ trợ mua trả góp không?') }
            ].map((p, idx) => (
              <button
                key={idx}
                onClick={p.action}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.73rem',
                  borderRadius: '20px',
                  border: '1.5px solid #bfdbfe',
                  backgroundColor: '#eff6ff',
                  color: '#2563eb',
                  fontWeight: 700,
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.15s'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Footer Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            style={{
              padding: '0.75rem 0.85rem',
              borderTop: '1px solid #cbd5e1',
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
              backgroundColor: '#ffffff'
            }}
          >
            <input
              type="text"
              placeholder={chatMode === 'cskh' ? "Nhắn tin trực tiếp với NV CSKH..." : "Nhập nội dung tin nhắn..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              style={{
                flex: 1,
                padding: '0.55rem 0.85rem',
                backgroundColor: '#f8fafc',
                border: '1.5px solid #cbd5e1',
                borderRadius: '12px',
                color: '#0f172a',
                fontSize: '0.85rem',
                fontWeight: 600,
                outline: 'none'
              }}
            />
            <button
              type="submit"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: '#2563eb',
                border: 'none',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
