import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, Tag, Newspaper, Building2, Users, Wrench } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Sản Phẩm', path: '/products' },
  {
    label: 'Khuyến Mãi',
    path: '/promotions',
    icon: <Tag size={15} />,
    highlight: true,
  },
  {
    label: 'Tự Build PC',
    path: '/pc-builder',
    icon: <Wrench size={15} />,
  },
  {
    label: 'Tin Tức',
    path: '/news',
    icon: <Newspaper size={15} />,
    dropdown: [
      { label: 'Tất Cả Bài Viết', path: '/news' },
      { label: 'Review Sản Phẩm', path: '/news?cat=review' },
      { label: 'Hướng Dẫn Build PC', path: '/news?cat=guide' },
    ],
  },
  {
    label: 'Về Chúng Tôi',
    path: '/about',
    icon: <Building2 size={15} />,
    dropdown: [
      { label: 'Giới Thiệu Công Ty', path: '/about' },
      { label: 'Tuyển Dụng', path: '/careers' },
    ],
  },
];

export const HeaderNav = React.memo(() => {
  const [openDropdown, setOpenDropdown] = useState(null);
  const location = useLocation();
  const ref = useRef(null);

  const isActive = (path) => location.pathname.startsWith(path);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav ref={ref} className="hidden md:flex items-center gap-1 flex-1 justify-center">
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.path);
        const hasDropdown = item.dropdown?.length > 0;
        const isOpen = openDropdown === item.label;

        return (
          <div key={item.label} className="relative">
            {hasDropdown ? (
              <button
                onClick={() => setOpenDropdown(isOpen ? null : item.label)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  active
                    ? 'bg-blue-100 text-blue-600'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {item.icon}
                {item.label}
                <ChevronDown
                  size={13}
                  style={{
                    transform: isOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s',
                  }}
                />
              </button>
            ) : (
              <Link
                to={item.path}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                  item.highlight
                    ? 'text-red-600 font-bold'
                    : active
                    ? 'bg-blue-100 text-blue-600'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            )}

            {hasDropdown && isOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 min-w-[220px] overflow-hidden">
                {item.dropdown.map((sub) => (
                  <Link
                    key={sub.path}
                    to={sub.path}
                    className="block px-4 py-2.5 text-sm text-slate-600 hover:bg-blue-50 hover:text-slate-900 transition-colors first:rounded-t-lg last:rounded-b-lg"
                    onClick={() => setOpenDropdown(null)}
                  >
                    {sub.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
});

HeaderNav.displayName = 'HeaderNav';

