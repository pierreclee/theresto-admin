'use server';

import { requireAdmin } from '@/lib/supabase/server';
import { invokeEdgeFunction, type ActionResult } from '@/lib/supabase/invokeFunction';
import type {
  IncidentMoneyResult,
  PrivatizationIncident,
  PrivatizationIncidentFilter,
} from '@/lib/types/privatizationIncidents';

// Incidents de paiement des privatisations, via l'Edge Function
// admin-privatization-incidents. Rembourser ou restituer un solde exige côté
// serveur un code TOTP vérifié il y a moins de 5 min.

const FUNCTION_NAME = 'admin-privatization-incidents';

export async function listPrivatizationIncidentsAction(
  status: PrivatizationIncidentFilter,
): Promise<ActionResult<{ incidents: PrivatizationIncident[] }>> {
  await requireAdmin();
  return invokeEdgeFunction(FUNCTION_NAME, { action: 'list', status });
}

export async function retryPrivatizationRefundAction(incidentId: string): Promise<ActionResult<IncidentMoneyResult>> {
  await requireAdmin();
  return invokeEdgeFunction(FUNCTION_NAME, { action: 'retryRefund', incidentId });
}

export async function returnPrivatizationCustomerBalanceAction(
  incidentId: string,
): Promise<ActionResult<IncidentMoneyResult>> {
  await requireAdmin();
  return invokeEdgeFunction(FUNCTION_NAME, { action: 'returnCustomerBalance', incidentId });
}

export async function resolvePrivatizationIncidentAction(input: {
  incidentId: string;
  resolution: string;
  status: 'resolved' | 'ignored';
}): Promise<ActionResult<{ status: string; auditLogged: boolean }>> {
  await requireAdmin();
  return invokeEdgeFunction(FUNCTION_NAME, {
    action: 'resolve',
    incidentId: input.incidentId,
    resolution: input.resolution,
    status: input.status,
  });
}
