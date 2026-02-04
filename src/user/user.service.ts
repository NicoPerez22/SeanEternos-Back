import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entity/user.entity';
import { TeamDTO } from 'src/team/models/team';
import { ApiResponse } from 'shared/models/apiResponse';
import { ImagesService } from 'shared/services/images/images.service';
import { ResponseUserDTO } from './models/user';

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

  async updateUser(id: number, dto: any) {
    return this.userRepository.update({ id }, dto);
  }

  async findUser() {
    const apiResponse = new ApiResponse<ResponseUserDTO>();
    const resp = await this.userRepository.find();

    const usersDto = resp.map(
      (user) =>
        new ResponseUserDTO({
          id: user.id,
          name: user.name,
          email: user.email,
          lastName: user.lastName,
        }),
    );

    return {
      ...apiResponse,
      httpCode: HttpStatus.OK,
      message: 'List All Users',
      data: usersDto,
    };
  }

  async findUserWithTeams(id: number) {
    const apiResponse = new ApiResponse<TeamDTO>();
    const teamDTO = new TeamDTO();

    try {
      const user = await this.userRepository.findOne({
        where: { id },
        relations: ['teams'],
      });

      if (!user) throw new NotFoundException(`Cant not found user ${id}`);

      if (user?.teams && user?.teams?.length > 0) {
        const team = user.teams[0];
        const logo = await this.ImagesService.getImage(team.idLogo);
  
        teamDTO.name = team.name;
        teamDTO.id = team.id;
        teamDTO.logo = logo;
      }


      return Object.assign(apiResponse, {
        httpCode: HttpStatus.OK,
        message: '',
        data: { ...teamDTO, user },
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
