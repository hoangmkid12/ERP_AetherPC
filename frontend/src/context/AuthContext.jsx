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

      // 1. Employee / staff / supplier login
      try {
        const response = await api.post('/auth/employee/login', {
          email: cleanUser.includes('@') ? cleanUser : `${lowerUser}@kltn-erp.vn`,
          username: cleanUser,
          password
        });
        if (response && response.token && response.user) {
          const userObj = {
            ...response.user,
            username: response.user.username || lowerUser,
            role: response.user.role || 'DELIVERY'
          };
          setUser(userObj);
          setLoading(false);
          return userObj;
        }
      } catch (empError) {
        // Not an employee/supplier account — fall through to customer login.
      }

      // 2. Customer login
      const response = await api.post('/auth/login', { email: cleanUser, username: cleanUser, password });
      if (response && response.token && response.user) {
        const userObj = {
          ...response.user,
          role: response.user.role || 'CUSTOMER'
        };
        setUser(userObj);
        setLoading(false);
        return userObj;
      }

      throw new Error('Tài khoản hoặc mật khẩu không chính xác');
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

  const hasPermission = (permissionKey) => {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    try {
      const matrix = JSON.parse(localStorage.getItem('erp_rbac_matrix') || '[]');
      const roleItem = matrix.find(r => r.role === user.role || (['QC', 'QA', 'QUALITY_CONTROL'].includes(user.role) && r.role.includes('QC')));
      if (roleItem && typeof roleItem[permissionKey] !== 'undefined') {
        return Boolean(roleItem[permissionKey]);
      }
    } catch (e) {
      // fallback
    }
    return true;
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
    hasPermission,
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
