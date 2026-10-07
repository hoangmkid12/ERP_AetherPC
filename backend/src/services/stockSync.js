// Đồng bộ tồn kho vật lý (bảng inventory, theo từng kho) với Product.stockQuantity.
//
// Trang bán hàng đọc Product.stockQuantity, trang Kho đọc tổng inventory.quantityOnHand.
// Mọi thao tác làm thay đổi Product.stockQuantity phải đi kèm đúng một thay đổi bằng
// nhau trên inventory — các hàm dưới đây gom logic đó vào một chỗ để không còn lệch:
//   - trước đây khi không kho nào đủ hàng, đơn chỉ trừ ở một kho rồi đặt kho đó về 0,
//     phần thiếu không được trừ ở kho còn lại;
//   - hoàn kho chỉ cộng nếu Kho 1 đã có dòng inventory cho sản phẩm, nếu không thì bỏ qua.

const MAIN_WAREHOUSE_ID = 1;

/**
 * Trừ `qty` đơn vị khỏi tồn kho vật lý: ưu tiên Kho chính, sau đó các kho còn nhiều hàng nhất.
 * Ghi một StockMovement OUT cho mỗi kho bị trừ. Ném lỗi 409 nếu tổng tồn các kho không đủ
 * (tức dữ liệu đã lệch từ trước) để giao dịch được hoàn tác thay vì lệch thêm.
 * @returns {Promise<Array<{warehouseId:number, quantity:number}>>}
 */
async function deductInventory(tx, productId, qty, { referenceId = null, note = '', createdBy = null } = {}) {
  const rows = await tx.inventory.findMany({ where: { productId, quantityOnHand: { gt: 0 } } });
  rows.sort((a, b) => (b.warehouseId === MAIN_WAREHOUSE_ID) - (a.warehouseId === MAIN_WAREHOUSE_ID) || b.quantityOnHand - a.quantityOnHand);
  const total = rows.reduce((s, r) => s + r.quantityOnHand, 0);
  if (total < qty) {
    const err = new Error(`Tồn kho thực tế tại các kho của sản phẩm ${productId} chỉ còn ${total}, không đủ ${qty}. Vui lòng kiểm kê lại kho.`);
    err.statusCode = 409;
    throw err;
  }

  const taken = [];
  let remaining = qty;
  for (const row of rows) {
    if (remaining <= 0) break;
    const take = Math.min(row.quantityOnHand, remaining);
    // Trừ có điều kiện để hai giao dịch đồng thời không cùng lấy một phần tồn
    const res = await tx.inventory.updateMany({
      where: { id: row.id, quantityOnHand: { gte: take } },
      data: { quantityOnHand: { decrement: take } },
    });
    if (res.count !== 1) {
      const err = new Error(`Tồn kho sản phẩm ${productId} vừa thay đổi, vui lòng thử lại.`);
      err.statusCode = 409;
      throw err;
    }
    await tx.stockMovement.create({
      data: { productId, fromWarehouseId: row.warehouseId, type: 'OUT', quantity: take, referenceId, note, createdBy },
    });
    taken.push({ warehouseId: row.warehouseId, quantity: take });
    remaining -= take;
  }
  return taken;
}

/**
 * Cộng `qty` đơn vị vào tồn kho vật lý của một kho (mặc định Kho chính), tạo dòng inventory
 * nếu sản phẩm chưa có ở kho đó, và ghi StockMovement IN.
 */
async function restockInventory(tx, productId, qty, { warehouseId = MAIN_WAREHOUSE_ID, referenceId = null, note = '', createdBy = null } = {}) {
  await tx.inventory.upsert({
    where: { productId_warehouseId: { productId, warehouseId } },
    update: { quantityOnHand: { increment: qty } },
    create: { productId, warehouseId, quantityOnHand: qty },
  });
  await tx.stockMovement.create({
    data: { productId, toWarehouseId: warehouseId, type: 'IN', quantity: qty, referenceId, note, createdBy },
  });
}

module.exports = { deductInventory, restockInventory, MAIN_WAREHOUSE_ID };
