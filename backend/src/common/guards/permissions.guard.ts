import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  PERMISSIONS_KEY
} from "../decorators/permissions.decorator";
import { RequestWithUser } from "../types/request-with-user.type";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass()
      ]) ?? [];

    if (requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (user.roles.includes("SUPER_ADMIN")) {
      return true;
    }

    const hasPermission = requiredPermissions.every((permission) =>
      user.permissions.includes(permission)
    );

    if (!hasPermission) {
      throw new ForbiddenException("You do not have permission to perform this action");
    }

    return true;
  }
}

