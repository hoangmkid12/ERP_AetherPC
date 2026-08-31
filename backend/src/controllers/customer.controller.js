const prisma = require('../config/database');

// Lấy danh sách địa chỉ của khách hàng
const getAddresses = async (req, res, next) => {
  try {
    const customerId = req.user.id;
    const addresses = await prisma.customerAddress.findMany({
      where: { customerId },
      orderBy: [
        { isDefault: 'desc' },
        { id: 'desc' }
      ]
    });

    res.json({ success: true, data: addresses });
  } catch (err) {
    next(err);
  }
};

// Thêm địa chỉ mới
const addAddress = async (req, res, next) => {
  try {
    const customerId = req.user.id;
    const { recipientName, recipientPhone, addressLine, ward, district, city, isDefault } = req.body;

    if (!recipientName || !recipientPhone || !addressLine || !city) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ các trường bắt buộc' });
    }

    // Nếu người dùng chọn làm mặc định, phải bỏ mặc định của các địa chỉ cũ
    if (isDefault) {
      await prisma.customerAddress.updateMany({
        where: { customerId, isDefault: true },
        data: { isDefault: false }
      });
    } else {
      // Nếu là địa chỉ đầu tiên, tự động set mặc định
      const count = await prisma.customerAddress.count({ where: { customerId } });
      if (count === 0) {
        req.body.isDefault = true;
      }
    }

    const newAddress = await prisma.customerAddress.create({
      data: {
        customerId,
        recipientName,
        recipientPhone,
        addressLine,
        ward,
        district,
        city,
        isDefault: req.body.isDefault !== undefined ? req.body.isDefault : (isDefault || false)
      }
    });

    if (newAddress.isDefault) {
      const fullAddress = [addressLine, ward, district].filter(Boolean).join(', ');
      await prisma.customer.update({
        where: { customerId },
        data: {
          phone: recipientPhone,
          address: fullAddress,
          city: city
        }
      });
    }

    res.status(201).json({ success: true, message: 'Thêm địa chỉ thành công', data: newAddress });
  } catch (err) {
    next(err);
  }
};

// Cập nhật địa chỉ
const updateAddress = async (req, res, next) => {
  try {
    const customerId = req.user.id;
    const { id } = req.params;
    const { recipientName, recipientPhone, addressLine, ward, district, city, isDefault } = req.body;

    // Xác nhận địa chỉ thuộc về user này
    const address = await prisma.customerAddress.findFirst({
      where: { id: parseInt(id), customerId }
    });

    if (!address) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy địa chỉ' });
    }

    if (isDefault && !address.isDefault) {
      await prisma.customerAddress.updateMany({
        where: { customerId, isDefault: true },
        data: { isDefault: false }
      });
    }

    const updatedAddress = await prisma.customerAddress.update({
      where: { id: parseInt(id) },
      data: {
        recipientName,
        recipientPhone,
        addressLine,
        ward,
        district,
        city,
        isDefault: isDefault !== undefined ? isDefault : address.isDefault
      }
    });

    if (updatedAddress.isDefault) {
      const fullAddress = [addressLine, ward, district].filter(Boolean).join(', ');
      await prisma.customer.update({
        where: { customerId },
        data: {
          phone: recipientPhone,
          address: fullAddress,
          city: city
        }
      });
    }

    res.json({ success: true, message: 'Cập nhật địa chỉ thành công', data: updatedAddress });
  } catch (err) {
    next(err);
  }
};

// Đặt làm địa chỉ mặc định (Quick toggle)
const setDefaultAddress = async (req, res, next) => {
  try {
    const customerId = req.user.id;
    const { id } = req.params;

    const address = await prisma.customerAddress.findFirst({
      where: { id: parseInt(id), customerId }
    });

    if (!address) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy địa chỉ' });
    }

    await prisma.$transaction([
      prisma.customerAddress.updateMany({
        where: { customerId, isDefault: true },
        data: { isDefault: false }
      }),
      prisma.customerAddress.update({
        where: { id: parseInt(id) },
        data: { isDefault: true }
      })
    ]);

    const fullAddress = [address.addressLine, address.ward, address.district].filter(Boolean).join(', ');
    await prisma.customer.update({
      where: { customerId },
      data: {
        phone: address.recipientPhone,
        address: fullAddress,
        city: address.city
      }
    });

    res.json({ success: true, message: 'Đã cập nhật địa chỉ mặc định' });
  } catch (err) {
    next(err);
  }
};

// Xóa địa chỉ
const deleteAddress = async (req, res, next) => {
  try {
    const customerId = req.user.id;
    const { id } = req.params;

    const address = await prisma.customerAddress.findFirst({
      where: { id: parseInt(id), customerId }
    });

    if (!address) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy địa chỉ' });
    }

    await prisma.customerAddress.delete({
      where: { id: parseInt(id) }
    });

    // Nếu địa chỉ bị xóa là mặc định, lấy địa chỉ mới nhất làm mặc định
    if (address.isDefault) {
      const latest = await prisma.customerAddress.findFirst({
        where: { customerId },
        orderBy: { id: 'desc' }
      });
      if (latest) {
        await prisma.customerAddress.update({
          where: { id: latest.id },
          data: { isDefault: true }
        });
      }
    }

    res.json({ success: true, message: 'Xóa địa chỉ thành công' });
  } catch (err) {
    next(err);
  }
};

// Lấy hồ sơ người dùng (kèm thông tin từ db thay vì chỉ JWT)
const getProfile = async (req, res, next) => {
  try {
    const customerId = req.user.id;
    const customer = await prisma.customer.findUnique({
      where: { customerId },
      select: {
        customerId: true,
        email: true,
        name: true,
        phone: true,
        gender: true,
        city: true,
        loyaltyPoints: true,
        tier: true,
        createdAt: true
      }
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin khách hàng' });
    }
    res.json({ success: true, data: customer });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAddresses,
  addAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
  getProfile
};
