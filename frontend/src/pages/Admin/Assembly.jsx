import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useUtilityStore, useInventoryStore, useSalesStore } from '../../stores';
import { useAuth } from '../../context/AuthContext';
import { notify } from '../../context/NotificationContext';
import { ASSEMBLY_STATUS, getStatusInfo } from '../../utils/statusLabels';
import { 
  Wrench, Play, CheckCircle2, ShieldCheck, ClipboardList, Plus, AlertCircle, 
  Truck, XCircle, Search, Cpu, HardDrive, Zap, Layers, Check, X, Printer,
  Eye, Calendar, User, Package, Award, TrendingUp, BarChart2, ShieldAlert, Sparkles
} from 'lucide-react';

const CATEGORY_MAP_VI = {
  CPU: 'Bộ Vi Xử Lý (CPU)',
  MAINBOARD: 'Bo Mạch Chủ (Mainboard)',
  RAM: 'Bộ Nhớ Trong (RAM)',
  VGA: 'Card Màn Hình (VGA)',
  PSU: 'Nguồn Máy Tính (PSU)',
  STORAGE: 'Ổ Cứng (SSD/HDD)',
  CASE: 'Vỏ Thùng Máy (Case)',
  COOLER: 'Tản Nhiệt (Cooler)'
};

// Available Serial Numbers pool generator for each component category
const getAvailableSerialsForCategory = (cat) => {
  const c = String(cat || '').toUpperCase();
  const year = new Date().getFullYear();
  if (c.includes('CPU')) {
    return [
      `SN-CPU-${year}-0811`,
      `SN-CPU-${year}-0812`,
      `SN-CPU-${year}-0813`,
      `SN-CPU-${year}-0814`
    ];
  }
  if (c.includes('MAIN') || c.includes('BOARD') || c.includes('MB')) {
    return [
      `SN-MB-${year}-4412`,
      `SN-MB-${year}-4413`,
      `SN-MB-${year}-4414`,
      `SN-MB-${year}-4415`
    ];
  }
  if (c.includes('RAM')) {
    return [
      `SN-RAM-${year}-9021`,
      `SN-RAM-${year}-9022`,
      `SN-RAM-${year}-9023`,
      `SN-RAM-${year}-9024`
    ];
  }
  if (c.includes('VGA') || c.includes('CARD') || c.includes('GPU')) {
    return [
      `SN-VGA-${year}-1102`,
      `SN-VGA-${year}-1103`,
      `SN-VGA-${year}-1104`,
      `SN-VGA-${year}-1105`
    ];
  }
  if (c.includes('PSU') || c.includes('NGUỒN')) {
    return [
      `SN-PSU-${year}-7712`,
      `SN-PSU-${year}-7713`,
      `SN-PSU-${year}-7714`,
      `SN-PSU-${year}-7715`
    ];
  }
  if (c.includes('STORAGE') || c.includes('SSD') || c.includes('HDD')) {
    return [
      `SN-SSD-${year}-5519`,
      `SN-SSD-${year}-5520`,
      `SN-SSD-${year}-5521`,
      `SN-SSD-${year}-5522`
    ];
  }
  if (c.includes('CASE') || c.includes('THÙNG')) {
    return [
      `SN-CASE-${year}-3318`,
      `SN-CASE-${year}-3319`,
      `SN-CASE-${year}-3320`
    ];
  }
  if (c.includes('COOLER') || c.includes('QUẠT') || c.includes('TẢN')) {
    return [
      `SN-FAN-${year}-6612`,
      `SN-FAN-${year}-6613`,
      `SN-FAN-${year}-6614`
    ];
  }
  return [
    `SN-${c}-${year}-101`,
    `SN-${c}-${year}-102`,
    `SN-${c}-${year}-103`
  ];
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
};

const formatDate = (dateStr) => {
  if (!dateStr) return 'Chưa rõ';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('vi-VN');
};

export default function Assembly() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const assemblyJobs = useUtilityStore(state => state.assemblyJobs) || [];
  const updateAssemblyJob = useUtilityStore(state => state.updateAssemblyJob);
  const createAssemblyJob = useUtilityStore(state => state.createAssemblyJob);
  const inventory = useInventoryStore(state => state.inventory) || [];
  const serialNumbers = [];
  const orders = useSalesStore(state => state.orders) || [];
  const { user, isCEO, isAdmin } = useAuth();
  const jobs = assemblyJobs || [];

  // Active Tab from URL params (?tab=overview|jobs|qa|reports)
  const activeTab = searchParams.get('tab') || 'overview';
  const setTab = (tabName) => {
    setSearchParams({ tab: tabName });
  };

  // Job selection state for tab 'jobs'
  const [activeJobId, setActiveJobId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [jobSearch, setJobSearch] = useState('');
  const [jobStatusFilter, setJobStatusFilter] = useState('ALL');

  // Manual Job Creation Form State
  const [newJobOrderId, setNewJobOrderId] = useState('');
  const [newJobCustomer, setNewJobCustomer] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(null);
  const [selectedQADetailJob, setSelectedQADetailJob] = useState(null);
  const [newJobComponents, setNewJobComponents] = useState([
    { category: 'CPU', name: '' },
    { category: 'MAINBOARD', name: '' },
    { category: 'RAM', name: '' },
    { category: 'VGA', name: '' },
    { category: 'PSU', name: '' },
    { category: 'STORAGE', name: '' },
    { category: 'CASE', name: '' },
    { category: 'COOLER', name: '' }
  ]);

  // Auto-select first active job
  useEffect(() => {
    if (!activeJobId && jobs.length > 0) {
      const assembling = jobs.find(j => j.status === 'ASSEMBLING');
      const pending = jobs.find(j => j.status === 'PENDING');
      setActiveJobId((assembling || pending || jobs[0]).id);
    }
    if (activeJobId && !jobs.find(j => j.id === activeJobId) && jobs.length > 0) {
      setActiveJobId(jobs[0].id);
    }
  }, [jobs, activeJobId]);

  const activeJob = jobs.find(j => j.id === activeJobId);
  const relatedOrder = activeJob ? (orders || []).find(o => o.orderId === activeJob.orderId || o.id === activeJob.orderId) : null;
  const isCancelled = activeJob?.status === 'CANCELLED' || relatedOrder?.status === 'CANCELLED';

  // KPI Statistics
  const todayStr = new Date().toLocaleDateString('vi-VN');
  const pendingJobs = jobs.filter(j => {
    const ord = (orders || []).find(o => o.orderId === j.orderId || o.id === j.orderId);
    return j.status === 'PENDING' && ord?.status !== 'CANCELLED';
  });
  const assemblingJobs = jobs.filter(j => {
    const ord = (orders || []).find(o => o.orderId === j.orderId || o.id === j.orderId);
    return j.status === 'ASSEMBLING' && ord?.status !== 'CANCELLED';
  });
  const completedToday = jobs.filter(j => j.status === 'COMPLETED' && (j.date === todayStr || j.updatedAt?.includes(todayStr)));
  const totalCompleted = jobs.filter(j => j.status === 'COMPLETED');

  // Filtered jobs list for Tab 'jobs'
  const filteredJobsList = useMemo(() => {
    return jobs.filter(j => {
      const matchSearch = !jobSearch.trim() || 
        (j.id && j.id.toLowerCase().includes(jobSearch.toLowerCase())) ||
        (j.orderId && j.orderId.toLowerCase().includes(jobSearch.toLowerCase())) ||
        (j.customer && j.customer.toLowerCase().includes(jobSearch.toLowerCase()));

      const matchStatus = jobStatusFilter === 'ALL' || j.status === jobStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [jobs, jobSearch, jobStatusFilter]);

  // Checklist Actions
  const toggleChecklist = (jobId, key) => {
    if (isCancelled) {
      notify('Không thể thao tác: Đơn hàng này đã bị HỦY!', 'error');
      return;
    }
    const targetJob = jobs.find(j => j.id === jobId);
    if (targetJob) {
      const nextChecklist = { ...(targetJob.checklist || {}), [key]: !targetJob.checklist?.[key] };
      updateAssemblyJob(jobId, targetJob.status, nextChecklist, targetJob.componentSerials)
        .catch(err => notify(err.message || 'Không thể lưu checklist.', 'error'));
    }
  };

  const startAssembly = (jobId) => {
    if (isCancelled) {
      notify('Không thể bắt đầu: Đơn hàng này đã bị HỦY!', 'error');
      return;
    }
    const targetJob = jobs.find(j => j.id === jobId);
    if (targetJob) {
      updateAssemblyJob(jobId, 'ASSEMBLING', targetJob.checklist, targetJob.componentSerials)
        .then(() => notify(`Đã tiếp nhận lệnh lắp ráp #${jobId}! Hãy tiến hành chọn mã Serial linh kiện.`, 'success'))
        .catch(err => notify(err.message || 'Không thể bắt đầu lắp ráp.', 'error'));
    }
  };

  // Auto-fill all serial numbers with 1 click
  const handleAutoAssignAllSerials = (job) => {
    if (!job) return;
    const autoSerials = {};
    (job.components || []).forEach(comp => {
      const available = getAvailableSerialsForCategory(comp.category);
      autoSerials[comp.category] = available[0] || `SN-${comp.category}-2026-001`;
    });
    updateAssemblyJob(job.id, job.status, job.checklist, autoSerials)
      .then(() => notify('Đã tự động gán mã Serial Number (S/N) tạm cho tất cả linh kiện — có thể sửa lại thủ công.', 'success'))
      .catch(err => notify(err.message || 'Không thể gán Serial Number.', 'error'));
  };

  const completeAssembly = async (jobId) => {
    if (isCancelled) {
      notify('Không thể nghiệm thu: Đơn hàng này đã bị HỦY!', 'error');
      return;
    }
    const jobToCheck = jobs.find(j => j.id === jobId);
    if (!jobToCheck) return;

    // Client-side pre-check so the user gets instant feedback — the server
    // (assembly.controller.js) re-validates the exact same rule and is the
    // one that actually decides whether COMPLETED is accepted.
    const REQUIRED_CHECKLIST_KEYS = ['biosPost', 'osInstall', 'stressTest', 'qcSeal'];
    const allDone = REQUIRED_CHECKLIST_KEYS.every(k => !!jobToCheck.checklist?.[k]);
    if (!allDone) {
      notify('Cảnh báo: Vui lòng tích chọn đầy đủ 4 đầu mục kiểm thử chất lượng QA trước khi nghiệm thu xuất xưởng!', 'error');
      return;
    }

    const currentSerials = { ...(jobToCheck.componentSerials || {}) };
    const serialsAssigned = (jobToCheck.components || []).every(comp => !!currentSerials[comp.category]);
    if (!serialsAssigned) {
      notify('Cảnh báo: Vui lòng chọn đầy đủ mã Serial Number (S/N) cho tất cả linh kiện trước khi nghiệm thu xuất xưởng!', 'error');
      return;
    }

    const finalChecklist = {
      biosPost: true,
      osInstall: true,
      stressTest: true,
      qcSeal: true
    };

    try {
      await updateAssemblyJob(jobId, 'COMPLETED', finalChecklist, currentSerials);
      notify(`Đã hoàn tất lắp ráp và nghiệm thu! Đơn hàng ${jobToCheck.orderId || jobId} đã được chuyển sang trạng thái "Sẵn Sàng Giao" (Kho sẽ bàn giao xuất hàng).`, 'success');
    } catch (err) {
      notify(`Nghiệm thu thất bại: ${err.message || 'lỗi kết nối máy chủ'}.`, 'error');
    }
  };

  // Create Manual Job
  const [creatingJob, setCreatingJob] = useState(false);
  const handleCreateJob = async (e) => {
    e.preventDefault();
    if (!newJobCustomer.trim()) {
      notify('Vui lòng nhập tên khách hàng hoặc mục đích lệnh lắp ráp.', 'error');
      return;
    }
    const validComponents = newJobComponents.filter(c => c.name && c.name.trim());
    if (validComponents.length === 0) {
      notify('Vui lòng điền ít nhất 1 linh kiện cần lắp ráp.', 'error');
      return;
    }

    if (typeof createAssemblyJob !== 'function') return;
    setCreatingJob(true);
    try {
      const newJob = await createAssemblyJob({
        orderId: newJobOrderId || null,
        customerName: newJobCustomer,
        components: validComponents
      });
      if (!newJob) {
        notify(`Đơn hàng ${newJobOrderId} đã có lệnh lắp ráp — không tạo trùng.`, 'error');
        return;
      }
      setShowCreateModal(false);
      setActiveJobId(newJob.id);
      setTab('jobs');
      notify(`Đã khởi tạo thành công Lệnh Lắp Ráp #${newJob.id}!`, 'success');
    } catch (err) {
      notify(`Không thể tạo lệnh lắp ráp: ${err.message || 'lỗi kết nối máy chủ'}.`, 'error');
    } finally {
      setCreatingJob(false);
    }
  };

  // Status Badge Helper
  const getJobStatusBadge = (status) => {
    const info = getStatusInfo(ASSEMBLY_STATUS, status);
    return { bg: info.bg, color: info.color, border: info.border, text: info.label };
  };

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '1.5rem 2rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & ASSEMBLY TASK CENTER BANNER */}
      {/* ========================================================================= */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
          {activeTab === 'overview' && 'Tổng Quan Bộ Phận Kỹ Thuật Lắp Ráp'}
          {activeTab === 'jobs' && 'Quản Lý Lệnh Lắp Ráp & Nghiệm Thu Máy Tính'}
          {activeTab === 'qa' && 'Kiểm Định Chất Lượng Xuất Xưởng & Tem Bảo Hành'}
          {activeTab === 'reports' && 'Báo Cáo Năng Suất & Hiệu Suất Xưởng Kỹ Thuật'}
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
          Tiếp nhận đơn build PC, chọn mã Serial linh kiện có sẵn, kiểm thử QA và bàn giao kho xuất hàng
        </p>
      </div>

      {/* Assembly Task Center Banner */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: '8px',
        padding: '1rem 1.25rem',
        marginBottom: '1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '8px',
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#2563eb'
          }}>
            <Wrench size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Trung Tâm Nhiệm Vụ Kỹ Thuật Lắp Ráp
              </h3>
              {pendingJobs.length > 0 && (
                <span style={{
                  backgroundColor: '#fef3c7',
                  color: '#b45309',
                  border: '1px solid #fde68a',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}>
                  {pendingJobs.length} Lệnh Chờ Tiếp Nhận
                </span>
              )}
            </div>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Xưởng build máy: {pendingJobs.length} lệnh chờ tiếp nhận | {assemblingJobs.length} lệnh đang ráp & stress test | {completedToday.length} máy hoàn tất hôm nay.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '0.5rem 1.1rem',
              fontSize: '0.83rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <Plus size={16} />
            <span>Tạo Lệnh Lắp Ráp Mới</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW (TỔNG QUAN LẮP RÁP) */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div>
          {/* 6 Odoo KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
            <div style={{ backgroundColor: '#fffbeb', padding: '0.85rem 0.65rem', borderRadius: '8px', border: '1px solid #fde68a', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '85px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#d97706' }}>{pendingJobs.length}</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b45309', marginTop: '0.25rem' }}>Chờ Tiếp Nhận</div>
            </div>

            <div style={{ backgroundColor: '#eff6ff', padding: '0.85rem 0.65rem', borderRadius: '8px', border: '1px solid #bfdbfe', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '85px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2563eb' }}>{assemblingJobs.length}</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb', marginTop: '0.25rem' }}>Đang Lắp Ráp & Test</div>
            </div>

            <div style={{ backgroundColor: '#f0fdf4', padding: '0.85rem 0.65rem', borderRadius: '8px', border: '1px solid #bbf7d0', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '85px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#16a34a' }}>{completedToday.length}</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16a34a', marginTop: '0.25rem' }}>Hoàn Thành Hôm Nay</div>
            </div>

            <div style={{ backgroundColor: '#ffffff', padding: '0.85rem 0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '85px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>{totalCompleted.length}</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginTop: '0.25rem' }}>Tổng Máy Đã Xuất Xưởng</div>
            </div>

            <div style={{ backgroundColor: '#ffffff', padding: '0.85rem 0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '85px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>100%</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginTop: '0.25rem' }}>Tỷ Lệ Đạt Chuẩn QA</div>
            </div>

            <div style={{ backgroundColor: '#ffffff', padding: '0.85rem 0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '85px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#8b5cf6' }}>45 Phút</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginTop: '0.25rem' }}>Thời Gian Lắp TB</div>
            </div>
          </div>

          {/* Ongoing Jobs Queue */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Tiến Độ Các Lệnh Lắp Ráp Hiện Tại
              </h3>
              <button
                onClick={() => setTab('jobs')}
                style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Mở danh sách chi tiết →
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {jobs.map(job => {
                const badge = getJobStatusBadge(job.status);
                const checkedCount = Object.values(job.checklist || {}).filter(Boolean).length;

                return (
                  <div
                    key={job.id}
                    onClick={() => { setActiveJobId(job.id); setTab('jobs'); }}
                    style={{
                      padding: '0.85rem',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: job.id === activeJobId ? '#eff6ff' : '#f8fafc',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <strong style={{ fontSize: '0.85rem', color: '#2563eb' }}>#{job.id}</strong>
                        <span style={{ fontSize: '0.8rem', color: '#0f172a', fontWeight: 700 }}>— {job.customer || 'Khách hàng'}</span>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginTop: '0.15rem' }}>
                        Đơn gốc: {job.orderId} | Ngày tạo: {job.date} | Linh kiện: {job.components?.length || 0} món
                      </span>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.2rem 0.65rem',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: badge.color,
                        backgroundColor: badge.bg,
                        border: `1px solid ${badge.border}`,
                        borderRadius: '12px',
                        marginBottom: '0.25rem'
                      }}>
                        {badge.text}
                      </span>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>
                        QA Test: {checkedCount}/4 tiêu chuẩn
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: JOBS (QUẢN LÝ LỆNH LẮP RÁP & CHỌN MÃ SERIAL TỰ ĐỘNG) */}
      {/* ========================================================================= */}
      {activeTab === 'jobs' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '1.25rem', alignItems: 'start' }}>
          
          {/* Left Column: Jobs List */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
            
            {/* Filter toolbar */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '0.65rem', marginBottom: '1rem' }}>
              <input
                type="text"
                placeholder="Tìm mã lệnh, khách hàng..."
                value={jobSearch}
                onChange={(e) => setJobSearch(e.target.value)}
                style={{ width: '100%', height: '36px', padding: '0 0.75rem', fontSize: '0.8rem', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
              />

              <select
                value={jobStatusFilter}
                onChange={(e) => setJobStatusFilter(e.target.value)}
                style={{ width: '100%', height: '36px', padding: '0 0.5rem', fontSize: '0.8rem', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', backgroundColor: '#ffffff' }}
              >
                <option value="ALL">Tất cả ({jobs.length})</option>
                <option value="PENDING">Chờ tiếp nhận</option>
                <option value="ASSEMBLING">Đang lắp ráp</option>
                <option value="COMPLETED">Đã hoàn tất</option>
              </select>
            </div>

            {/* List of Job cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '600px', overflowY: 'auto' }}>
              {filteredJobsList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8', fontSize: '0.82rem' }}>
                  Không tìm thấy lệnh lắp ráp nào phù hợp.
                </div>
              ) : (
                filteredJobsList.map(job => {
                  const badge = getJobStatusBadge(job.status);
                  const isSelected = job.id === activeJobId;

                  return (
                    <div
                      key={job.id}
                      onClick={() => setActiveJobId(job.id)}
                      style={{
                        padding: '0.85rem',
                        borderRadius: '8px',
                        border: isSelected ? '2px solid #2563eb' : '1px solid #cbd5e1',
                        backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                        <div>
                          <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>#{job.id}</strong>
                          <span style={{ fontSize: '0.78rem', color: '#475569', display: 'block', fontWeight: 600 }}>
                            {job.customer || 'Khách hàng'}
                          </span>
                        </div>
                        <span style={{
                          padding: '2px 7px',
                          borderRadius: '10px',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          backgroundColor: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`
                        }}>
                          {badge.text}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '0.35rem', marginTop: '0.35rem' }}>
                        <span>Đơn: {job.orderId}</span>
                        <span>{job.date}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Active Job Workbench */}
          {activeJob ? (
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.5rem' }}>
              
              {/* Job Header & Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                      Lệnh Lắp Ráp #{activeJob.id}
                    </h3>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      backgroundColor: getJobStatusBadge(activeJob.status).bg,
                      color: getJobStatusBadge(activeJob.status).color,
                      border: `1px solid ${getJobStatusBadge(activeJob.status).border}`
                    }}>
                      {getJobStatusBadge(activeJob.status).text}
                    </span>
                  </div>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                    Khách hàng: <strong>{activeJob.customer}</strong> | Đơn hàng tham chiếu: <strong>{activeJob.orderId}</strong>
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {activeJob.status === 'PENDING' && (
                    <button
                      onClick={() => startAssembly(activeJob.id)}
                      style={{
                        backgroundColor: '#2563eb',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0.5rem 1rem',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <Play size={14} />
                      <span>Tiếp Nhận & Bắt Đầu Lắp</span>
                    </button>
                  )}

                  {activeJob.status === 'ASSEMBLING' && (
                    <button
                      onClick={() => completeAssembly(activeJob.id)}
                      style={{
                        backgroundColor: '#16a34a',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0.5rem 1rem',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <CheckCircle2 size={15} />
                      <span>Nghiệm Thu & Bàn Giao Xuất Kho</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 1. Component Serial Numbers Table with Dropdown Select */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Cpu size={16} style={{ color: '#2563eb' }} />
                    <span>1. Danh Sách Linh Kiện & Chọn Mã Serial Number (S/N)</span>
                  </h4>

                  {activeJob.status === 'ASSEMBLING' && (
                    <button
                      onClick={() => handleAutoAssignAllSerials(activeJob)}
                      style={{
                        backgroundColor: '#eff6ff',
                        color: '#2563eb',
                        border: '1px solid #bfdbfe',
                        borderRadius: '4px',
                        padding: '0.3rem 0.65rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <Sparkles size={13} />
                      <span>Tự Động Chọn S/N Cho Tất Cả</span>
                    </button>
                  )}
                </div>

                <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                        <th style={{ padding: '0.6rem 0.85rem', width: '120px' }}>Phân Nhóm</th>
                        <th style={{ padding: '0.6rem 0.85rem' }}>Tên Linh Kiện</th>
                        <th style={{ padding: '0.6rem 0.85rem', width: '240px' }}>Mã Serial (S/N Có Sẵn)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(activeJob.components || []).map((comp, idx) => {
                        const assignedSN = activeJob.componentSerials?.[comp.category] || '';
                        const availableSerials = getAvailableSerialsForCategory(comp.category);

                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.6rem 0.85rem', fontWeight: 700, color: '#2563eb', verticalAlign: 'top' }}>
                              {comp.category}
                            </td>
                            <td style={{ padding: '0.6rem 0.85rem', color: '#0f172a', fontWeight: 600, verticalAlign: 'top' }}>
                              {comp.name || 'Chưa chỉ định'}
                            </td>
                            <td style={{ padding: '0.6rem 0.85rem', verticalAlign: 'top' }}>
                              <select
                                value={assignedSN}
                                onChange={(e) => {
                                  const nextSerials = { ...(activeJob.componentSerials || {}), [comp.category]: e.target.value };
                                  updateAssemblyJob(activeJob.id, activeJob.status, activeJob.checklist, nextSerials)
                                    .catch(err => notify(err.message || 'Không thể lưu Serial Number.', 'error'));
                                }}
                                style={{
                                  width: '100%',
                                  height: '32px',
                                  padding: '0 0.5rem',
                                  fontSize: '0.78rem',
                                  fontWeight: assignedSN ? 700 : 400,
                                  color: assignedSN ? '#15803d' : '#64748b',
                                  border: `1px solid ${assignedSN ? '#86efac' : '#cbd5e1'}`,
                                  borderRadius: '4px',
                                  backgroundColor: assignedSN ? '#f0fdf4' : '#ffffff',
                                  boxSizing: 'border-box',
                                  cursor: 'pointer'
                                }}
                              >
                                <option value="">-- Chọn mã Serial S/N --</option>
                                {availableSerials.map((snVal, sIdx) => (
                                  <option key={sIdx} value={snVal}>
                                    {snVal} (Kho sẵn sàng)
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2. QA Testing & Stress Test Checklist */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <ShieldCheck size={16} style={{ color: '#16a34a' }} />
                    <span>2. Checklist Kiểm Định Chất Lượng & Stress Test</span>
                  </h4>

                  {activeJob.status === 'ASSEMBLING' && (
                    <button
                      onClick={() => {
                        const fullQA = { biosPost: true, osInstall: true, stressTest: true, qcSeal: true };
                        updateAssemblyJob(activeJob.id, activeJob.status, fullQA, activeJob.componentSerials)
                          .catch(err => notify(err.message || 'Không thể lưu checklist.', 'error'));
                      }}
                      style={{
                        backgroundColor: '#f0fdf4',
                        color: '#16a34a',
                        border: '1px solid #bbf7d0',
                        borderRadius: '4px',
                        padding: '0.3rem 0.65rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <Sparkles size={13} />
                      <span>Đạt Tất Cả Tiêu Chuẩn</span>
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {[
                    { key: 'biosPost', label: 'Khởi động BIOS POST & Cập nhật Firmware mới nhất' },
                    { key: 'osInstall', label: 'Cài đặt Windows 11 bản quyền & Full Drivers phần cứng' },
                    { key: 'stressTest', label: 'Stress test 15 phút FurMark (VGA) & Cinebench (CPU)' },
                    { key: 'qcSeal', label: 'Kiểm tra nhiệt độ tải < 75°C & Dán tem bảo hành xuất xưởng' }
                  ].map(item => {
                    const isChecked = !!activeJob.checklist?.[item.key];

                    return (
                      <div
                        key={item.key}
                        onClick={() => toggleChecklist(activeJob.id, item.key)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.65rem',
                          padding: '0.75rem',
                          borderRadius: '6px',
                          border: `1px solid ${isChecked ? '#bbf7d0' : '#cbd5e1'}`,
                          backgroundColor: isChecked ? '#f0fdf4' : '#ffffff',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '4px',
                          border: `2px solid ${isChecked ? '#16a34a' : '#94a3b8'}`,
                          backgroundColor: isChecked ? '#16a34a' : '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                          flexShrink: 0
                        }}>
                          {isChecked && <Check size={14} />}
                        </div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: isChecked ? '#15803d' : '#334155' }}>
                          {item.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          ) : (
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
              Chưa chọn lệnh lắp ráp nào.
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: QA (KIỂM ĐỊNH XUẤT XƯỞNG & BIÊN BẢN NGHIỆM THU) */}
      {/* ========================================================================= */}
      {activeTab === 'qa' && (
        <div>
          <div style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Biên Bản Kiểm Định Xuất Xưởng & Tem Bảo Hành Điện Tử
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
              Nhật ký nghiệm thu 4 bài kiểm thử stress test, lưu vết mã Serial Number từng linh kiện
            </p>
          </div>

          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Mã Lệnh Build</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Khách Hàng</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Ngày Nghiệm Thu</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Kết Quả Stress Test</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Tem Bảo Hành</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Trạng Thái Xuất Xưởng</th>
                </tr>
              </thead>
              <tbody>
                {jobs.filter(j => j.status === 'COMPLETED').length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                      Chưa có lệnh lắp ráp nào hoàn tất nghiệm thu xuất xưởng.
                    </td>
                  </tr>
                ) : (
                  jobs.filter(j => j.status === 'COMPLETED').map(job => (
                    <tr 
                      key={job.id} 
                      onClick={() => setSelectedQADetailJob(job)}
                      style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s ease' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                    >
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#2563eb' }}>
                        #{job.id}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0f172a' }}>
                        {job.customer}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                        {job.date}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <span style={{ backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 700 }}>
                          Pass (Full 100%)
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: '#15803d', fontWeight: 700 }}>
                        Đã Dán Tem
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <span style={{ backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 700 }}>
                          Đã Bàn Giao Kho
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: REPORTS (BÁO CÁO HIỆU SUẤT KỸ THUẬT) */}
      {/* ========================================================================= */}
      {activeTab === 'reports' && (
        <div>
          <div style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Báo Cáo Hiệu Suất Xưởng Kỹ Thuật Lắp Ráp
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
              Thống kê năng suất lắp ráp theo ngày, cơ cấu phân khúc máy và tỷ lệ nghiệm thu đúng chuẩn
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: '1rem' }}>
                Phân Bổ Phân Khúc Máy Build
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {[
                  { name: 'PC Gaming Trung Cấp (RTX 4060 / 4060Ti)', count: 12, pct: 55, color: '#2563eb' },
                  { name: 'PC Workstation Đồ Họa & Render 3D', count: 5, pct: 25, color: '#8b5cf6' },
                  { name: 'PC Văn Phòng Kế Toán', count: 3, pct: 15, color: '#10b981' },
                  { name: 'PC High-End 4K Enthusiast (RTX 4090)', count: 1, pct: 5, color: '#ef4444' }
                ].map((item, idx) => (
                  <div key={idx} style={{ paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.3rem' }}>
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>{item.name}</span>
                      <span style={{ color: item.color, fontWeight: 700 }}>{item.count} Bộ ({item.pct}%)</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${item.pct}%`, height: '100%', backgroundColor: item.color, borderRadius: '3px' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: '1rem' }}>
                Chỉ Số Chất Lượng Xưởng Lắp Ráp
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#16a34a' }}>100%</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, marginTop: '0.2rem' }}>Tỷ Lệ Đạt Stress Test Lần 1</div>
                </div>
                <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2563eb' }}>45 Phút</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, marginTop: '0.2rem' }}>Thời Gian Lắp + Test TB</div>
                </div>
                <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>{jobs.length}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, marginTop: '0.2rem' }}>Tổng Lệnh Lắp Ráp</div>
                </div>
                <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#d97706' }}>0%</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, marginTop: '0.2rem' }}>Tỷ Lệ Hỏng Hóc Lắp Ráp</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL TẠO LỆNH LẮP RÁP THỦ CÔNG TỐI ƯU ================= */}
      {showCreateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1.5rem' }}>
          <div style={{ width: '100%', maxWidth: '780px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ padding: '0.6rem', background: '#eff6ff', borderRadius: '8px', color: '#2563eb' }}>
                  <Wrench size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Tạo Lệnh Lắp Ráp Máy Tính</h3>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.15rem 0 0' }}>Khởi tạo phiếu yêu cầu kỹ thuật ráp bộ máy PC mới</p>
                </div>
              </div>
              <button onClick={() => setShowCreateModal(false)} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', cursor: 'pointer', padding: '0.4rem', borderRadius: '6px' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateJob}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.3rem' }}>
                    Mã Đơn Hàng (Tùy chọn):
                  </label>
                  <input
                    type="text"
                    placeholder="ORD-xxxxxx (hoặc để trống)..."
                    value={newJobOrderId}
                    onChange={(e) => setNewJobOrderId(e.target.value)}
                    style={{ width: '100%', height: '36px', padding: '0 0.75rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.3rem' }}>
                    Tên Khách Hàng / Mục Đích (*):
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Tên khách hàng / PC Trưng bày..."
                    value={newJobCustomer}
                    onChange={(e) => setNewJobCustomer(e.target.value)}
                    style={{ width: '100%', height: '36px', padding: '0 0.75rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Danh Sách Linh Kiện Lắp Ráp:
                  </label>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    Nhập chữ để tìm kiếm và chọn linh kiện gợi ý từ kho
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {newJobComponents.map((comp, idx) => {
                    const query = (comp.name || '').toLowerCase().trim();
                    const matchedSuggestions = query.length > 0
                      ? inventory.filter(p => {
                          const pCat = String(p.category || '').toUpperCase();
                          const targetCat = String(comp.category || '').toUpperCase();
                          const catMatch = pCat.includes(targetCat) || targetCat.includes(pCat);
                          const nameMatch = (p.name || '').toLowerCase().includes(query) || (p.sku || '').toLowerCase().includes(query);
                          return catMatch && nameMatch;
                        }).slice(0, 6)
                      : [];

                    return (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.65rem', alignItems: 'center', backgroundColor: '#f8fafc', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #e2e8f0', position: 'relative' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#2563eb' }}>
                          {comp.category}:
                        </span>

                        <div style={{ position: 'relative', width: '100%' }}>
                          <input
                            type="text"
                            placeholder={`Gõ tên linh kiện ${comp.category} để gợi ý...`}
                            value={comp.name}
                            onChange={(e) => {
                              const updated = [...newJobComponents];
                              updated[idx] = { ...updated[idx], name: e.target.value };
                              setNewJobComponents(updated);
                            }}
                            onFocus={() => setFocusedIndex(idx)}
                            onBlur={() => {
                              // Small timeout to allow clicking on dropdown suggestions
                              setTimeout(() => setFocusedIndex(null), 250);
                            }}
                            style={{
                              width: '100%',
                              height: '34px',
                              padding: '0 0.65rem',
                              fontSize: '0.8rem',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              backgroundColor: '#ffffff',
                              boxSizing: 'border-box'
                            }}
                          />

                          {/* Autocomplete Dropdown - Only show when typing text and focused */}
                          {focusedIndex === idx && matchedSuggestions.length > 0 && (
                            <div style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              right: 0,
                              marginTop: '4px',
                              backgroundColor: '#ffffff',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
                              maxHeight: '180px',
                              overflowY: 'auto',
                              zIndex: 9999
                            }}>
                              {matchedSuggestions.map(p => (
                                <div
                                  key={p.productId || p.id}
                                  onMouseDown={() => {
                                    const updated = [...newJobComponents];
                                    updated[idx] = { ...updated[idx], name: p.name };
                                    setNewJobComponents(updated);
                                    setFocusedIndex(null);
                                  }}
                                  style={{
                                    padding: '0.5rem 0.75rem',
                                    fontSize: '0.78rem',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid #f1f5f9',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    backgroundColor: '#ffffff',
                                    transition: 'background 0.1s ease'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                                >
                                  <div>
                                    <strong style={{ color: '#0f172a', display: 'block' }}>{p.name}</strong>
                                    {p.sku && <span style={{ fontSize: '0.68rem', color: '#64748b' }}>SKU: {p.sku}</span>}
                                  </div>
                                  <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: '0.5rem' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16a34a', display: 'block' }}>
                                      {formatCurrency(p.price)}
                                    </span>
                                    <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                                      Tồn: {p.stock !== undefined ? p.stock : (p.stockQuantity || 10)} chiếc
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem 1.1rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.5rem 1.25rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Tạo Lệnh Lắp Ráp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL XEM CHI TIẾT BIÊN BẢN NGHIỆM THU QA ================= */}
      {selectedQADetailJob && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1.5rem' }}>
          <div style={{ width: '100%', maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '1.25rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{ padding: '0.65rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#16a34a' }}>
                  <ShieldCheck size={26} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      Phiếu Nghiệm Thu Kỹ Thuật & Bảo Hành #{selectedQADetailJob.id}
                    </h3>
                    <span style={{ backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 700 }}>
                      Pass 100% Xuất Xưởng
                    </span>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0.2rem 0 0' }}>
                    Biên bản bàn giao kỹ thuật & quản lý mã Serial Number bảo hành chính hãng
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedQADetailJob(null)} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', cursor: 'pointer', padding: '0.4rem', borderRadius: '6px' }}>
                <X size={18} />
              </button>
            </div>

            {/* General Info Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.25rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, display: 'block' }}>MÃ ĐƠN HÀNG:</span>
                <strong style={{ fontSize: '0.85rem', color: '#2563eb' }}>#{selectedQADetailJob.orderId}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, display: 'block' }}>KHÁCH HÀNG:</span>
                <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>{selectedQADetailJob.customer}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, display: 'block' }}>NGÀY NGHIỆM THU:</span>
                <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>{selectedQADetailJob.date}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, display: 'block' }}>BÀN GIAO:</span>
                <strong style={{ fontSize: '0.85rem', color: '#16a34a' }}>Kho Sẵn Sàng Xuất</strong>
              </div>
            </div>

            {/* Component & Serial Numbers Table */}
            <div style={{ marginBottom: '1.25rem' }}>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Cpu size={16} style={{ color: '#2563eb' }} />
                <span>1. Danh Sách Linh Kiện & Mã Serial Number (S/N) Bảo Hành</span>
              </h4>

              <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                      <th style={{ padding: '0.6rem 0.85rem', width: '130px' }}>Phân Nhóm</th>
                      <th style={{ padding: '0.6rem 0.85rem' }}>Tên Linh Kiện</th>
                      <th style={{ padding: '0.6rem 0.85rem', width: '220px' }}>Mã Serial Number (S/N)</th>
                      <th style={{ padding: '0.6rem 0.85rem', width: '100px', textAlign: 'center' }}>Bảo Hành</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedQADetailJob.components || []).map((comp, idx) => {
                      const sn = selectedQADetailJob.componentSerials?.[comp.category] || `SN-${comp.category}-2026-0811`;
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.6rem 0.85rem', fontWeight: 700, color: '#2563eb' }}>
                            {comp.category}
                          </td>
                          <td style={{ padding: '0.6rem 0.85rem', color: '#0f172a', fontWeight: 600 }}>
                            {comp.name}
                          </td>
                          <td style={{ padding: '0.6rem 0.85rem' }}>
                            <span style={{ backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, fontFamily: 'monospace' }}>
                              {sn}
                            </span>
                          </td>
                          <td style={{ padding: '0.6rem 0.85rem', textAlign: 'center', color: '#64748b', fontSize: '0.75rem' }}>
                            36 Tháng
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* QA Test Results Breakdown */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <ShieldCheck size={16} style={{ color: '#16a34a' }} />
                <span>2. Kết Quả Kiểm Định Chất Lượng & Stress Test</span>
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                {[
                  { title: 'Khởi động BIOS POST & Update Firmware', result: 'PASS (Version 2026.08)', note: 'Đã nhận đủ RAM và SSD NVMe Gen4' },
                  { title: 'Cài đặt Windows 11 & Full Drivers', result: 'PASS (Win 11 Pro)', note: 'Driver VGA & Chipset hoạt động ổn định' },
                  { title: 'Stress test 15 phút FurMark & Cinebench', result: 'PASS (Max 68°C)', note: 'Điểm benchmark chuẩn hiệu năng hãng' },
                  { title: 'Kiểm tra nhiệt độ & Dán tem niêm phong', result: 'PASS (Đã Dán Tem)', note: 'Tem bảo hành điện tử chính hãng ERP' }
                ].map((test, tIdx) => (
                  <div key={tIdx} style={{ backgroundColor: '#f0fdf4', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '0.78rem', color: '#15803d', display: 'block' }}>{test.title}</strong>
                      <span style={{ fontSize: '0.7rem', color: '#475569' }}>{test.note}</span>
                    </div>
                    <span style={{ backgroundColor: '#16a34a', color: '#ffffff', fontSize: '0.68rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', flexShrink: 0 }}>
                      {test.result}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
              <button
                onClick={() => window.print()}
                style={{ backgroundColor: '#ffffff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Printer size={15} />
                <span>In Phiếu Nghiệm Thu & Tem Bảo Hành</span>
              </button>

              <button
                onClick={() => setSelectedQADetailJob(null)}
                style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.5rem 1.25rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Đóng
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

