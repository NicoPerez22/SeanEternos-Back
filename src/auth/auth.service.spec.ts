import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { jwtConstants } from './constants/jwt.constants';

describe('Administrator password reset', () => {
  let users: any;
  let service: AuthService;
  let jwt: JwtService;
  let stored: { id: number; password: string };

  beforeEach(async () => {
    stored = { id: 7, password: await bcrypt.hash('old-password', 4) };
    users = {
      findOneByEmail: jest.fn().mockResolvedValue({ id: 1, idRol: '1' }),
      findOneById: jest.fn(async (id) =>
        id === stored.id ? { ...stored } : null,
      ),
      replacePassword: jest.fn(async (id, previous, password) => {
        if (id !== stored.id || previous !== stored.password) return false;
        stored.password = password;
        return true;
      }),
    };
    jwt = new JwtService({ secret: jwtConstants.secret });
    service = new AuthService(users, jwt);
  });

  const issue = (service: AuthService) =>
    service.requestPasswordReset('admin@example.test', 7);

  it('only lets an administrator issue a reset', async () => {
    users.findOneByEmail.mockResolvedValue({ idRol: '2' });
    await expect(issue(service)).rejects.toBeInstanceOf(ForbiddenException);
    expect(users.replacePassword).not.toHaveBeenCalled();
  });

  it('rejects an administrator that no longer exists', async () => {
    users.findOneByEmail.mockResolvedValue(null);
    await expect(issue(service)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a missing administrator identity', async () => {
    await expect(
      service.requestPasswordReset(undefined as any, 7),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects missing users and invalid ids', async () => {
    await expect(
      service.requestPasswordReset('admin@example.test', 9),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.requestPasswordReset('admin@example.test', -1),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('disables the old password and lets the user choose a new one without login', async () => {
    const result = await issue(service);
    expect(result.data.expiresIn).toBe(900);
    expect(await bcrypt.compare('old-password', stored.password)).toBe(false);
    const response = await service.resetPassword({
      token: result.data.token,
      newPassword: 'chosen-password',
    });
    expect(response.data).toBeNull();
    expect(await bcrypt.compare('chosen-password', stored.password)).toBe(true);
    expect(users.findOneByEmail).toHaveBeenCalledTimes(1);
  });

  it('rejects a used token', async () => {
    const { data } = await issue(service);
    await service.resetPassword({
      token: data.token,
      newPassword: 'chosen-password',
    });
    await expect(
      service.resetPassword({
        token: data.token,
        newPassword: 'other-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('invalidates previous tokens when the administrator issues another', async () => {
    const first = await issue(service);
    const second = await issue(service);
    await expect(
      service.resetPassword({
        token: first.data.token,
        newPassword: 'chosen-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.resetPassword({
        token: second.data.token,
        newPassword: 'chosen-password',
      }),
    ).resolves.toHaveProperty('httpCode', 200);
  });

  it('accepts a token at most once under concurrent requests', async () => {
    const { data } = await issue(service);
    const results = await Promise.allSettled([
      service.resetPassword({
        token: data.token,
        newPassword: 'chosen-password',
      }),
      service.resetPassword({
        token: data.token,
        newPassword: 'other-password',
      }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });

  it('rejects an expired token', async () => {
    const { data } = await issue(service);
    const now = Date.now();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(now + 901000);
    try {
      await expect(
        service.resetPassword({
          token: data.token,
          newPassword: 'chosen-password',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    } finally {
      clock.mockRestore();
    }
  });

  it('rejects forged, malformed and normal login tokens', async () => {
    const normal = await jwt.signAsync({ email: 'user@example.test' });
    const forged = await jwt.signAsync({ sub: '7', purpose: 'password-reset' });
    for (const token of ['invalid', '', normal, forged]) {
      await expect(
        service.resetPassword({ token, newPassword: 'chosen-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }
    expect(users.replacePassword).not.toHaveBeenCalled();
  });

  it('prevents using recovery tokens to authenticate normal API requests', async () => {
    const { data } = await issue(service);
    const guard = new AuthGuard(jwt);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: 'Bearer ' + data.token },
        }),
      }),
    };
    await expect(guard.canActivate(context as any)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it.each([
    undefined,
    {},
    { token: 'x', newPassword: 'short' },
    { token: 'x', newPassword: 123 },
    { token: 'x', newPassword: 'a'.repeat(73) },
    { token: 'x', newPassword: '\u00e1'.repeat(37) },
  ])('rejects invalid input %j', async (body) => {
    await expect(service.resetPassword(body as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(users.replacePassword).not.toHaveBeenCalled();
  });

  it('reports a conflicting password change during issuance', async () => {
    users.replacePassword.mockResolvedValue(false);
    await expect(issue(service)).rejects.toBeInstanceOf(ConflictException);
  });

  it('keeps the administrator route guarded and the token confirmation public', () => {
    const prototype = AuthController.prototype;
    expect(
      Reflect.getMetadata('__guards__', prototype.requestPasswordReset),
    ).toContain(AuthGuard);
    expect(
      Reflect.getMetadata('__guards__', prototype.resetPassword),
    ).toBeUndefined();
  });
});
