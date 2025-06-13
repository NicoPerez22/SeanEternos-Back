import { Module } from '@nestjs/common';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { CloudinaryProvider } from 'src/providers/cloudinary.provider';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Image } from './entity/image.entity';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Image])],
  providers: [UploadService, CloudinaryProvider],
  controllers: [UploadController],
})
export class UploadModule {}
