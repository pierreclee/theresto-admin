export async function generateTOTPSecret() {
  // This would be implemented in Cloud Functions for security
  // For MVP, we return a placeholder that will be handled server-side
  return {
    secret: 'TOTP_SECRET_PLACEHOLDER',
    qrCodeUrl: 'data:image/svg+xml,<svg></svg>',
  };
}

export async function verifyTOTPCode(code: string): Promise<boolean> {
  // Verification will be done in Cloud Functions
  // Client just sends the code
  return code.length === 6 && /^\d+$/.test(code);
}
