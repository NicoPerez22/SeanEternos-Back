import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
import { Image } from './entity/image.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class UploadService {
  constructor(
    @Inject('CLOUDINARY')
    private readonly cloudinary: typeof import('cloudinary').v2,
    @InjectRepository(Image) private imageRepository: Repository<Image>,
  ) {}

  async uploadImage(file: Express.Multer.File): Promise<Image> {
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = this.cloudinary.uploader.upload_stream(
        { folder: 'mi_app' },
        (error, result) => {
          if (error) return reject(error);
          if (result) {
            resolve(result);
          } else {
            reject(new Error('Upload result is undefined'));
          }
        },
      );

      Readable.from(file.buffer).pipe(stream);
    });

    const image = this.imageRepository.create({
      publicId: result.public_id,
      secureUrl: result.secure_url,
      originalName: file.originalname,
    });

    return this.imageRepository.save(image);
  }

  async findAll(): Promise<Image[]> {
    return this.imageRepository.find();
  }

  async findOne(id: number): Promise<Image> {
    const image = await this.imageRepository.findOneBy({ id });
    if (!image) {
      throw new Error(`Image with id ${id} not found`);
    }
    return image;
  }

  async deleteImage(id: number): Promise<string> {
    const image = await this.imageRepository.findOne({ where: { id } });

    if (!image) {
      throw new NotFoundException('Imagen no encontrada');
    }

    // 1. Borrar de Cloudinary
    await this.deleteFile(image.publicId);

    // 2. Borrar de la base de datos
    await this.imageRepository.remove(image);

    return 'Imagen eliminada con éxito';
  }

  async deleteFile(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }
}
