export type SupabaseErrorCode =
  | 'PERMISSION_DENIED'
  | 'UNAUTHENTICATED'
  | 'INVALID_ARGUMENT'
  | 'NOT_FOUND'
  | 'INTERNAL'
  | 'RESOURCE_EXHAUSTED';

export class AdminError extends Error {
  constructor(
    public code: SupabaseErrorCode,
    message: string,
    public originalError?: Error,
  ) {
    super(message);
    this.name = 'AdminError';
  }
}

export function parseSupabaseError(error: unknown): AdminError {
  if (error instanceof Error) {
    const code = (error as any).code as string | undefined;
    const message = error.message;

    // Map common PostgreSQL / Supabase PostgREST error codes
    if (code === '42501' || message.toLowerCase().includes('permission denied')) {
      return new AdminError('PERMISSION_DENIED', 'Accès refusé', error);
    }
    if (code === 'PGRST301' || message.toLowerCase().includes('unauthorized')) {
      return new AdminError('UNAUTHENTICATED', 'Non authentifié', error);
    }
    if (code === 'PGRST116' || message.toLowerCase().includes('not found')) {
      return new AdminError('NOT_FOUND', 'Non trouvé', error);
    }

    return new AdminError('INTERNAL', message || 'Erreur interne', error);
  }

  return new AdminError('INTERNAL', 'Erreur inconnue');
}
