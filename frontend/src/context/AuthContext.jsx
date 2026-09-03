import React, { createContext, useState, useEffect, useContext } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session from the backend's HTTP-Only authToken cookie on load.
  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      try {
        const response = await api.get('/auth/me');
        if (active && response && response.user) {
          setUser(response.user);
        }
      } catch (e) {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    restoreSession();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    // api.js dispatches this when a session cookie is missing/expired.
    const handleAuthChange = () => setUser(null);
    window.addEventListener('auth-change', handleAuthChange);
    return () => window.removeEventListener('auth-change', handleAuthChange);
  }, []);

  const login = async (username, password) => {
    setLoading(true);
    try {
      const cleanUser = String(username || '').trim();
      const lowerUser = cleanUser.toLowerCase();

      // Employee/staff/supplier and customer accounts live in separate tables
      // behind separate endpoints, and there's no way to tell which one a
      // typed identifier belongs to up front — only the backend knows.
      // Firing both concurrently and taking whichever succeeds first (instead
      // of trying employee, awaiting its failure, then only starting the
      // customer attempt) roughly halves perceived login latency for every
      // customer account, since it no longer pays for a full extra
      // network round-trip + bcrypt compare before even starting the
      // request that will actually succeed. api.js already throws on a
      // non-2xx response, so Promise.any's "first fulfilled" is exactly
      // "first endpoint that actually accepted these credentials" — it only
      // rejects (AggregateError) once *both* have failed.
      //
      // Only pass `email` on the employee attempt when the user actually
      // typed one — the backend already derives a `{code}@kltn-erp.vn` guess
      // from `username` itself and also matches employeeCode/supplier code
      // directly. Guessing an email here and always sending it made the
      // backend's `email || username` priority pick the guess over the real
      // identifier for every account whose real email doesn't follow that
      // pattern (e.g. supplier accounts like SUP-FPT, whose real email is a
      // company address, not sup-fpt@kltn-erp.vn) — login failed with a
      // wrong-looking "Invalid credentials" no matter how correct the typed
      // code/password was.
      const employeeAttempt = api.post('/auth/employee/login', {
        ...(cleanUser.includes('@') ? { email: cleanUser } : {}),
        username: cleanUser,
        password
      }).then(response => ({ kind: 'employee', response }));

      const customerAttempt = api.post('/auth/login', { email: cleanUser, username: cleanUser, password })
        .then(response => ({ kind: 'customer', response }));

      let kind, response;
      try {
        ({ kind, response } = await Promise.any([employeeAttempt, customerAttempt]));
      } catch (aggregateError) {
        throw new Error('Tài khoản hoặc mật khẩu không chính xác');
      }

      if (!response || !response.token || !response.user) {
        throw new Error('Tài khoản hoặc mật khẩu không chính xác');
      }

      const userObj = kind === 'employee'
        ? { ...response.user, username: response.user.username || lowerUser, role: response.user.role || 'DELIVERY' }
        : { ...response.user, role: response.user.role || 'CUSTOMER' };

      setUser(userObj);
      setLoading(false);
      return userObj;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const register = async (userData) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/register', userData);
      if (!response || !response.token || !response.user) {
        throw new Error('Đăng ký không thành công');
      }
      const userObj = { ...response.user, role: 'CUSTOMER' };
      setUser(userObj);
      setLoading(false);
      return userObj;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const updateUser = async (updatedFields) => {
    setLoading(true);
    try {
      const response = await api.put('/auth/profile', {
        id: user.id,
        role: user.role,
        ...updatedFields
      });
      if (!response || !response.success || !response.user) {
        throw new Error('Cập nhật hồ sơ không thành công');
      }
      const updatedUserObj = { ...user, ...response.user };
      setUser(updatedUserObj);
      setLoading(false);
      return updatedUserObj;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    // Fire-and-forget: clear the HTTP-Only cookie server-side. The UI has
    // already logged the user out locally regardless of this call's outcome.
    api.post('/auth/logout').catch(() => {});
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
    isAuthenticated: !!user,
    isCEO: user?.role === 'CEO',
    isSales: user?.role === 'SALES',
    isSalesManager: user?.role === 'SALES_MANAGER',
    isWarehouse: user?.role === 'WAREHOUSE',
    isWarehouseManager: user?.role === 'WAREHOUSE_MANAGER',
    isAssembly: user?.role === 'ASSEMBLY',
    isHR: user?.role === 'HR',
    isAccountant: user?.role === 'ACCOUNTANT',
    isPurchasing: user?.role === 'PURCHASING',
    isAdmin: user?.role === 'ADMIN',
    isSupplier: user?.role === 'SUPPLIER',
    isCustomer: user?.role === 'CUSTOMER' || !user,
    isCskh: user?.role === 'CSKH',
    isDelivery: user?.role === 'DELIVERY',
    isQC: ['QC', 'QA', 'QUALITY_CONTROL'].includes(user?.role)
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
