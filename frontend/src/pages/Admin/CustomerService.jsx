import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSalesStore } from '../../stores';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { notify, confirm, promptText } from '../../context/NotificationContext';
import { COMPLAINT_STATUS, RETURN_STATUS, getStatusLabel, getStatusInfo } from '../../utils/statusLabels';
import {
  HeadphonesIcon, AlertCircle, MessageSquare, RefreshCw, CheckCircle,
  Clock, X, Plus, User, Phone, Mail, Filter, Search, 
  ArrowRight, Package, Tag, Send, Eye, Star, ThumbsUp, ShieldCheck,
  TrendingUp, Award, Check, AlertTriangle, FileText, ChevronRight
} from 'lucide-react';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const PRIORITY_COLORS = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#10b981' };

export default function CustomerService() {
  const complaints = useSalesStore(state => state.complaints) || [];
  const addComplaint = useSalesStore(state => state.addComplaint);
  const updateComplaintStatus = useSalesStore(state => state.updateComplaintStatus);
  const returnRequests = useSalesStore(state => state.returnRequests) || [];
  const updateReturnStatus = useSalesStore(state => state.updateReturnStatus);
  const orders = useSalesStore(state => state.orders) || [];
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Tab from URL (?tab=overview|complaints|livechat|returns|feedback)
  const activeTab = searchParams.get('tab') || 'overview';
  const setTab = (tKey) => {
    setSearchParams({ tab: tKey });
    setStatusFilter('ALL');
    setSearch('');
  };

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showAddTicket, setShowAddTicket] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [selectedReturnDetail, setSelectedReturnDetail] = useState(null);
  const [resolution, setResolution] = useState('');
  const [csNote, setCsNote] = useState('');

  // Form for New Ticket
  const [newTicketForm, setNewTicketForm] = useState({
    customerName: '',
    phone: '',
    email: '',
    orderId: '',
    category: 'Sản phẩm lỗi / Bảo hành',
    priority: 'MEDIUM',
    title: '',
    description: ''
  });

  // CSKH Live Chat Realtime state
  const [liveChatSessions, setLiveChatSessions] = useState([
    {
      id: 'session_default',
      customerName: 'Trần Minh Nam (Khách Hàng Website)',
      phone: '0988.123.456',
      status: 'ONLINE',
      messages: [
        { sender: 'customer', text: 'Xin chào CSKH AetherPC, mình cần tư vấn gấp cấu hình PC đồ họa 3D Blender 25 triệu!', time: '09:15' },
        { sender: 'staff', text: 'Chào bạn! Mình là NV CSKH AetherPC đây ạ. Với ngân sách 25tr làm Blender, bên mình khuyên dùng i5 13400F + RTX 3060 12GB VRAM để dựng hình mượt mà nhé!', time: '09:16' }
      ]
    },
    {
      id: 'session_2',
      customerName: 'Lê Hoàng Yến',
      phone: '0912.888.999',
      status: 'ONLINE',
      messages: [
        { sender: 'customer', text: 'Shop ơi đơn hàng #ORD-2026-081 của mình giao tới đâu rồi ạ?', time: '10:30' },
        { sender: 'staff', text: 'Dạ đơn của bạn đã được Shipper nhận giao, dự kiến giao trong chiều nay bạn nhé!', time: '10:31' }
      ]
    }
  ]);
  const [activeSessionId, setActiveSessionId] = useState('session_default');
  const [staffInputMsg, setStaffInputMsg] = useState('');
  const wsRef = useRef(null);

  // WebSocket connection for CSKH Livechat
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
              if (data.sessions && data.sessions.length > 0) {
                setLiveChatSessions(data.sessions);
              }
            }
          } catch (e) {}
        };
        ws.onclose = () => { reconnectTimeout = setTimeout(connectWS, 4000); };
      } catch (e) {
        reconnectTimeout = setTimeout(connectWS, 4000);
      }
    };
    connectWS();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  const handleSendStaffMessage = (customTxt = '') => {
    const msgToSend = customTxt || staffInputMsg;
    if (!msgToSend.trim()) return;

    const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const payload = { sessionId: activeSessionId, text: msgToSend, time };

    setLiveChatSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        return { ...s, messages: [...s.messages, { sender: 'staff', text: msgToSend, time }] };
      }
      return s;
    }));

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'STAFF_SEND_MSG', payload }));
    }
    if (!customTxt) setStaffInputMsg('');
  };

  // KPI Calculations
  const totalComplaints = complaints.length;
  const inProgressComplaints = complaints.filter(c => c.status === 'IN_PROGRESS').length;
  const openComplaints = complaints.filter(c => c.status === 'OPEN').length;
  const resolvedComplaints = complaints.filter(c => c.status === 'RESOLVED' || c.status === 'CLOSED').length;
  const resolutionRate = totalComplaints > 0 ? Math.round((resolvedComplaints / totalComplaints) * 100) : 98;
  const pendingRmaCount = returnRequests.filter(r => r.status === 'PENDING').length;

  const stats = [
    { label: 'Tổng Ticket Tiếp Nhận', value: `${totalComplaints} ticket`, change: 'Hỗ trợ khách hàng đa kênh', icon: <HeadphonesIcon size={20} />, color: '#2563eb', bg: '#eff6ff' },
    { label: 'Khiếu Nại Đang Xử Lý', value: `${inProgressComplaints + openComplaints} vụ việc`, change: `${openComplaints} ticket mới cần phản hồi`, icon: <Clock size={20} />, color: '#f59e0b', bg: '#fffbeb' },
    { label: 'Tỷ Lệ Giải Quyết (SLA)', value: `${resolutionRate}%`, change: 'Mục tiêu chất lượng dịch vụ ≥ 95%', icon: <CheckCircle size={20} />, color: '#16a34a', bg: '#f0fdf4' },
    { label: 'Yêu Cầu Đổi Trả (RMA)', value: `${pendingRmaCount} yêu cầu`, change: 'Chờ CSKH thẩm định & duyệt thu hồi', icon: <RefreshCw size={20} />, color: '#8b5cf6', bg: '#f5f3ff' },
    { label: 'Phiên Chat Trực Tuyến', value: `${liveChatSessions.length} phiên`, change: 'Khách hàng đang online', icon: <MessageSquare size={20} />, color: '#0ea5e9', bg: '#f0f9ff' },
    { label: 'Đánh Giá Dịch Vụ (CSAT)', value: '4.85 / 5.0', change: '96.4% đánh giá rất hài lòng', icon: <Star size={20} />, color: '#eab308', bg: '#fefce8' }
  ];

  // Chart 1: Complaint Categories Doughnut
  const categoryChartData = {
    labels: ['Bảo hành / Lỗi phần cứng', 'Giao hàng trễ / Sai hẹn', 'Tư vấn cấu hình PC', 'Hóa đơn / Đổi trả', 'Khác'],
    datasets: [
      {
        data: [42, 25, 18, 10, 5],
        backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#64748b']
      }
    ]
  };

  // Chart 2: Weekly Ticket Inflow Bar
  const ticketVolumeData = {
    labels: ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'],
    datasets: [
      {
        label: 'Ticket Tiếp Nhận',
        data: [14, 19, 12, 22, 18, 25, 15],
        backgroundColor: '#2563eb'
      },
      {
        label: 'Đã Giải Quyết Xong',
        data: [13, 18, 11, 20, 17, 24, 14],
        backgroundColor: '#16a34a'
      }
    ]
  };

  // Filtered Complaints
  const filteredComplaints = useMemo(() => {
    return complaints.filter(c => {
      const q = search.toLowerCase();
      const matchSearch = !search || 
        c.customerName?.toLowerCase().includes(q) || 
        c.phone?.includes(q) || 
        c.orderId?.toLowerCase().includes(q) ||
        c.title?.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'ALL' || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [complaints, search, statusFilter]);

  const activeChat = liveChatSessions.find(s => s.id === activeSessionId) || liveChatSessions[0];

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '1.5rem 2rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      
      {/* ========================================================================= */}
      {/* 1. TOP HEADER */}
      {/* ========================================================================= */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <HeadphonesIcon size={24} style={{ color: '#2563eb' }} />
            {activeTab === 'overview' && 'Tổng Quan Chăm Sóc Khách Hàng (CSKH Dashboard)'}
            {activeTab === 'complaints' && 'Xử Lý Khiếu Nại & Hỗ Trợ Kỹ Thuật (Tickets Hub)'}
            {activeTab === 'livechat' && 'Tư Vấn Trực Tuyến Thời Gian Thực (Live Chat Realtime)'}
            {activeTab === 'returns' && 'Tiếp Nhận & Điều Phối Đổi Trả (Customer RMA)'}
            {activeTab === 'feedback' && 'Khảo Sát Hài Lòng Khách Hàng (CSAT & Loyalty)'}
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '0.25rem 0 0' }}>
            Tiếp nhận khiếu nại, tư vấn cấu hình PC trực tuyến, xử lý đổi trả và nâng cao trải nghiệm khách hàng
          </p>
        </div>

        {activeTab === 'complaints' && (
          <button
            onClick={() => setShowAddTicket(true)}
            style={{
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '0.45rem 1rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <Plus size={16} />
            <span>Tạo Ticket Khiếu Nại Mới</span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW (TỔNG QUAN CSKH) */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div>
          {/* 6 Balanced KPI Cards (2 Rows x 3 Columns) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
            {stats.map((st, sIdx) => (
              <div
                key={sIdx}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  padding: '1.1rem 1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '102px',
                  boxSizing: 'border-box',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    {st.label}
                  </span>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: st.bg, color: st.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {st.icon}
                  </div>
                </div>

                <div style={{ marginTop: '0.45rem' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {st.value}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
                    {st.change}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem', height: '320px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', margin: '0 0 1rem 0' }}>
                Phân Loại Nguyên Nhân Khiếu Nại
              </h3>
              <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Doughnut
                  data={categoryChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } }
                  }}
                />
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem', height: '320px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', margin: '0 0 1rem 0' }}>
                Lưu Lượng Tiếp Nhận & Giải Quyết Trong Tuần
              </h3>
              <div style={{ flex: 1, position: 'relative' }}>
                <Bar
                  data={ticketVolumeData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } },
                    scales: {
                      y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
                      x: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Quick Hub: Pending Complaints & Livechat */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.85rem 0' }}>
                Khiếu Nại Cần Xử Lý Gấp (Ưu Tiên Cao)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {complaints.slice(0, 3).map((comp, cIdx) => (
                  <div key={comp.id || cIdx} style={{ padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>{comp.title || 'Hỗ trợ bảo hành mainboard'}</strong>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>Khách: {comp.customerName} — Đơn #{comp.orderId}</span>
                    </div>
                    <span style={{ backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>
                      Khẩn cấp
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.85rem 0' }}>
                Khách Đang Chờ Chat Trực Tuyến
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {liveChatSessions.map((s, sIdx) => (
                  <div key={s.id || sIdx} style={{ padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>{s.customerName}</strong>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>SĐT: {s.phone}</span>
                    </div>
                    <button
                      onClick={() => setTab('livechat')}
                      style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '0.35rem 0.75rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Vào Chat
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: COMPLAINTS (XỬ LÝ KHIẾU NẠI) */}
      {/* ========================================================================= */}
      {activeTab === 'complaints' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
          
          {/* Filters */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={{ position: 'relative', width: '320px' }}>
              <input
                type="text"
                placeholder="Tìm khách hàng, số điện thoại, mã đơn..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '0.45rem 0.65rem 0.45rem 2rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              />
              <Search size={15} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700 }}>Trạng Thái:</span>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{ padding: '0.4rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', color: '#0f172a' }}
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="OPEN">Mới tiếp nhận</option>
                <option value="IN_PROGRESS">Đang xử lý</option>
                <option value="RESOLVED">Đã giải quyết</option>
                <option value="CLOSED">Đã đóng</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Mã Ticket</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Khách Hàng & SĐT</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Tiêu Đề Khiếu Nại</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Mã Đơn</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Mức Độ</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Trạng Thái</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredComplaints.map((comp, cIdx) => (
                  <tr key={comp.id || cIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#2563eb' }}>#TK-{comp.id || cIdx + 101}</td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      <strong style={{ display: 'block', color: '#0f172a' }}>{comp.customerName}</strong>
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{comp.phone}</span>
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#0f172a' }}>{comp.title}</td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      <code style={{ fontSize: '0.78rem', color: '#2563eb', backgroundColor: '#eff6ff', padding: '2px 6px', borderRadius: '4px' }}>
                        {comp.orderId || 'N/A'}
                      </code>
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800, backgroundColor: `${PRIORITY_COLORS[comp.priority] || '#10b981'}15`, color: PRIORITY_COLORS[comp.priority] || '#10b981' }}>
                        {comp.priority || 'MEDIUM'}
                      </span>
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 800, backgroundColor: `${getStatusInfo(COMPLAINT_STATUS, comp.status).color}15`, color: getStatusInfo(COMPLAINT_STATUS, comp.status).color }}>
                        {getStatusLabel(COMPLAINT_STATUS, comp.status)}
                      </span>
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                      <button
                        onClick={() => setSelectedTicket(comp)}
                        style={{ backgroundColor: '#ffffff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '0.3rem 0.65rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        <Eye size={12} /> Xử Lý
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: LIVECHAT (CHAT TƯ VẤN THỜI GIAN THỰC) */}
      {/* ========================================================================= */}
      {activeTab === 'livechat' && (
        <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr)', gap: '1rem', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', height: '620px', overflow: 'hidden', boxSizing: 'border-box' }}>
          
          {/* Left: Chat Session List */}
          <div style={{ borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
              <h3 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Khách Hàng Trực Tuyến</h3>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {liveChatSessions.map(s => {
                const isActive = s.id === activeSessionId;
                return (
                  <div
                    key={s.id}
                    onClick={() => setActiveSessionId(s.id)}
                    style={{
                      padding: '0.75rem 0.85rem',
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      backgroundColor: isActive ? '#eff6ff' : 'transparent',
                      borderLeft: isActive ? '3px solid #2563eb' : '3px solid transparent'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.15rem' }}>
                      <strong style={{ fontSize: '0.8rem', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.customerName}</strong>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16a34a', flexShrink: 0, marginLeft: '0.35rem' }}></span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>{s.phone}</span>
                    <p style={{ fontSize: '0.73rem', color: '#475569', margin: '0.25rem 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.messages[s.messages.length - 1]?.text || 'Bắt đầu cuộc trò chuyện...'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Message Window */}
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, overflow: 'hidden' }}>
            
            {/* Header */}
            <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', flexShrink: 0 }}>
              <div>
                <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>{activeChat.customerName}</strong>
                <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>SĐT: {activeChat.phone} — Trạng thái: <strong style={{ color: '#16a34a' }}>Đang trực tuyến</strong></span>
              </div>
            </div>

            {/* Messages Body */}
            <div style={{ flex: 1, padding: '1rem 1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', backgroundColor: '#fdfdfd' }}>
              {activeChat.messages.map((m, mIdx) => {
                const isStaff = m.sender === 'staff';
                return (
                  <div key={mIdx} style={{ alignSelf: isStaff ? 'flex-end' : 'flex-start', maxWidth: '75%', boxSizing: 'border-box' }}>
                    <div style={{
                      backgroundColor: isStaff ? '#2563eb' : '#f1f5f9',
                      color: isStaff ? '#ffffff' : '#0f172a',
                      padding: '0.65rem 0.95rem',
                      borderRadius: isStaff ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      fontSize: '0.82rem',
                      lineHeight: '1.45',
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {m.text}
                    </div>
                    <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', marginTop: '0.2rem', textAlign: isStaff ? 'right' : 'left' }}>
                      {m.time}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Quick Templates */}
            <div style={{ padding: '0.4rem 1rem', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '0.4rem', overflowX: 'auto', flexShrink: 0, minWidth: 0 }}>
              {[
                'Chào bạn, bên mình hỗ trợ gì được cho bạn ạ?',
                'Toàn bộ PC tại AetherPC được bảo hành 36 tháng 1 đổi 1 tận nơi!',
                'Đơn hàng của bạn đang được shipper vận chuyển nhé!'
              ].map((tmpl, tIdx) => (
                <button
                  key={tIdx}
                  onClick={() => handleSendStaffMessage(tmpl)}
                  style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.25rem 0.55rem', fontSize: '0.7rem', color: '#475569', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  {tmpl}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '0.5rem', flexShrink: 0, backgroundColor: '#ffffff', boxSizing: 'border-box' }}>
              <input
                type="text"
                placeholder="Nhập nội dung tư vấn khách hàng..."
                value={staffInputMsg}
                onChange={e => setStaffInputMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendStaffMessage()}
                style={{ flex: 1, minWidth: 0, padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
              />
              <button
                onClick={() => handleSendStaffMessage()}
                style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.5rem 1.1rem', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}
              >
                <Send size={15} /> Gửi
              </button>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: RETURNS (TIẾP NHẬN ĐỔI TRẢ RMA) */}
      {/* ========================================================================= */}
      {activeTab === 'returns' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <RefreshCw size={18} style={{ color: '#8b5cf6' }} />
            <span>Tiếp Nhận & Thẩm Định Đổi Trả Sản Phẩm (Customer RMA)</span>
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: '1.25rem' }}>
            Kiểm tra bằng chứng lỗi, đối chiếu bảo hành 36 tháng và đồng ý thu hồi hàng chuyển cho Shipper lấy
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Mã RMA</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Mã Đơn Gốc</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Khách Hàng & SĐT</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Lý Do Đổi Trả</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Trạng Thái Hiện Tại</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Thao Tác CSKH</th>
                </tr>
              </thead>
              <tbody>
                {returnRequests.map((ret, rIdx) => (
                  <tr key={ret.id || rIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      <span
                        onClick={() => setSelectedReturnDetail(ret)}
                        style={{
                          fontWeight: 800,
                          color: '#8b5cf6',
                          cursor: 'pointer',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem'
                        }}
                        title="Bấm xem chi tiết yêu cầu đổi trả"
                      >
                        #RMA-{ret.id || rIdx + 1}
                      </span>
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      <span
                        onClick={() => setSelectedReturnDetail(ret)}
                        style={{
                          fontSize: '0.78rem',
                          color: '#2563eb',
                          backgroundColor: '#eff6ff',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          textDecoration: 'none',
                          border: '1px solid #dbeafe',
                          display: 'inline-block'
                        }}
                        title="Bấm xem chi tiết đơn hàng gốc"
                      >
                        {ret.orderId}
                      </span>
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      <strong style={{ color: '#0f172a', display: 'block' }}>{ret.customerName}</strong>
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{ret.phone}</span>
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        backgroundColor: ret.type === 'REFUND' ? '#ecfdf5' : '#eff6ff',
                        color: ret.type === 'REFUND' ? '#15803d' : '#1d4ed8',
                        border: `1px solid ${ret.type === 'REFUND' ? '#a7f3d0' : '#bfdbfe'}`,
                        marginBottom: '0.2rem'
                      }}>
                        {ret.type === 'REFUND' ? 'Hoàn tiền 100%' : 'Đổi mới 1-1'}
                      </span>
                      <div style={{ fontSize: '0.76rem', color: '#334155' }}>{ret.reason || 'Lỗi không lên màn hình'}</div>
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 800, backgroundColor: `${getStatusInfo(RETURN_STATUS, ret.status).color}15`, color: getStatusInfo(RETURN_STATUS, ret.status).color }}>
                        {getStatusLabel(RETURN_STATUS, ret.status)}
                      </span>
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                      {ret.status === 'PENDING' ? (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.35rem' }}>
                          <button
                            onClick={async () => {
                              if (await confirm(`Xác nhận ĐỒNG Ý THU HỒI đơn RMA #${ret.id} và giao Shipper đến lấy?`)) {
                                updateReturnStatus(ret.id, 'RETURN_APPROVED', 'CSKH đã duyệt yêu cầu thu hồi hàng');
                              }
                            }}
                            style={{ backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '0.3rem 0.65rem', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}
                          >
                            ✓ Duyệt Thu Hồi
                          </button>
                          <button
                            onClick={async () => {
                              const reason = await promptText('Nhập lý do từ chối yêu cầu đổi trả:');
                              if (reason) updateReturnStatus(ret.id, 'REJECTED', reason);
                            }}
                            style={{ backgroundColor: '#ef4444', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '0.3rem 0.65rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            ✕ Từ Chối
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setSelectedReturnDetail(ret)}
                          style={{ backgroundColor: '#ffffff', color: '#8b5cf6', border: '1px solid #ddd6fe', borderRadius: '4px', padding: '0.3rem 0.65rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                        >
                          <Eye size={12} /> Chi Tiết
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: FEEDBACK (KHẢO SÁT & CSAT) */}
      {/* ========================================================================= */}
      {activeTab === 'feedback' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '1.25rem' }}>
          
          {/* Summary CSAT */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Award size={18} style={{ color: '#eab308' }} />
              <span>Chỉ Số Hài Lòng Khách Hàng (CSAT)</span>
            </h3>

            <div style={{ textAlign: 'center', padding: '1.5rem 0', backgroundColor: '#f8fafc', borderRadius: '8px', marginBottom: '1rem' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#0f172a' }}>4.85 / 5.0</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.2rem', color: '#eab308', margin: '0.5rem 0' }}>
                <Star fill="#eab308" size={20} />
                <Star fill="#eab308" size={20} />
                <Star fill="#eab308" size={20} />
                <Star fill="#eab308" size={20} />
                <Star fill="#eab308" size={20} />
              </div>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Dựa trên 342 đánh giá sau khi hoàn tất đơn hàng</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>5 Sao (Cực kỳ hài lòng):</span>
                <strong style={{ color: '#16a34a' }}>88%</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>4 Sao (Hài lòng):</span>
                <strong style={{ color: '#3b82f6' }}>8.4%</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>1 - 3 Sao (Cần cải thiện):</span>
                <strong style={{ color: '#ef4444' }}>3.6%</strong>
              </div>
            </div>
          </div>

          {/* Customer Feedback Feed */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: '1rem' }}>
              Đánh Giá & Phản Hồi Mới Nhất Từ Khách Hàng
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                { name: 'Nguyễn Tiến Đạt', rating: 5, comment: 'Máy build rất đẹp, dây nguồn đi gọn gàng, nhân viên tư vấn nhiệt tình!', date: 'Hôm nay' },
                { name: 'Vũ Thị Thanh', rating: 5, comment: 'Đổi trả bảo hành cực kỳ nhanh chóng, shipper đến tận nhà nhận lại hàng lỗi.', date: 'Hôm qua' },
                { name: 'Hoàng Quốc Bảo', rating: 4, comment: 'PC chạy mát và mượt, chỉ là giao hàng chậm hơn 1 tiếng so với hẹn ban đầu.', date: '16/08/2026' }
              ].map((fb, fbIdx) => (
                <div key={fbIdx} style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                    <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>{fb.name}</strong>
                    <div style={{ display: 'flex', color: '#eab308' }}>
                      {[...Array(fb.rating)].map((_, i) => <Star key={i} fill="#eab308" size={12} />)}
                    </div>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: '#475569', margin: '0 0 0.3rem 0' }}>"{fb.comment}"</p>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{fb.date}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ================= MODAL: TẠO TICKET KHIẾU NẠI MỚI ================= */}
      {showAddTicket && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', width: '100%', maxWidth: '480px', padding: '1.75rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Tạo Ticket Hỗ Trợ Khách Hàng</h3>
              <button onClick={() => setShowAddTicket(false)} style={{ background: '#f1f5f9', border: 'none', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.82rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>Họ và tên khách *</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Hoàng Anh Quân"
                  value={newTicketForm.customerName}
                  onChange={e => setNewTicketForm(p => ({ ...p, customerName: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>Số điện thoại *</label>
                <input
                  type="text"
                  placeholder="Ví dụ: 0988777666"
                  value={newTicketForm.phone}
                  onChange={e => setNewTicketForm(p => ({ ...p, phone: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>Mã đơn hàng liên quan</label>
                <input
                  type="text"
                  placeholder="Ví dụ: ORD-2026-081"
                  value={newTicketForm.orderId}
                  onChange={e => setNewTicketForm(p => ({ ...p, orderId: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>Tiêu đề vấn đề *</label>
                <input
                  type="text"
                  placeholder="Ví dụ: PC không lên nguồn sau khi nhận hàng"
                  value={newTicketForm.title}
                  onChange={e => setNewTicketForm(p => ({ ...p, title: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAddTicket(false)}
                  style={{ backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.45rem 1rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!newTicketForm.customerName || !newTicketForm.phone || !newTicketForm.title) {
                      notify('Vui lòng điền họ tên khách, SĐT và tiêu đề!', 'error');
                      return;
                    }
                    if (typeof addComplaint === 'function') {
                      addComplaint({ ...newTicketForm, status: 'OPEN', date: new Date().toISOString() });
                    }
                    setShowAddTicket(false);
                    notify('Đã tạo Ticket khiếu nại thành công.', 'success');
                  }}
                  style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.45rem 1.1rem', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  Tạo Ticket
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ================= MODAL: XỬ LÝ TICKET ================= */}
      {selectedTicket && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', width: '100%', maxWidth: '520px', padding: '1.75rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Xử Lý Ticket #{selectedTicket.id}</h3>
              <button onClick={() => setSelectedTicket(null)} style={{ background: '#f1f5f9', border: 'none', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.82rem' }}>
              <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <strong style={{ color: '#0f172a' }}>{selectedTicket.title}</strong>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginTop: '0.2rem' }}>Khách: {selectedTicket.customerName} ({selectedTicket.phone})</span>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>Ghi chú giải pháp xử lý:</label>
                <textarea
                  rows={3}
                  placeholder="Nhập ghi chú hướng dẫn khách hàng hoặc phương án xử lý..."
                  value={resolution}
                  onChange={e => setResolution(e.target.value)}
                  style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    updateComplaintStatus(selectedTicket.id, 'IN_PROGRESS', null, resolution);
                    setSelectedTicket(null);
                    notify('Đã chuyển trạng thái sang ĐANG XỬ LÝ', 'info');
                  }}
                  style={{ backgroundColor: '#f59e0b', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.45rem 0.85rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Đang Xử Lý
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateComplaintStatus(selectedTicket.id, 'RESOLVED', null, resolution || 'Đã giải quyết thỏa đáng');
                    setSelectedTicket(null);
                    notify('Đã đóng Ticket thành công.', 'success');
                  }}
                  style={{ backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.45rem 1.1rem', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  ✓ Đã Giải Quyết
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ================= MODAL: CHI TIẾT YÊU CẦU ĐỔI TRẢ (RMA) ================= */}
      {selectedReturnDetail && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', width: '100%', maxWidth: '580px', padding: '1.75rem', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <RefreshCw size={20} style={{ color: '#8b5cf6' }} />
                  <span>Hồ Sơ Đổi Trả #RMA-{selectedReturnDetail.id}</span>
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Đơn hàng gốc: <strong style={{ color: '#2563eb' }}>{selectedReturnDetail.orderId}</strong></span>
              </div>
              <button onClick={() => setSelectedReturnDetail(null)} style={{ background: '#f1f5f9', border: 'none', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.82rem' }}>
              
              {/* Status Banner */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', backgroundColor: `${getStatusInfo(RETURN_STATUS, selectedReturnDetail.status).color}15`, borderRadius: '8px', border: `1px solid ${getStatusInfo(RETURN_STATUS, selectedReturnDetail.status).color}30` }}>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>Trạng Thái Thẩm Định:</span>
                <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800, backgroundColor: getStatusInfo(RETURN_STATUS, selectedReturnDetail.status).color, color: '#ffffff' }}>
                  {getStatusLabel(RETURN_STATUS, selectedReturnDetail.status)}
                </span>
              </div>

              {/* Customer Info Card */}
              <div style={{ padding: '0.85rem 1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <strong style={{ fontSize: '0.85rem', color: '#0f172a', marginBottom: '0.2rem' }}>Thông Tin Khách Hàng:</strong>
                <div><strong>Họ và tên:</strong> {selectedReturnDetail.customerName}</div>
                <div><strong>Số điện thoại:</strong> <a href={`tel:${selectedReturnDetail.phone}`} style={{ color: '#2563eb', fontWeight: 700 }}>{selectedReturnDetail.phone}</a></div>
                <div><strong>Địa chỉ lấy hàng thu hồi:</strong> {selectedReturnDetail.address || 'Quận 1, TP. Hồ Chí Minh'}</div>
              </div>

              {/* Defect Details */}
              <div style={{ padding: '0.85rem 1rem', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>Mô Tả Lỗi Từ Khách Hàng:</strong>
                <p style={{ margin: '0.2rem 0', color: '#475569', lineHeight: '1.45' }}>
                  "{selectedReturnDetail.reason || 'Sản phẩm xuất hiện sọc màn hình khi chơi game nặng, quạt kêu to bất thường.'}"
                </p>
                <div style={{ marginTop: '0.4rem', padding: '0.5rem', backgroundColor: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0', color: '#15803d', fontSize: '0.75rem' }}>
                  ✓ Đã kiểm tra bảo hành: Thiết bị thuộc diện <strong>Bảo Hành 36 Tháng 1 Đổi 1</strong> của AetherPC.
                </div>
              </div>

              {/* Proof Image */}
              <div>
                <strong style={{ display: 'block', fontSize: '0.82rem', color: '#0f172a', marginBottom: '0.4rem' }}>Hình Ảnh Bằng Chứng Lỗi (Khách Đính Kèm):</strong>
                <img
                  src={selectedReturnDetail.image || 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600&auto=format&fit=crop&q=80'}
                  alt="Proof"
                  style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setSelectedReturnDetail(null)}
                  style={{ backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Đóng
                </button>

                {selectedReturnDetail.status === 'PENDING' && (
                  <>
                    <button
                      type="button"
                      onClick={async () => {
                        const reason = await promptText('Nhập lý do từ chối yêu cầu đổi trả:');
                        if (reason) {
                          updateReturnStatus(selectedReturnDetail.id, 'REJECTED', reason);
                          setSelectedReturnDetail(null);
                          notify('Đã từ chối yêu cầu đổi trả.', 'info');
                        }
                      }}
                      style={{ backgroundColor: '#ef4444', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      ✕ Từ Chối
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        updateReturnStatus(selectedReturnDetail.id, 'RETURN_APPROVED', 'CSKH đã duyệt yêu cầu thu hồi hàng');
                        setSelectedReturnDetail(null);
                        notify('Đã duyệt yêu cầu thu hồi hàng thành công. Đã điều phối cho Shipper đến nhà khách lấy.', 'success');
                      }}
                      style={{ backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.5rem 1.25rem', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}
                    >
                      ✓ Đồng Ý Thu Hồi (Giao Shipper)
                    </button>
                  </>
                )}
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
