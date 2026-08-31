import { AuthenticatedUser } from "../types/authenticated-user.type";

const ADMIN_ROLE_CODES = new Set([
  "SUPER_ADMIN",
  "MAIN_OFFICE_AUTHORIZED_USER",
  "BRANCH_AUTHORIZED_USER"
]);

export function isSalesRepScopedActor(actor: AuthenticatedUser) {
  return actor.roles.includes("SALES_REP")
    && !actor.roles.some((role) => ADMIN_ROLE_CODES.has(role));
}
