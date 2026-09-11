import React, { useState, useEffect, useRef } from 'react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useSalesStore } from '../../stores';
import { useNotification, confirm } from '../../context/NotificationContext';
import { 
  ShoppingCart, ShoppingBag, Trash2, ArrowLeft, CreditCard, Sparkles, 
  MapPin, User, Phone, Lock, LogIn, UserPlus, CheckCircle, 
  ShieldCheck, Truck, RotateCcw, AlertCircle, Copy, Check, QrCode, Banknote, Mail,
  ChevronDown, Search
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

const VIETNAM_PROVINCES = [
  { id: 'HN', name: 'Thành phố Hà Nội', districts: ['Quận Ba Đình', 'Quận Hoàn Kiếm', 'Quận Tây Hồ', 'Quận Long Biên', 'Quận Cầu Giấy', 'Quận Đống Đa', 'Quận Hai Bà Trưng', 'Quận Hoàng Mai', 'Quận Thanh Xuân', 'Quận Hà Đông', 'Quận Nam Từ Liêm', 'Quận Bắc Từ Liêm', 'Thị xã Sơn Tây', 'Huyện Đông Anh', 'Huyện Gia Lâm', 'Huyện Thanh Trì', 'Huyện Mê Linh', 'Huyện Sóc Sơn', 'Huyện Ba Vì', 'Huyện Thạch Thất', 'Huyện Hoài Đức', 'Huyện Quốc Oai', 'Huyện Chương Mỹ', 'Huyện Thường Tín', 'Huyện Phú Xuyên', 'Huyện Ứng Hòa', 'Huyện Mỹ Đức', 'Huyện Đan Phượng', 'Huyện Phúc Thọ', 'Huyện Thanh Oai'] },
  { id: 'HCM', name: 'Thành phố Hồ Chí Minh (gồm TP.HCM, Bình Dương, Bà Rịa - Vũng Tàu)', districts: ['TP. Thủ Đức', 'Quận 1', 'Quận 3', 'Quận 4', 'Quận 5', 'Quận 6', 'Quận 7', 'Quận 8', 'Quận 10', 'Quận 11', 'Quận 12', 'Quận Bình Thạnh', 'Quận Tân Bình', 'Quận Tân Phú', 'Quận Phú Nhuận', 'Quận Gò Vấp', 'Quận Bình Tân', 'TP. Thủ Dầu Một', 'TP. Dĩ An', 'TP. Thuận An', 'TP. Tân Uyên', 'TP. Bến Cát', 'TP. Vũng Tàu', 'TP. Bà Rịa', 'Thị xã Phú Mỹ', 'Huyện Bình Chánh', 'Huyện Củ Chi', 'Huyện Hóc Môn', 'Huyện Nhà Bè', 'Huyện Cần Giờ', 'Huyện Bàu Bàng', 'Huyện Phú Giáo', 'Huyện Châu Đức', 'Huyện Xuyên Mộc'] },
  { id: 'HP', name: 'Thành phố Hải Phòng (gồm Hải Phòng, Hải Dương)', districts: ['Quận Hồng Bàng', 'Quận Ngô Quyền', 'Quận Lê Chân', 'Quận Kiến An', 'Quận Hải An', 'Quận Dương Kinh', 'Quận Đồ Sơn', 'TP. Thủy Nguyên', 'Quận An Dương', 'TP. Hải Dương', 'TP. Chí Linh', 'Thị xã Kinh Môn', 'Huyện Tiên Lãng', 'Huyện Vĩnh Bảo', 'Huyện Kiến Thụy', 'Huyện An Lão', 'Huyện Cát Hải', 'Huyện Bình Giang', 'Huyện Cẩm Giàng', 'Huyện Nam Sách'] },
  { id: 'DN', name: 'Thành phố Đà Nẵng (gồm Đà Nẵng, Quảng Nam)', districts: ['Quận Hải Châu', 'Quận Thanh Khê', 'Quận Sơn Trà', 'Quận Ngũ Hành Sơn', 'Quận Liên Chiểu', 'Quận Cẩm Lệ', 'TP. Tam Kỳ', 'TP. Hội An', 'Thị xã Điện Bàn', 'Huyện Hòa Vàng', 'Huyện Đại Lộc', 'Huyện Duy Xuyên', 'Huyện Núi Thành', 'Huyện Thăng Bình', 'Huyện Hoàng Sa'] },
  { id: 'CT', name: 'Thành phố Cần Thơ (gồm Cần Thơ, Sóc Trăng, Hậu Giang)', districts: ['Quận Ninh Kiều', 'Quận Bình Thủy', 'Quận Cái Răng', 'Quận Ô Môn', 'Quận Thốt Nốt', 'TP. Sóc Trăng', 'TP. Vị Thanh', 'TP. Ngã Bảy', 'Thị xã Ngã Năm', 'Thị xã Vĩnh Châu', 'Thị xã Long Mỹ', 'Huyện Phong Điền', 'Huyện Thới Lai', 'Huyện Cờ Đỏ', 'Huyện Vĩnh Thạnh', 'Huyện Phụng Hiệp', 'Huyện Mỹ Xuyên'] },
  { id: 'HUE', name: 'Thành phố Huế', districts: ['Quận Thuận Hóa', 'Quận Phú Xuân', 'Thị xã Hương Thủy', 'Thị xã Hương Trà', 'Thị xã Phong Điền', 'Huyện Phú Lộc', 'Huyện Phú Vàng', 'Huyện Quảng Điền', 'Huyện A Lưới'] },
  { id: 'TQ', name: 'Tỉnh Tuyên Quang (gồm Tuyên Quang, Hà Giang)', districts: ['TP. Tuyên Quang', 'TP. Hà Giang', 'Huyện Bắc Quang', 'Huyện Đồng Văn', 'Huyện Hoàng Su Phì', 'Huyện Mèo Vạc', 'Huyện Vị Xuyên', 'Huyện Chiêm Hóa', 'Huyện Hàm Yên', 'Huyện Sơn Dương', 'Huyện Yên Sơn'] },
  { id: 'LC', name: 'Tỉnh Lào Cai (gồm Lào Cai, Yên Bái)', districts: ['TP. Lào Cai', 'TP. Yên Bái', 'Thị xã Sa Pa', 'Thị xã Nghĩa Lộ', 'Huyện Bắc Hà', 'Huyện Bảo Thắng', 'Huyện Bát Xát', 'Huyện Lục Yên', 'Huyện Trấn Yên', 'Huyện Văn Chấn', 'Huyện Yên Bình'] },
  { id: 'TN', name: 'Tỉnh Thái Nguyên (gồm Thái Nguyên, Bắc Kạn)', districts: ['TP. Thái Nguyên', 'TP. Bắc Kạn', 'TP. Phổ Yên', 'TP. Sông Công', 'Huyện Ba Bể', 'Huyện Bạch Thông', 'Huyện Chợ Đồn', 'Huyện Na Rì', 'Huyện Đại Từ', 'Huyện Phú Bình', 'Huyện Phú Lương'] },
  { id: 'PT', name: 'Tỉnh Phú Thọ (gồm Phú Thọ, Vĩnh Phúc, Hòa Bình)', districts: ['TP. Việt Trì', 'TP. Vĩnh Yên', 'TP. Hòa Bình', 'Thị xã Phú Thọ', 'TP. Phúc Yên', 'Huyện Cẩm Khê', 'Huyện Đoan Hùng', 'Huyện Lâm Thao', 'Huyện Phù Ninh', 'Huyện Cao Phong', 'Huyện Lương Sơn', 'Huyện Mai Châu', 'Huyện Tân Lạc', 'Huyện Bình Xuyên', 'Huyện Vĩnh Tường'] },
  { id: 'BN', name: 'Tỉnh Bắc Ninh (gồm Bắc Ninh, Bắc Giang)', districts: ['TP. Bắc Ninh', 'TP. Từ Sơn', 'TP. Bắc Giang', 'Thị xã Quế Võ', 'Thị xã Thuận Thành', 'Thị xã Việt Yên', 'Huyện Hiệp Hòa', 'Huyện Tiên Du', 'Huyện Yên Phong', 'Huyện Lạng Giang', 'Huyện Lục Nam'] },
  { id: 'HY', name: 'Tỉnh Hưng Yên (gồm Hưng Yên, Thái Bình)', districts: ['TP. Hưng Yên', 'TP. Thái Bình', 'Thị xã Mỹ Hào', 'Huyện Ân Thi', 'Huyện Khoái Châu', 'Huyện Văn Giang', 'Huyện Yên Mỹ', 'Huyện Đông Hưng', 'Huyện Hưng Hà', 'Huyện Kiến Xương', 'Huyện Tiền Hải', 'Huyện Vũ Thư'] },
  { id: 'NB', name: 'Tỉnh Ninh Bình (gồm Ninh Bình, Hà Nam, Nam Định)', districts: ['TP. Ninh Bình', 'TP. Phủ Lý', 'TP. Nam Định', 'TP. Tam Điệp', 'Thị xã Duy Tiên', 'Thị xã Kim Bảng', 'Huyện Gia Viễn', 'Huyện Hoa Lư', 'Huyện Kim Sơn', 'Huyện Nho Quan', 'Huyện Giao Thủy', 'Huyện Hải Hậu', 'Huyện Nam Trực', 'Huyện Ý Yên'] },
  { id: 'QT', name: 'Tỉnh Quảng Trị (gồm Quảng Trị, Quảng Bình)', districts: ['TP. Đông Hà', 'TP. Đồng Hới', 'Thị xã Ba Đồn', 'Thị xã Quảng Trị', 'Huyện Bố Trạch', 'Huyện Lệ Thủy', 'Huyện Quảng Trạch', 'Huyện Cam Lộ', 'Huyện Gio Linh', 'Huyện Triệu Phong', 'Huyện Vĩnh Linh'] },
  { id: 'QNG', name: 'Tỉnh Quảng Ngãi (gồm Quảng Ngãi, Kon Tum)', districts: ['TP. Quảng Ngãi', 'TP. Kon Tum', 'Thị xã Đức Phổ', 'Huyện Bình Sơn', 'Huyện Mộ Đức', 'Huyện Tư Nghĩa', 'Huyện Đắk Hà', 'Huyện Đắk Tô', 'Huyện Ngọc Hồi', 'Huyện Sa Thầy'] },
  { id: 'GL', name: 'Tỉnh Gia Lai (gồm Gia Lai, Bình Định)', districts: ['TP. Pleiku', 'TP. Quy Nhơn', 'Thị xã An Khê', 'Thị xã Ayun Pa', 'Thị xã An Nhơn', 'Thị xã Hoài Nhơn', 'Huyện Chư Sê', 'Huyện Đăk Đoa', 'Huyện Ia Grai', 'Huyện Tuy Phước', 'Huyện Phù Cát', 'Huyện Phù Mỹ'] },
  { id: 'KH', name: 'Tỉnh Khánh Hòa (gồm Khánh Hòa, Ninh Thuận)', districts: ['TP. Nha Trang', 'TP. Cam Ranh', 'TP. Phan Rang - Tháp Chàm', 'Thị xã Ninh Hòa', 'Huyện Cam Lâm', 'Huyện Diên Khánh', 'Huyện Vạn Ninh', 'Huyện Ninh Hải', 'Huyện Ninh Phước', 'Huyện Ninh Sơn'] },
  { id: 'LD', name: 'Tỉnh Lâm Đồng (gồm Lâm Đồng, Đắk Nông, Bình Thuận)', districts: ['TP. Đà Lạt', 'TP. Bảo Lộc', 'TP. Gia Nghĩa', 'TP. Phan Thiết', 'Thị xã La Gi', 'Huyện Bảo Lâm', 'Huyện Di Linh', 'Huyện Đức Trọng', 'Huyện Đơn Dương', 'Huyện Cư Jút', 'Huyện Đắk Mil', 'Huyện Đắk R\'lấp', 'Huyện Hàm Thuận Bắc', 'Huyện Hàm Thuận Nam'] },
  { id: 'DL', name: 'Tỉnh Đắk Lắk (gồm Đắk Lắk, Phú Yên)', districts: ['TP. Buôn Ma Thuột', 'TP. Tuy Hòa', 'Thị xã Buôn Hồ', 'Thị xã Đông Hòa', 'Thị xã Sông Cầu', 'Huyện Cư M\'gar', 'Huyện Ea Kar', 'Huyện Krông Pắc', 'Huyện Buôn Đôn', 'Huyện Phú Hòa', 'Huyện Tuy An'] },
  { id: 'DNAI', name: 'Tỉnh Đồng Nai (gồm Đồng Nai, Bình Phước)', districts: ['TP. Biên Hòa', 'TP. Long Khánh', 'TP. Đồng Xoài', 'Thị xã Bình Long', 'Thị xã Phước Long', 'Thị xã Chơn Thành', 'Huyện Nhơn Trạch', 'Huyện Trảng Bom', 'Huyện Long Thành', 'Huyện Vĩnh Cửu', 'Huyện Thống Nhất', 'Huyện Đồng Phú', 'Huyện Lộc Ninh'] },
  { id: 'TNIEN', name: 'Tỉnh Tây Ninh (gồm Tây Ninh, Long An)', districts: ['TP. Tây Ninh', 'TP. Tân An', 'Thị xã Hòa Thành', 'Thị xã Trảng Bàng', 'Thị xã Kiến Tường', 'Huyện Bến Cầu', 'Huyện Châu Thành', 'Huyện Gò Dầu', 'Huyện Bến Lức', 'Huyện Cần Đước', 'Huyện Cần Giuộc', 'Huyện Đức Hòa'] },
  { id: 'VL', name: 'Tỉnh Vĩnh Long (gồm Vĩnh Long, Bến Tre, Trà Vinh)', districts: ['TP. Vĩnh Long', 'TP. Bến Tre', 'TP. Trà Vinh', 'Thị xã Bình Minh', 'Thị xã Duyên Hải', 'Huyện Long Hồ', 'Huyện Mang Thít', 'Huyện Tam Bình', 'Huyện Vũng Liêm', 'Huyện Ba Tri', 'Huyện Bình Đại', 'Huyện Giồng Trôm', 'Huyện Càng Long', 'Huyện Cầu Ngang'] },
  { id: 'DT', name: 'Tỉnh Đồng Tháp (gồm Đồng Tháp, Tiền Giang)', districts: ['TP. Cao Lãnh', 'TP. Sa Đéc', 'TP. Hồng Ngự', 'TP. Mỹ Tho', 'TP. Gò Công', 'Thị xã Cai Lậy', 'Huyện Lấp Vò', 'Huyện Lai Vung', 'Huyện Tháp Mười', 'Huyện Châu Thành', 'Huyện Chợ Gạo', 'Huyện Cái Bè'] },
  { id: 'CM', name: 'Tỉnh Cà Mau (gồm Cà Mau, Bạc Liêu)', districts: ['TP. Cà Mau', 'TP. Bạc Liêu', 'Thị xã Giá Rai', 'Huyện Cái Nước', 'Huyện Đầm Dơi', 'Huyện Năm Căn', 'Huyện Trần Văn Thời', 'Huyện U Minh', 'Huyện Đông Hải', 'Huyện Phước Long', 'Huyện Vĩnh Lợi'] },
  { id: 'AG', name: 'Tỉnh An Giang (gồm An Giang, Kiên Giang)', districts: ['TP. Long Xuyên', 'TP. Châu Đốc', 'TP. Rạch Giá', 'TP. Hà Tiên', 'TP. Phú Quốc', 'Thị xã Tân Châu', 'Thị xã Tịnh Biên', 'Huyện Chợ Mới', 'Huyện Thoại Sơn', 'Huyện Châu Phú', 'Huyện Châu Thành', 'Huyện Hòn Đất', 'Huyện Kiên Lương'] },
  { id: 'LCHAU', name: 'Tỉnh Lai Châu', districts: ['TP. Lai Châu', 'Huyện Mường Tè', 'Huyện Nậm Nhùn', 'Huyện Phong Thổ', 'Huyện Sìn Hồ', 'Huyện Tam Đường', 'Huyện Tân Uyên', 'Huyện Than Uyên'] },
  { id: 'DBIEN', name: 'Tỉnh Điện Biên', districts: ['TP. Điện Biên Phủ', 'Thị xã Mường Lay', 'Huyện Điện Biên', 'Huyện Điện Biên Đông', 'Huyện Mường Chà', 'Huyện Mường Nhé', 'Huyện Mường Ảng', 'Huyện Nậm Pồ', 'Huyện Tủa Chùa', 'Huyện Tuần Giáo'] },
  { id: 'SLA', name: 'Tỉnh Sơn La', districts: ['TP. Sơn La', 'Huyện Bắc Yên', 'Huyện Mai Sơn', 'Huyện Mộc Châu', 'Huyện Mường La', 'Huyện Phù Yên', 'Huyện Quỳnh Nhai', 'Huyện Sông Mã', 'Huyện Thuận Châu', 'Huyện Vân Hồ'] },
  { id: 'LSON', name: 'Tỉnh Lạng Sơn', districts: ['TP. Lạng Sơn', 'Huyện Bắc Sơn', 'Huyện Bình Gia', 'Huyện Cao Lộc', 'Huyện Chi Lăng', 'Huyện Đình Lập', 'Huyện Hữu Lũng', 'Huyện Lộc Bình', 'Huyện Tràng Định', 'Huyện Văn Lãng'] },
  { id: 'QNINH', name: 'Tỉnh Quảng Ninh', districts: ['TP. Hạ Long', 'TP. Cẩm Phả', 'TP. Móng Cái', 'TP. Uông Bí', 'TP. Đông Triều', 'Thị xã Quảng Yên', 'Huyện Ba Chẽ', 'Huyện Bình Liêu', 'Huyện Cô Tô', 'Huyện Đầm Hà', 'Huyện Hải Hà', 'Huyện Tiên Yên', 'Huyện Vân Đồn'] },
  { id: 'THOA', name: 'Tỉnh Thanh Hóa', districts: ['TP. Thanh Hóa', 'TP. Sầm Sơn', 'Thị xã Bỉm Sơn', 'Thị xã Nghi Sơn', 'Huyện Bá Thước', 'Huyện Cẩm Thủy', 'Huyện Đông Sơn', 'Huyện Hà Trung', 'Huyện Hậu Lộc', 'Huyện Hoằng Hóa', 'Huyện Nga Sơn', 'Huyện Nông Cống', 'Huyện Quảng Xương', 'Huyện Thọ Xuân'] },
  { id: 'NAN', name: 'Tỉnh Nghệ An', districts: ['TP. Vinh', 'Thị xã Cửa Lò', 'Thị xã Hoàng Mai', 'Thị xã Thái Hòa', 'Huyện Anh Sơn', 'Huyện Con Cuông', 'Huyện Diễn Châu', 'Huyện Đô Lương', 'Huyện Hưng Nguyên', 'Huyện Kỳ Sơn', 'Huyện Nam Đàn', 'Huyện Nghi Lộc', 'Huyện Nghĩa Đàn', 'Huyện Quỳnh Lưu'] },
  { id: 'HTINH', name: 'Tỉnh Hà Tĩnh', districts: ['TP. Hà Tĩnh', 'Thị xã Hồng Lĩnh', 'Thị xã Kỳ Anh', 'Huyện Cẩm Xuyên', 'Huyện Can Lộc', 'Huyện Đức Thọ', 'Huyện Hương Khê', 'Huyện Hương Sơn', 'Huyện Kỳ Anh', 'Huyện Nghi Xuân', 'Huyện Thạch Hà'] },
];

// Helper for smart Vietnamese accent-insensitive matching
const removeAccents = (str) => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
};

const matchesSearch = (label, query) => {
  if (!query) return true;
  const normLabel = removeAccents(label);
  const normQuery = removeAccents(query);

  // 1. Direct accent-insensitive substring match (e.g. "ho" -> "Hồ Chí Minh")
  if (normLabel.includes(normQuery)) return true;

  // 2. Acronym / abbreviation initials match (e.g. "hcm" -> "Thành phố Hồ Chí Minh")
  const initials = normLabel
    .split(/[\s\.\,\(\)\-]+/)
    .filter(Boolean)
    .map(w => w[0])
    .join('');
  if (initials.includes(normQuery)) return true;

  // 3. Match all words in query anywhere in label (e.g. "chi minh" -> "Hồ Chí Minh")
  const queryWords = normQuery.split(/\s+/).filter(Boolean);
  return queryWords.every(w => normLabel.includes(w));
};

function SearchableSelect({ value, onChange, options, placeholder, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = (options || []).filter(opt => {
    const label = typeof opt === 'string' ? opt : (opt.name || opt.label || '');
    return matchesSearch(label, searchTerm);
  });

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      {/* Trigger Select Box */}
      <div
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
        style={{
          width: '100%',
          padding: '0.55rem 2.2rem 0.55rem 0.75rem',
          borderRadius: '8px',
          border: '1.5px solid #cbd5e1',
          fontSize: '0.82rem',
          color: value ? '#0f172a' : '#64748b',
          backgroundColor: disabled ? '#f1f5f9' : '#ffffff',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          userSelect: 'none',
          boxSizing: 'border-box',
          position: 'relative'
        }}
      >
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {value || placeholder}
        </span>
        <ChevronDown
          size={16}
          style={{
            position: 'absolute',
            right: '0.65rem',
            top: '50%',
            transform: `translateY(-50%) rotate(${isOpen ? 180 : 0}deg)`,
            transition: 'transform 0.2s ease',
            color: '#64748b',
            pointerEvents: 'none'
          }}
        />
      </div>

      {/* Dropdown Options Popup */}
      {isOpen && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 9999,
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #cbd5e1',
            boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
            padding: '0.4rem',
            maxHeight: '260px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem'
          }}
        >
          {/* Search Bar */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.55rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Gõ để tìm kiếm..."
              style={{
                width: '100%',
                padding: '0.45rem 0.55rem 0.45rem 2rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.8rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Options List */}
          <div style={{ overflowY: 'auto', maxHeight: '190px', display: 'flex', flexDirection: 'column' }}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => {
                const optName = typeof opt === 'string' ? opt : opt.name;
                const optKey = typeof opt === 'string' ? `${opt}-${idx}` : (opt.code || opt.id || idx);
                return (
                  <div
                    key={optKey}
                    onClick={() => {
                      onChange(optName);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    style={{
                      padding: '0.45rem 0.65rem',
                      borderRadius: '6px',
                      fontSize: '0.82rem',
                      color: value === optName ? '#2563eb' : '#0f172a',
                      backgroundColor: value === optName ? '#eff6ff' : 'transparent',
                      fontWeight: value === optName ? 700 : 400,
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={e => {
                      if (value !== optName) e.currentTarget.style.backgroundColor = '#f8fafc';
                    }}
                    onMouseLeave={e => {
                      if (value !== optName) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {optName}
                  </div>
                );
              })
            ) : (
              <div style={{ padding: '0.6rem', fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center' }}>
                Không tìm thấy kết quả
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const formatPrice = (price) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price || 0);
};

export default function Cart() {
  const cartContext = useCart() || {};
  const {
    cartItems = [],
    updateQuantity = () => {},
    removeFromCart = () => {},
    removeSelectedFromCart = () => {},
    cartTotal = 0,
    clearCart = () => {}
  } = cartContext;

  const auth = useAuth() || {};
  const { user, login } = auth;
  const processCheckout = useSalesStore(state => state.processCheckout);
  const { addNotification } = useNotification();
  const navigate = useNavigate();

  const getProductId = (p) => {
    if (!p) return undefined;
    return p.id ?? p.product_id ?? p.productId;
  };

  // Helper for item key with safe navigation
  const getItemKey = (item) => {
    if (!item || !item.product) return null;
    const pId = getProductId(item.product);
    if (pId === undefined || pId === null) return null;
    return `${pId}-${JSON.stringify(item.selectedSpec || null)}`;
  };

  const validCartItems = (cartItems || []).filter(item => item && item.product && getProductId(item.product) !== undefined);

  // Item Selection state for checkboxes
  const [selectedKeys, setSelectedKeys] = useState({});

  // Ensure newly added items are checked by default
  useEffect(() => {
    setSelectedKeys((prev) => {
      const updated = { ...prev };
      let changed = false;
      validCartItems.forEach((item) => {
        const key = getItemKey(item);
        if (key && updated[key] === undefined) {
          updated[key] = true;
          changed = true;
        }
      });
      return changed ? updated : prev;
    });
  }, [cartItems]);

  const toggleSelectItem = (key) => {
    if (!key) return;
    setSelectedKeys((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const isAllSelected = validCartItems.length > 0 && validCartItems.every((item) => selectedKeys[getItemKey(item)]);

  const toggleSelectAll = () => {
    const nextState = !isAllSelected;
    const newSelected = {};
    validCartItems.forEach((item) => {
      const key = getItemKey(item);
      if (key) newSelected[key] = nextState;
    });
    setSelectedKeys(newSelected);
  };

  const handleDeleteSelected = async () => {
    const keysToRemove = validCartItems
      .map(getItemKey)
      .filter((key) => key && selectedKeys[key]);

    if (keysToRemove.length === 0) {
      addNotification('Vui lòng tích chọn ít nhất 1 sản phẩm để xóa!', 'error');
      return;
    }

    if (await confirm(`Bạn có chắc chắn muốn xóa ${keysToRemove.length} sản phẩm đã chọn khỏi giỏ hàng?`, { danger: true })) {
      removeSelectedFromCart(keysToRemove);
    }
  };

  // Selected items & total calculation
  const selectedCartItems = validCartItems.filter((item) => selectedKeys[getItemKey(item)]);
  const selectedCartCount = selectedCartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const selectedCartTotal = selectedCartItems.reduce((sum, item) => {
    const price = item?.product?.price || 0;
    return sum + price * (item.quantity || 1);
  }, 0);

  // Resolve user email with fallback if email field is not explicitly present
  const getUserEmail = (u) => {
    if (!u) return '';
    if (u.email) return u.email;
    if (u.username) return u.username.includes('@') ? u.username : `${u.username}@gmail.com`;
    return '';
  };

  // Form states
  const [customerName, setCustomerName] = useState(user?.fullname || user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [customerEmail, setCustomerEmail] = useState(() => getUserEmail(user));
  
  // Structured address states - customers select manually & all are required
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [ward, setWard] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState(null);

  // AddressKit API states (live data from General Statistics Office via https://addresskit.cas.so)
  const [apiProvinces, setApiProvinces] = useState([]);
  const [apiCommunes, setApiCommunes] = useState([]);
  const [loadingCommunes, setLoadingCommunes] = useState(false);
  
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [checkingOut, setCheckingOut] = useState(false);
  const [orderNote, setOrderNote] = useState('');

  // Invoice / Success state
  const [invoice, setInvoice] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  // Coupon states
  const [couponCode, setCouponCode] = useState('');
  const [activeCoupon, setActiveCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');

  // Fetch live provinces from AddressKit API (General Statistics Office dataset),
  // proxied through our backend — the AddressKit host only allows CORS from
  // http://localhost:3000, so calling it directly from the browser fails on
  // any deployed domain (works in local dev, breaks in production).
  useEffect(() => {
    api.get('/address/provinces')
      .then(res => {
        const provinces = res?.data?.provinces;
        if (Array.isArray(provinces) && provinces.length > 0) {
          setApiProvinces(provinces);
        }
      })
      .catch(err => console.warn('AddressKit API fetch error:', err));
  }, []);

  // Sync user info when logged in
  useEffect(() => {
    if (user) {
      setCustomerName(user.fullname || user.name || '');
      setPhone(user.phone || '');
      const mail = getUserEmail(user);
      if (mail) setCustomerEmail(mail);
      if (user.address) {
        setStreetAddress(user.address);
      }
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    const loadSavedAddresses = async () => {
      try {
        const list = (await api.get('/customers/addresses')).data || [];
        if (active) setSavedAddresses([...list].sort((a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)) || Number(b.id) - Number(a.id)));
      } catch (error) {
        console.warn('Unable to load saved addresses:', error);
      }
    };
    if (user) loadSavedAddresses();
    return () => { active = false; };
  }, [user]);

  // Fetch live communes for a given province name/code, proxied through our backend
  const fetchCommunesForProvince = (provName) => {
    const foundProv = apiProvinces.find(p => p.name === provName || p.code === provName);
    if (foundProv?.code) {
      setLoadingCommunes(true);
      api.get(`/address/provinces/${foundProv.code}/communes`)
        .then(res => {
          const communes = res?.data?.communes;
          if (Array.isArray(communes)) {
            setApiCommunes(communes);
          }
        })
        .catch(err => console.warn('AddressKit Communes fetch error:', err))
        .finally(() => setLoadingCommunes(false));
    }
  };

  const useSavedAddress = (address) => {
    setSelectedSavedAddressId(address.id);
    setCustomerName(address.recipientName || customerName);
    setPhone(address.recipientPhone || phone);
    setStreetAddress(address.addressLine || '');
    setSelectedProvince(address.city || '');
    setWard(address.ward || '');
    setSelectedDistrict(address.district || '');
    setApiCommunes([]);
    fetchCommunesForProvince(address.city || '');
  };
  // Update ward & fetch live communes when province changes
  const handleProvinceChange = (val) => {
    const provName = typeof val === 'string' ? val : val?.target?.value;
    setSelectedProvince(provName);
    setWard('');
    setApiCommunes([]);
    fetchCommunesForProvince(provName);
  };

  const handleCopy = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Helper: Only Hà Nội & TP. Hồ Chí Minh qualify for Freeship
  const isFreeShipCity = (provinceName) => {
    if (!provinceName) return false;
    const p = removeAccents(provinceName);
    return p.includes('ho chi minh') || p.includes('ha noi');
  };

  // Shipping calculation: 100% Miễn phí vận chuyển toàn quốc cho mọi đơn hàng
  const shippingFee = 0;

  const handleApplyCoupon = (e) => {
    e.preventDefault();
    setCouponError('');
    setCouponSuccess('');
    const code = couponCode.trim().toUpperCase();
    if (!code) return;

    if (code === 'AETHER10') {
      if (selectedCartTotal < 2000000) {
        setCouponError('Mã AETHER10 chỉ áp dụng cho đơn hàng từ 2.000.000đ.');
        return;
      }
      setActiveCoupon({ code, type: 'percent' });
      setCouponSuccess('Áp dụng mã AETHER10 giảm 10% thành công!');
    } else if (code === 'NEWPC200K') {
      if (selectedCartTotal < 5000000) {
        setCouponError('Mã NEWPC200K chỉ áp dụng cho đơn hàng từ 5.000.000đ.');
        return;
      }
      setActiveCoupon({ code, type: 'flat' });
      setCouponSuccess('Áp dụng mã NEWPC200K giảm 200.000đ thành công!');
    } else if (code === 'FREESHIP') {
      setActiveCoupon({ code, type: 'freeship' });
      setCouponSuccess('Áp dụng mã FREESHIP miễn phí vận chuyển thành công!');
    } else {
      setCouponError('Mã giảm giá không chính xác hoặc đã hết hạn.');
    }
  };

  const handleRemoveCoupon = () => {
    setActiveCoupon(null);
    setCouponCode('');
    setCouponSuccess('');
    setCouponError('');
  };

  const couponDiscount = (() => {
    if (!activeCoupon) return 0;
    if (activeCoupon.code === 'AETHER10') {
      if (selectedCartTotal < 2000000) return 0;
      return Math.round(selectedCartTotal * 0.1);
    }
    if (activeCoupon.code === 'NEWPC200K') {
      if (selectedCartTotal < 5000000) return 0;
      return 200000;
    }
    if (activeCoupon.code === 'FREESHIP') {
      return 30000;
    }
    return 0;
  })();

  // Member Tier discount calculation
  const memberTier = user?.tier || 'BRONZE';
  let memberDiscountPercent = 0;
  let memberTierName = 'Đồng';

  if (memberTier.toUpperCase() === 'SILVER') {
    memberDiscountPercent = 0.02;
    memberTierName = 'Bạc';
  } else if (memberTier.toUpperCase() === 'GOLD') {
    memberDiscountPercent = 0.05;
    memberTierName = 'Vàng';
  } else if (memberTier.toUpperCase() === 'PLATINUM') {
    memberDiscountPercent = 0.10;
    memberTierName = 'Kim Cương';
  }

  const memberDiscountAmount = Math.round(selectedCartTotal * memberDiscountPercent);
  const finalTotal = Math.max(0, selectedCartTotal + shippingFee - couponDiscount - memberDiscountAmount);

  const formatPrice = (price) => {
    if (price === null || price === undefined || isNaN(price)) return '0 đ';
    return Number(price).toLocaleString('vi-VN') + ' đ';
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (selectedCartItems.length === 0) {
      addNotification('Vui lòng tích chọn ít nhất 1 sản phẩm trong giỏ hàng để thực hiện thanh toán!', 'error');
      return;
    }

    if (!user) {
      addNotification('Vui lòng đăng nhập tài khoản để thực hiện thanh toán!', 'error');
      navigate('/login?redirect=/cart');
      return;
    }

    if (!selectedProvince || !ward.trim() || !streetAddress.trim()) {
      addNotification('Vui lòng chọn và nhập đầy đủ thông tin Địa Chỉ Giao Hàng (Tỉnh/Thành phố, Phường/Xã, Số nhà/tên đường)!', 'error');
      return;
    }

    setCheckingOut(true);

    try {
      const itemsForERP = selectedCartItems.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        price: item.product.price,
        category: item.product.category,
        name: item.product.name,
        selectedSpec: item.selectedSpec
      }));

      // Combine structured address & order note if provided
      const baseAddress = [
        streetAddress,
        ward ? (ward.toLowerCase().includes('phường') || ward.toLowerCase().includes('xã') ? ward : `Phường/Xã ${ward}`) : '',
        selectedProvince
      ].filter(Boolean).join(', ');

      const fullAddress = orderNote.trim()
        ? `${baseAddress} (Ghi chú: ${orderNote.trim()})`
        : baseAddress;

      const targetEmail = customerEmail || user?.email || '';
      const orderId = await processCheckout(
        customerName,
        phone,
        itemsForERP,
        'ONLINE',
        finalTotal,
        fullAddress,
        paymentMethod,
        targetEmail,
        {
          shippingFee,
          discount: (couponDiscount || 0) + (memberDiscountAmount || 0),
          shippingCity: selectedProvince
        }
      );

      const invoiceData = {
        customerName,
        phone,
        address: fullAddress,
        paymentMethod,
        orderId,
        totalAmount: finalTotal,
        date: new Date().toLocaleDateString('vi-VN'),
        email: targetEmail
      };

      setInvoice(invoiceData);
      addNotification(`Đơn hàng #${orderId} đã đặt thành công!`, 'success', '/my-orders');

      // Email xác nhận đơn hàng được backend tự gửi ngay khi tạo đơn (POST /orders,
      // xem order.controller.js) với đầy đủ dữ liệu thật từ DB — gọi thêm
      // /orders/email-notify ở đây trước kia khiến khách nhận 2 email trùng nội dung.

      removeSelectedFromCart(selectedCartItems.map(getItemKey));
    } catch (err) {
      addNotification('Không thể hoàn tất thanh toán. Vui lòng kiểm tra lại kết nối!', 'error');
    } finally {
      setCheckingOut(false);
    }
  };

  const currentProvinceObj = VIETNAM_PROVINCES.find(p => p.name === selectedProvince) || { districts: [] };

  // Invoice Success Screen
  if (invoice) {
    const isQrPay = invoice.paymentMethod === 'BANK_TRANSFER';
    const qrUrl = `https://qr.sepay.vn/img?acc=22633181&bank=MB&amount=${invoice.totalAmount}&des=AetherPC%20${invoice.orderId}&template=compact`;

    return (
      <div className="container" style={{ padding: '3.5rem 1.5rem', display: 'flex', justifyContent: 'center' }}>
        <style>{`
          @keyframes scan { 0% { top: 0%; } 50% { top: 100%; } 100% { top: 0%; } }
          .scanner-line {
            position: absolute; left: 0; width: 100%; height: 3px;
            background: #10b981; boxShadow: 0 0 10px #10b981, 0 0 20px #10b981;
            animation: scan 4s linear infinite;
          }
        `}</style>

        <div className="card-glass" style={{ 
          width: '100%', 
          maxWidth: isQrPay ? '850px' : '600px', 
          padding: '2.5rem', 
          borderRadius: '20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 20px 40px rgba(0,0,0,0.08)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              backgroundColor: '#ecfdf5', color: '#10b981',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.25rem auto'
            }}>
              <CheckCircle size={36} />
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0f172a', fontFamily: 'var(--font-title)', marginBottom: '0.5rem' }}>
              Đặt Hàng Thành Công!
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
              Mã đơn hàng: <strong style={{ color: '#2563eb' }}>#{invoice.orderId}</strong> — Cảm ơn quý khách đã mua hàng tại AetherPC.
            </p>
          </div>

          {isQrPay ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem' }}>
              {/* QR Code Column */}
              <div style={{ textAlign: 'center', backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0', position: 'relative', overflow: 'hidden' }}>
                <div className="scanner-line" />
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.75rem' }}>
                  Quét Mã VietQR Chuyển Khoản Nhanh
                </div>
                <img src={qrUrl} alt="QR Thanh Toán" style={{ width: '210px', height: '210px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.75rem', fontWeight: 500 }}>
                  Tự động điền số tiền &amp; nội dung chuyển khoản
                </div>
              </div>

              {/* Bank Details Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', borderBottom: '2px solid #2563eb', paddingBottom: '0.35rem', width: 'fit-content' }}>
                  Thông Tin Tài Khoản Ngân Hàng
                </div>
                {[
                  { label: 'Ngân hàng', val: 'MBBank (MB)' },
                  { label: 'Số tài khoản', val: '22633181', field: 'acc' },
                  { label: 'Chủ tài khoản', val: 'NGUYEN HOANG KHANG' },
                  { label: 'Số tiền', val: formatPrice(invoice.totalAmount), isMoney: true },
                  { label: 'Nội dung CK', val: `AetherPC ${invoice.orderId}`, field: 'des' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', backgroundColor: '#ffffff', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ color: '#64748b', fontWeight: 500 }}>{item.label}:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <strong style={{ color: item.isMoney ? '#dc2626' : '#0f172a', fontSize: item.isMoney ? '1.05rem' : '0.85rem' }}>{item.val}</strong>
                      {item.field && (
                        <button onClick={() => handleCopy(item.val, item.field)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', padding: '2px' }} title="Sao chép">
                          {copiedField === item.field ? <Check size={14} color="#16a34a"/> : <Copy size={14}/>}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '14px', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem' }}>Chi Tiết Giao Hàng</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem', color: '#475569' }}>
                <div><strong>Người nhận:</strong> {invoice.customerName} ({invoice.phone})</div>
                <div><strong>Địa chỉ giao:</strong> {invoice.address}</div>
                <div><strong>Phương thức thanh toán:</strong> COD (Tiền mặt khi nhận hàng)</div>
                <div><strong>Tổng tiền thanh toán:</strong> <strong style={{ color: '#dc2626', fontSize: '1.1rem' }}>{formatPrice(invoice.totalAmount)}</strong></div>
              </div>
            </div>
          )}

          {/* Email Notification Banner */}
          {invoice.email && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              backgroundColor: '#eff6ff', border: '1px solid #bfdbfe',
              borderRadius: '12px', padding: '0.85rem 1.1rem', marginTop: '1.25rem'
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                backgroundColor: '#dbeafe', color: '#2563eb',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <Mail size={18} />
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e3a8a' }}>
                  Email xác nhận đã được gửi tới hòm thư của bạn
                </div>
                <div style={{ fontSize: '0.8rem', color: '#3b82f6', marginTop: '2px' }}>
                  {invoice.email} — Hệ thống sẽ tiếp tục gửi thông báo cập nhật trạng thái đơn hàng tự động.
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', justifyContent: 'center' }}>
            <Link to="/" className="btn btn-primary" style={{ padding: '0.75rem 2rem', borderRadius: '12px', fontWeight: 700 }}>
              Tiếp Tục Mua Sắm
            </Link>
            <Link to="/my-orders" className="btn btn-secondary" style={{ padding: '0.75rem 2rem', borderRadius: '12px', fontWeight: 700, backgroundColor: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1' }}>
              Xem Đơn Hàng Của Tôi
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem 4rem' }}>
      {/* Page Title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShoppingCart size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0f172a', fontFamily: 'var(--font-title)', margin: 0 }}>
              Giỏ Hàng &amp; Thanh Toán
            </h1>
            <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
              {cartItems.length} sản phẩm trong giỏ hàng
            </span>
          </div>
        </div>

        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#2563eb', fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none' }}>
          <ArrowLeft size={16} /> Tiếp tục mua thêm sản phẩm
        </Link>
      </div>

      {validCartItems.length === 0 ? (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', padding: '4rem 2rem', textAlign: 'center', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#f1f5f9', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
            <ShoppingCart size={40} />
          </div>
          <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>Giỏ hàng của bạn đang trống</h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.75rem' }}>Hãy khám phá các linh kiện PC cao cấp giá tốt nhất hôm nay!</p>
          <Link to="/" className="btn btn-primary" style={{ padding: '0.75rem 2rem', borderRadius: '12px', fontWeight: 700 }}>
            Xem Danh Mục Sản Phẩm
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '2rem', alignItems: 'start' }}>
          
          {/* LEFT COLUMN: Cart Items List */}
          <div>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '18px', padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontWeight: 800, color: '#0f172a', fontSize: '1rem', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    style={{ width: '18px', height: '18px', accentColor: '#2563eb', cursor: 'pointer' }}
                  />
                  <span>Chọn tất cả ({selectedCartItems.length}/{validCartItems.length} sản phẩm)</span>
                </label>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <button
                    onClick={handleDeleteSelected}
                    disabled={selectedCartItems.length === 0}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: selectedCartItems.length === 0 ? '#cbd5e1' : '#ef4444',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: selectedCartItems.length === 0 ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}
                    title="Xóa các sản phẩm được chọn"
                  >
                    <Trash2 size={14} /> Xóa SP đã chọn
                  </button>

                  <span style={{ color: '#cbd5e1' }}>|</span>

                  <button onClick={clearCart} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    Xóa tất cả
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {validCartItems.map((item, idx) => {
                  const pId = getProductId(item.product);
                  const itemKey = getItemKey(item);
                  const isChecked = !!selectedKeys[itemKey];
                  const price = item.product.price ?? item.product.unitPrice ?? 0;
                  const qty = item.quantity || 1;

                  return (
                    <div
                      key={`${pId}-${idx}`}
                      style={{
                        display: 'flex',
                        gap: '1rem',
                        alignItems: 'center',
                        padding: '1.1rem',
                        borderRadius: '14px',
                        backgroundColor: isChecked ? '#ffffff' : '#f8fafc',
                        border: `2px solid ${isChecked ? '#3b82f6' : '#e2e8f0'}`,
                        boxShadow: isChecked ? '0 4px 14px rgba(59,130,246,0.06)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {/* Item Checkbox */}
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelectItem(itemKey)}
                        style={{ width: '20px', height: '20px', accentColor: '#2563eb', cursor: 'pointer', flexShrink: 0 }}
                      />

                      {/* Product Image */}
                      <Link to={`/product/${pId}`} style={{ flexShrink: 0, textDecoration: 'none' }}>
                        <div style={{ width: '76px', height: '76px', backgroundColor: '#ffffff', borderRadius: '12px', padding: '0.4rem', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img
                            src={item.product.image || item.product.imageUrl || `https://placehold.co/80x80/f8fafc/94a3b8?text=${item.product.category || 'PC'}`}
                            alt={item.product.name || item.product.productName || 'Sản phẩm'}
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                          />
                        </div>
                      </Link>

                      {/* Product Title & Brand */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#2563eb', backgroundColor: '#eff6ff', padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {item.product.category || item.product.categoryName || 'Linh kiện'}
                        </span>
                        <Link to={`/product/${pId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                          <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0f172a', margin: '0.35rem 0 0.2rem', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {item.product.name || item.product.productName || 'Sản phẩm'}
                          </h4>
                        </Link>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Thương hiệu: <strong style={{ color: '#334155' }}>{item.product.brand || item.product.brandName || 'Chính hãng'}</strong></span>
                      </div>

                      {/* Quantity modifier */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                        <button
                          onClick={() => updateQuantity(pId, qty - 1, item.selectedSpec)}
                          style={{ width: '30px', height: '30px', borderRadius: '8px', border: '1.5px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', fontSize: '1.1rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}
                          title="Giảm số lượng"
                        >−</button>
                        <span style={{ minWidth: '24px', textAlign: 'center', fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>{qty}</span>
                        <button
                          onClick={() => updateQuantity(pId, qty + 1, item.selectedSpec)}
                          style={{ width: '30px', height: '30px', borderRadius: '8px', border: '1.5px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', fontSize: '1.1rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}
                          title="Tăng số lượng"
                        >+</button>
                      </div>

                      {/* Item Total Price */}
                      <div style={{ fontSize: '1.08rem', fontWeight: 900, color: '#dc2626', textDecoration: 'none', whiteSpace: 'nowrap', minWidth: '100px', textAlign: 'right', flexShrink: 0 }}>
                        {formatPrice(price * qty)}
                      </div>

                      {/* Delete button */}
                      <button 
                        onClick={() => removeFromCart(pId, item.selectedSpec)} 
                        style={{ 
                          backgroundColor: '#fef2f2', 
                          border: '1px solid #fecaca', 
                          color: '#ef4444', 
                          cursor: 'pointer', 
                          padding: '0.4rem 0.65rem', 
                          borderRadius: '8px', 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '0.3rem', 
                          fontSize: '0.8rem', 
                          fontWeight: 700,
                          flexShrink: 0
                        }} 
                        title="Xóa sản phẩm này"
                      >
                        <Trash2 size={14} /> Xóa
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* ELEGANT & BALANCED TOTAL SUMMARY BAR */}
              <div style={{
                marginTop: '1.25rem',
                padding: '1.25rem 1.5rem',
                borderRadius: '16px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
                display: 'flex',
                alignItems: 'center',
                justify: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    backgroundColor: '#eff6ff',
                    color: '#2563eb',
                    display: 'grid',
                    placeItems: 'center',
                    border: '1px solid #dbeafe',
                    flexShrink: 0
                  }}>
                    <ShoppingBag size={20} style={{ display: 'block' }} />
                  </div>

                  <div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>Tạm tính sản phẩm đã chọn</span>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: '#2563eb',
                        backgroundColor: '#eff6ff',
                        padding: '2px 9px',
                        borderRadius: '12px',
                        border: '1px solid #bfdbfe'
                      }}>
                        {selectedCartItems.length} sản phẩm
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                      Đã bao gồm thuế GTGT (VAT)
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right', marginLeft: 'auto', marginRight: '77px', flexShrink: 0 }}>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#dc2626', fontFamily: 'var(--font-title)', letterSpacing: '-0.5px', whiteSpace: 'nowrap', marginRight: '-20px' }}>
                    {formatPrice(selectedCartTotal)}
                  </div>
                </div>
              </div>
            </div>

            {/* Service & Guarantee Commitments */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '1.5rem' }}>
              {[
                { icon: <ShieldCheck size={20} color="#2563eb" />, title: 'Chính Hãng 100%', desc: 'Bảo hành 24-36 tháng' },
                { icon: <Truck size={20} color="#16a34a" />, title: 'Giao Siêu Tốc', desc: 'Freeship HN & TP.HCM' },
                { icon: <RotateCcw size={20} color="#d97706" />, title: 'Đổi Trả 30 Ngày', desc: 'Nhanh chóng & dễ dàng' },
              ].map((item, i) => (
                <div key={i} style={{ backgroundColor: '#ffffff', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                  {item.icon}
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0f172a' }}>{item.title}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT COLUMN: Checkout Form or Login Gate */}
          <div>
            {!user ? (
              /* GUEST USER LOGIN GATE CARD */
              <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', padding: '2rem', border: '2px solid #3b82f6', boxShadow: '0 8px 30px rgba(59,130,246,0.12)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, right: 0, width: '100px', height: '100px', background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #bfdbfe' }}>
                    <Lock size={24} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '1px' }}>Khách Vãng Lai</span>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>Đăng Nhập Để Thanh Toán</h3>
                  </div>
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '1.1rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '1.5rem', fontSize: '0.85rem', color: '#475569', lineHeight: 1.6 }}>
                  <p style={{ margin: 0, fontWeight: 600, color: '#0f172a' }}>
                    Quý khách đã thêm sản phẩm vào giỏ thành công.
                  </p>
                  <p style={{ margin: '0.4rem 0 0' }}>
                    Để hoàn tất thanh toán, tích điểm thành viên (chiết khấu đến 10%) và bảo hành đơn hàng, vui lòng đăng nhập tài khoản.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <Link 
                    to="/login?redirect=/cart" 
                    className="btn btn-primary" 
                    style={{ width: '100%', padding: '0.85rem', borderRadius: '12px', fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 4px 15px rgba(37,99,235,0.3)' }}
                  >
                    <LogIn size={18} /> Đăng Nhập Để Thanh Toán
                  </Link>

                  <Link 
                    to="/login" 
                    style={{ textDecoration: 'none', textAlign: 'center', fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}
                  >
                    Chưa có tài khoản? <span style={{ color: '#2563eb', fontWeight: 700 }}>Đăng ký ngay</span>
                  </Link>

                  {/* Demo account quick login — dev only, stripped from production builds */}
                  {import.meta.env.DEV && (
                    <div style={{ marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px dashed #e2e8f0', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.5rem' }}>Đăng nhập nhanh cho Demo:</div>
                      <button
                        onClick={() => login('customer', '123456')}
                        style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1.5px solid #22c55e', backgroundColor: '#f0fdf4', color: '#15803d', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                      >
                        <CheckCircle size={15} /> Đăng Nhập Bằng Tài Khoản Khách Hàng (Demo)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* LOGGED IN USER CHECKOUT FORM */
              <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', padding: '1.75rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', margin: 0, fontFamily: 'var(--font-title)' }}>
                    Thông Tin Thanh Toán
                  </h3>
                </div>

                <form onSubmit={handleCheckout} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  
                  {/* Customer Name */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                      Họ và tên người nhận <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <User size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Nhập họ và tên..."
                        required
                        style={{ width: '100%', padding: '0.65rem 0.75rem 0.65rem 2.3rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', color: '#0f172a', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                      Số điện thoại liên hệ <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Phone size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Nhập số điện thoại..."
                        required
                        style={{ width: '100%', padding: '0.65rem 0.75rem 0.65rem 2.3rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', color: '#0f172a', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  {/* Customer Email */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                      Email nhận thông báo đơn hàng <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="Ví dụ: hotro@gmail.com..."
                        required
                        style={{ width: '100%', padding: '0.65rem 0.75rem 0.65rem 2.3rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', color: '#0f172a', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  {savedAddresses.length > 0 && (
                    <div style={{ border: '1px solid #dbeafe', background: '#f8fbff', borderRadius: '12px', padding: '0.85rem' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e3a8a', marginBottom: '0.55rem' }}>{'\u0110\u1ecba ch\u1ec9 \u0111\u00e3 l\u01b0u'}</div>
                      <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'grid', gap: '0.45rem', paddingRight: '0.2rem' }}>
                        {savedAddresses.map(address => {
                          const selected = selectedSavedAddressId === address.id;
                          return <button key={address.id} type="button" onClick={() => useSavedAddress(address)} style={{ textAlign: 'left', border: selected ? '1px solid #2563eb' : '1px solid #dbeafe', background: selected ? '#eff6ff' : '#fff', borderRadius: '8px', padding: '0.6rem 0.7rem', cursor: 'pointer', color: '#1e293b' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontWeight: 700 }}><span>{address.recipientName}</span><span style={{ fontWeight: 400 }}>| {address.recipientPhone}</span>{address.isDefault && <span style={{ fontSize: '0.68rem', background: '#2563eb', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>{'\u0110\u1ecba ch\u1ec9 m\u1eb7c \u0111\u1ecbnh'}</span>}</div>
                            <div style={{ marginTop: '0.2rem', fontSize: '0.75rem', color: '#475569' }}>{[address.addressLine, address.ward, address.district, address.city].filter(Boolean).join(', ')}</div>
                          </button>;
                        })}
                      </div>
                    </div>
                  )}
                  {/* Structured Address Selection */}
                  <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <MapPin size={15} color="#2563eb" /> Địa Chỉ Giao Hàng Chi Tiết <span style={{ color: '#ef4444' }}>*</span>
                    </div>

                    {/* Province / City */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginBottom: '0.25rem' }}>
                        Tỉnh / Thành phố <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <SearchableSelect
                        value={selectedProvince}
                        onChange={handleProvinceChange}
                        options={apiProvinces.length > 0 ? apiProvinces : VIETNAM_PROVINCES}
                        placeholder="-- Chọn Tỉnh / Thành phố --"
                      />
                    </div>

                    {/* Ward & Street address */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginBottom: '0.25rem' }}>
                          Phường / Xã <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <SearchableSelect
                          value={ward}
                          onChange={val => setWard(val)}
                          options={apiCommunes}
                          placeholder={loadingCommunes ? "-- Đang tải Phường / Xã... --" : "-- Chọn Phường / Xã --"}
                          disabled={loadingCommunes || !selectedProvince}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginBottom: '0.25rem' }}>
                          Số nhà, tên đường <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={streetAddress}
                          onChange={e => setStreetAddress(e.target.value)}
                          placeholder="Số nhà, tên đường..."
                          required
                          style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem', color: '#0f172a', backgroundColor: '#ffffff', outline: 'none', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Delivery Note (Optional) */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                      Ghi chú giao hàng <span style={{ color: '#94a3b8', fontWeight: 400 }}>(Không bắt buộc)</span>
                    </label>
                    <textarea
                      value={orderNote}
                      onChange={e => setOrderNote(e.target.value)}
                      placeholder="Ví dụ: Giao giờ hành chính, gọi trước khi giao 15 phút, gửi bảo vệ..."
                      rows={2}
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.75rem',
                        borderRadius: '10px',
                        border: '1.5px solid #cbd5e1',
                        fontSize: '0.82rem',
                        color: '#0f172a',
                        outline: 'none',
                        boxSizing: 'border-box',
                        resize: 'none',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>

                  {/* Payment Method */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>
                      Phương thức thanh toán
                    </label>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {/* COD */}
                      <div
                        onClick={() => setPaymentMethod('CASH')}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0.85rem',
                          border: `2px solid ${paymentMethod === 'CASH' ? '#2563eb' : '#e2e8f0'}`,
                          borderRadius: '12px', backgroundColor: paymentMethod === 'CASH' ? '#eff6ff' : '#ffffff',
                          cursor: 'pointer', transition: 'all 0.15s'
                        }}
                      >
                        <input type="radio" name="payment" value="CASH" checked={paymentMethod === 'CASH'} onChange={() => setPaymentMethod('CASH')} style={{ accentColor: '#2563eb', cursor: 'pointer' }} />
                        <Banknote size={20} color={paymentMethod === 'CASH' ? '#2563eb' : '#64748b'} />
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>Thanh toán COD (Tiền mặt)</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Thanh toán trực tiếp cho shipper khi nhận hàng</div>
                        </div>
                      </div>

                      {/* Bank Transfer */}
                      <div
                        onClick={() => setPaymentMethod('BANK_TRANSFER')}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0.85rem',
                          border: `2px solid ${paymentMethod === 'BANK_TRANSFER' ? '#2563eb' : '#e2e8f0'}`,
                          borderRadius: '12px', backgroundColor: paymentMethod === 'BANK_TRANSFER' ? '#eff6ff' : '#ffffff',
                          cursor: 'pointer', transition: 'all 0.15s'
                        }}
                      >
                        <input type="radio" name="payment" value="BANK_TRANSFER" checked={paymentMethod === 'BANK_TRANSFER'} onChange={() => setPaymentMethod('BANK_TRANSFER')} style={{ accentColor: '#2563eb', cursor: 'pointer' }} />
                        <QrCode size={20} color={paymentMethod === 'BANK_TRANSFER' ? '#2563eb' : '#64748b'} />
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            Chuyển khoản SePay VietQR <span style={{ backgroundColor: '#16a34a', color: '#fff', fontSize: '0.6rem', padding: '1px 5px', borderRadius: '4px', textTransform: 'uppercase' }}>Tự động</span>
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Quét mã QR ngân hàng tự động nhận diện thanh toán</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Coupon Code Section */}
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.85rem' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.35rem' }}>
                      Mã giảm giá (Coupon): <span style={{ color: '#2563eb', fontWeight: 800 }}>AETHER10</span>, <span style={{ color: '#2563eb', fontWeight: 800 }}>FREESHIP</span>
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="text"
                        placeholder="Nhập mã giảm giá..."
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        style={{ flex: 1, padding: '0.55rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem', color: '#0f172a', textTransform: 'uppercase', outline: 'none' }}
                        disabled={activeCoupon !== null}
                      />
                      {activeCoupon ? (
                        <button type="button" onClick={handleRemoveCoupon} style={{ padding: '0.55rem 1rem', borderRadius: '8px', border: '1px solid #ef4444', backgroundColor: '#fef2f2', color: '#ef4444', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                          Hủy
                        </button>
                      ) : (
                        <button type="button" onClick={handleApplyCoupon} style={{ padding: '0.55rem 1.2rem', borderRadius: '8px', border: 'none', backgroundColor: '#2563eb', color: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                          Áp dụng
                        </button>
                      )}
                    </div>
                    {couponError && <p style={{ color: '#dc2626', fontSize: '0.72rem', marginTop: '0.25rem', fontWeight: 600 }}>{couponError}</p>}
                    {couponSuccess && <p style={{ color: '#16a34a', fontSize: '0.72rem', marginTop: '0.25rem', fontWeight: 600 }}>{couponSuccess}</p>}
                  </div>

                  {/* Summary Breakdown */}
                  <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                      <span>Tạm tính ({selectedCartItems.length} SP đã chọn):</span>
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>{formatPrice(selectedCartTotal)}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', color: '#64748b' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span>Phí vận chuyển:</span>
                        <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 500, marginTop: '1px' }}>
                          {selectedProvince && isFreeShipCity(selectedProvince)
                            ? '(✓ Miễn phí HN & TP.HCM)'
                            : (selectedProvince ? '(Giao tỉnh: 30.000đ)' : '(Freeship HN & TP.HCM, 30k tỉnh khác)')}
                        </span>
                      </div>
                      <span style={{ fontWeight: 700, color: shippingFee === 0 ? '#16a34a' : '#0f172a' }}>
                        {shippingFee === 0 ? 'MIỄN PHÍ' : formatPrice(shippingFee)}
                      </span>
                    </div>

                    {activeCoupon && couponDiscount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626', fontWeight: 700 }}>
                        <span>Khuyến mãi ({activeCoupon.code}):</span>
                        <span>-{formatPrice(couponDiscount)}</span>
                      </div>
                    )}

                    {memberDiscountAmount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626', fontWeight: 700 }}>
                        <span>Ưu đãi hạng {memberTierName}:</span>
                        <span>-{formatPrice(memberDiscountAmount)}</span>
                      </div>
                    )}

                    <div style={{ borderTop: '1.5px dashed #cbd5e1', paddingTop: '0.5rem', marginTop: '0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>Tổng thanh toán:</span>
                      <strong style={{ fontSize: '1.35rem', fontWeight: 900, color: '#dc2626' }}>
                        {formatPrice(finalTotal)}
                      </strong>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={checkingOut}
                    style={{
                      width: '100%', padding: '0.85rem', borderRadius: '12px', border: 'none',
                      backgroundColor: '#dc2626', color: '#ffffff', fontSize: '1rem', fontWeight: 900,
                      cursor: checkingOut ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', gap: '0.5rem', boxShadow: '0 4px 15px rgba(220,38,38,0.3)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <CreditCard size={18} />
                    {checkingOut ? 'Đang thực hiện hạch toán ERP...' : 'Xác Nhận Thanh Toán'}
                  </button>

                </form>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
