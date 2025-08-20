import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiResponse } from 'shared/models/apiResponse';
import { User } from 'src/user/entity/user.entity';
import { UserService } from 'src/user/user.service';
import * as bcryptjs from 'bcryptjs';
import { UserDTO } from 'src/user/models/user';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async registerUser({ email, password }: UserDTO) {
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
      });
    } catch (error) {
      return Object.assign(apiResponse, {
        data: null,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error al buscar el usuario: ${error.message}`,
      });
    }
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
        });
      }

      const isPasswordValid = await bcryptjs.compare(password, user.password);
      if (!isPasswordValid) {
        return Object.assign(apiResponse, {
          data: null,
          httpCode: HttpStatus.OK,
          message: 'El mail o la contraseña no son correctas',
        });
      }

      const payload = { email: user.email };
      const token = await this.jwtService.signAsync(payload);

      return Object.assign(apiResponse, {
        data: {
          id: user.id,
          token: token,
          email: user.email,
          expiryToken: 10000,
          nombre: 'Nico',
          idRol: user.idRol,
          idTeam: user.teams
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
