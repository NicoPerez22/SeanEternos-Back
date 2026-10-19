import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  ParseIntPipe,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ResetPasswordDTO } from './models/reset-password';
import { ChangePasswordDTO } from './models/change-password';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { UserDTO } from 'src/user/models/user';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  createUser(@Body() user: UserDTO) {
    return this.authService.registerUser(user);
  }

  @Post('login')
  login(@Body() user: UserDTO) {
    return this.authService.login(user);
  }

  @Patch('password')
  @UseGuards(AuthGuard)
  changePassword(
    @Request() req: { user: { email: string } },
    @Body() body: ChangePasswordDTO,
  ) {
    return this.authService.changePassword(req.user.email, body);
  }

  @Post('password-reset/:userId')
  @UseGuards(AuthGuard)
  requestPasswordReset(
    @Request() req: { user: { email: string } },
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.authService.requestPasswordReset(req.user.email, userId);
  }

  @Post('password-reset')
  resetPassword(@Body() body: ResetPasswordDTO) {
    return this.authService.resetPassword(body);
  }

  @Get('profile')
  @UseGuards(AuthGuard)
  profile(@Request() req: any) {
    return req.user;
  }
}
