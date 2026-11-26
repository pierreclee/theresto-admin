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

// Un client par environnement. Le singleton de @supabase/ssr garderait le premier
// projet ouvert dans la page : après une déconnexion de la prod, la connexion à
// staging partait vers la prod (400 « Invalid login credentials »). Chaque projet a
// sa propre clé de session (sb-<ref>-auth-token) : deux clients ne se gênent pas.
function newBrowserClient(env: AppEnvironment) {
  const creds = getSupabaseCredentials(env);
  return createBrowserClient(creds.url, creds.anonKey, { isSingleton: false });
}

const browserClients: Partial<Record<AppEnvironment, ReturnType<typeof newBrowserClient>>> = {};

export function createClient(forceEnv?: AppEnvironment) {
  const env = forceEnv || getClientEnvironment();
  if (typeof window === 'undefined') return newBrowserClient(env);
  return (browserClients[env] ??= newBrowserClient(env));
}
