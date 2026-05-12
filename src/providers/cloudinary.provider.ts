import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import { ConfigService } from '@nestjs/config';
import { resolveEnvFilePath } from '../config/resolve-env-file';

/**
 * Lee el mismo archivo .env / .env-dev que usa ConfigModule.
 * Sirve de respaldo porque Nest fusiona { ...archivo, ...process.env }: lo que ya
 * venga en el entorno (p. ej. Docker con CLOUDINARY_API_KEY vacía) pisa el .env.
 */
function cloudinaryVarsFromEnvFile(): Record<string, string> {
  const p = resolve(process.cwd(), resolveEnvFilePath());
  if (!existsSync(p)) return {};
  return parse(readFileSync(p)) as Record<string, string>;
}

function pickCloudinaryVar(
  configService: ConfigService,
  fileEnv: Record<string, string>,
  key: 'CLOUDINARY_NAME' | 'CLOUDINARY_API_KEY' | 'CLOUDINARY_API_SECRET',
): string | undefined {
  const fromConfig = configService.get<string>(key);
  const trimmed =
    typeof fromConfig === 'string' ? fromConfig.trim() : fromConfig;
  if (trimmed) return trimmed;
  const fromFile = fileEnv[key]?.trim();
  if (fromFile) return fromFile;
  return undefined;
}

export const CloudinaryProvider = {
  provide: 'CLOUDINARY',
  useFactory: (configService: ConfigService) => {
    const fileEnv = cloudinaryVarsFromEnvFile();
    cloudinary.config({
      cloud_name: pickCloudinaryVar(
        configService,
        fileEnv,
        'CLOUDINARY_NAME',
      ),
      api_key: pickCloudinaryVar(
        configService,
        fileEnv,
        'CLOUDINARY_API_KEY',
      ),
      api_secret: pickCloudinaryVar(
        configService,
        fileEnv,
        'CLOUDINARY_API_SECRET',
      ),
    });
    return cloudinary;
  },
  inject: [ConfigService],
};
