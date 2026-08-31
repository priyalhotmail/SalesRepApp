import { AuthUser } from "./AuthContext";

export function hasAnyPermission(
  user: AuthUser | null,
  permissions: string[] = []
) {
  if (!user) {
    return false;
  }
  if (user.roles?.includes("SUPER_ADMIN")) {
    return true;
  }
  if (permissions.length === 0) {
    return true;
  }
  return permissions.some((permission) => user.permissions?.includes(permission));
}

export function hasAllPermissions(
  user: AuthUser | null,
  permissions: string[] = []
) {
  if (!user) {
    return false;
  }
  if (user.roles?.includes("SUPER_ADMIN")) {
    return true;
  }
  return permissions.every((permission) => user.permissions?.includes(permission));
}
