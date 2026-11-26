'use server';

// Demandes d'ouverture d'un espace restaurant (contrat : docs/features/onboarding-accompagne.md
// du dépôt de l'app, migration 20261206110000_restaurant_access_requests.sql). RPC exécutables
// par service_role seul : appelées avec la clé service, toujours après requireAdmin().
//
// Journal (RGPD-29) : identifiants, filtre, nombre et statut seulement, jamais le nom du
// restaurant, la ville, le téléphone, le message ni l'adresse.
// - Liste (données personnelles) : refusée par adminLogRefusal() si le journal ne s'écrit pas (D2).
// - Refus d'une demande : la base n'accepte que pending → declined ou invited, la remise en
//   attente est impossible ; journal en échec : demande refusée quand même, auditLogged: false
//   (comme moderateUserAction).
// - Invitation : passée à « invited » par admin-onboarding (createRestaurantInvitation), qui
//   journalise accessRequestInvited ; rien à faire ici.

import { getAdminClient, requireAdmin } from '@/lib/supabase/server';
import { adminLogRefusal, logAdminAction } from '@/lib/audit/adminLog';
import type { ActionResult } from '@/lib/supabase/invokeFunction';
import type {
  AccessRequest,
  AccessRequestFilter,
  AccessRequestList,
  AccessRequestStatus,
  DeclinedAccessRequest,
} from '@/lib/types/accessRequests';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Borne haute de admin_restaurant_access_requests. */
const LIST_LIMIT = 500;
const FILTERS: readonly AccessRequestFilter[] = ['pending', 'invited', 'declined', 'all'];

type DbError = { code?: string; hint?: string; message?: string } | null;

interface Row {
  id: string;
  user_id: string;
  restaurant_name: string;
  city: string;
  phone: string;
  message: string | null;
  status: AccessRequestStatus;
  created_at: string;
  handled_at: string | null;
  email: string | null;
}

/** Refus de la base traduits (HINT d'abord, SQLSTATE en repli) ; jamais le message brut. */
function dbFailure(error: DbError, fallback: string): { ok: false; code: string; error: string } {
  console.error('[demandes] refus de la base :', error?.hint ?? error?.code ?? 'erreur');
  const hint = error?.hint;
  if (hint === 'P0A06' || error?.code === 'PT409') {
    return { ok: false, code: 'conflict', error: 'Cette demande a déjà été traitée (invitée ou refusée). La liste est rechargée.' };
  }
  if (hint === 'P0A07' || error?.code === 'PT404') {
    return { ok: false, code: 'not-found', error: 'Demande introuvable : elle a peut-être été supprimée avec le compte.' };
  }
  if (hint === 'P0A08' || error?.code === '22023') {
    return { ok: false, code: 'invalid-argument', error: 'Statut de demande invalide.' };
  }
  return { ok: false, code: error?.code ?? 'internal', error: fallback };
}

const toRequest = (r: Row): AccessRequest => ({
  id: r.id,
  userId: r.user_id,
  restaurantName: r.restaurant_name,
  city: r.city,
  phone: r.phone,
  message: r.message ?? null,
  status: r.status,
  createdAt: r.created_at,
  handledAt: r.handled_at ?? null,
  email: r.email ?? null,
});

/** Demandes, plus récentes d'abord ; « pending » par défaut. */
export async function listRestaurantAccessRequestsAction(
  filter: unknown = 'pending',
): Promise<ActionResult<AccessRequestList>> {
  const admin = await requireAdmin();
  if (!FILTERS.includes(filter as AccessRequestFilter)) {
    return { ok: false, code: 'invalid-argument', error: 'Filtre de statut inconnu.' };
  }
  const status = filter as AccessRequestFilter;
  const db = await getAdminClient();
  const { data, error } = await db.rpc('admin_restaurant_access_requests', {
    p_status: status === 'all' ? null : status,
    p_limit: LIST_LIMIT,
  });
  if (error) return dbFailure(error, 'Impossible de charger les demandes.');
  const rows = (data ?? []) as Row[];

  const logged = await logAdminAction(admin, {
    action: 'list_restaurant_access_requests',
    targetType: 'access_request',
    targetId: null,
    details: { status, count: rows.length },
  });
  if (!logged) return adminLogRefusal();
  return { ok: true, data: { requests: rows.map(toRequest), truncated: rows.length >= LIST_LIMIT } };
}

/** Refuse une demande en attente (la personne n'est pas prévenue par TheResto). */
export async function declineRestaurantAccessRequestAction(
  requestId: unknown,
): Promise<ActionResult<DeclinedAccessRequest>> {
  const admin = await requireAdmin();
  if (typeof requestId !== 'string' || !UUID.test(requestId)) {
    return { ok: false, code: 'not-found', error: 'Demande introuvable.' };
  }
  const db = await getAdminClient();
  const { data, error } = await db.rpc('admin_set_restaurant_access_request_status', {
    p_id: requestId,
    p_status: 'declined',
  });
  if (error) return dbFailure(error, 'Impossible de refuser la demande.');
  const result = (data ?? {}) as { id?: string; status?: AccessRequestStatus; handled_at?: string | null };

  const auditLogged = await logAdminAction(admin, {
    action: 'decline_restaurant_access_request',
    targetType: 'access_request',
    targetId: requestId,
    details: { previousStatus: 'pending', status: 'declined' },
  });
  return {
    ok: true,
    data: {
      id: result.id ?? requestId,
      status: result.status ?? 'declined',
      handledAt: result.handled_at ?? null,
      auditLogged,
    },
  };
}
