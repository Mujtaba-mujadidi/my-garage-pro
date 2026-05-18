import { Controller, Get } from "@nestjs/common";
import { APP_NAME } from "@mygaragepro/shared";

@Controller()
export class HealthController {
  @Get("health")
  health() {
    return {
      ok: true,
      app: APP_NAME,
      env: process.env.NODE_ENV ?? "development",
      phase: "0",
    };
  }
}
