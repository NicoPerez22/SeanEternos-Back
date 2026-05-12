import { v2 as cloudinary } from 'cloudinary';
import { ConfigService } from '@nestjs/config';

export const CloudinaryProvider = {
  provide: 'CLOUDINARY',
  useFactory: (configService: ConfigService) => {
    const name = configService.get<string>('CLOUDINARY_NAME');
    const key = configService.get<string>('CLOUDINARY_API_KEY');
    const secret = configService.get<string>('CLOUDINARY_API_SECRET');

    console.log('[Cloudinary] config →', {
      name: name ?? 'UNDEFINED',
      key: key ? `${key.slice(0, 4)}...` : 'UNDEFINED',
      secret: secret ? `${secret.slice(0, 4)}...` : 'UNDEFINED',
    });

    cloudinary.config({
      cloud_name: name,
      api_key: key,
      api_secret: secret,
    });
    return cloudinary;
  },
  inject: [ConfigService],
};
