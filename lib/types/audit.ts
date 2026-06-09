export interface AuditLog {
  id: string;
  adminId: string;
  adminEmail?: string;
  action: string;
  resourceType: 'restaurant' | 'user' | 'config';
  resourceId?: string;
  changes?: Record<string, any>;
  timestamp: Date;
  success: boolean;
}

export interface AuditLogFilter {
  startDate?: Date;
  endDate?: Date;
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
