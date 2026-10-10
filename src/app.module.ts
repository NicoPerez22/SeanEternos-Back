import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from './user/user.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { TournamentModule } from './tournament/tournament.module';
import { TeamModule } from './team/team.module';
import { UploadModule } from './upload/upload.module';
import { PlayerModule } from './player/player.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { resolveEnvFilePath } from './config/resolve-env-file';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolveEnvFilePath(),
    }),
    UserModule,
    AuthModule,
    TournamentModule,
    TeamModule,
    UploadModule,
    PlayerModule,
    DashboardModule,
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.MYSQLHOST,
      port: Number(process.env.MYSQLPORT || 3306),
      username: process.env.MYSQLUSER,
      password: process.env.MYSQLPASSWORD,
      database: process.env.MYSQLDATABASE,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: false,
      autoLoadEntities: true,

      // Tiempo máximo para establecer una conexión inicial.
      connectTimeout: 10_000,

      extra: {
        connectionLimit: 10,
        waitForConnections: true,
        queueLimit: 0,

        // Reducir conexiones que permanecen inactivas.
        maxIdle: 2,
        idleTimeout: 30_000,

        // Mantener activo el socket TCP.
        enableKeepAlive: true,
        keepAliveInitialDelay: 10_000,
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
