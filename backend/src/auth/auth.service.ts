import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { AuditService } from "../audit/audit.service";
import { toSafeUser, userAuthInclude } from "../common/utils/auth-user.util";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";

type LoginContext = {
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly auditService: AuditService,
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService
  ) {}

  async login(dto: LoginDto, context: LoginContext) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      include: userAuthInclude,
      where: {
        email
      }
    });

    const passwordMatches = user
      ? await bcrypt.compare(dto.password, user.passwordHash)
      : false;

    if (!user || !passwordMatches) {
      await this.auditService.record({
        action: "USER_LOGIN_FAILED",
        entityId: email,
        entityType: "user",
        ipAddress: context.ipAddress,
        newValues: { email },
        userAgent: context.userAgent
      });
      throw new UnauthorizedException("Invalid email or password");
    }

    if (user.status !== "ACTIVE") {
      await this.auditService.record({
        action: "USER_LOGIN_BLOCKED",
        actorUserId: user.id,
        entityId: user.id,
        entityType: "user",
        ipAddress: context.ipAddress,
        newValues: {
          status: user.status
        },
        userAgent: context.userAgent
      });
      throw new UnauthorizedException("User account is not active");
    }

    const updatedUser = await this.prisma.user.update({
      data: {
        lastLoginAt: new Date()
      },
      include: userAuthInclude,
      where: {
        id: user.id
      }
    });

    await this.auditService.record({
      action: "USER_LOGIN_SUCCESS",
      actorUserId: user.id,
      entityId: user.id,
      entityType: "user",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    const accessToken = await this.jwtService.signAsync(
      {
        email: user.email,
        sub: user.id
      },
      {
        expiresIn: this.config.get<string>("jwt.expiresIn") ?? "1d",
        secret: this.config.get<string>("jwt.secret")
      }
    );

    return {
      accessToken,
      tokenType: "Bearer",
      user: toSafeUser(updatedUser)
    };
  }

  async getMe(userId: number) {
    const user = await this.prisma.user.findFirstOrThrow({
      include: userAuthInclude,
      where: {
        id: userId,
        status: "ACTIVE"
      }
    });

    return toSafeUser(user);
  }
}
