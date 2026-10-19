import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, randomBytes } from 'crypto';
import { jwtConstants } from './constants/jwt.constants';
import { ResetPasswordDTO } from './models/reset-password';
import { JwtService } from '@nestjs/jwt';
import { ApiResponse } from 'shared/models/apiResponse';
import { User } from 'src/user/entity/user.entity';
import { UserService } from 'src/user/user.service';
import * as bcryptjs from 'bcryptjs';
import { ChangePasswordDTO } from './models/change-password';
import { UserDTO } from 'src/user/models/user';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async registerUser({ email, password, name, lastName, userName }: UserDTO) {
    const apiResponse = new ApiResponse<User>();

    try {
      const user = await this.userService.findOneByEmail(email);

      if (user) {
        return Object.assign(apiResponse, {
          data: null,
          httpCode: HttpStatus.OK,
          message: 'Ya existe un usuario con ese email',
        });
      }

      return await this.userService.createUser({
        email,
        password: await bcryptjs.hash(password, 10),
        name,
        lastName,
        userName,
        idRol: 2,
      });
    } catch (error) {
      return Object.assign(apiResponse, {
        data: null,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error al buscar el usuario: ${error.message}`,
      });
    }
  }

  async changePassword(email: string, body: ChangePasswordDTO) {
    const { newPassword } = body ?? {};
    this.validateNewPassword(newPassword);
    if (!email || typeof email !== 'string') {
      throw new UnauthorizedException();
    }

    const user = await this.userService.findOneByEmail(email);
    if (!user) {
      throw new UnauthorizedException();
    }
    if (await bcryptjs.compare(newPassword, user.password)) {
      throw new BadRequestException(
        'La nueva contraseña debe ser diferente de la actual',
      );
    }

    const password = await bcryptjs.hash(newPassword, 10);
    await this.userService.updateUser(user.id, { password });

    return Object.assign(new ApiResponse<null>(), {
      data: null,
      httpCode: HttpStatus.OK,
      message: 'Contraseña actualizada correctamente',
    });
  }

  private validateNewPassword(
    newPassword: unknown,
  ): asserts newPassword is string {
    if (
      typeof newPassword !== 'string' ||
      newPassword.length < 8 ||
      Buffer.byteLength(newPassword, 'utf8') > 72
    ) {
      throw new BadRequestException(
        'La nueva contraseña debe tener al menos 8 caracteres y como máximo 72 bytes',
      );
    }
  }

  // A different signing key prevents recovery tokens from being used as login JWTs.
  // Binding it to the stored hash invalidates it on any password change.
  private passwordResetSecret(password: string) {
    return createHmac('sha256', jwtConstants.secret)
      .update('password-reset:')
      .update(password)
      .digest('hex');
  }

  async requestPasswordReset(adminEmail: string, userId: number) {
    if (!adminEmail || typeof adminEmail !== 'string') {
      throw new UnauthorizedException();
    }
    const admin = await this.userService.findOneByEmail(adminEmail);
    if (Number(admin?.idRol) !== 1) {
      throw new ForbiddenException(
        'Solo los administradores pueden restablecer contraseñas',
      );
    }
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new BadRequestException('Usuario inválido');
    }
    const user = await this.userService.findOneById(userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Rotate to an unknown password: disables the old password and previous reset tokens.
    const password = await bcryptjs.hash(randomBytes(32).toString('hex'), 10);
    const token = await this.jwtService.signAsync(
      { sub: String(user.id), purpose: 'password-reset' },
      {
        secret: this.passwordResetSecret(password),
        expiresIn: '15m',
        algorithm: 'HS256',
        audience: 'password-reset',
      },
    );
    if (
      !(await this.userService.replacePassword(
        user.id,
        user.password,
        password,
      ))
    ) {
      throw new ConflictException(
        'La contraseña cambió. Volvé a solicitar el restablecimiento',
      );
    }
    return Object.assign(
      new ApiResponse<{ token: string; expiresIn: number }>(),
      {
        data: { token, expiresIn: 900 },
        httpCode: HttpStatus.OK,
        message:
          'Entregá este token al usuario para definir su nueva contraseña',
      },
    );
  }

  async resetPassword(body: ResetPasswordDTO) {
    const { token, newPassword } = body ?? {};
    this.validateNewPassword(newPassword);
    const invalidToken = () =>
      new UnauthorizedException('Token inválido, vencido o ya utilizado');
    if (typeof token !== 'string' || !token.length || token.length > 2048) {
      throw invalidToken();
    }
    let userId: number;
    try {
      const decoded = this.jwtService.decode(token);
      if (
        !decoded ||
        typeof decoded === 'string' ||
        decoded.purpose !== 'password-reset' ||
        typeof decoded.sub !== 'string' ||
        !/^[1-9]\d*$/.test(decoded.sub)
      ) {
        throw invalidToken();
      }
      userId = Number(decoded.sub);
      if (!Number.isSafeInteger(userId)) throw invalidToken();
    } catch {
      throw invalidToken();
    }
    const user = await this.userService.findOneById(userId);
    if (!user) throw invalidToken();
    try {
      await this.jwtService.verifyAsync(token, {
        secret: this.passwordResetSecret(user.password),
        algorithms: ['HS256'],
        audience: 'password-reset',
      });
    } catch {
      throw invalidToken();
    }
    const password = await bcryptjs.hash(newPassword, 10);
    // Conditional update makes consumption atomic, including simultaneous requests.
    if (
      !(await this.userService.replacePassword(
        user.id,
        user.password,
        password,
      ))
    ) {
      throw invalidToken();
    }
    return Object.assign(new ApiResponse<null>(), {
      data: null,
      httpCode: HttpStatus.OK,
      message: 'Contraseña actualizada correctamente. Ya podés iniciar sesión',
    });
  }

  async login({ email, password }: UserDTO) {
    const apiResponse = new ApiResponse<User>();

    try {
      const user = await this.userService.findOneByEmail(email);
      if (!user) {
        return Object.assign(apiResponse, {
          data: null,
          httpCode: HttpStatus.OK,
          message: 'El mail o la contraseña no son correctas',
          code: -1,
        });
      }

      const isPasswordValid = await bcryptjs.compare(password, user.password);
      if (!isPasswordValid) {
        return Object.assign(apiResponse, {
          data: null,
          httpCode: HttpStatus.OK,
          message: 'El mail o la contraseña no son correctas',
          code: -1,
        });
      }

      const team = await this.userService.findUserWithTeams(user.id);
      const payload = { email: user.email };
      const token = await this.jwtService.signAsync(payload);

      return Object.assign(apiResponse, {
        data: {
          id: user.id,
          token: token,
          email: user.email,
          expiryToken: 10000,
          nombre: user.name,
          lastName: user.lastName,
          userName: user.userName,
          idRol: user.idRol,
          idTeam: team.data ? team.data.id : null,
        },
        httpCode: HttpStatus.OK,
        message: '',
      });
    } catch (error) {
      return Object.assign(apiResponse, {
        data: null,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error al buscar el usuario: ${error.message}`,
      });
    }
  }
}
