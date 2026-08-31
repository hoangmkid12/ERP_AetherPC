import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { CheckCircle2, ShoppingBag, X } from 'lucide-react';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

export const useCart = () => useContext(CartContext);

const getProductId = (p) => {
  if (!p) return undefined;
  return p.id ?? p.product_id ?? p.productId;
};

export const CartProvider = ({ children }) => {
  const auth = useAuth() || {};
  const user = auth.user;
  const [cartItems, setCartItems] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [toastMessage, setToastMessage] = useState(null);

  // User identifier for persistent cart per account
  const userId = user ? (user.username || user.email || user.id || 'user') : 'guest';
  const cartStorageKey = `cart_user_${userId}`;
  
  // Track initial load per user to avoid overwriting on mount
  const isLoadedRef = useRef(false);

  // Sync cart when user changes (login, logout, or account switch)
  useEffect(() => {
    isLoadedRef.current = false;
    const storedUserCart = localStorage.getItem(cartStorageKey) || localStorage.getItem('cart');
    
    if (storedUserCart) {
      try {
        const parsed = JSON.parse(storedUserCart);
        if (Array.isArray(parsed)) {
          const cleaned = parsed
            .filter(item => item && item.product && getProductId(item.product) !== undefined)
            .map(item => ({
              product: {
                id: getProductId(item.product),
                product_id: getProductId(item.product),
                productId: getProductId(item.product),
                name: item.product.name || item.product.productName || 'Sản phẩm',
                price: Number(item.product.price ?? item.product.unitPrice ?? 0),
                image: item.product.image || item.product.imageUrl || '',
                category: item.product.category || item.product.categoryName || 'Linh kiện',
                brand: item.product.brand || item.product.brandName || 'Chính hãng'
              },
              quantity: parseInt(item.quantity, 10) || 1,
              selectedSpec: item.selectedSpec && typeof item.selectedSpec === 'object' && !item.selectedSpec.target ? item.selectedSpec : null
            }));
          setCartItems(cleaned);
        } else {
          setCartItems([]);
        }
      } catch (e) {
        console.warn('Corrupt cart data detected, resetting:', e);
        setCartItems([]);
        try {
          localStorage.removeItem(cartStorageKey);
          localStorage.removeItem('cart');
        } catch (err) {}
      }
    } else {
      setCartItems([]);
    }
    isLoadedRef.current = true;
  }, [userId, cartStorageKey]);

  // Save cart items to user-specific localStorage key whenever cartItems changes
  useEffect(() => {
    if (!isLoadedRef.current) return;
    try {
      localStorage.setItem(cartStorageKey, JSON.stringify(cartItems));
      localStorage.setItem('cart', JSON.stringify(cartItems)); // Fallback sync
    } catch (e) {
      console.error('Error saving cart to localStorage:', e);
    }
  }, [cartItems, cartStorageKey]);

  // Wishlist initialization & sync
  useEffect(() => {
    const storedWishlist = localStorage.getItem('wishlist');
    if (storedWishlist) {
      try {
        setWishlist(JSON.parse(storedWishlist));
      } catch (e) {
        localStorage.removeItem('wishlist');
      }
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('wishlist', JSON.stringify(wishlist));
    } catch (e) {}
  }, [wishlist]);

  const toggleWishlist = (product) => {
    setWishlist((prev) => {
      const targetId = getProductId(product);
      const exists = prev.some((item) => String(getProductId(item)) === String(targetId));
      if (exists) {
        return prev.filter((item) => String(getProductId(item)) !== String(targetId));
      } else {
        return [...prev, product];
      }
    });
  };

  const isInWishlist = (productId) => {
    return wishlist.some((item) => String(getProductId(item)) === String(productId));
  };

  const addToCart = (product, rawQuantity = 1, rawSpec = null) => {
    if (!product) return;

    // 1. Sanitize quantity: ensure it's a valid positive integer
    let parsedQty = parseInt(rawQuantity, 10);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      parsedQty = 1;
    }

    // 2. Sanitize selectedSpec: if it's a React SyntheticEvent or non-serializable object, reset to null
    let safeSpec = rawSpec;
    if (
      safeSpec &&
      (typeof safeSpec !== 'object' ||
        safeSpec.nativeEvent ||
        safeSpec.target ||
        safeSpec.preventDefault ||
        safeSpec._reactName)
    ) {
      safeSpec = null;
    }

    // 3. Clean product object to prevent non-serializable properties
    const pId = getProductId(product);
    if (pId === undefined || pId === null) return;

    const cleanProduct = {
      id: pId,
      product_id: pId,
      productId: pId,
      name: product.name || product.productName || 'Sản phẩm',
      price: Number(product.price ?? product.unitPrice ?? product.originalPrice ?? 0),
      image: product.image || product.imageUrl || '',
      category: product.category || product.categoryName || 'Linh kiện',
      brand: product.brand || product.brandName || 'Chính hãng',
      stock_quantity: product.stock_quantity ?? product.stock ?? 50
    };

    const specKey = safeSpec ? JSON.stringify(safeSpec) : null;

    setCartItems((prevItems) => {
      const existingIndex = prevItems.findIndex((item) => {
        if (!item || !item.product) return false;
        const itemId = getProductId(item.product);
        const itemSpecKey = item.selectedSpec ? JSON.stringify(item.selectedSpec) : null;
        return String(itemId) === String(pId) && itemSpecKey === specKey;
      });

      if (existingIndex > -1) {
        const newItems = [...prevItems];
        const currentQty = parseInt(newItems[existingIndex].quantity, 10) || 1;
        newItems[existingIndex].quantity = currentQty + parsedQty;
        newItems[existingIndex].selectedSpec = safeSpec;
        return newItems;
      } else {
        return [...prevItems, { product: cleanProduct, quantity: parsedQty, selectedSpec: safeSpec }];
      }
    });

    // Trigger Toast Notification Popup safely
    setToastMessage({
      name: cleanProduct.name,
      price: cleanProduct.price ? cleanProduct.price.toLocaleString('vi-VN') + ' ₫' : '',
      quantity: parsedQty
    });

    setTimeout(() => {
      setToastMessage(null);
    }, 3800);
  };

  const removeFromCart = (productId, selectedSpec = null) => {
    setCartItems((prevItems) =>
      prevItems.filter(
        (item) => !(String(getProductId(item.product)) === String(productId) && JSON.stringify(item.selectedSpec) === JSON.stringify(selectedSpec))
      )
    );
  };

  const removeSelectedFromCart = (selectedKeysArray) => {
    if (!Array.isArray(selectedKeysArray)) return;
    setCartItems((prevItems) =>
      prevItems.filter((item) => {
        const pId = getProductId(item.product);
        const key = `${pId}-${JSON.stringify(item.selectedSpec || null)}`;
        return !selectedKeysArray.includes(key);
      })
    );
  };

  const updateQuantity = (productId, quantity, selectedSpec = null) => {
    if (quantity <= 0) {
      removeFromCart(productId, selectedSpec);
      return;
    }
    setCartItems((prevItems) =>
      prevItems.map((item) =>
        String(getProductId(item.product)) === String(productId) && JSON.stringify(item.selectedSpec) === JSON.stringify(selectedSpec)
          ? { ...item, quantity: parseInt(quantity, 10) || 1 }
          : item
      )
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const cartCount = cartItems.reduce((sum, item) => sum + (parseInt(item.quantity, 10) || 1), 0);
  
  const cartTotal = cartItems.reduce((sum, item) => {
    const price = Number(item?.product?.price ?? item?.product?.unitPrice ?? 0);
    return sum + price * (parseInt(item.quantity, 10) || 1);
  }, 0);

  const value = {
    cartItems,
    addToCart,
    removeFromCart,
    removeSelectedFromCart,
    updateQuantity,
    clearCart,
    cartCount,
    cartTotal,
    wishlist,
    toggleWishlist,
    isInWishlist,
  };

  return (
    <CartContext.Provider value={value}>
      {children}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '90px',
          right: '24px',
          zIndex: 999999,
          backgroundColor: '#ffffff',
          border: '1px solid #16a34a',
          borderRadius: '16px',
          padding: '0.875rem 1.15rem',
          boxShadow: '0 15px 35px rgba(22, 163, 74, 0.2), 0 4px 12px rgba(0, 0, 0, 0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
          maxWidth: '380px',
          animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            backgroundColor: '#dcfce7',
            border: '1px solid #bbf7d0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <CheckCircle2 size={22} style={{ color: '#16a34a' }} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#15803d', fontWeight: 800, fontSize: '0.85rem' }}>
              <ShoppingBag size={14} />
              <span>Đã thêm vào giỏ hàng!</span>
            </div>
            <div style={{ color: '#0f172a', fontWeight: 700, fontSize: '0.825rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
              {toastMessage.name}
            </div>
            {toastMessage.price && (
              <div style={{ color: '#16a34a', fontWeight: 700, fontSize: '0.75rem', marginTop: '1px' }}>
                {toastMessage.price} {toastMessage.quantity > 1 ? `(x${toastMessage.quantity})` : ''}
              </div>
            )}
          </div>

          <button
            onClick={() => setToastMessage(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%'
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </CartContext.Provider>
  );
};
