import { Request } from "express";
import { AuthenticatedUser } from "./authenticated-user.type";

export type RequestContext = {
  actor: AuthenticatedUser;
  ipAddress?: string;
  userAgent?: string;
};

export function buildRequestContext(
  actor: AuthenticatedUser,
  request: Request
): RequestContext {
  const userAgent = request.headers["user-agent"];

  return {
    actor,
    ipAddress: request.ip,
    userAgent: Array.isArray(userAgent) ? userAgent.join(", ") : userAgent
  };
}

