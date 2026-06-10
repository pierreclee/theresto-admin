import type { MultiFactorResolver } from 'firebase/auth';

// Module-level singleton — survives Next.js client-side navigation
// (unlike window properties which can be lost on hard navigations)
let _resolver: MultiFactorResolver | null = null;
let _email: string | null = null;

export function storeMfaResolver(resolver: MultiFactorResolver, email: string) {
  _resolver = resolver;
  _email = email;
}

export function getMfaResolver(): { resolver: MultiFactorResolver | null; email: string | null } {
  return { resolver: _resolver, email: _email };
}

export function clearMfaResolver() {
  _resolver = null;
  _email = null;
}
