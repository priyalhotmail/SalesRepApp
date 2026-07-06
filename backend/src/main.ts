import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger("Bootstrap");

  app.setGlobalPrefix("api");
  app.use(helmet());
  app.enableCors({
    origin: config.get<string>("frontendUrl") ?? "http://localhost:5173",
    credentials: true
  });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true
    })
  );

  const port = config.get<number>("port") ?? 3000;
  await app.listen(port);
  logger.log(`API listening on http://localhost:${port}/api`);
}

void bootstrap();
