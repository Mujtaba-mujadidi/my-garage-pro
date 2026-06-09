import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Permission } from "@mygaragepro/shared";
import type { RequestUser } from "../auth.types";
import { ANY_PERMISSIONS_KEY } from "../decorators/any-permissions.decorator";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredAny = this.reflector.getAllAndOverride<Permission[]>(ANY_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredAny?.length && !required?.length) return true;

    const request = context.switchToHttp().getRequest<{ user: RequestUser }>();
    const user = request.user;
    if (!user) throw new ForbiddenException();

    if (requiredAny?.length) {
      const okAny = requiredAny.some((p) => user.permissions.includes(p));
      if (!okAny) throw new ForbiddenException("Insufficient permissions");
      return true;
    }

    const ok = required!.every((p) => user.permissions.includes(p));
    if (!ok) throw new ForbiddenException("Insufficient permissions");
    return true;
  }
}
