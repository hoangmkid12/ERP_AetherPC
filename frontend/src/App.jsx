import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { NotificationProvider } from './context/NotificationContext';
import { initializeAllStores } from './stores';
import { getRolesForModule } from './utils/rbacEngine';

// Layout chrome loads eagerly (needed on first paint of every page).
// Every actual page is lazy-loaded instead — the JS for e.g. SystemAdmin's
// RBAC matrix or the POS screen no longer has to download+parse before the
// public storefront or the login page can render at all.
import Header from './components/Layout/Header';
import Footer from './components/Layout/Footer';
import Chatbot from './components/Layout/Chatbot';
import Sidebar from './components/Layout/Sidebar';
import DeliveryAppShell from './components/Layout/DeliveryAppShell';

// Storefront Components
const Home = lazy(() => import('./pages/Storefront/Home'));
const PCBuilder = lazy(() => import('./pages/Storefront/PCBuilder'));
const Cart = lazy(() => import('./pages/Storefront/Cart'));
const MyOrders = lazy(() => import('./pages/Storefront/MyOrders'));
const Products = lazy(() => import('./pages/Storefront/Products'));
const ProductDetail = lazy(() => import('./pages/Storefront/ProductDetail'));
const Promotions = lazy(() => import('./pages/Storefront/Promotions'));
const News = lazy(() => import('./pages/Storefront/News'));
const NewsDetail = lazy(() => import('./pages/Storefront/NewsDetail'));
const About = lazy(() => import('./pages/Storefront/About'));
const Careers = lazy(() => import('./pages/Storefront/Careers'));
const MemberTier = lazy(() => import('./pages/Storefront/MemberTier'));
const FlashSale = lazy(() => import('./pages/Storefront/FlashSale'));
const Profile = lazy(() => import('./pages/Storefront/Profile'));
const Login = lazy(() => import('./pages/Login'));

// Admin ERP Components
const Dashboard = lazy(() => import('./pages/Admin/Dashboard'));
const SalesPOS = lazy(() => import('./pages/Admin/SalesPOS'));
const Warehouse = lazy(() => import('./pages/Admin/Warehouse'));
const Assembly = lazy(() => import('./pages/Admin/Assembly'));
const HRManager = lazy(() => import('./pages/Admin/HRManager'));
const Accountant = lazy(() => import('./pages/Admin/Accountant'));
const Purchasing = lazy(() => import('./pages/Admin/Purchasing'));
const SystemAdmin = lazy(() => import('./pages/Admin/SystemAdmin'));
const MyPayroll = lazy(() => import('./pages/Admin/MyPayroll'));
const SupplierPortal = lazy(() => import('./pages/SupplierPortal'));
const CustomerService = lazy(() => import('./pages/Admin/CustomerService'));
const Delivery = lazy(() => import('./pages/Admin/Delivery'));
const QualityControl = lazy(() => import('./pages/Admin/QualityControl'));

// Shown while a lazy route chunk downloads — same "Đang tải..." look already
// used by ProtectedRoute/AdminLayout's own auth-loading states.
const RouteLoadingFallback = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
    <div style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.95rem' }}>Đang tải...</div>
  </div>
);

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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();

  // Close mobile sidebar on route transition
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname, location.search]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg-app)' }}>
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

  // Shippers get a permanent mobile-app-style shell (top bar + bottom tab
  // bar), regardless of viewport width — every other role keeps the
  // Sidebar+main desktop layout unchanged.
  if (user?.role === 'DELIVERY') {
    return (
      <DeliveryAppShell>
        <Outlet />
      </DeliveryAppShell>
    );
  }

  return (
    <div className="admin-layout-container" style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-app)' }}>
      {/* Top Mobile Bar for Admin ERP on screens <= 1024px */}
      <header
        className="admin-mobile-topbar"
        style={{
          height: '56px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '0 1rem',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 9999,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Mở Menu Quản Trị"
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '8px',
              width: '38px',
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0f172a',
              cursor: 'pointer',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>AetherPC</span>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, background: '#eff6ff', color: '#2563eb', padding: '2px 6px', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
              {user?.role || 'ERP'}
            </span>
          </div>
        </div>

        <Link
          to="/"
          style={{
            fontSize: '0.8rem',
            fontWeight: 600,
            color: '#64748b',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
        >
          <span>Ra Cửa Hàng</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </Link>
      </header>

      {/* Backdrop overlay for mobile drawer */}
      {mobileSidebarOpen && (
        <div
          className="admin-sidebar-backdrop"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar (Drawer on mobile, sticky fixed column on desktop) */}
      <Sidebar isOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />

      {/* Main ERP Content View */}
      <main className="admin-main-content" style={{ flex: 1, overflowY: 'auto', maxHeight: '100vh', minHeight: '100vh', backgroundColor: 'var(--bg-app)' }}>
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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg-app)' }}>
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
              <Suspense fallback={<RouteLoadingFallback />}>
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
                    <ProtectedRoute allowedRoles={getRolesForModule('dashboard')}>
                      <Dashboard />
                    </ProtectedRoute>
                  } />

                  <Route path="sales" element={
                    <ProtectedRoute allowedRoles={getRolesForModule('sales')}>
                      <SalesPOS />
                    </ProtectedRoute>
                  } />

                  <Route path="warehouse" element={
                    <ProtectedRoute allowedRoles={getRolesForModule('warehouse')}>
                      <Warehouse />
                    </ProtectedRoute>
                  } />

                  <Route path="assembly" element={
                    <ProtectedRoute allowedRoles={getRolesForModule('assembly')}>
                      <Assembly />
                    </ProtectedRoute>
                  } />

                  <Route path="hr" element={
                    <ProtectedRoute allowedRoles={getRolesForModule('hr')}>
                      <HRManager />
                    </ProtectedRoute>
                  } />

                  <Route path="accounting" element={
                    <ProtectedRoute allowedRoles={getRolesForModule('accounting')}>
                      <Accountant />
                    </ProtectedRoute>
                  } />

                  <Route path="purchasing" element={
                    <ProtectedRoute allowedRoles={getRolesForModule('purchasing')}>
                      <Purchasing />
                    </ProtectedRoute>
                  } />

                  <Route path="quality-control" element={
                    <ProtectedRoute allowedRoles={getRolesForModule('quality-control')}>
                      <QualityControl />
                    </ProtectedRoute>
                  } />

                  <Route path="system" element={
                    <ProtectedRoute allowedRoles={getRolesForModule('system')}>
                      <SystemAdmin />
                    </ProtectedRoute>
                  } />

                  <Route path="cskh" element={
                    <ProtectedRoute allowedRoles={getRolesForModule('cskh')}>
                      <CustomerService />
                    </ProtectedRoute>
                  } />

                  <Route path="delivery" element={
                    <ProtectedRoute allowedRoles={getRolesForModule('delivery')}>
                      <Delivery />
                    </ProtectedRoute>
                  } />

                  {/* Cổng tự tra cứu phiếu lương — mở cho MỌI nhân viên (không
                      theo ma trận RBAC module như các trang trên), vì đây là
                      dữ liệu cá nhân của chính người xem, không phải một
                      nghiệp vụ theo phòng ban. AdminLayout đã tự kiểm tra
                      isEmployee ở tầng ngoài. */}
                  <Route path="my-payroll" element={<MyPayroll />} />

                </Route>

                {/* Supplier Portal Layout Routes */}
                <Route path="/supplier" element={
                  <ProtectedRoute allowedRoles={['SUPPLIER']}>
                    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-app)' }}>
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
              </Suspense>
            </Router>
        </CartProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}
