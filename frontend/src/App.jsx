import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { NotificationProvider } from './context/NotificationContext';
import { initializeAllStores } from './stores';

// Storefront Components
import Header from './components/Layout/Header';
import Footer from './components/Layout/Footer';
import Chatbot from './components/Layout/Chatbot';
import Home from './pages/Storefront/Home';
import PCBuilder from './pages/Storefront/PCBuilder';
import Cart from './pages/Storefront/Cart';
import MyOrders from './pages/Storefront/MyOrders';
import Products from './pages/Storefront/Products';
import ProductDetail from './pages/Storefront/ProductDetail';
import Promotions from './pages/Storefront/Promotions';
import News from './pages/Storefront/News';
import NewsDetail from './pages/Storefront/NewsDetail';
import About from './pages/Storefront/About';
import Careers from './pages/Storefront/Careers';
import MemberTier from './pages/Storefront/MemberTier';
import FlashSale from './pages/Storefront/FlashSale';
import Profile from './pages/Storefront/Profile';
import Login from './pages/Login';

// Admin ERP Components
import Sidebar from './components/Layout/Sidebar';
import Dashboard from './pages/Admin/Dashboard';
import SalesPOS from './pages/Admin/SalesPOS';
import Warehouse from './pages/Admin/Warehouse';
import Assembly from './pages/Admin/Assembly';
import HRManager from './pages/Admin/HRManager';
import Accountant from './pages/Admin/Accountant';
import Purchasing from './pages/Admin/Purchasing';
import SystemAdmin from './pages/Admin/SystemAdmin';
import MyPayroll from './pages/Admin/MyPayroll';
import SupplierPortal from './pages/SupplierPortal';
import CustomerService from './pages/Admin/CustomerService';
import Delivery from './pages/Admin/Delivery';
import QualityControl from './pages/Admin/QualityControl';

// 1. Layout for Storefront Customer Views
const StorefrontLayout = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
      <Footer />
      <Chatbot />
    </div>
  );
};

// 2. Layout for Admin Panel Views
const AdminLayout = () => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Đang tải...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Verify that they are indeed an employee (including HR, Accounting, QA/QC actors)
  const isEmployee = ['CEO', 'SALES', 'SALES_MANAGER', 'WAREHOUSE', 'WAREHOUSE_MANAGER', 'ASSEMBLY', 'HR', 'ACCOUNTANT', 'PURCHASING', 'ADMIN', 'CSKH', 'DELIVERY', 'QC', 'QA', 'QUALITY_CONTROL'].includes(user?.role);
  if (!isEmployee) {
    return <Navigate to="/" replace />;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      <Sidebar />
      <main style={{ flex: 1, overflowY: 'auto', maxHeight: '100vh', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
        <Outlet />
      </main>
    </div>
  );
};

// 3. Role-Based Access Guard Wrapper
const ProtectedRoute = ({ allowedRoles, children }) => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Đang tải...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to fallback page if role is unauthorized
    return <Navigate to="/admin" replace />;
  }

  return children;
};

// 4. Default Admin Entry Redirect handler
const AdminIndexRedirect = () => {
  const { user } = useAuth();
  
  if (!user) return <Navigate to="/login" replace />;

  switch (user.role) {
    case 'CEO':
      return <Navigate to="/admin/dashboard" replace />;
    case 'SALES':
    case 'SALES_MANAGER':
      return <Navigate to="/admin/sales" replace />;
    case 'WAREHOUSE':
    case 'WAREHOUSE_MANAGER':
      return <Navigate to="/admin/warehouse" replace />;
    case 'ASSEMBLY':
      return <Navigate to="/admin/assembly" replace />;
    case 'HR':
      return <Navigate to="/admin/hr" replace />;
    case 'ACCOUNTANT':
      return <Navigate to="/admin/accounting" replace />;
    case 'PURCHASING':
      return <Navigate to="/admin/purchasing" replace />;
    case 'QC':
    case 'QA':
    case 'QUALITY_CONTROL':
      return <Navigate to="/admin/quality-control" replace />;
    case 'ADMIN':
      return <Navigate to="/admin/system" replace />;
    case 'CSKH':
      return <Navigate to="/admin/cskh" replace />;
    case 'DELIVERY':
      return <Navigate to="/admin/delivery" replace />;
    default:
      return <Navigate to="/" replace />;
  }
};

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

export default function App() {
  useEffect(() => {
    initializeAllStores();
  }, []);

  return (
    <AuthProvider>
      <NotificationProvider>
        <CartProvider>

            <Router>
              <ScrollToTop />
              <Routes>
                {/* Storefront Layout Routes */}
                <Route path="/" element={<StorefrontLayout />}>
                  <Route index element={<Home />} />
                  <Route path="products" element={<Products />} />
                  <Route path="product/:id" element={<ProductDetail />} />
                  <Route path="pc-builder" element={<PCBuilder />} />
                  <Route path="cart" element={<Cart />} />
                  <Route path="my-orders" element={<MyOrders />} />
                  {/* New TMĐT Pages */}
                  <Route path="promotions" element={<Promotions />} />
                  <Route path="flash-sale" element={<FlashSale />} />
                  <Route path="news" element={<News />} />
                  <Route path="news/:id" element={<NewsDetail />} />
                  <Route path="about" element={<About />} />
                  <Route path="careers" element={<Careers />} />
                  <Route path="member-tier" element={<MemberTier />} />
                  <Route path="profile" element={<Profile />} />
                </Route>

                {/* Standalone Login Route */}
                <Route path="/login" element={<Login />} />

                {/* Protected Admin ERP Layout Routes */}
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<AdminIndexRedirect />} />
                  
                  <Route path="dashboard" element={
                    <ProtectedRoute allowedRoles={['CEO', 'ADMIN']}>
                      <Dashboard />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="sales" element={
                    <ProtectedRoute allowedRoles={['CEO', 'SALES', 'SALES_MANAGER', 'ADMIN']}>
                      <SalesPOS />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="warehouse" element={
                    <ProtectedRoute allowedRoles={['CEO', 'WAREHOUSE', 'WAREHOUSE_MANAGER', 'SALES_MANAGER', 'SALES', 'ADMIN']}>
                      <Warehouse />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="assembly" element={
                    <ProtectedRoute allowedRoles={['ASSEMBLY', 'CEO', 'ADMIN']}>
                      <Assembly />
                    </ProtectedRoute>
                  } />

                  <Route path="hr" element={
                    <ProtectedRoute allowedRoles={['CEO', 'HR', 'ADMIN', 'ACCOUNTANT']}>
                      <HRManager />
                    </ProtectedRoute>
                  } />

                  <Route path="accounting" element={
                    <ProtectedRoute allowedRoles={['CEO', 'ACCOUNTANT', 'ADMIN']}>
                      <Accountant />
                    </ProtectedRoute>
                  } />

                  <Route path="purchasing" element={
                    <ProtectedRoute allowedRoles={['CEO', 'PURCHASING', 'WAREHOUSE_MANAGER', 'ADMIN']}>
                      <Purchasing />
                    </ProtectedRoute>
                  } />

                  <Route path="quality-control" element={
                    <ProtectedRoute allowedRoles={['QC', 'QA', 'QUALITY_CONTROL', 'CEO', 'ADMIN', 'WAREHOUSE', 'WAREHOUSE_MANAGER', 'PURCHASING']}>
                      <QualityControl />
                    </ProtectedRoute>
                  } />

                  <Route path="system" element={
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                      <SystemAdmin />
                    </ProtectedRoute>
                  } />

                  <Route path="cskh" element={
                    <ProtectedRoute allowedRoles={['CSKH', 'ADMIN', 'SALES_MANAGER', 'CEO']}>
                      <CustomerService />
                    </ProtectedRoute>
                  } />

                  <Route path="delivery" element={
                    <ProtectedRoute allowedRoles={['DELIVERY', 'WAREHOUSE', 'WAREHOUSE_MANAGER', 'SALES_MANAGER', 'ADMIN', 'CEO']}>
                      <Delivery />
                    </ProtectedRoute>
                  } />
                </Route>

                {/* Supplier Portal Layout Routes */}
                <Route path="/supplier" element={
                  <ProtectedRoute allowedRoles={['SUPPLIER']}>
                    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
                      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
                        <Outlet />
                      </main>
                    </div>
                  </ProtectedRoute>
                }>
                  <Route path="portal" element={<SupplierPortal />} />
                </Route>

                {/* General fallback route */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Router>
        </CartProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}
