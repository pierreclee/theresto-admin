export interface PlatformConfig {
  commissionRate: number;
  currency: string;
  maintenanceMode: boolean;
  updatedAt?: Date;
  updatedBy?: string;
}

export interface UpdatePlatformConfigInput {
  commissionRate?: number;
  currency?: string;
  maintenanceMode?: boolean;
}
