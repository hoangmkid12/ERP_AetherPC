import React from 'react';

export const Button = React.memo(({ 
  children, 
  variant = 'primary', 
  size = 'md',
  className = '',
  ...props 
}) => {
  const baseClasses = 'inline-flex items-center justify-center gap-2 font-medium rounded-md transition-all disabled:opacity-45 disabled:cursor-not-allowed';
  
  const variantClasses = {
    primary: 'bg-primary text-white hover:bg-blue-700 shadow-md hover:shadow-lg',
    secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 border border-slate-300',
    danger: 'bg-danger text-white hover:bg-red-700 shadow-md hover:shadow-lg',
    success: 'bg-success text-white hover:bg-green-700 shadow-md hover:shadow-lg',
    ghost: 'text-slate-600 hover:bg-slate-100',
    outline: 'border border-primary text-primary hover:bg-blue-50',
  };

  const sizeClasses = {
    xs: 'px-2 py-1 text-xs',
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
    xl: 'px-6 py-3 text-base',
  };

  return (
    <button 
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});

Button.displayName = 'Button';

