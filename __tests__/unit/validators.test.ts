import { LoginFormSchema } from '@/lib/utils/validators';

describe('LoginFormSchema', () => {
  it('should validate correct email and password', () => {
    const result = LoginFormSchema.safeParse({
      email: 'admin@theresto.fr',
      password: 'password123',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const result = LoginFormSchema.safeParse({
      email: 'not-an-email',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });

  it('should reject short password', () => {
    const result = LoginFormSchema.safeParse({
      email: 'admin@theresto.fr',
      password: '123',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty email', () => {
    const result = LoginFormSchema.safeParse({
      email: '',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty password', () => {
    const result = LoginFormSchema.safeParse({
      email: 'admin@theresto.fr',
      password: '',
    });
    expect(result.success).toBe(false);
  });
});
