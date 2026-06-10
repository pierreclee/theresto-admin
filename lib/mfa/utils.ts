import {
  MultiFactorResolver,
  MultiFactorError,
  TotpMultiFactorGenerator,
  TotpSecret,
  multiFactor,
  User,
} from 'firebase/auth';

export interface MFASession {
  resolver: MultiFactorResolver;
  email: string;
}

export interface TOTPSetup {
  secret: TotpSecret;
  qrCodeUrl: string;
}

export function isMFAError(error: any): error is MultiFactorError {
  return error.code === 'auth/multi-factor-auth-required';
}

export async function generateTOTPSecret(user: User): Promise<TOTPSetup> {
  const multiFactorUser = multiFactor(user);
  const session = await multiFactorUser.getSession();
  const secret = await TotpMultiFactorGenerator.generateSecret(session);
  const qrCodeUrl = secret.generateQrCodeUrl(
    user.email || 'admin',
    'TheResto Admin'
  );
  return { secret, qrCodeUrl };
}

export async function enrollTOTP(
  user: User,
  secret: TotpSecret,
  code: string
): Promise<void> {
  const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code);
  await multiFactor(user).enroll(assertion, 'TheResto Admin TOTP');
}

export async function verifyTOTPCode(
  resolver: MultiFactorResolver,
  code: string
) {
  try {
    const enrolledFactors = resolver.hints;

    // Find TOTP factor
    const totpFactor = enrolledFactors.find(
      (factor) => factor.factorId === 'totp'
    );

    if (!totpFactor) {
      throw new Error('TOTP factor not enrolled');
    }

    // Create assertion from code
    const assertion = await (
      TotpMultiFactorGenerator as any
    ).assertionForSignIn(totpFactor.uid, code);

    // Resolve sign-in
    const userCredential = await resolver.resolveSignIn(assertion);

    return userCredential;
  } catch (err) {
    throw new Error(
      `MFA verification failed: ${
        err instanceof Error ? err.message : 'Unknown error'
      }`
    );
  }
}
