import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Nhật ký QC trước đây lưu cục bộ trong trình duyệt (kèm biên bản mẫu); nay dựng từ dữ liệu thật
// trên máy chủ. Xoá cache cũ để các màn Kho/QC không ưu tiên số liệu nghiệm thu đã lỗi thời.
try { localStorage.removeItem('erp_qa_inspection_logs'); } catch (_) { /* trình duyệt chặn storage */ }

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
