import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseCredentials, type AppEnvironment } from './config';

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

export async function getAdminClient() {
  const cookieStore = await cookies();
  const env = await getServerEnvironment();
  const creds = getSupabaseCredentials(env);

  return createServerClient(
    creds.url,
    creds.serviceKey,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );
}

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
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
  
  return user;
}
