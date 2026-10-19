import React, { useMemo, useState } from 'react';
import { X, Award, Star, Clock, AlertTriangle, CheckCircle2, Trophy } from 'lucide-react';

// Bảng so sánh báo giá của 1 đợt RFQ gửi nhiều NCC + chốt NCC trúng thầu.
// Tiêu chí chấm điểm (thang 100, so tương đối giữa các báo giá trong đợt):
//   - Giá: giá thấp nhất trong đợt = 100, các báo giá khác = thấp nhất / giá đó
//   - Tiến độ: số ngày giao sớm nhất = 100 (ngày giao NCC cam kết khi báo giá,
//     không có thì lấy thời gian giao hàng chuẩn của NCC)
//   - Chất lượng: điểm đánh giá NCC trung bình (thang 10 => 100); NCC chưa
//     từng được đánh giá tính 60 và được ghi chú rõ
const WEIGHT_PRESETS = {
  BALANCED: { label: 'Cân bằng (Giá 50% · Tiến độ 25% · Chất lượng 25%)', price: 0.5, delivery: 0.25, quality: 0.25 },
  PRICE: { label: 'Ưu tiên giá (70% · 15% · 15%)', price: 0.7, delivery: 0.15, quality: 0.15 },
  DELIVERY: { label: 'Ưu tiên tiến độ (35% · 45% · 20%)', price: 0.35, delivery: 0.45, quality: 0.2 },
  QUALITY: { label: 'Ưu tiên chất lượng (35% · 20% · 45%)', price: 0.35, delivery: 0.2, quality: 0.45 }
};
const UNRATED_QUALITY = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

const cell = { padding: '0.55rem 0.7rem', borderBottom: '1px solid #eef2f7', fontSize: '0.8rem', verticalAlign: 'top' };
const headCell = { ...cell, backgroundColor: '#f8fafc', fontWeight: 800, color: '#334155', borderBottom: '2px solid #e2e8f0' };
const labelCell = { ...cell, fontWeight: 700, color: '#475569', backgroundColor: '#fcfdff', whiteSpace: 'nowrap' };

function quoteMeta(po) {
  const history = Array.isArray(po.statusHistory) ? po.statusHistory : [];
  const quotedEntry = [...history].reverse().find(h => h.status === 'QUOTED');
  return {
    quotedAt: quotedEntry?.timestamp ? new Date(quotedEntry.timestamp) : null,
    note: quotedEntry?.note && !/^Nhà cung cấp đã gửi báo giá/.test(quotedEntry.note) ? quotedEntry.note : ''
  };
}

export default function RfqComparisonModal({
  groups,
  selectedGroupKey,
  suppliers,
  getSupplierName,
  getSupplierAvgScore,
  formatPurchaseReference,
  formatCurrency,
  canAward,
  onAward,
  onClose
}) {
  const visibleGroups = selectedGroupKey ? groups.filter(g => g.key === selectedGroupKey) : groups;
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '1180px', maxHeight: '92vh', overflowY: 'auto', padding: '1.5rem', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e3e8ef', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Bảng So Sánh & Xét Chọn Báo Giá Nhà Cung Cấp</h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0' }}>
              Đối chiếu đơn giá từng mặt hàng, tổng giá trị, tiến độ giao, điều khoản thanh toán và chất lượng NCC trước khi chốt trúng thầu
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ background: '#f1f5f9', border: '1px solid #e3e8ef', color: '#475569', cursor: 'pointer', padding: '0.4rem', borderRadius: '6px', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {visibleGroups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b', fontSize: '0.9rem' }}>
            Hiện chưa có đợt Yêu Cầu Báo Giá gửi nhiều nhà cung cấp nào đang mở.
          </div>
        ) : visibleGroups.map(group => (
          <BatchComparison
            key={group.key}
            group={group}
            suppliers={suppliers}
            getSupplierName={getSupplierName}
            getSupplierAvgScore={getSupplierAvgScore}
            formatPurchaseReference={formatPurchaseReference}
            formatCurrency={formatCurrency}
            canAward={canAward}
            onAward={onAward}
          />
        ))}
      </div>
    </div>
  );
}

function BatchComparison({ group, suppliers, getSupplierName, getSupplierAvgScore, formatPurchaseReference, formatCurrency, canAward, onAward }) {
  const [presetKey, setPresetKey] = useState('BALANCED');
  const [chosenId, setChosenId] = useState(null);
  const [reason, setReason] = useState('');
  const [reasonTouched, setReasonTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const weights = WEIGHT_PRESETS[presetKey];

  // Danh sách mặt hàng của đợt (hợp nhất theo productId)
  const lines = useMemo(() => {
    const map = new Map();
    for (const po of group.list) {
      for (const it of po.items || []) {
        const pid = String(it.productId || it.product?.productId || '');
        if (!map.has(pid)) map.set(pid, { productId: pid, name: it.product?.name || it.productName || pid, quantity: it.quantity });
      }
    }
    return [...map.values()];
  }, [group.list]);

  const columns = useMemo(() => {
    const now = Date.now();
    const cols = group.list.map(po => {
      const supplier = suppliers.find(s => s.code === (po.supplierCode || po.supplier?.code)) || po.supplier || {};
      const itemsById = new Map((po.items || []).map(it => [String(it.productId || it.product?.productId || ''), it]));
      const pricedLines = lines.filter(l => parseFloat(itemsById.get(l.productId)?.unitCost) > 0).length;
      const total = parseFloat(po.totalAmount) || 0;
      const complete = po.status === 'QUOTED' && pricedLines === lines.length && total > 0;
      const quoteDate = po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate) : null;
      const deliveryDays = quoteDate
        ? Math.max(1, Math.ceil((quoteDate.getTime() - now) / DAY_MS))
        : (Number(supplier.leadTimeDays) > 0 ? Number(supplier.leadTimeDays) : null);
      const rating = getSupplierAvgScore(supplier);
      return { po, supplier, itemsById, pricedLines, total, complete, quoteDate, deliveryDays, rating, ...quoteMeta(po) };
    });

    const comparable = cols.filter(c => c.complete);
    const minTotal = Math.min(...comparable.map(c => c.total));
    const knownDays = comparable.map(c => c.deliveryDays).filter(Boolean);
    const minDays = knownDays.length ? Math.min(...knownDays) : null;
    for (const c of cols) {
      if (!c.complete) { c.score = null; continue; }
      c.priceScore = (minTotal / c.total) * 100;
      c.deliveryScore = c.deliveryDays && minDays ? (minDays / c.deliveryDays) * 100 : 50;
      c.qualityScore = c.rating != null ? Math.min(100, c.rating * 10) : UNRATED_QUALITY;
      c.score = c.priceScore * weights.price + c.deliveryScore * weights.delivery + c.qualityScore * weights.quality;
      c.diffPct = ((c.total - minTotal) / minTotal) * 100;
    }
    const ranked = [...comparable].sort((a, b) => b.score - a.score);
    ranked.forEach((c, i) => { c.rank = i + 1; });
    return cols;
  }, [group.list, lines, suppliers, getSupplierAvgScore, weights]);

  const comparable = columns.filter(c => c.complete);
  const recommended = comparable.find(c => c.rank === 1) || null;
  const cheapest = comparable.length ? comparable.reduce((a, b) => (a.total <= b.total ? a : b)) : null;
  const awaiting = columns.filter(c => ['RFQ', 'RFQ_SENT', 'SENT'].includes(c.po.status));
  const chosen = columns.find(c => c.po.id === chosenId) || null;

  // Giá tốt nhất từng dòng (tham khảo tiềm năng tiết kiệm nếu tách đơn)
  const bestUnit = useMemo(() => {
    const m = {};
    for (const l of lines) {
      const prices = comparable.map(c => parseFloat(c.itemsById.get(l.productId)?.unitCost)).filter(v => v > 0);
      m[l.productId] = prices.length ? Math.min(...prices) : null;
    }
    return m;
  }, [lines, comparable]);
  const bestSplitTotal = lines.reduce((s, l) => s + (bestUnit[l.productId] || 0) * (Number(l.quantity) || 0), 0);

  const suggestReason = (c) => {
    if (!c) return '';
    const parts = [];
    if (cheapest && c.po.id === cheapest.po.id) parts.push('giá chào thấp nhất đợt');
    else if (cheapest) parts.push(`giá cao hơn mức thấp nhất ${c.diffPct.toFixed(1)}% nhưng`);
    if (c.rank === 1) parts.push(`điểm tổng hợp cao nhất (${c.score.toFixed(1)}/100)`);
    if (c.deliveryDays) parts.push(`giao hàng trong ${c.deliveryDays} ngày`);
    if (c.rating != null) parts.push(`đánh giá NCC ${c.rating}/10`);
    return `Chọn ${getSupplierName(c.po)}: ${parts.join(', ')}.`;
  };

  const pick = (c) => {
    setChosenId(c.po.id);
    if (!reasonTouched) setReason(suggestReason(c));
  };

  const notCheapestChosen = chosen && cheapest && chosen.po.id !== cheapest.po.id;
  const reasonOk = reason.trim().length >= (notCheapestChosen ? 20 : 5);

  const submit = async () => {
    if (!chosen || !reasonOk || submitting) return;
    setSubmitting(true);
    try {
      await onAward(chosen.po, reason.trim(), group);
    } finally {
      setSubmitting(false);
    }
  };

  const best = (c, getter, lowerIsBetter = true) => {
    const vals = comparable.map(getter).filter(v => v != null);
    if (!c.complete || !vals.length) return false;
    const v = getter(c);
    return v != null && v === (lowerIsBetter ? Math.min(...vals) : Math.max(...vals));
  };
  const goodBg = '#ecfdf5';

  return (
    <div style={{ marginBottom: '1.75rem' }}>
      {/* Thông tin đợt */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '0.75rem' }}>
        <div style={{ fontSize: '0.82rem', color: '#334155' }}>
          <strong style={{ color: '#0f172a' }}>{group.batchCode ? `Đợt ${group.batchCode}` : 'Đợt so sánh (tạo trước khi có mã đợt)'}</strong>
          {group.createdAt && <span> · Gửi ngày {new Date(group.createdAt).toLocaleDateString('vi-VN')}</span>}
          <span> · Đã nhận <strong>{comparable.length}/{columns.length}</strong> báo giá đầy đủ</span>
          {awaiting.length > 0 && <span style={{ color: '#b45309' }}> · {awaiting.length} NCC chưa báo giá</span>}
        </div>
        <label style={{ fontSize: '0.78rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          Tiêu chí chấm điểm:
          <select value={presetKey} onChange={e => setPresetKey(e.target.value)} style={{ padding: '0.3rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', backgroundColor: '#fff' }}>
            {Object.entries(WEIGHT_PRESETS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
          </select>
        </label>
      </div>

      {/* Ma trận so sánh */}
      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: `${260 + columns.length * 200}px` }}>
          <thead>
            <tr>
              <th style={{ ...headCell, textAlign: 'left', minWidth: '220px' }}>Tiêu chí / Mặt hàng</th>
              {columns.map(c => (
                <th key={c.po.id} style={{ ...headCell, textAlign: 'center', backgroundColor: chosenId === c.po.id ? '#eff6ff' : headCell.backgroundColor }}>
                  <div style={{ color: '#0f172a' }}>{getSupplierName(c.po)}</div>
                  <div style={{ fontWeight: 500, fontSize: '0.72rem', color: '#64748b' }}>{formatPurchaseReference(c.po)}</div>
                  {recommended && c.po.id === recommended.po.id && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '0.25rem', fontSize: '0.68rem', fontWeight: 800, color: '#fff', backgroundColor: '#2563eb', padding: '1px 7px', borderRadius: '999px' }}>
                      <Trophy size={10} /> ĐỀ XUẤT
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Đơn giá từng dòng */}
            {lines.map(l => (
              <tr key={l.productId}>
                <td style={labelCell}>
                  <div style={{ whiteSpace: 'normal', color: '#0f172a' }}>{l.name}</div>
                  <div style={{ fontWeight: 500, fontSize: '0.72rem', color: '#64748b' }}>Số lượng: {l.quantity}</div>
                </td>
                {columns.map(c => {
                  const it = c.itemsById.get(l.productId);
                  const unit = parseFloat(it?.unitCost) || 0;
                  const isBest = unit > 0 && c.complete && unit === bestUnit[l.productId];
                  return (
                    <td key={c.po.id} style={{ ...cell, textAlign: 'right', backgroundColor: isBest ? goodBg : undefined }}>
                      {unit > 0 ? (
                        <>
                          <div style={{ fontWeight: 700, color: isBest ? '#047857' : '#0f172a' }}>{formatCurrency(unit)}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Thành tiền {formatCurrency(unit * (Number(l.quantity) || 0))}</div>
                        </>
                      ) : <span style={{ color: '#94a3b8' }}>{it ? 'Chưa báo giá' : 'Không có trong RFQ'}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}

            <tr>
              <td style={labelCell}>Tổng giá trị báo giá</td>
              {columns.map(c => (
                <td key={c.po.id} style={{ ...cell, textAlign: 'right', backgroundColor: best(c, x => x.total) ? goodBg : undefined }}>
                  {c.complete ? (
                    <>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: best(c, x => x.total) ? '#047857' : '#0f172a' }}>{formatCurrency(c.total)}</div>
                      <div style={{ fontSize: '0.72rem', color: c.diffPct > 0 ? '#b45309' : '#047857', fontWeight: 700 }}>
                        {c.diffPct > 0 ? `+${c.diffPct.toFixed(1)}% so với thấp nhất` : 'Thấp nhất đợt'}
                      </div>
                    </>
                  ) : (
                    <span style={{ color: '#b45309', fontWeight: 700 }}>
                      {c.po.status === 'QUOTED'
                        ? `Thiếu giá ${lines.length - c.pricedLines}/${lines.length} mặt hàng`
                        : c.po.status === 'CANCELLED' ? 'NCC từ chối báo giá'
                          : c.po.status === 'NOT_AWARDED' ? 'Không trúng thầu'
                            : c.po.status === 'PENDING_PO_DRAFT' ? 'Đã trúng thầu'
                              : 'Chờ NCC báo giá'}
                    </span>
                  )}
                </td>
              ))}
            </tr>

            <tr>
              <td style={labelCell}><Clock size={12} style={{ verticalAlign: '-2px' }} /> Tiến độ giao hàng</td>
              {columns.map(c => (
                <td key={c.po.id} style={{ ...cell, textAlign: 'center', backgroundColor: best(c, x => x.deliveryDays) ? goodBg : undefined }}>
                  {c.quoteDate ? (
                    <>
                      <div style={{ fontWeight: 700 }}>{c.quoteDate.toLocaleDateString('vi-VN')}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>~{c.deliveryDays} ngày (NCC cam kết)</div>
                    </>
                  ) : c.deliveryDays ? (
                    <>
                      <div style={{ fontWeight: 700 }}>{c.deliveryDays} ngày</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Thời gian giao chuẩn của NCC</div>
                    </>
                  ) : <span style={{ color: '#94a3b8' }}>Chưa có thông tin</span>}
                </td>
              ))}
            </tr>

            <tr>
              <td style={labelCell}>Điều khoản thanh toán</td>
              {columns.map(c => (
                <td key={c.po.id} style={{ ...cell, textAlign: 'center' }}>{c.supplier.paymentTerms || <span style={{ color: '#94a3b8' }}>Chưa khai báo</span>}</td>
              ))}
            </tr>

            <tr>
              <td style={labelCell}><Star size={12} style={{ verticalAlign: '-2px' }} /> Đánh giá chất lượng NCC</td>
              {columns.map(c => (
                <td key={c.po.id} style={{ ...cell, textAlign: 'center', backgroundColor: best(c, x => x.rating, false) ? goodBg : undefined }}>
                  {c.rating != null
                    ? <strong style={{ color: '#b45309' }}>{c.rating}/10 <span style={{ fontWeight: 500, color: '#64748b' }}>({c.supplier.evaluations?.length || 0} kỳ)</span></strong>
                    : <span style={{ color: '#94a3b8' }}>Chưa đánh giá (tính {UNRATED_QUALITY}/100)</span>}
                </td>
              ))}
            </tr>

            <tr>
              <td style={labelCell}>Ngày gửi báo giá · Ghi chú NCC</td>
              {columns.map(c => (
                <td key={c.po.id} style={{ ...cell, fontSize: '0.75rem', color: '#475569' }}>
                  {c.quotedAt ? c.quotedAt.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                  {c.note && <div style={{ marginTop: '0.2rem', fontStyle: 'italic' }}>“{c.note}”</div>}
                </td>
              ))}
            </tr>

            <tr>
              <td style={{ ...labelCell, color: '#1d4ed8' }}>Điểm tổng hợp (thang 100)</td>
              {columns.map(c => (
                <td key={c.po.id} style={{ ...cell, textAlign: 'center', backgroundColor: c.rank === 1 ? '#eff6ff' : undefined }}>
                  {c.score != null ? (
                    <>
                      <div style={{ fontSize: '1rem', fontWeight: 900, color: c.rank === 1 ? '#1d4ed8' : '#0f172a' }}>{c.score.toFixed(1)}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        Hạng {c.rank}/{comparable.length} · Giá {c.priceScore.toFixed(0)} · Tiến độ {c.deliveryScore.toFixed(0)} · CL {c.qualityScore.toFixed(0)}
                      </div>
                    </>
                  ) : <span style={{ color: '#94a3b8' }}>Chưa đủ dữ liệu</span>}
                </td>
              ))}
            </tr>

            {canAward && (
              <tr>
                <td style={labelCell}>Chọn trúng thầu</td>
                {columns.map(c => (
                  <td key={c.po.id} style={{ ...cell, textAlign: 'center' }}>
                    {c.complete ? (
                      <button
                        type="button"
                        onClick={() => pick(c)}
                        style={{
                          padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.76rem', fontWeight: 800, cursor: 'pointer',
                          border: chosenId === c.po.id ? '2px solid #2563eb' : '1px solid #cbd5e1',
                          backgroundColor: chosenId === c.po.id ? '#2563eb' : '#fff',
                          color: chosenId === c.po.id ? '#fff' : '#334155'
                        }}
                      >
                        {chosenId === c.po.id ? '✓ Đã chọn' : 'Chọn NCC này'}
                      </button>
                    ) : <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Chưa thể chọn</span>}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Ghi chú tham khảo */}
      {comparable.length >= 2 && cheapest && bestSplitTotal > 0 && bestSplitTotal < cheapest.total - 1 && (
        <div style={{ marginTop: '0.6rem', fontSize: '0.76rem', color: '#475569' }}>
          Tham khảo: nếu lấy giá tốt nhất của từng mặt hàng (tách đơn cho nhiều NCC) tổng là {formatCurrency(bestSplitTotal)},
          thấp hơn báo giá trọn gói rẻ nhất {formatCurrency(cheapest.total - bestSplitTotal)}.
        </div>
      )}

      {/* Chốt trúng thầu */}
      {canAward && (
        <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: '8px', border: '1px solid #bfdbfe', backgroundColor: '#f8fbff' }}>
          {!chosen ? (
            <div style={{ fontSize: '0.82rem', color: '#475569' }}>
              Chọn 1 nhà cung cấp ở dòng "Chọn trúng thầu" để lập quyết định.
              {recommended && <> Hệ thống đề xuất: <strong>{getSupplierName(recommended.po)}</strong> (điểm {recommended.score.toFixed(1)}).</>}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
                <Award size={16} color="#2563eb" /> Quyết định chọn: {getSupplierName(chosen.po)} — {formatCurrency(chosen.total)}
              </div>
              {notCheapestChosen && (
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start', fontSize: '0.78rem', color: '#b45309', marginBottom: '0.5rem' }}>
                  <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                  Không phải báo giá thấp nhất (cao hơn {formatCurrency(chosen.total - cheapest.total)}, +{chosen.diffPct.toFixed(1)}%) — cần ghi rõ lý do (tối thiểu 20 ký tự), lý do được lưu vào nhật ký kiểm toán.
                </div>
              )}
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>Lý do lựa chọn</label>
              <textarea
                rows={2}
                value={reason}
                onChange={e => { setReason(e.target.value); setReasonTouched(true); }}
                style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.6rem', borderRadius: '6px', border: `1px solid ${reasonOk ? '#cbd5e1' : '#fca5a5'}`, fontSize: '0.8rem' }}
              />
              <div style={{ fontSize: '0.75rem', color: '#475569', margin: '0.5rem 0 0.75rem' }}>
                <CheckCircle2 size={12} style={{ verticalAlign: '-2px', color: '#047857' }} /> Báo giá được chọn chuyển sang "Đã duyệt — Chờ lập phiếu".
                {' '}{columns.length - 1} RFQ còn lại của đợt (kể cả {awaiting.length} NCC chưa báo giá) chuyển "Không trúng thầu".
                {' '}Hệ thống gửi email kết quả cho từng NCC (không tiết lộ tên/giá của NCC khác) và ghi lịch sử cho mọi RFQ.
                {awaiting.length > 0 && <span style={{ color: '#b45309' }}> Lưu ý: còn NCC chưa gửi báo giá — chốt bây giờ sẽ đóng đợt với các NCC đó.</span>}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setChosenId(null); setReasonTouched(false); setReason(''); }} style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                  Bỏ chọn
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={!reasonOk || submitting}
                  style={{ padding: '0.5rem 1.1rem', borderRadius: '6px', border: 'none', background: !reasonOk || submitting ? '#94a3b8' : '#16a34a', color: '#fff', fontWeight: 800, fontSize: '0.8rem', cursor: !reasonOk || submitting ? 'not-allowed' : 'pointer' }}
                >
                  {submitting ? 'Đang chốt...' : 'Xác nhận trúng thầu & thông báo NCC'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
