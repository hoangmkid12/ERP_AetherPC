import React from 'react';
import { usePermission } from '../hooks/usePermission';

/**
 * PermissionGate: Render children only if user has permission.
 * If not, optionally render fallback.
 * 
 * Example:
 * <PermissionGate module="warehouse" action="edit" fallback={<span>Chỉ xem</span>}>
 *   <button onClick={handleEdit}>Chỉnh Sửa</button>
 * </PermissionGate>
 */
export default function PermissionGate({ 
  module, 
  action = 'read', 
  fallback = null, 
  children 
}) {
  const { can } = usePermission();

  if (can(module, action)) {
    return <>{children}</>;
  }

  return fallback ? <>{fallback}</> : null;
}
