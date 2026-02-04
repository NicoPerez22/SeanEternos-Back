import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}

  @Post()
  createUser(@Body() newUser: any) {
    return this.userService.createUser(newUser);
  }

  @Post(':id')
  updateUserr(@Param('id', ParseIntPipe) id: number, @Body() newUser: any) {
    return this.userService.updateUser(id, newUser);
  }

  @Get(':id')
  getUserByID(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findUserWithTeams(id);
  }

  @Get()
  getUsers() {
    return this.userService.findUser();
  }
}
