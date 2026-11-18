import type { AppUser, RolePermissions, UserRole } from '../src/types/payment.ts';

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  'Super Admin': {
    canViewAllBranches: true,
    canCreatePosPayment: true,
    canCreateIncomingOther: true,
    canCreateOutgoing: true,
    canManageInvoices: true,
    canManageFranchise: true,
    canVerifyManual: true,
    canRequestRefund: true,
    canApproveRefund: true,
    canReconcile: true,
    canConfigureMethods: true,
    canCorrectSettled: true,
    canExportReports: true,
  },
  'Owner': {
    canViewAllBranches: true,
    canCreatePosPayment: true,
    canCreateIncomingOther: true,
    canCreateOutgoing: true,
    canManageInvoices: true,
    canManageFranchise: true,
    canVerifyManual: true,
    canRequestRefund: true,
    canApproveRefund: true,
    canReconcile: true,
    canConfigureMethods: true,
    canCorrectSettled: true,
    canExportReports: true,
  },
  'Admin Pusat': {
    canViewAllBranches: true,
    canCreatePosPayment: false,
    canCreateIncomingOther: true,
    canCreateOutgoing: true,
    canManageInvoices: true,
    canManageFranchise: true,
    canVerifyManual: true,
    canRequestRefund: true,
    canApproveRefund: true,
    canReconcile: false,
    canConfigureMethods: false,
    canCorrectSettled: false,
    canExportReports: true,
  },
  'Mitra Franchise': {
    canViewAllBranches: false,
    canCreatePosPayment: false,
    canCreateIncomingOther: false,
    canCreateOutgoing: false,
    canManageInvoices: false,
    canManageFranchise: true,
    canVerifyManual: false,
    canRequestRefund: false,
    canApproveRefund: false,
    canReconcile: false,
    canConfigureMethods: false,
    canCorrectSettled: false,
    canExportReports: true,
  },
  'Manager Cabang': {
    canViewAllBranches: false,
    canCreatePosPayment: true,
    canCreateIncomingOther: true,
    canCreateOutgoing: true,
    canManageInvoices: true,
    canManageFranchise: false,
    canVerifyManual: true,
    canRequestRefund: true,
    canApproveRefund: false,
    canReconcile: false,
    canConfigureMethods: false,
    canCorrectSettled: false,
    canExportReports: true,
  },
  'Kasir': {
    canViewAllBranches: false,
    canCreatePosPayment: true,
    canCreateIncomingOther: false,
    canCreateOutgoing: false,
    canManageInvoices: false,
    canManageFranchise: false,
    canVerifyManual: false,
    canRequestRefund: false,
    canApproveRefund: false,
    canReconcile: false,
    canConfigureMethods: false,
    canCorrectSettled: false,
    canExportReports: false,
  },
  'Finance': {
    canViewAllBranches: true,
    canCreatePosPayment: false,
    canCreateIncomingOther: true,
    canCreateOutgoing: true,
    canManageInvoices: true,
    canManageFranchise: true,
    canVerifyManual: true,
    canRequestRefund: true,
    canApproveRefund: true,
    canReconcile: true,
    canConfigureMethods: false,
    canCorrectSettled: true,
    canExportReports: true,
  },
};

export function getPermissionsForRole(role: UserRole): RolePermissions {
  return ROLE_PERMISSIONS[role];
}

export function buildScopeWhere(
  user: AppUser,
  tableAlias: string,
  allowedBranchIds: string[]
): { clause: string; params: string[] } {
  const parts: string[] = [`${tableAlias}.tenant_id = ?`];
  const params: string[] = [user.tenant_id];

  if (user.role === 'Super Admin' || user.role === 'Owner' || user.role === 'Admin Pusat' || user.role === 'Finance') {
    return { clause: parts.join(' AND '), params };
  }

  if (user.role === 'Mitra Franchise') {
    if (allowedBranchIds.length === 0) {
      parts.push('1 = 0');
    } else {
      const placeholders = allowedBranchIds.map(() => '?').join(', ');
      parts.push(`${tableAlias}.branch_id IN (${placeholders})`);
      params.push(...allowedBranchIds);
    }
    return { clause: parts.join(' AND '), params };
  }

  if (user.branch_id) {
    parts.push(`${tableAlias}.branch_id = ?`);
    params.push(user.branch_id);
  } else {
    parts.push('1 = 0');
  }

  return { clause: parts.join(' AND '), params };
}

export function canUserAccessBranch(
  user: AppUser,
  branchId: string,
  partnerBranchIds: string[]
): boolean {
  if (
    user.role === 'Super Admin' ||
    user.role === 'Owner' ||
    user.role === 'Admin Pusat' ||
    user.role === 'Finance'
  ) {
    return true;
  }
  if (user.role === 'Mitra Franchise') {
    return partnerBranchIds.includes(branchId);
  }
  return user.branch_id === branchId;
}
