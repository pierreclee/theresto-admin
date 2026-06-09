export interface AdminUser {
  uid: string;
  email: string;
  displayName?: string;
  admin: boolean;
  mfaEnrolled: boolean;
}

export interface AdminSession {
  user: AdminUser | null;
  startTime: Date | null;
  isValid: boolean;
}
