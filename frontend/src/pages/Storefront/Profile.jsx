import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Plus, User, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { notify, confirm } from '../../context/NotificationContext';
import { api } from '../../services/api';

const TEXT = {
  home: 'Trang chủ',
  account: 'Tài khoản của tôi',
  profile: 'Hồ sơ cá nhân',
  addresses: 'Sổ địa chỉ',
  profileTitle: 'Hồ sơ của tôi',
  edit: 'Chỉnh sửa hồ sơ',
  name: 'Họ và tên',
  phone: 'Số điện thoại',
  gender: 'Giới tính',
  notUpdated: 'Chưa cập nhật',
  cancel: 'Hủy',
  save: 'Lưu thay đổi',
  addAddress: 'Thêm địa chỉ mới',
  default: 'Mặc định',
  setDefault: 'Thiết lập mặc định',
  update: 'Cập nhật',
  delete: 'Xóa',
  noAddress: 'Bạn chưa lưu địa chỉ nào.',
  back: 'Trở lại',
  complete: 'Hoàn thành',
  addressTitle: 'Sổ địa chỉ nhận hàng',
  street: 'Địa chỉ cụ thể (Số nhà, tên đường)',
  city: 'Tỉnh / Thành phố',
  district: 'Quận / Huyện',
  ward: 'Phường / Xã',
  male: 'Nam',
  female: 'Nữ',
  other: 'Khác',
  member: 'Thành viên'
};

const emptyAddress = { recipientName: '', recipientPhone: '', addressLine: '', city: '', district: '', ward: '', isDefault: false };
const sortAddresses = (items = []) => [...items].sort((a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)) || Number(b.id) - Number(a.id));

export default function Profile() {
  const { user, loading: authLoading, updateUser } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('info');
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', gender: '' });

  // Address state
  const [addresses, setAddresses] = useState([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [addressForm, setAddressForm] = useState(emptyAddress);

  useEffect(() => {
    if (!authLoading && !user) navigate('/login', { replace: true });
  }, [authLoading, user, navigate]);

  // Load customer addresses
  const loadAddresses = async () => {
    setLoadingAddresses(true);
    try {
      const result = await api.get('/customers/addresses');
      setAddresses(sortAddresses(result.data || []));
    } catch (error) {
      console.warn('Unable to load saved addresses:', error);
    } finally {
      setLoadingAddresses(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'address') loadAddresses();
  }, [activeTab]);

  // Save profile info
  const saveProfile = async (event) => {
    event.preventDefault();
    const name = profileForm.name.trim();
    if (!name) return;
    try {
      await updateUser({
        name,
        fullname: name,
        phone: profileForm.phone.trim(),
        gender: profileForm.gender
      });
      setEditingProfile(false);
      notify('Cập nhật thông tin hồ sơ thành công.', 'success');
    } catch (error) {
      notify(error.message || 'Không thể cập nhật hồ sơ.', 'error');
    }
  };

  // Save address
  const saveAddress = async (event) => {
    event.preventDefault();
    try {
      if (editingAddress) await api.put(`/customers/addresses/${editingAddress.id}`, addressForm);
      else await api.post('/customers/addresses', addressForm);
      setShowAddressModal(false);
      await loadAddresses();
    } catch (error) {
      notify(error.message || 'Không thể lưu địa chỉ.', 'error');
    }
  };

  // Delete address
  const deleteAddress = async (id) => {
    if (!(await confirm('Bạn có chắc muốn xóa địa chỉ này?', { danger: true }))) return;
    try {
      await api.delete(`/customers/addresses/${id}`);
      await loadAddresses();
    } catch (error) {
      notify(error.message || 'Không thể xóa địa chỉ.', 'error');
    }
  };

  // Set default address
  const makeDefault = async (id) => {
    try {
      await api.patch(`/customers/addresses/${id}/default`);
      await loadAddresses();
    } catch (error) {
      notify(error.message || 'Không thể đặt địa chỉ mặc định.', 'error');
    }
  };

  if (authLoading || !user) return null;

  const displayName = user.fullname || user.name || user.username || 'Khách Hàng';
  const displayEmail = user.email || (user.username ? `${user.username}@gmail.com` : 'Chưa cập nhật email');

  const openProfileEditor = () => {
    setProfileForm({
      name: user.name || user.fullname || '',
      phone: user.phone || '',
      gender: user.gender || ''
    });
    setEditingProfile(true);
  };

  const openNewAddress = () => {
    setEditingAddress(null);
    setAddressForm(emptyAddress);
    setShowAddressModal(true);
  };

  const openEditAddress = (address) => {
    setEditingAddress(address);
    setAddressForm({ ...emptyAddress, ...address });
    setShowAddressModal(true);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '1020px', margin: '0 auto' }}>
        {/* Breadcrumbs */}
        <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.5rem', color: '#64748b', fontSize: '0.85rem' }}>
          <Link to="/" style={{ color: 'inherit', textDecoration: 'none' }}>{TEXT.home}</Link>
          <span>›</span>
          <strong style={{ color: '#0f172a' }}>{TEXT.account}</strong>
        </div>

        <div style={{ display: 'flex', gap: '1.75rem', alignItems: 'flex-start' }}>
          {/* Left Sidebar */}
          <aside style={{
            width: '280px',
            flexShrink: 0,
            background: '#ffffff',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)',
            border: '1px solid #e2e8f0'
          }}>
            {/* User Avatar Info Header */}
            <div style={{
              display: 'flex',
              gap: '0.85rem',
              alignItems: 'center',
              marginBottom: '1.5rem',
              paddingBottom: '1.25rem',
              borderBottom: '1px solid #f1f5f9'
            }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                fontSize: '1.25rem',
                fontWeight: 800,
                flexShrink: 0,
                boxShadow: '0 4px 10px rgba(37, 99, 235, 0.25)'
              }}>
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <strong style={{
                  fontSize: '0.95rem',
                  color: '#0f172a',
                  display: 'block',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }} title={displayName}>
                  {displayName}
                </strong>
                <div style={{
                  fontSize: '0.75rem',
                  color: '#64748b',
                  marginTop: '2px',
                  display: 'inline-block',
                  background: '#f1f5f9',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontWeight: 600
                }}>
                  {TEXT.member} {user.tier || 'SILVER'}
                </div>
              </div>
            </div>

            {/* Navigation Tabs (Only Profile Info & Address Book) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {[
                ['info', User, TEXT.profile],
                ['address', MapPin, TEXT.addresses]
              ].map(([tab, Icon, label]) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      border: 'none',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '0.88rem',
                      textAlign: 'left',
                      background: isActive ? '#eff6ff' : 'transparent',
                      color: isActive ? '#2563eb' : '#475569',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Icon size={18} color={isActive ? '#2563eb' : '#64748b'} />
                    {label}
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Main Content Area */}
          <main style={{
            flex: 1,
            minWidth: 0,
            background: '#ffffff',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)',
            border: '1px solid #e2e8f0'
          }}>
            {/* 1. Profile Info Tab */}
            {activeTab === 'info' && (
              <section>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #f1f5f9' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 800 }}>{TEXT.profileTitle}</h2>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>Quản lý thông tin cá nhân của bạn tại AetherPC</p>
                  </div>
                  {!editingProfile && (
                    <button onClick={openProfileEditor} style={primaryButton}>
                      {TEXT.edit}
                    </button>
                  )}
                </div>

                {editingProfile ? (
                  <form onSubmit={saveProfile} style={formStyle}>
                    <Field label={TEXT.name}>
                      <input required value={profileForm.name} onChange={event => setProfileForm({ ...profileForm, name: event.target.value })} placeholder="Nhập họ và tên" />
                    </Field>
                    <Field label="Địa chỉ Email">
                      <input disabled value={displayEmail} style={{ backgroundColor: '#f8fafc', cursor: 'not-allowed', color: '#64748b' }} />
                    </Field>
                    <Field label={TEXT.phone}>
                      <input value={profileForm.phone} onChange={event => setProfileForm({ ...profileForm, phone: event.target.value })} placeholder="Nhập số điện thoại nhận hàng" />
                    </Field>
                    <Field label={TEXT.gender}>
                      <select value={profileForm.gender} onChange={event => setProfileForm({ ...profileForm, gender: event.target.value })}>
                        <option value="">{TEXT.other}</option>
                        <option value="MALE">{TEXT.male}</option>
                        <option value="FEMALE">{TEXT.female}</option>
                      </select>
                    </Field>
                    <Actions onCancel={() => setEditingProfile(false)} saveLabel={TEXT.save} />
                  </form>
                ) : (
                  <ProfileDetails user={user} displayEmail={displayEmail} />
                )}
              </section>
            )}

            {/* 2. Address Book Tab */}
            {activeTab === 'address' && (
              <section>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #f1f5f9' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 800 }}>{TEXT.addressTitle}</h2>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>Địa chỉ nhận hàng mặc định khi thanh toán đơn hàng</p>
                  </div>
                  <button onClick={openNewAddress} style={primaryButton}>
                    <Plus size={17} /> {TEXT.addAddress}
                  </button>
                </div>

                {loadingAddresses ? (
                  <p style={{ color: '#64748b' }}>Đang tải danh sách địa chỉ...</p>
                ) : addresses.length === 0 ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                    <MapPin size={42} style={{ color: '#94a3b8', margin: '0 auto 0.5rem' }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>{TEXT.noAddress}</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    {addresses.map(address => (
                      <AddressCard
                        key={address.id}
                        address={address}
                        onEdit={() => openEditAddress(address)}
                        onDelete={() => deleteAddress(address.id)}
                        onDefault={() => makeDefault(address.id)}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </main>
        </div>
      </div>

      {/* Address Edit/Create Modal */}
      {showAddressModal && (
        <AddressModal
          form={addressForm}
          setForm={setAddressForm}
          editing={Boolean(editingAddress)}
          onClose={() => setShowAddressModal(false)}
          onSave={saveAddress}
        />
      )}
    </div>
  );
}

const primaryButton = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '.5rem',
  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
  color: '#ffffff',
  border: 0,
  borderRadius: '8px',
  padding: '.65rem 1.15rem',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: '0.85rem',
  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
};

const formStyle = { display: 'grid', gap: '1.15rem' };

function Field({ label, children }) {
  return (
    <label style={{ display: 'grid', gap: '.4rem', color: '#334155', fontWeight: 600, fontSize: '0.85rem' }}>
      {label}
      {React.cloneElement(children, {
        style: {
          boxSizing: 'border-box',
          width: '100%',
          padding: '.7rem 0.85rem',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          font: 'inherit',
          fontSize: '0.88rem',
          outline: 'none',
          backgroundColor: '#ffffff',
          ...(children.props?.style || {})
        }
      })}
    </label>
  );
}

function Actions({ onCancel, saveLabel }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.75rem', marginTop: '0.5rem' }}>
      <button
        type="button"
        onClick={onCancel}
        style={{
          padding: '.65rem 1.15rem',
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          color: '#475569',
          fontWeight: 600,
          cursor: 'pointer'
        }}
      >
        {TEXT.cancel}
      </button>
      <button type="submit" style={primaryButton}>
        {saveLabel}
      </button>
    </div>
  );
}

function ProfileDetails({ user, displayEmail }) {
  const gender = user.gender === 'MALE' ? TEXT.male : user.gender === 'FEMALE' ? TEXT.female : TEXT.other;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '1.25rem', rowGap: '1.5rem', fontSize: '0.88rem' }}>
      <span style={{ color: '#64748b', fontWeight: 500 }}>{TEXT.name}</span>
      <strong style={{ color: '#0f172a' }}>{user.fullname || user.name || user.username}</strong>

      <span style={{ color: '#64748b', fontWeight: 500 }}>Địa chỉ Email</span>
      <strong style={{ color: '#0f172a' }}>{displayEmail}</strong>

      <span style={{ color: '#64748b', fontWeight: 500 }}>{TEXT.phone}</span>
      <strong style={{ color: '#0f172a' }}>{user.phone || TEXT.notUpdated}</strong>

      <span style={{ color: '#64748b', fontWeight: 500 }}>{TEXT.gender}</span>
      <strong style={{ color: '#0f172a' }}>{gender}</strong>

      <span style={{ color: '#64748b', fontWeight: 500 }}>Hạng thành viên</span>
      <div>
        <span style={{ background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, fontSize: '0.75rem', border: '1px solid #fde68a' }}>
          {user.tier || 'SILVER'}
        </span>
      </div>
    </div>
  );
}

function AddressCard({ address, onEdit, onDelete, onDefault }) {
  return (
    <div style={{
      padding: '1.25rem',
      border: address.isDefault ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
      borderRadius: '12px',
      background: address.isDefault ? '#eff6ff' : '#ffffff',
      boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>{address.recipientName}</strong>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{address.recipientPhone}</span>
            {address.isDefault && (
              <span style={{ marginLeft: '0.5rem', background: '#2563eb', color: '#fff', padding: '1px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}>
                {TEXT.default}
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.45 }}>
            {address.addressLine}<br />
            {[address.ward, address.district, address.city].filter(Boolean).join(', ')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <button onClick={onEdit} style={linkButton}>{TEXT.update}</button>
          {!address.isDefault && (
            <>
              <button onClick={onDelete} style={{ ...linkButton, color: '#ef4444' }}>{TEXT.delete}</button>
              <button onClick={onDefault} style={linkButton}>{TEXT.setDefault}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AddressModal({ form, setForm, editing, onClose, onSave }) {
  const update = key => event => setForm({ ...form, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value });
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(2px)', display: 'grid', placeItems: 'center', zIndex: 100000000, padding: '1rem' }}>
      <form onSubmit={onSave} style={{ width: 'min(520px, 100%)', background: '#ffffff', borderRadius: '16px', padding: '1.75rem', display: 'grid', gap: '1rem', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', fontWeight: 800 }}>{editing ? TEXT.update : TEXT.addAddress}</h3>
          <button type="button" onClick={onClose} style={{ border: 0, background: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
        </div>
        <Field label={TEXT.name}><input required value={form.recipientName} onChange={update('recipientName')} placeholder="Tên người nhận hàng" /></Field>
        <Field label={TEXT.phone}><input required value={form.recipientPhone} onChange={update('recipientPhone')} placeholder="Số điện thoại nhận hàng" /></Field>
        <Field label={TEXT.city}><input required value={form.city} onChange={update('city')} placeholder="Tỉnh / Thành phố" /></Field>
        <Field label={TEXT.district}><input value={form.district} onChange={update('district')} placeholder="Quận / Huyện" /></Field>
        <Field label={TEXT.ward}><input value={form.ward} onChange={update('ward')} placeholder="Phường / Xã" /></Field>
        <Field label={TEXT.street}><textarea required rows={2} value={form.addressLine} onChange={update('addressLine')} placeholder="Số nhà, tên đường..." /></Field>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#334155', fontWeight: 600 }}>
          <input type="checkbox" checked={form.isDefault} onChange={update('isDefault')} />
          {TEXT.setDefault}
        </label>
        <Actions onCancel={onClose} saveLabel={TEXT.complete} />
      </form>
    </div>
  );
}

const linkButton = { border: 0, background: 'none', color: '#2563eb', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: '0.82rem' };