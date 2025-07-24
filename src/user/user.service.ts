import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entity/user.entity';
import { Image } from 'src/upload/entity/image.entity';
import { TeamDTO } from 'src/team/models/team';
import { ApiResponse } from 'shared/models/apiResponse';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,

    @InjectRepository(Image)
    private readonly imageRepository: Repository<Image>,
  ) {}

  createUser(user) {
    return this.userRepository.save(user);
  }

  findOneByEmail(email: string) {
    return this.userRepository.findOne({ where: { email } });
  }

  findOneById(id: number) {
    return this.userRepository.findOne({ where: { id } });
  }

  async findUserWithTeams(id: number) {
    const apiResponse = new ApiResponse<TeamDTO>();
    let teamDTO = new TeamDTO();

    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['teams'],
    });

    if (!user) return null;

    // Si no tiene equipos, retorna el usuario tal cual
    if (!user.teams || user.teams.length === 0) return user;

    // Solo el equipo en la posición 0, agregando el logo
    const team = user.teams[0];
    const logo = await this._getImage(team.idLogo);

    teamDTO.name = team.name;
    teamDTO.id = team.id;
    teamDTO.logo = logo;

    let resp = { ...teamDTO, user };

    return Object.assign(apiResponse, {
      data: resp,
      httpCode: HttpStatus.OK,
      message: '',
    });
  }

  async _getImage(idLogo) {
    return await this.imageRepository.findOne({
      where: {
        id: idLogo,
      },
    });
  }
}
