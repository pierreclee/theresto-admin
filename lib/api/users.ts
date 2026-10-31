import * as actions from '@/lib/actions/users';
import { unwrapAction } from '@/lib/api/actionResult';

// Consultations journalisées : refus faute de journal levé côté navigateur (message lisible).
export const usersApi = {
  listUsers: (opts: Parameters<typeof actions.listUsersAction>[0]) => unwrapAction(actions.listUsersAction(opts)),
  getUser: (userId: string) => unwrapAction(actions.getUserAction(userId)),
  getCrmProfile: (userId: string) => unwrapAction(actions.getCrmProfileAction(userId)),
  moderateUser: actions.moderateUserAction,
};
