const jwt = require('jsonwebtoken');

const authMiddleware = (roles = []) => {
  return (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      
      // Try reading from Authorization header (Bearer token)
      let token = null;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      } else if (req.cookies && req.cookies.authToken) {
        // Fallback: read from HTTP-Only cookie for backward compatibility
        token = req.cookies.authToken;
      }

      if (!token) {
        return res.status(401).json({ success: false, message: 'Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.' });
      }

      // Verify real JWT token
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        console.error('CRITICAL: JWT_SECRET is not set in environment variables');
        return res.status(500).json({ success: false, message: 'Lỗi cấu hình máy chủ (thiếu khoá xác thực).' });
      }

      const decoded = jwt.verify(token, secret);
      req.user = decoded;

      // Role check (ADMIN and CEO have broad access)
      if (roles.length > 0 && !roles.includes(decoded.role) && decoded.role !== 'ADMIN' && decoded.role !== 'CEO') {
        return res.status(403).json({ success: false, message: 'Tài khoản của bạn không có quyền thực hiện thao tác này.' });
      }

      next();
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn, vui lòng đăng nhập lại.' });
    }
  };
};

const optionalAuthMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.authToken) {
      token = req.cookies.authToken;
    }

    if (token && process.env.JWT_SECRET) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    }
  } catch (_) {
    req.user = null;
  }
  next();
};

module.exports = { authMiddleware, optionalAuthMiddleware };

