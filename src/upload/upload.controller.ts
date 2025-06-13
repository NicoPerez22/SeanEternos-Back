import {
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: Express.Multer.File) {
    const image = await this.uploadService.uploadImage(file);
    return {
      message: 'Imagen subida correctamente',
      id: image.id,
      url: image.secureUrl,
    };
  }

  @Get()
  async getAll() {
    const images = await this.uploadService.findAll();
    return images;
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    const image = await this.uploadService.findOne(Number(id));
    if (!image) {
      throw new NotFoundException('Imagen no encontrada');
    }
    return image;
  }

  @Delete(':id')
  async deleteImage(@Param('id', ParseIntPipe) id: number) {
    const message = await this.uploadService.deleteImage(id);
    return { message };
  }
}
