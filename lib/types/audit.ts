export interface AuditLog {
  id: string;
  adminId: string;
  adminEmail?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  changes?: Record<string, any>;
  timestamp: Date;
  success: boolean;
}

export interface AuditLogFilter {
  /** Jour de Paris « AAAA-MM-JJ » (inclus). */
  startDate?: string;
  /** Jour de Paris « AAAA-MM-JJ » (inclus). */
  endDate?: string;
  adminId?: string;
  action?: string;
  resourceType?: string;
  limit?: number;
  offset?: number;
}

export interface PlatformStats {
  totalRestaurants: number;
  pendingApprovals: number;
  activeToday: number;
  premiumCount: number;
  platformRevenueMTD: number;
}
