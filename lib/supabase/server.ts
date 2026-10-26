import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getSupabaseCredentials, type AppEnvironment } from './config';
import { ADMIN_SESSION_MAX_AGE_SECONDS, hasAal2, hasRecentTotp } from '@/lib/utils/recentMfa';

export async function getServerEnvironment(): Promise<AppEnvironment> {
  const cookieStore = await cookies();
  const env = cookieStore.get('theresto_env')?.value;
  return (env === 'production' || env === 'staging') ? (env as AppEnvironment) : 'staging';
}

export async function createClient() {
  const cookieStore = await cookies();
  const env = await getServerEnvironment();
  const creds = getSupabaseCredentials(env);

  return createServerClient(
    creds.url,
    creds.anonKey,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

// Service-role client. Must NOT read the auth cookies: @supabase/ssr would send
// the signed-in admin's JWT instead of the service key, subjecting every query
// to RLS (e.g. users_select_own → only the admin's own row).
export async function getAdminClient() {
  const env = await getServerEnvironment();
  const creds = getSupabaseCredentials(env);

  return createSupabaseClient(creds.url, creds.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireAdmin() {
  const supabase = await createClient();
  // Le jeton lu dans les cookies (rafraîchi par getSession s'il a expiré) est
  // celui que getUser valide auprès de Supabase, puis dont on lit le niveau AAL.
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);

  if (error) {
    console.error('Supabase Auth Error in requireAdmin:', error);
    throw new Error(`Auth Error: ${error.message}`);
  }
  
  if (!user) {
    throw new Error('Unauthorized: No user session found on server (cookies might not be sent or token invalid).');
  }
  
  if (user.app_metadata?.admin !== true) {
    throw new Error(`Unauthorized: User is not an admin. Current app_metadata: ${JSON.stringify(user.app_metadata)}`);
  }

  // Le second facteur se vérifie côté serveur : le claim admin seul ne suffit pas (RGPD-28).
  if (!hasAal2(accessToken)) {
    throw new Error('Unauthorized: second factor required (AAL2 session).');
  }
  // Même durée de session que l'interface : au-delà de 2 h, le code TOTP est redemandé.
  if (!hasRecentTotp(accessToken, Math.floor(Date.now() / 1000), ADMIN_SESSION_MAX_AGE_SECONDS)) {
    throw new Error('Unauthorized: admin session expired, the TOTP code must be entered again (older than 2 h).');
  }

  return user;
}
