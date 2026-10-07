import React, { useState, useMemo, useEffect } from 'react';
import {
  Building, Users, User, Clock, Calendar, CheckCircle2, AlertCircle, XCircle,
  ChevronRight, ChevronDown, Search, Plus, MoreHorizontal, Network,
  Filter, ArrowRight, UserCheck, Shield, Phone, Mail, FileText,
  Camera, Check, X, Edit2, Trash2, ExternalLink, RefreshCw, Award, Briefcase, Eye
} from 'lucide-react';
import { useHRStore } from '../../../stores';
import { useAuth } from '../../../context/AuthContext';
import { notify, promptText } from '../../../context/NotificationContext';
import { getRoleName } from '../../../utils/rbacEngine';
import { ATTENDANCE_STATUS, getStatusInfo, getStatusLabel } from '../../../utils/statusLabels';
import { api } from '../../../services/api';
import DateRangeFilter, { isDateInRange } from '../../../components/Common/DateRangeFilter';

// Cấu trúc cây phòng ban phân cấp chuẩn của doanh nghiệp
const DEFAULT_TREE = [
  {
    id: 'dept-bgd',
    name: 'BAN GIÁM ĐỐC',
    code: 'BGD',
    deptKey: 'Ban Giám Đốc',
    leader: 'Bùi Thành Long',
    leaderRole: 'CEO / Tổng Giám Đốc',
    roleDesc: 'Ban Lãnh Đạo Tối Cao',
    description: 'Chỉ đạo định hướng chiến lược toàn diện, phê duyệt các quyết định đầu tư và vận hành cốt lõi',
    children: []
  },
  {
    id: 'dept-bld',
    name: 'BAN LÃNH ĐẠO & ĐIỀU HÀNH',
    code: 'BLD',
    deptKey: 'Ban Lãnh Đạo',
    leader: 'Nguyễn Văn A',
    leaderRole: 'Phó Tổng Giám Đốc Điều Hành',
    roleDesc: 'Ban Điều Hành Chiến Lược',
    description: 'Điều hành trực tiếp khối vận hành, khối kinh doanh và chuỗi cung ứng kỹ thuật',
    children: [
      {
        id: 'dept-backoffice',
        name: 'BACK OFFICE',
        code: 'BO',
        deptKey: 'Khối Vận Hành',
        leader: 'Trần Thị Mai',
        leaderRole: 'Giám Đốc Vận Hành (COO)',
        roleDesc: 'Khối Vận Hành Hỗ Trợ',
        description: 'Khối hỗ trợ quản trị hành chính, nhân sự, tài chính kế toán và hạ tầng IT',
        children: [
          {
            id: 'dept-hc',
            name: 'HÀNH CHÍNH',
            code: 'HC',
            deptKey: 'Hành Chính',
            leader: 'Vũ Thị Hồng',
            leaderRole: 'Trưởng Phòng Hành Chính',
            roleDesc: 'Quản trị văn phòng & Lễ tân',
            description: 'Quản lý tài sản văn phòng, văn thư lưu trữ và hậu cần',
            children: []
          },
          {
            id: 'dept-hr',
            name: 'NHÂN SỰ (HRM)',
            code: 'HR',
            deptKey: 'Nhân Sự',
            leader: 'Lê Thu Trang',
            leaderRole: 'Trưởng Phòng Nhân Sự',
            roleDesc: 'Quản trị nhân lực & Đãi ngộ',
            description: 'Tuyển dụng, đào tạo, giám sát chấm công và tính lương',
            children: []
          },
          {
            id: 'dept-kt',
            name: 'KẾ TOÁN & TÀI CHÍNH',
            code: 'KT',
            deptKey: 'Kế Toán',
            leader: 'Nguyễn Minh Quân',
            leaderRole: 'Kế Toán Trưởng',
            roleDesc: 'Kế toán tài chính & Thuế',
            description: 'Kiểm soát dòng tiền, sổ quỹ thu chi, đối soát COD và nghĩa vụ thuế',
            children: []
          },
          {
            id: 'dept-it',
            name: 'CÔNG NGHỆ THÔNG TIN (IT)',
            code: 'IT',
            deptKey: 'IT',
            leader: 'Hoàng Văn Nam',
            leaderRole: 'Trưởng Nhóm IT & Hệ Thống',
            roleDesc: 'Hạ tầng hệ thống & Phần mềm ERP',
            description: 'Vận hành hạ tầng mạng máy chủ, bảo mật dữ liệu và hỗ trợ người dùng ERP',
            children: []
          }
        ]
      },
      {
        id: 'dept-commercial',
        name: 'KHỐI KINH DOANH & THƯƠNG MẠI',
        code: 'COMMERCIAL',
        deptKey: 'Khối Kinh Doanh',
        leader: 'Trần Anh',
        leaderRole: 'Giám Đốc Kinh Doanh (CSO)',
        roleDesc: 'Khối Bán Hàng & Chăm Sóc KH',
        description: 'Tăng trưởng doanh số, mở rộng thị phần và phát triển dịch vụ khách hàng',
        children: [
          {
            id: 'dept-sales',
            name: 'KINH DOANH & BÁN HÀNG',
            code: 'SALES',
            deptKey: 'Kinh Doanh',
            leader: 'Trần Anh',
            leaderRole: 'Quản Lý Bán Hàng',
            roleDesc: 'Bán lẻ POS & Tư vấn giải pháp PC',
            description: 'Bán lẻ tại quầy POS, tư vấn cấu hình PC và chăm sóc khách hàng doanh nghiệp',
            children: []
          },
          {
            id: 'dept-cskh',
            name: 'CHĂM SÓC KHÁCH HÀNG (CSKH)',
            code: 'CSKH',
            deptKey: 'Chăm Sóc KH',
            leader: 'Phạm Thúy Vy',
            leaderRole: 'Trưởng Phòng CSKH',
            roleDesc: 'Hỗ trợ khách hàng & Khiếu nại',
            description: 'Tiếp nhận tư vấn trực tuyến, xử lý bảo hành RMA và giải quyết khiếu nại',
            children: []
          }
        ]
      },
      {
        id: 'dept-supply-tech',
        name: 'KHỐI CHUỖI CUNG ỨNG & KỸ THUẬT',
        code: 'SCM-TECH',
        deptKey: 'Khối Kỹ Thuật',
        leader: 'Lê Hoàng',
        leaderRole: 'Giám Đốc Chuỗi Cung Ứng',
        roleDesc: 'Khối Kho Vận & Kỹ Thuật PC',
        description: 'Điều phối kho bãi, nhập mua linh kiện, lắp ráp PC và kiểm soát chất lượng',
        children: [
          {
            id: 'dept-wh',
            name: 'KHO VẬN & TỒN KHO',
            code: 'WH',
            deptKey: 'Kho Vận',
            leader: 'Lê Hoàng',
            leaderRole: 'Quản Lý Kho',
            roleDesc: 'Quản lý kho bãi & Nhập xuất tồn',
            description: 'Quản lý mặt bằng kho, nhập kho, phân phối vị trí kệ và đóng gói đơn',
            children: []
          },
          {
            id: 'dept-purchasing',
            name: 'MUA HÀNG (PURCHASING)',
            code: 'PO',
            deptKey: 'Mua Hàng',
            leader: 'Vũ Đình Trọng',
            leaderRole: 'Trưởng Phòng Mua Hàng',
            roleDesc: 'Mua hàng & Đàm phán NCC',
            description: 'Lập yêu cầu báo giá RFQ, phát hành đơn mua hàng PO và đánh giá nhà cung cấp',
            children: []
          },
          {
            id: 'dept-assembly',
            name: 'KỸ THUẬT LẮP RÁP PC',
            code: 'ASM',
            deptKey: 'Kỹ Thuật Lắp Ráp',
            leader: 'Đặng Quốc Huy',
            leaderRole: 'Trưởng Nhóm Lắp Ráp',
            roleDesc: 'Lắp ráp PC & Kiểm tra kỹ thuật',
            description: 'Lắp ráp linh kiện máy tính, test hiệu năng Benchmarking và dán tem xuất xưởng',
            children: []
          },
          {
            id: 'dept-qc',
            name: 'KIỂM ĐỊNH CHẤT LƯỢNG (QA/QC)',
            code: 'QC',
            deptKey: 'Kiểm Định QA/QC',
            leader: 'Đỗ Thanh Tùng',
            leaderRole: 'Trưởng Bộ Phận QA/QC',
            roleDesc: 'Kiểm soát chất lượng linh kiện',
            description: 'Nghiệm thu linh kiện hàng nhập PO và thẩm định hàng đổi trả bảo hành RMA',
            children: []
          },
          {
            id: 'dept-delivery',
            name: 'GIAO VẬN (LOGISTICS)',
            code: 'LOG',
            deptKey: 'Giao Vận',
            leader: 'Bùi Thành Long',
            leaderRole: 'Đội Trưởng Giao Vận',
            roleDesc: 'Giao nhận tuyến & Thu hộ COD',
            description: 'Điều phối shipper theo tuyến, xác nhận giao hàng và bàn giao tiền mặt COD',
            children: []
          }
        ]
      }
    ]
  }
];

export default function DepartmentPanel() {
  const { user } = useAuth();
  const { employees, attendanceLogs, leaveRequests, markAttendance } = useHRStore();

  // 1. Quản lý cây phòng ban (lưu vào localStorage để cho phép tùy chỉnh)
  const [deptTree, setDeptTree] = useState(() => {
    try {
      const saved = localStorage.getItem('erp_department_tree');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return DEFAULT_TREE;
  });

  // Lưu cây phòng ban khi thay đổi
  useEffect(() => {
    try {
      localStorage.setItem('erp_department_tree', JSON.stringify(deptTree));
    } catch (_) {}
  }, [deptTree]);

  // Bộ phận mặc định theo vai trò người dùng đăng nhập
  const initialDeptId = useMemo(() => {
    if (user?.role === 'SALES_MANAGER') return 'dept-sales';
    if (user?.role === 'WAREHOUSE_MANAGER') return 'dept-wh';
    if (user?.role === 'HR') return 'dept-hr';
    if (user?.role === 'ACCOUNTANT') return 'dept-kt';
    return 'dept-bgd'; // Mặc định Ban Giám Đốc như hình chụp
  }, [user]);

  const [selectedDeptId, setSelectedDeptId] = useState(initialDeptId);
  const [expandedNodes, setExpandedNodes] = useState({
    'dept-bld': true,
    'dept-backoffice': true,
    'dept-commercial': true,
    'dept-supply-tech': true
  });

  // Tab con trong chi tiết phòng ban: 'attendance' (Chấm công nhân viên cấp dưới - Cốt lõi) | 'members' (Nhân sự) | 'subDepts' (Phòng ban con)
  const [activeSubTab, setActiveSubTab] = useState('attendance');

  // Bộ lọc chấm công của nhân viên cấp dưới
  const [searchQuery, setSearchQuery] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal Sơ đồ tổ chức (Org Chart)
  const [showOrgChartModal, setShowOrgChartModal] = useState(false);

  // Modal Chấm công nhanh / Điều chỉnh cho nhân viên cấp dưới
  const [manualModalEmp, setManualModalEmp] = useState(null);
  const [manualForm, setManualForm] = useState({
    status: 'PRESENT',
    checkIn: '08:00',
    checkOut: '17:30',
    overtimeHours: '0',
    note: ''
  });

  // Modal Xem ảnh chấm công khuôn mặt
  const [photoModalData, setPhotoModalData] = useState(null);

  // Modal Tạo/Sửa phòng ban
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDeptParentId, setEditingDeptParentId] = useState(null);
  const [deptFormData, setDeptFormData] = useState({
    name: '',
    code: '',
    deptKey: '',
    leader: '',
    leaderRole: '',
    roleDesc: '',
    description: ''
  });

  // Toggle thu gọn/mở rộng nút cây
  const toggleNode = (nodeId, e) => {
    e?.stopPropagation();
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  // Tìm node đang chọn trong cây (đệ quy)
  const findNode = (nodes, id) => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children?.length > 0) {
        const found = findNode(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const selectedDept = useMemo(() => {
    return findNode(deptTree, selectedDeptId) || deptTree[0];
  }, [deptTree, selectedDeptId]);

  // Lấy danh sách tất cả các mã phòng ban con (đệ quy)
  const getAllChildDeptKeys = (node) => {
    let keys = [node.deptKey, node.name];
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => {
        keys = [...keys, ...getAllChildDeptKeys(child)];
      });
    }
    return keys;
  };

  // Danh sách nhân sự cấp dưới thuộc phòng ban hiện tại (bao gồm các phòng ban con)
  const subordinateEmployees = useMemo(() => {
    if (!selectedDept) return [];
    const validDeptKeys = getAllChildDeptKeys(selectedDept).map(k => k?.toLowerCase());

    return (employees || []).filter(emp => {
      if (!emp || emp.status === 'INACTIVE') return false;
      const empDept = (emp.department || '').toLowerCase();
      // Nếu phòng ban đang chọn là Ban Giám Đốc, nhân sự cấp dưới có thể là Ban Giám Đốc hoặc CEO
      if (selectedDept.id === 'dept-bgd') {
        return empDept.includes('giám đốc') || emp.role === 'CEO' || emp.role === 'ADMIN';
      }
      return validDeptKeys.some(k => empDept.includes(k) || k.includes(empDept));
    });
  }, [employees, selectedDept]);

  // Tìm Trưởng bộ phận thực tế từ danh sách nhân sự nếu có
  const currentLeaderDisplay = useMemo(() => {
    if (!selectedDept) return 'Chưa bổ nhiệm';
    // Tìm nhân sự có role Manager hoặc chức danh khớp
    const foundManager = subordinateEmployees.find(e =>
      e.role?.includes('MANAGER') ||
      e.role === 'CEO' ||
      e.role === 'HR' ||
      e.jobTitle?.includes('Trưởng') ||
      e.jobTitle?.includes('Quản lý') ||
      e.fullname === selectedDept.leader
    );
    return foundManager ? (foundManager.fullname || foundManager.fullName) : selectedDept.leader || 'Bùi Thành Long';
  }, [subordinateEmployees, selectedDept]);

  // Danh sách chấm công của nhân viên cấp dưới trong ngày được chọn
  const subordinateAttendanceList = useMemo(() => {
    const targetDateFormatted = new Date(attendanceDate).toLocaleDateString('vi-VN', { timeZone: 'UTC' });
    const targetDateIso = attendanceDate;

    return subordinateEmployees.map(emp => {
      // Tìm bản ghi chấm công của nhân viên này trong ngày
      const log = (attendanceLogs || []).find(l => {
        if (!l) return false;
        const matchesEmp = l.empId === emp.id || l.employeeId === emp.id;
        const matchesDate = l.isoDate === targetDateIso || l.date === targetDateFormatted || String(l.date).startsWith(targetDateIso);
        return matchesEmp && matchesDate;
      });

      // Kiểm tra có đơn xin nghỉ phép được duyệt hôm nay không
      const leave = (leaveRequests || []).find(lr => {
        if (!lr || (lr.employeeId !== emp.id && lr.empName !== emp.fullname)) return false;
        if (lr.status !== 'APPROVED') return false;
        const s = new Date(lr.startDate).toISOString().slice(0, 10);
        const e = new Date(lr.endDate).toISOString().slice(0, 10);
        return targetDateIso >= s && targetDateIso <= e;
      });

      let status = 'ABSENT';
      let checkIn = '---';
      let checkOut = '---';
      let workHours = 0;
      let lateMinutes = 0;
      let overtimeHours = 0;
      let method = 'MANUAL';
      let logId = log?.id;

      if (log) {
        status = log.status || 'PRESENT';
        checkIn = log.checkIn || '---';
        checkOut = log.checkOut || '---';
        workHours = Number(log.workHours) || 0;
        lateMinutes = Number(log.lateMinutes) || 0;
        overtimeHours = Number(log.overtimeHours) || 0;
        method = log.checkInMethod || (log.hasPhoto ? 'FACE' : 'MANUAL');
      } else if (leave) {
        status = 'LEAVE';
      }

      return {
        emp,
        logId,
        date: targetDateIso,
        status,
        checkIn,
        checkOut,
        workHours,
        lateMinutes,
        overtimeHours,
        method,
        hasPhoto: Boolean(log?.hasPhoto),
        leaveReason: leave?.reason
      };
    }).filter(item => {
      // Lọc theo từ khóa tìm kiếm
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.emp.fullname?.toLowerCase().includes(q);
        const matchesCode = (item.emp.employeeCode || `EMP-${item.emp.id}`)?.toLowerCase().includes(q);
        const matchesRole = item.emp.role?.toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesRole) return false;
      }
      // Lọc theo trạng thái
      if (statusFilter !== 'ALL') {
        if (item.status !== statusFilter) return false;
      }
      return true;
    });
  }, [subordinateEmployees, attendanceLogs, leaveRequests, attendanceDate, searchQuery, statusFilter]);

  // Thống kê nhanh chuyên cần của phòng ban hôm nay
  const attendanceStats = useMemo(() => {
    const total = subordinateEmployees.length;
    const present = subordinateAttendanceList.filter(a => a.status === 'PRESENT').length;
    const late = subordinateAttendanceList.filter(a => a.status === 'LATE').length;
    const absent = subordinateAttendanceList.filter(a => a.status === 'ABSENT').length;
    const leave = subordinateAttendanceList.filter(a => a.status === 'LEAVE').length;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    return { total, present, late, absent, leave, rate };
  }, [subordinateEmployees, subordinateAttendanceList]);

  // Xử lý gửi biểu mẫu chấm công thủ công cho nhân viên cấp dưới
  const handleSaveManualAttendance = async (e) => {
    e.preventDefault();
    if (!manualModalEmp) return;

    try {
      await markAttendance(
        manualModalEmp.emp.id,
        manualForm.status,
        attendanceDate,
        manualForm.checkIn,
        manualForm.checkOut,
        manualForm.note
      );
      notify(`Đã cập nhật chấm công cho ${manualModalEmp.emp.fullname} ngày ${attendanceDate}`, 'success');
      setManualModalEmp(null);
    } catch (err) {
      notify(err.message || 'Không thể lưu bản ghi chấm công.', 'error');
    }
  };

  // Mở modal xem ảnh chấm công
  const handleViewPhoto = async (logId, empName) => {
    if (!logId) {
      notify('Bản ghi này chưa có dữ liệu ảnh chấm công.', 'info');
      return;
    }
    try {
      const res = await api.get(`/hr/attendance/${logId}/photos`);
      if (res?.success && (res.data?.checkInPhoto || res.data?.registeredFace)) {
        setPhotoModalData({
          empName,
          checkInPhoto: res.data.checkInPhoto,
          checkOutPhoto: res.data.checkOutPhoto,
          registeredFace: res.data.registeredFace
        });
      } else {
        notify('Không tìm thấy hình ảnh xác thực khuôn mặt.', 'warning');
      }
    } catch (err) {
      notify('Không thể tải ảnh chấm công.', 'error');
    }
  };

  // Xử lý thêm phòng ban con mới
  const handleAddSubDept = () => {
    setEditingDeptParentId(selectedDept.id);
    setDeptFormData({
      name: '',
      code: '',
      deptKey: '',
      leader: '',
      leaderRole: '',
      roleDesc: '',
      description: ''
    });
    setShowDeptModal(true);
  };

  const handleSaveNewDepartment = (e) => {
    e.preventDefault();
    if (!deptFormData.name.trim()) {
      notify('Vui lòng nhập tên phòng ban.', 'error');
      return;
    }

    const newDept = {
      id: `dept-${Date.now()}`,
      name: deptFormData.name.toUpperCase(),
      code: deptFormData.code || deptFormData.name.slice(0, 4).toUpperCase(),
      deptKey: deptFormData.deptKey || deptFormData.name,
      leader: deptFormData.leader || 'Chưa bổ nhiệm',
      leaderRole: deptFormData.leaderRole || 'Trưởng Bộ Phận',
      roleDesc: deptFormData.roleDesc || 'Bộ phận chuyên môn',
      description: deptFormData.description || 'Bộ phận trực thuộc doanh nghiệp',
      children: []
    };

    // Đệ quy thêm vào node cha
    const addNodeRecursive = (nodes) => {
      return nodes.map(n => {
        if (n.id === editingDeptParentId) {
          return { ...n, children: [...(n.children || []), newDept] };
        }
        if (n.children?.length > 0) {
          return { ...n, children: addNodeRecursive(n.children) };
        }
        return n;
      });
    };

    if (editingDeptParentId === 'root') {
      setDeptTree(prev => [...prev, newDept]);
    } else {
      setDeptTree(prev => addNodeRecursive(prev));
    }

    notify(`Đã thêm phòng ban "${newDept.name}" thành công!`, 'success');
    setShowDeptModal(false);
  };

  // Component đệ quy hiển thị từng node cây phòng ban (Tree Node)
  const renderTreeNode = (node, depth = 0) => {
    const isSelected = selectedDeptId === node.id;
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = Boolean(expandedNodes[node.id]);

    return (
      <div key={node.id} style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          onClick={() => setSelectedDeptId(node.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.45rem 0.65rem',
            paddingLeft: `${0.65 + depth * 1.25}rem`,
            borderRadius: '6px',
            backgroundColor: isSelected ? '#e0f2fe' : 'transparent',
            color: isSelected ? '#0284c7' : '#334155',
            fontWeight: isSelected ? 700 : 500,
            fontSize: '0.82rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            border: isSelected ? '1px solid #bae6fd' : '1px solid transparent',
            marginBottom: '2px'
          }}
          onMouseEnter={(e) => {
            if (!isSelected) e.currentTarget.style.backgroundColor = '#f1f5f9';
          }}
          onMouseLeave={(e) => {
            if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0, flex: 1 }}>
            {hasChildren ? (
              <span
                onClick={(e) => toggleNode(node.id, e)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  color: isSelected ? '#0284c7' : '#64748b'
                }}
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            ) : (
              <span style={{ width: '14px', height: '14px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: isSelected ? '#0284c7' : '#94a3b8' }} />
              </span>
            )}

            <Building size={15} style={{ color: isSelected ? '#0284c7' : '#64748b', flexShrink: 0 }} />
            <span style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              letterSpacing: '-0.01em'
            }}>
              {node.name}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                notify(`Phòng ban: ${node.name} (${node.code})`, 'info');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: isSelected ? '#0284c7' : '#94a3b8',
                cursor: 'pointer',
                padding: '2px 4px',
                borderRadius: '4px',
                display: 'inline-flex',
                alignItems: 'center'
              }}
              title="Tùy chọn phòng ban"
            >
              <MoreHorizontal size={14} />
            </button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {node.children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontFamily: 'inherit' }}>

      {/* ========================================================================= */}
      {/* 1. HEADER CHÍNH CỦA MỤC QUẢN LÝ PHÒNG BAN (GIỐNG HÌNH CHỤP) */}
      {/* ========================================================================= */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            Quản lý phòng ban
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.84rem', margin: '0.35rem 0 0' }}>
            Theo dõi cấu trúc phòng ban theo cây và quản lý chi tiết ngay trên cùng một màn hình.
          </p>
        </div>

        {/* Nút Xem Sơ Đồ Cây Tổ Chức Toàn Doanh Nghiệp (Top Right Action) */}
        <button
          type="button"
          onClick={() => setShowOrgChartModal(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            backgroundColor: '#0284c7',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '0.55rem 0.85rem',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)',
            transition: 'background 0.2s'
          }}
          title="Xem sơ đồ tổ chức toàn công ty"
        >
          <Network size={18} />
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 2. LAYOUT 2 CỘT CHÍNH: CÂY PHÒNG BAN (BÊN TRÁI) + CHI TIẾT (BÊN PHẢI) */}
      {/* ========================================================================= */}
      <div style={{ display: 'grid', gridTemplateColumns: '310px 1fr', gap: '1.25rem', alignItems: 'start' }}>

        {/* ──────────────── CỘT TRÁI: CÂY PHÒNG BAN (TREE VIEW) ──────────────── */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '1rem',
          boxShadow: '0 1px 4px rgba(15, 23, 42, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          minHeight: '620px'
        }}>
          {/* Header Cây: Tên Công Ty + Nút Thêm Phòng Ban */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#e0f2fe',
            border: '1px solid #bae6fd',
            borderRadius: '8px',
            padding: '0.65rem 0.85rem',
            color: '#0284c7',
            fontWeight: 800,
            fontSize: '0.82rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building size={16} />
              <span>SRT MIỀN TRUNG</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingDeptParentId('root');
                setDeptFormData({ name: '', code: '', deptKey: '', leader: '', leaderRole: '', roleDesc: '', description: '' });
                setShowDeptModal(true);
              }}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: '#0284c7',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2px',
                borderRadius: '4px'
              }}
              title="Thêm phòng ban mới"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Danh sách các Node cây phòng ban */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto', maxHeight: '720px' }}>
            {deptTree.map(node => renderTreeNode(node, 0))}
          </div>
        </div>

        {/* ──────────────── CỘT PHẢI: CHI TIẾT & CHẤM CÔNG CẤP DƯỚI ──────────────── */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '1.25rem 1.5rem',
          boxShadow: '0 1px 4px rgba(15, 23, 42, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.1rem'
        }}>

          {/* 2.1 Tiêu đề phòng ban đang chọn */}
          <div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>
              {selectedDept?.name}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '0.25rem 0 0' }}>
              Theo dõi nhanh thông tin chính và cơ cấu cấp dưới của phòng ban này.
            </p>
          </div>

          {/* 2.2 Thanh Pills tóm tắt thông tin: Trưởng bộ phận, Phòng ban con, Tổng nhân sự (Y như ảnh) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.75rem',
            padding: '0.65rem 1.15rem',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '999px',
            fontSize: '0.82rem',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ color: '#64748b' }}>Trưởng bộ phận:</span>
              <strong style={{ color: '#0f172a' }}>{currentLeaderDisplay}</strong>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Building size={15} style={{ color: '#0284c7' }} />
              <span style={{ color: '#64748b' }}>Phòng ban con:</span>
              <strong style={{ color: '#0f172a' }}>{selectedDept?.children?.length || 0}</strong>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Users size={15} style={{ color: '#16a34a' }} />
              <span style={{ color: '#64748b' }}>Tổng nhân sự:</span>
              <strong style={{ color: '#0f172a' }}>{subordinateEmployees.length}</strong>
            </div>
          </div>

          {/* 2.3 THANH ĐIỀU HƯỚNG TÍNH NĂNG CON: CHẤM CÔNG CẤP DƯỚI (MỤC TIÊU CHÍNH) | DANH SÁCH NHÂN SỰ | CƠ CẤU CON */}
          <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.65rem' }}>
            <button
              type="button"
              onClick={() => setActiveSubTab('attendance')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.95rem',
                borderRadius: '6px',
                border: activeSubTab === 'attendance' ? 'none' : '1px solid #e2e8f0',
                backgroundColor: activeSubTab === 'attendance' ? '#0284c7' : '#ffffff',
                color: activeSubTab === 'attendance' ? '#ffffff' : '#475569',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: activeSubTab === 'attendance' ? '0 2px 4px rgba(2, 132, 199, 0.2)' : 'none'
              }}
            >
              <Clock size={15} />
              <span>Chấm Công Của Nhân Viên Cấp Dưới</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('members')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.95rem',
                borderRadius: '6px',
                border: activeSubTab === 'members' ? 'none' : '1px solid #e2e8f0',
                backgroundColor: activeSubTab === 'members' ? '#0284c7' : '#ffffff',
                color: activeSubTab === 'members' ? '#ffffff' : '#475569',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: activeSubTab === 'members' ? '0 2px 4px rgba(2, 132, 199, 0.2)' : 'none'
              }}
            >
              <Users size={15} />
              <span>Danh Sách Nhân Sự ({subordinateEmployees.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('subDepts')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.95rem',
                borderRadius: '6px',
                border: activeSubTab === 'subDepts' ? 'none' : '1px solid #e2e8f0',
                backgroundColor: activeSubTab === 'subDepts' ? '#0284c7' : '#ffffff',
                color: activeSubTab === 'subDepts' ? '#ffffff' : '#475569',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: activeSubTab === 'subDepts' ? '0 2px 4px rgba(2, 132, 199, 0.2)' : 'none'
              }}
            >
              <Building size={15} />
              <span>Phòng Ban Cấp Dưới ({selectedDept?.children?.length || 0})</span>
            </button>
          </div>

          {/* 2.4 THANH CÔNG CỤ TÌM KIẾM & NÚT THAO TÁC (GIỐNG HÌNH CHỤP) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, maxWidth: '420px' }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Tìm kiếm..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.75rem 0.45rem 2.2rem',
                    borderRadius: '8px',
                    border: '1px solid #e3e8ef',
                    fontSize: '0.82rem',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Cụm nút hành động bên phải: "+" và "Diagram" */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              {activeSubTab === 'attendance' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Ngày:</span>
                  <input
                    type="date"
                    value={attendanceDate}
                    onChange={(e) => setAttendanceDate(e.target.value)}
                    style={{
                      padding: '0.4rem 0.65rem',
                      borderRadius: '6px',
                      border: '1px solid #e3e8ef',
                      fontSize: '0.8rem',
                      color: '#0f172a'
                    }}
                  />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{
                      padding: '0.4rem 0.65rem',
                      borderRadius: '6px',
                      border: '1px solid #e3e8ef',
                      fontSize: '0.8rem',
                      color: '#0f172a',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    <option value="ALL">Tất cả trạng thái</option>
                    <option value="PRESENT">Có mặt</option>
                    <option value="LATE">Đi muộn</option>
                    <option value="ABSENT">Vắng mặt</option>
                    <option value="LEAVE">Nghỉ phép</option>
                  </select>
                </div>
              )}

              <button
                type="button"
                onClick={handleAddSubDept}
                style={{
                  width: '34px',
                  height: '34px',
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)'
                }}
                title="Thêm phòng ban trực thuộc"
              >
                <Plus size={16} />
              </button>

              <button
                type="button"
                onClick={() => setShowOrgChartModal(true)}
                style={{
                  width: '34px',
                  height: '34px',
                  backgroundColor: '#f8fafc',
                  color: '#0284c7',
                  border: '1px solid #e3e8ef',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
                title="Xem sơ đồ phân cấp"
              >
                <Network size={16} />
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: CHẤM CÔNG CỦA NHÂN VIÊN CẤP DƯỚI (SUBORDINATE ATTENDANCE) */}
          {/* ========================================================================= */}
          {activeSubTab === 'attendance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

              {/* Thẻ KPI chuyên cần nhanh của phòng ban hôm nay */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.65rem 0.85rem' }}>
                  <div style={{ fontSize: '0.77rem', color: '#16a34a', fontWeight: 700 }}>CÓ MẶT</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#15803d', marginTop: '0.2rem' }}>
                    {attendanceStats.present} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>/ {attendanceStats.total}</span>
                  </div>
                </div>

                <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', padding: '0.65rem 0.85rem' }}>
                  <div style={{ fontSize: '0.77rem', color: '#d97706', fontWeight: 700 }}>ĐI MUỘN</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#b45309', marginTop: '0.2rem' }}>
                    {attendanceStats.late}
                  </div>
                </div>

                <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.65rem 0.85rem' }}>
                  <div style={{ fontSize: '0.77rem', color: '#dc2626', fontWeight: 700 }}>VẮNG MẶT</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#b91c1c', marginTop: '0.2rem' }}>
                    {attendanceStats.absent}
                  </div>
                </div>

                <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.65rem 0.85rem' }}>
                  <div style={{ fontSize: '0.77rem', color: '#2563eb', fontWeight: 700 }}>TỶ LỆ CHUYÊN CẦN</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1d4ed8', marginTop: '0.2rem' }}>
                    {attendanceStats.rate}%
                  </div>
                </div>
              </div>

              {/* Bảng chấm công chi tiết của nhân viên cấp dưới */}
              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Nhân Viên Cấp Dưới</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Vào Ca (Check-in)</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Ra Ca (Check-out)</th>
                      <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Số Giờ Làm</th>
                      <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Trạng Thái</th>
                      <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Thao Tác Quản Lý</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subordinateAttendanceList.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
                          Phòng ban này hiện chưa có nhân sự cấp dưới hoặc không có dữ liệu chấm công ngày này.
                        </td>
                      </tr>
                    ) : (
                      subordinateAttendanceList.map((item, idx) => {
                        const statusObj = getStatusInfo(ATTENDANCE_STATUS, item.status);
                        const isLate = item.status === 'LATE' || item.lateMinutes > 0;

                        return (
                          <tr key={item.emp.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.65rem 0.85rem' }}>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>
                                {item.emp.fullname || item.emp.fullName}
                              </div>
                              <div style={{ fontSize: '0.77rem', color: '#64748b', marginTop: '2px' }}>
                                {item.emp.employeeCode || `EMP-${item.emp.id}`} · {getRoleName(item.emp.role)}
                              </div>
                            </td>

                            <td style={{ padding: '0.65rem 0.85rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span style={{ fontWeight: 600, color: item.checkIn !== '---' ? '#0f172a' : '#94a3b8' }}>
                                  {item.checkIn}
                                </span>
                                {item.method === 'FACE' && (
                                  <span style={{ fontSize: '0.74rem', backgroundColor: '#e0f2fe', color: '#0284c7', padding: '1px 4px', borderRadius: '4px', fontWeight: 700 }}>
                                    Khuôn mặt
                                  </span>
                                )}
                              </div>
                              {isLate && (
                                <div style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 600 }}>
                                  Trễ {item.lateMinutes || 15}p
                                </div>
                              )}
                            </td>

                            <td style={{ padding: '0.65rem 0.85rem' }}>
                              <span style={{ fontWeight: 600, color: item.checkOut !== '---' ? '#0f172a' : '#94a3b8' }}>
                                {item.checkOut}
                              </span>
                            </td>

                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                              <span style={{ fontWeight: 700, color: '#2563eb' }}>
                                {item.workHours > 0 ? `${item.workHours}h` : '---'}
                              </span>
                              {item.overtimeHours > 0 && (
                                <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>
                                  OT: +{item.overtimeHours}h
                                </div>
                              )}
                            </td>

                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: '12px',
                                fontSize: '0.77rem',
                                fontWeight: 800,
                                backgroundColor: statusObj.bg,
                                color: statusObj.color
                              }}>
                                {item.status === 'LEAVE' ? 'Nghỉ phép' : getStatusLabel(ATTENDANCE_STATUS, item.status)}
                              </span>
                            </td>

                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                                {item.hasPhoto && (
                                  <button
                                    type="button"
                                    onClick={() => handleViewPhoto(item.logId, item.emp.fullname)}
                                    style={{
                                      backgroundColor: '#eff6ff',
                                      color: '#2563eb',
                                      border: '1px solid #bfdbfe',
                                      borderRadius: '4px',
                                      padding: '0.25rem 0.5rem',
                                      fontSize: '0.77rem',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.2rem'
                                    }}
                                    title="Xem ảnh chấm công"
                                  >
                                    <Camera size={13} />
                                    <span>Ảnh</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setManualModalEmp(item);
                                    setManualForm({
                                      status: item.status === 'LEAVE' ? 'PRESENT' : item.status,
                                      checkIn: item.checkIn !== '---' ? item.checkIn : '08:00',
                                      checkOut: item.checkOut !== '---' ? item.checkOut : '17:30',
                                      overtimeHours: String(item.overtimeHours || 0),
                                      note: ''
                                    });
                                  }}
                                  style={{
                                    backgroundColor: '#f8fafc',
                                    color: '#475569',
                                    border: '1px solid #e3e8ef',
                                    borderRadius: '4px',
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.77rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.2rem'
                                  }}
                                  title="Điều chỉnh hoặc duyệt công thủ công"
                                >
                                  <Edit2 size={13} />
                                  <span>Duyệt công</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: DANH SÁCH NHÂN SỰ CẤP DƯỚI (MEMBERS) */}
          {/* ========================================================================= */}
          {activeSubTab === 'members' && (
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Mã NV & Họ Tên</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Chức Vụ / Vai Trò</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Phòng Ban Trực Thuộc</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Thông Tin Liên Hệ</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Trạng Thái</th>
                  </tr>
                </thead>
                <tbody>
                  {subordinateEmployees.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
                        Chưa có nhân viên nào trực thuộc phòng ban này.
                      </td>
                    </tr>
                  ) : (
                    subordinateEmployees.map((emp, eIdx) => (
                      <tr key={emp.id || eIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{emp.fullname || emp.fullName}</div>
                          <div style={{ fontSize: '0.77rem', color: '#64748b' }}>{emp.employeeCode || `EMP-${emp.id}`}</div>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#2563eb' }}>
                          {emp.jobTitle || getRoleName(emp.role)}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>
                          {emp.department || selectedDept.name}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', fontSize: '0.8rem', color: '#64748b' }}>
                          <div>{emp.email || `${emp.username}@aetherpc.com`}</div>
                          <div>{emp.phone || 'Chưa cập nhật SĐT'}</div>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            backgroundColor: emp.status === 'ACTIVE' ? '#dcfce7' : '#fee2e2',
                            color: emp.status === 'ACTIVE' ? '#16a34a' : '#ef4444'
                          }}>
                            {emp.status === 'ACTIVE' ? 'Đang làm việc' : 'Nghỉ việc'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: PHÒNG BAN CẤP DƯỚI (GIỐNG NGUYÊN BẢN HÌNH CHỤP CỦA NGƯỜI DÙNG) */}
          {/* ========================================================================= */}
          {activeSubTab === 'subDepts' && (
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#0f172a' }}>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 700, width: '40%' }}>Tên phòng ban</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 700, width: '35%' }}>Vai trò</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 700, textAlign: 'center', width: '25%' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {(!selectedDept?.children || selectedDept.children.length === 0) ? (
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#64748b', fontSize: '0.85rem' }}>
                        Phòng ban này chưa có phòng ban cấp dưới.
                      </td>
                    </tr>
                  ) : (
                    selectedDept.children.map((sub, sIdx) => (
                      <tr key={sub.id || sIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: '#0f172a' }}>
                            <Building size={16} style={{ color: '#0284c7' }} />
                            <span>{sub.name}</span>
                          </div>
                          <div style={{ fontSize: '0.77rem', color: '#64748b', marginLeft: '1.5rem', marginTop: '2px' }}>
                            Trưởng bộ phận: {sub.leader}
                          </div>
                        </td>

                        <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>
                          {sub.roleDesc || sub.description || 'Bộ phận chuyên môn'}
                        </td>

                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedDeptId(sub.id)}
                            style={{
                              backgroundColor: '#e0f2fe',
                              color: '#0284c7',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '0.35rem 0.75rem',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            Xem chi tiết →
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MODAL SƠ ĐỒ CÂY TỔ CHỨC (INTERACTIVE ORG CHART) */}
      {/* ========================================================================= */}
      {showOrgChartModal && (
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
          zIndex: 9999,
          padding: '1.5rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            maxWidth: '920px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Network size={20} style={{ color: '#0284c7' }} />
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                  Sơ Đồ Cơ Cấu Tổ Chức Doanh Nghiệp (Org Chart)
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowOrgChartModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
                {/* Root Box */}
                <div style={{
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '10px',
                  textAlign: 'center',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  boxShadow: '0 4px 6px rgba(2, 132, 199, 0.25)'
                }}>
                  <div>CÔNG TY CỔ PHẦN AETHERPC ERP</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 500, opacity: 0.9 }}>Tổng nhân sự: {employees?.length || 0} cán bộ nhân viên</div>
                </div>

                <div style={{ width: '2px', height: '24px', backgroundColor: '#cbd5e1' }} />

                {/* Level 1: Ban Giám Đốc & Ban Lãnh Đạo */}
                <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {deptTree.map(rootNode => (
                    <div
                      key={rootNode.id}
                      onClick={() => {
                        setSelectedDeptId(rootNode.id);
                        setShowOrgChartModal(false);
                      }}
                      style={{
                        backgroundColor: '#ffffff',
                        border: selectedDeptId === rootNode.id ? '2px solid #0284c7' : '1px solid #e3e8ef',
                        borderRadius: '8px',
                        padding: '0.75rem 1.1rem',
                        minWidth: '220px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(15, 23, 42, 0.05)'
                      }}
                    >
                      <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.85rem' }}>{rootNode.name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#2563eb', marginTop: '2px', fontWeight: 600 }}>{rootNode.leader}</div>
                      <div style={{ fontSize: '0.77rem', color: '#64748b' }}>{rootNode.roleDesc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid #e2e8f0', textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => setShowOrgChartModal(false)}
                style={{
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.45rem 1rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODAL DUYỆT CÔNG / CHẤM CÔNG THỦ CÔNG CHO NHÂN VIÊN CẤP DƯỚI */}
      {/* ========================================================================= */}
      {manualModalEmp && (
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
          zIndex: 9999,
          padding: '1.5rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            maxWidth: '460px',
            width: '100%',
            overflow: 'hidden',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={18} style={{ color: '#0284c7' }} />
                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a' }}>
                  Duyệt Chấm Công Nhân Viên Cấp Dưới
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setManualModalEmp(null)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveManualAttendance} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ padding: '0.65rem 0.85rem', backgroundColor: '#f8fafc', borderRadius: '6px', fontSize: '0.8rem' }}>
                <div>Nhân viên: <strong style={{ color: '#0f172a' }}>{manualModalEmp.emp.fullname}</strong></div>
                <div style={{ color: '#64748b', marginTop: '2px' }}>Ngày: <strong>{attendanceDate}</strong></div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Trạng Thái Chuyên Cần
                </label>
                <select
                  value={manualForm.status}
                  onChange={(e) => setManualForm(p => ({ ...p, status: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #e3e8ef', fontSize: '0.82rem' }}
                >
                  <option value="PRESENT">Có Mặt (Đủ công)</option>
                  <option value="LATE">Đi Muộn</option>
                  <option value="ABSENT">Vắng Mặt (Không phép)</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Giờ Vào Ca
                  </label>
                  <input
                    type="time"
                    value={manualForm.checkIn}
                    onChange={(e) => setManualForm(p => ({ ...p, checkIn: e.target.value }))}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #e3e8ef', fontSize: '0.82rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Giờ Ra Ca
                  </label>
                  <input
                    type="time"
                    value={manualForm.checkOut}
                    onChange={(e) => setManualForm(p => ({ ...p, checkOut: e.target.value }))}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #e3e8ef', fontSize: '0.82rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Giờ Tăng Ca (OT)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="12"
                  value={manualForm.overtimeHours}
                  onChange={(e) => setManualForm(p => ({ ...p, overtimeHours: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #e3e8ef', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Ghi Chú Phê Duyệt Của Quản Lý
                </label>
                <textarea
                  rows="2"
                  placeholder="Lý do điều chỉnh (đi công tác, giải trình quên check-in...)"
                  value={manualForm.note}
                  onChange={(e) => setManualForm(p => ({ ...p, note: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #e3e8ef', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setManualModalEmp(null)}
                  style={{ padding: '0.45rem 0.95rem', borderRadius: '6px', border: '1px solid #e3e8ef', backgroundColor: '#ffffff', color: '#475569', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={{ padding: '0.45rem 0.95rem', borderRadius: '6px', border: 'none', backgroundColor: '#0284c7', color: '#ffffff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Xác Nhận & Lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MODAL XEM ẢNH CHECK-IN CHẤM CÔNG */}
      {/* ========================================================================= */}
      {photoModalData && (
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
          zIndex: 9999,
          padding: '1.5rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            maxWidth: '520px',
            width: '100%',
            overflow: 'hidden',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Camera size={18} style={{ color: '#0284c7' }} />
                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a' }}>
                  Ảnh Chấm Công: {photoModalData.empName}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setPhotoModalData(null)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.25rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              {photoModalData.checkInPhoto && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>Ảnh Vào Ca</div>
                  <img
                    src={photoModalData.checkInPhoto}
                    alt="Check-in Photo"
                    style={{ width: '180px', height: '180px', objectFit: 'cover', borderRadius: '8px', border: '2px solid #e2e8f0' }}
                  />
                </div>
              )}

              {photoModalData.registeredFace && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>Ảnh Đăng Ký Gốc</div>
                  <img
                    src={photoModalData.registeredFace}
                    alt="Registered Face"
                    style={{ width: '180px', height: '180px', objectFit: 'cover', borderRadius: '8px', border: '2px solid #bbf7d0' }}
                  />
                </div>
              )}
            </div>

            <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid #e2e8f0', textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => setPhotoModalData(null)}
                style={{ padding: '0.45rem 1rem', borderRadius: '6px', border: 'none', backgroundColor: '#f1f5f9', color: '#475569', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL THÊM PHÒNG BAN TRỰC THUỘC */}
      {/* ========================================================================= */}
      {showDeptModal && (
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
          zIndex: 9999,
          padding: '1.5rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            maxWidth: '480px',
            width: '100%',
            overflow: 'hidden',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Building size={18} style={{ color: '#0284c7' }} />
                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a' }}>
                  Thêm Phòng Ban Trực Thuộc Mới
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowDeptModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveNewDepartment} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Tên Phòng Ban (*)
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: PHÒNG KỸ THUẬT BẢO HÀNH"
                  value={deptFormData.name}
                  onChange={(e) => setDeptFormData(p => ({ ...p, name: e.target.value }))}
                  required
                  style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #e3e8ef', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Mã Phòng Ban
                  </label>
                  <input
                    type="text"
                    placeholder="KT-BH"
                    value={deptFormData.code}
                    onChange={(e) => setDeptFormData(p => ({ ...p, code: e.target.value }))}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #e3e8ef', fontSize: '0.82rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Trưởng Bộ Phận
                  </label>
                  <input
                    type="text"
                    placeholder="Nguyễn Văn A"
                    value={deptFormData.leader}
                    onChange={(e) => setDeptFormData(p => ({ ...p, leader: e.target.value }))}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #e3e8ef', fontSize: '0.82rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Vai Trò / Chức Năng
                </label>
                <input
                  type="text"
                  placeholder="Tiếp nhận thẩm định và xử lý bảo hành RMA"
                  value={deptFormData.roleDesc}
                  onChange={(e) => setDeptFormData(p => ({ ...p, roleDesc: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #e3e8ef', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowDeptModal(false)}
                  style={{ padding: '0.45rem 0.95rem', borderRadius: '6px', border: '1px solid #e3e8ef', backgroundColor: '#ffffff', color: '#475569', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={{ padding: '0.45rem 0.95rem', borderRadius: '6px', border: 'none', backgroundColor: '#0284c7', color: '#ffffff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Tạo Phòng Ban
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
