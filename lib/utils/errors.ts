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

export function parseFirebaseError(error: any): AdminError {
  if (error instanceof Error) {
    const message = error.message;
    if (message.includes('permission-denied')) return new AdminError('PERMISSION_DENIED', 'Accès refusé', error);
    if (message.includes('unauthenticated')) return new AdminError('UNAUTHENTICATED', 'Non authentifié', error);
    if (message.includes('invalid-argument')) return new AdminError('INVALID_ARGUMENT', 'Argument invalide', error);
    if (message.includes('not-found')) return new AdminError('NOT_FOUND', 'Non trouvé', error);
    if (message.includes('resource-exhausted')) return new AdminError('RESOURCE_EXHAUSTED', 'Limite atteinte', error);
    return new AdminError('INTERNAL', 'Erreur interne', error);
  }
  return new AdminError('INTERNAL', 'Erreur inconnue');
}
