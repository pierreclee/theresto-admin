import * as actions from '@/lib/actions/admin';

export const adminApi = {
  getStats: actions.getStatsAction,
  getRestaurants: actions.getRestaurantsAction,
  getRestaurantDetail: actions.getRestaurantDetailAction,
  updateRestaurant: actions.updateRestaurantAction,
  getKbisUrl: actions.getKbisUrlAction,
  setAdminFee: actions.setAdminFeeAction,
  approveRestaurant: actions.approveRestaurantAction,
  updateSubscriptionPlan: actions.updateSubscriptionPlanAction,
  getAuditLogs: actions.getAuditLogsAction,
  getConfig: actions.getConfigAction,
  updateConfig: actions.updateConfigAction,
};
