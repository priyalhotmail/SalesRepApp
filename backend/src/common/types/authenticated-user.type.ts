export type AuthenticatedUser = {
  id: number;
  email: string;
  displayName: string;
  roles: string[];
  permissions: string[];
};

