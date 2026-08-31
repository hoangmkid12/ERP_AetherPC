import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { hasPermission, getOperationalRbac, canDo as rbacCanDo } from '../utils/rbacEngine';

export function usePermission() {
  const { user } = useAuth();
  const role = (user?.role || '').toUpperCase();
  const [matrixVersion, setMatrixVersion] = useState(0);

  useEffect(() => {
    const handleRbacChanged = () => {
      setMatrixVersion(v => v + 1);
    };

    window.addEventListener('erp-rbac-changed', handleRbacChanged);
    window.addEventListener('storage', handleRbacChanged);

    return () => {
      window.removeEventListener('erp-rbac-changed', handleRbacChanged);
      window.removeEventListener('storage', handleRbacChanged);
    };
  }, []);

  const can = useCallback((moduleName, actionType = 'read') => {
    return hasPermission(role, moduleName, actionType);
  }, [role, matrixVersion]);

  const canDo = useCallback((operationId) => {
    return rbacCanDo(role, operationId);
  }, [role, matrixVersion]);

  const canRead = useCallback((moduleName) => can(moduleName, 'read'), [can]);
  const canCreate = useCallback((moduleName) => can(moduleName, 'create'), [can]);
  const canEdit = useCallback((moduleName) => can(moduleName, 'edit'), [can]);
  const canDelete = useCallback((moduleName) => can(moduleName, 'delete'), [can]);
  const canApprove = useCallback((moduleName) => can(moduleName, 'approve'), [can]);

  return {
    role,
    user,
    can,
    canDo,
    canRead,
    canCreate,
    canEdit,
    canDelete,
    canApprove,
    matrix: getOperationalRbac()
  };
}

export default usePermission;
