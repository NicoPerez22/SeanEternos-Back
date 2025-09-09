import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './entity/user.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { Image } from 'src/upload/entity/image.entity';
import { ImagesService } from 'shared/services/images/images.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Image])],
  controllers: [UserController],
  providers: [UserService, ImagesService],
  exports: [UserService],
})
export class UserModule {}
