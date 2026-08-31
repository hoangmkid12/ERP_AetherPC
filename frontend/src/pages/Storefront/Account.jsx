import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, User } from 'lucide-react';
import AccountSidebar from '../../components/AccountSidebar';

export default function Account() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('profile');

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('Nam');
  const [dob, setDob] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    } else {
      setName(user.name || '');
      setPhone(user.phone || '');
      setGender(user.gender || 'Nam');
      setDob(user.dob || '');
    }
  }, [user, navigate]);

  if (!user) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateUser({ name, phone, gender, dob });
      alert('Cập nhật hồ sơ thành công!');
    } catch (err) {
      alert('Có lỗi xảy ra: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };



  return (
    <div style={{ minHeight: '80vh', padding: '2rem 0' }} className="container">
      <div style={{ display: 'flex', gap: '2rem' }}>
        
        {/* Sidebar */}
        <AccountSidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Main Content */}
        <div style={{ flex: 1 }} className="card-glass">
          {activeTab === 'profile' && (
            <div style={{ padding: '2rem' }}>
              <div style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>Hồ Sơ Của Tôi</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Quản lý thông tin hồ sơ để bảo mật tài khoản</p>
              </div>

              <div style={{ display: 'flex', gap: '3rem' }}>
                {/* Form */}
                <form onSubmit={handleSave} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  
                  {/* Row: Username */}
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ color: 'var(--text-secondary)', textAlign: 'right', fontSize: '0.95rem' }}>Tên đăng nhập</div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{user.username || user.email?.split('@')[0]}</div>
                  </div>

                  {/* Row: Name */}
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ color: 'var(--text-secondary)', textAlign: 'right', fontSize: '0.95rem' }}>Tên</div>
                    <input 
                      type="text" 
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="form-input"
                      style={{ padding: '0.6rem 1rem' }}
                    />
                  </div>

                  {/* Row: Email */}
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ color: 'var(--text-secondary)', textAlign: 'right', fontSize: '0.95rem' }}>Email</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ color: 'var(--text-primary)' }}>{user.email?.replace(/(.{2})(.*)(?=@)/, (gp1, gp2, gp3) => gp1 + '*'.repeat(gp2.length))}</span>
                      <button type="button" style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.9rem' }}>Thay Đổi</button>
                    </div>
                  </div>

                  {/* Row: Phone */}
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ color: 'var(--text-secondary)', textAlign: 'right', fontSize: '0.95rem' }}>Số điện thoại</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ color: 'var(--text-primary)' }}>{phone ? phone.replace(/.(?=.{2})/g, '*') : 'Chưa cập nhật'}</span>
                      <button type="button" style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.9rem' }}>Thay Đổi</button>
                    </div>
                  </div>

                  {/* Row: Gender */}
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ color: 'var(--text-secondary)', textAlign: 'right', fontSize: '0.95rem' }}>Giới tính</div>
                    <div style={{ display: 'flex', gap: '1.5rem' }}>
                      {['Nam', 'Nữ', 'Khác'].map(g => (
                        <label key={g} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                          <input 
                            type="radio" 
                            name="gender" 
                            value={g}
                            checked={gender === g}
                            onChange={e => setGender(e.target.value)}
                            style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                          />
                          {g}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Row: DOB */}
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ color: 'var(--text-secondary)', textAlign: 'right', fontSize: '0.95rem' }}>Ngày sinh</div>
                    <input 
                      type="date"
                      value={dob}
                      onChange={e => setDob(e.target.value)}
                      className="form-input"
                      style={{ padding: '0.6rem 1rem', width: 'fit-content' }}
                    />
                  </div>

                  {/* Submit */}
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '1.5rem', marginTop: '1rem' }}>
                    <div></div>
                    <button type="submit" disabled={isSaving} className="btn btn-primary" style={{ width: 'fit-content', padding: '0.6rem 1.5rem' }}>
                      {isSaving ? 'Đang lưu...' : 'Lưu'}
                    </button>
                  </div>
                </form>

                {/* Avatar Section */}
                <div style={{ width: '250px', borderLeft: '1px solid var(--border-glass)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1rem 0 1rem 2rem' }}>
                  <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', overflow: 'hidden', border: '1px solid var(--border-glass)' }}>
                    <User size={50} color="var(--text-muted)" />
                  </div>
                  <button type="button" style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', marginBottom: '1rem', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.1)'} onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.05)'}>
                    Chọn Ảnh
                  </button>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
                    Dụng lượng file tối đa 1 MB<br/>
                    Định dạng: .JPEG, .PNG
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab !== 'profile' && (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ marginBottom: '1rem' }}><Lock size={48} opacity={0.2} /></div>
              <h3>Tính năng đang phát triển</h3>
              <p>Phần cài đặt này sẽ được cập nhật trong phiên bản tiếp theo.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
