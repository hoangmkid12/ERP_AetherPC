import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Heart } from 'lucide-react';

export const HeaderActions = React.memo(({ cartCount = 0, wishlistCount = 0, onWishlistClick }) => {
  const handleWishlistClick = useCallback(() => {
    onWishlistClick?.();
  }, [onWishlistClick]);

  return (
    <div className="flex items-center gap-3 flex-shrink-0">
      {/* Cart */}
      <Link
        to="/cart"
        className="relative flex items-center gap-2 h-10 px-3 rounded-md bg-slate-100 border border-slate-300 text-slate-600 text-sm font-medium hover:border-blue-500 hover:text-slate-900 transition-all"
      >
        <ShoppingBag size={15} />
        <span className="hidden sm:inline">Giỏ Hàng</span>
        {cartCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {cartCount > 99 ? '99+' : cartCount}
          </span>
        )}
      </Link>

      {/* Wishlist */}
      <button
        onClick={handleWishlistClick}
        className="relative flex items-center gap-2 h-10 px-3 rounded-md bg-slate-100 border border-slate-300 text-slate-600 text-sm font-medium hover:border-blue-500 hover:text-slate-900 transition-all hidden sm:flex"
      >
        <Heart size={15} className={wishlistCount > 0 ? 'fill-red-500 text-red-500' : ''} />
        <span>Yêu Thích</span>
        {wishlistCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {wishlistCount}
          </span>
        )}
      </button>
    </div>
  );
});

HeaderActions.displayName = 'HeaderActions';

