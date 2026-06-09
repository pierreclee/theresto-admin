import {
  MultiFactorResolver,
  MultiFactorError,
  TotpMultiFactorGenerator,
} from 'firebase/auth';

export interface MFASession {
  resolver: MultiFactorResolver;
  email: string;
}

export function isMFAError(error: any): error is MultiFactorError {
  return error.code === 'auth/multi-factor-auth-required';
}

export async function generateTOTPSecret() {
  // This would be implemented in Cloud Functions for security
  // For MVP, we return a placeholder that will be handled server-side
  return {
    secret: 'TOTP_SECRET_PLACEHOLDER',
    qrCodeUrl: 'data:image/svg+xml,<svg></svg>',
  };
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
    // Use assertionForSignIn for sign-in verification (not enrollment)
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
