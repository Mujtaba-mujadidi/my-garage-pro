import { Controller, Get } from "@nestjs/common";
import { APP_NAME } from "@mygaragepro/shared";
import { Public } from "./auth/decorators/public.decorator";

@Controller()
export class HealthController {
  @Public()
  @Get("health")
  health() {
    return {
      ok: true,
      app: APP_NAME,
      env: process.env.NODE_ENV ?? "development",
      phase: "1",
    };
  }
}
