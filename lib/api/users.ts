import * as actions from '@/lib/actions/users';

export const usersApi = {
  listUsers: actions.listUsersAction,
  getCrmProfile: actions.getCrmProfileAction,
  moderateUser: actions.moderateUserAction,
};
