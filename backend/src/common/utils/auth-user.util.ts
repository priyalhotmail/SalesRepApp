import { Prisma } from "@prisma/client";

export const userAuthInclude = {
  roles: {
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true
            }
          }
        }
      }
    }
  }
} satisfies Prisma.UserInclude;

export type UserWithAuth = Prisma.UserGetPayload<{
  include: typeof userAuthInclude;
}>;

export function getRolesAndPermissions(user: UserWithAuth) {
  const roles = user.roles.map((userRole) => userRole.role.code);
  const permissions = [
    ...new Set(
      user.roles.flatMap((userRole) =>
        userRole.role.permissions.map(
          (rolePermission) => rolePermission.permission.code
        )
      )
    )
  ];

  return {
    permissions,
    roles
  };
}

export function toSafeUser(user: UserWithAuth) {
  const { permissions, roles } = getRolesAndPermissions(user);

  return {
    displayName: user.displayName,
    email: user.email,
    id: user.id,
    lastLoginAt: user.lastLoginAt,
    permissions,
    roles,
    status: user.status,
    telephone: user.telephone
  };
}

