import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { getRolesAndPermissions, userAuthInclude } from "../utils/auth-user.util";
import { PrismaService } from "../../prisma/prisma.service";
import { RequestWithUser } from "../types/request-with-user.type";

type JwtPayload = {
  email: string;
  sub: number;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const payload = await this.verifyToken(token);
    const user = await this.prisma.user.findFirst({
      include: userAuthInclude,
      where: {
        id: payload.sub,
        status: "ACTIVE"
      }
    });

    if (!user) {
      throw new UnauthorizedException("User is not active");
    }

    const { permissions, roles } = getRolesAndPermissions(user);

    request.user = {
      displayName: user.displayName,
      email: user.email,
      id: user.id,
      permissions,
      roles
    };

    return true;
  }

  private extractBearerToken(authorization?: string) {
    const [type, token] = authorization?.split(" ") ?? [];
    return type === "Bearer" ? token : undefined;
  }

  private async verifyToken(token: string) {
    try {
      return await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>("jwt.secret")
      });
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}
