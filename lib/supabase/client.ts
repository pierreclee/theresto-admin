import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseCredentials, type AppEnvironment } from './config';

export function getClientEnvironment(): AppEnvironment {
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(new RegExp('(^| )theresto_env=([^;]+)'));
    if (match && (match[2] === 'production' || match[2] === 'staging')) {
      return match[2] as AppEnvironment;
    }
  }
  return 'staging'; // Default to staging to prevent accidental prod edits
}

export function createClient(forceEnv?: AppEnvironment) {
  const env = forceEnv || getClientEnvironment();
  const creds = getSupabaseCredentials(env);
  
  return createBrowserClient(creds.url, creds.anonKey);
}
