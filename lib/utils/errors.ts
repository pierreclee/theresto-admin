export type FirebaseErrorCode =
  | 'PERMISSION_DENIED'
  | 'UNAUTHENTICATED'
  | 'INVALID_ARGUMENT'
  | 'NOT_FOUND'
  | 'INTERNAL'
  | 'RESOURCE_EXHAUSTED';

export class AdminError extends Error {
  constructor(
    public code: FirebaseErrorCode,
    message: string,
    public originalError?: Error,
  ) {
    super(message);
    this.name = 'AdminError';
  }
}

export function parseFirebaseError(error: unknown): AdminError {
  if (error instanceof Error) {
    const code = (error as any).code as string | undefined;
    const message = error.message;

    if (code?.includes('permission-denied') || message.includes('permission-denied')) {
      return new AdminError('PERMISSION_DENIED', 'Accès refusé', error);
    }
    if (code?.includes('unauthenticated') || message.includes('unauthenticated')) {
      return new AdminError('UNAUTHENTICATED', 'Non authentifié', error);
    }
    if (code?.includes('invalid-argument') || message.includes('invalid-argument')) {
      return new AdminError('INVALID_ARGUMENT', 'Argument invalide', error);
    }
    if (code?.includes('not-found') || message.includes('not-found')) {
      return new AdminError('NOT_FOUND', 'Non trouvé', error);
    }
    if (code?.includes('resource-exhausted') || message.includes('resource-exhausted')) {
      return new AdminError('RESOURCE_EXHAUSTED', 'Limite atteinte', error);
    }

    return new AdminError('INTERNAL', message || 'Erreur interne', error);
  }

  return new AdminError('INTERNAL', 'Erreur inconnue');
}
