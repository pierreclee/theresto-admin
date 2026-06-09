import { renderHook } from '@testing-library/react';
import { useAuth } from '@/lib/hooks/useAuth';

describe('useAuth', () => {
  it('should throw error if used outside AuthProvider', () => {
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuthContext must be used within AuthProvider');
  });
});
