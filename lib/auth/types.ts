import { User } from 'firebase/auth';
import { AdminUser } from '@/lib/types/admin';

export interface AuthContextType {
  user: User | null;
  adminUser: AdminUser | null;
  loading: boolean;
  error: Error | null;
  isAdmin: boolean;
  hasMfa: boolean;
  sessionValid: boolean;
  signOut: () => Promise<void>;
}
