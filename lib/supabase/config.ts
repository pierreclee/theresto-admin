export type AppEnvironment = 'production' | 'staging';

export function getSupabaseCredentials(env: AppEnvironment) {
  if (env === 'production') {
    return {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL_PROD || '',
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_PROD || '',
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY_PROD || '',
    };
  }
  
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL_STAGING || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_STAGING || '',
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY_STAGING || '',
  };
}
