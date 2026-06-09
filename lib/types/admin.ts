export interface AdminUser {
  uid: string;
  email: string;
  displayName?: string;
  admin: boolean;
  mfaEnrolled: boolean;
  role?: 'super_admin' | 'admin' | 'read_only';
  addedBy?: string;
  addedAt?: Date;
}

export interface AdminSession {
  user: AdminUser | null;
  startTime: Date | null;
  isValid: boolean;
}
