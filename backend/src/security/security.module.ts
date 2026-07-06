import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";

@Global()
@Module({
  exports: [JwtModule, JwtAuthGuard, PermissionsGuard],
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("jwt.secret"),
        signOptions: {
          expiresIn: config.get<string>("jwt.expiresIn") ?? "1d"
        }
      })
    })
  ],
  providers: [JwtAuthGuard, PermissionsGuard]
})
export class SecurityModule {}

