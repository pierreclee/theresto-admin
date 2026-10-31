import * as actions from '@/lib/actions/admin';
import { unwrapAction } from '@/lib/api/actionResult';

export const adminApi = {
  getStats: actions.getStatsAction,
  // Consultations journalisées : refus faute de journal levé côté navigateur (message lisible).
  getRestaurants: (filters?: Parameters<typeof actions.getRestaurantsAction>[0]) =>
    unwrapAction(actions.getRestaurantsAction(filters)),
  getRestaurantDetail: (restaurantId: string) => unwrapAction(actions.getRestaurantDetailAction(restaurantId)),
  updateRestaurant: actions.updateRestaurantAction,
  getKbisUrl: actions.getKbisUrlAction,
  approveRestaurant: actions.approveRestaurantAction,
  updateSubscriptionPlan: actions.updateSubscriptionPlanAction,
  getAuditLogs: (filters: Parameters<typeof actions.getAuditLogsAction>[0]) =>
    unwrapAction(actions.getAuditLogsAction(filters)),
  getConfig: actions.getConfigAction,
  updateConfig: actions.updateConfigAction,
};
