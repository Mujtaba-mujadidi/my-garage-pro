import "reflect-metadata";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { ValidationPipe } from "@nestjs/common";

loadEnv({ path: resolve(process.cwd(), ".env") });
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3011";
  app.enableCors({
    origin: webOrigin.split(",").map((o) => o.trim()),
    credentials: true,
  });

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}`);
}

bootstrap();
