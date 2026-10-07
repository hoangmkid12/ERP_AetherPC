import React from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// Dung lượng tối đa của ảnh/video gửi trong chat CSKH — khớp giới hạn ở máy chủ (chatUpload.middleware.js).
export const CHAT_MAX_FILE_SIZE = 10 * 1024 * 1024;

// Đường dẫn xem tệp. Khách (chưa chắc đã đăng nhập) gửi kèm mã phiên để máy chủ xác nhận tệp thuộc phiên của họ;
// nhân viên CSKH được xác thực bằng cookie đăng nhập nên không cần.
export const chatAttachmentUrl = (id, sessionId) =>
  `${API_BASE}/chat/attachments/${encodeURIComponent(id)}${sessionId ? `?s=${encodeURIComponent(sessionId)}` : ''}`;

export default function ChatAttachment({ attachment, sessionId }) {
  if (!attachment?.id) return null;
  const src = chatAttachmentUrl(attachment.id, sessionId);
  const box = { display: 'block', maxWidth: '100%', width: 220, maxHeight: 260, borderRadius: 10, backgroundColor: '#0f172a' };
  if (attachment.type === 'video') {
    return <video src={src} controls preload="metadata" playsInline style={box} />;
  }
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" title={attachment.name || 'Ảnh'}>
      <img src={src} alt={attachment.name || 'Ảnh đính kèm'} loading="lazy" style={{ ...box, objectFit: 'cover', backgroundColor: '#e2e8f0' }} />
    </a>
  );
}

export const attachmentPreviewText = (m) =>
  m?.text || (m?.attachment ? (m.attachment.type === 'video' ? '[Video]' : '[Hình ảnh]') : '');
