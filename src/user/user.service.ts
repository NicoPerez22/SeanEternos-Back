import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entity/user.entity';
import { TeamDTO } from 'src/team/models/team';
import { ApiResponse } from 'shared/models/apiResponse';
import { ImagesService } from 'shared/services/images/images.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly ImagesService: ImagesService,
  ) {}

  async createUser(user) {
    return await this.userRepository.save(user);
  }

  async findOneByEmail(email: string) {
    return await this.userRepository.findOne({ where: { email } });
  }

  async findOneById(id: number) {
    return await this.userRepository.findOne({ where: { id } });
  }

  async findUser() {
    return await this.userRepository.find();
  }

  async findUserWithTeams(id: number) {
    const apiResponse = new ApiResponse<TeamDTO>();
    const teamDTO = new TeamDTO();

    try {
      const user = await this.userRepository.findOne({
        where: { id },
        relations: ['teams'],
      });

      if (!user) {
        return Object.assign(apiResponse, {
          data: null,
          httpCode: HttpStatus.OK,
          message: 'No existe un usuario con ese id',
        });
      }

      if (!user.teams || user.teams.length === 0) {
        return Object.assign(apiResponse, {
          data: null,
          httpCode: HttpStatus.OK,
          message: 'El usuario no tiene equipos',
        });
      }

      const team = user.teams[0];
      const logo = await this.ImagesService.getImage(team.idLogo);

      teamDTO.name = team.name;
      teamDTO.id = team.id;
      teamDTO.logo = logo;

      return Object.assign(apiResponse, {
        data: { ...teamDTO, user },
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
