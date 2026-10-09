import * as actions from '@/lib/actions/users';

export const usersApi = {
  listUsers: actions.listUsersAction,
  getUser: actions.getUserAction,
  getCrmProfile: actions.getCrmProfileAction,
  moderateUser: actions.moderateUserAction,
};
