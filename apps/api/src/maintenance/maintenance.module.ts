import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module.js';
import { CronController } from './cron.controller.js';

@Module({ imports: [ContentModule], controllers: [CronController] })
export class MaintenanceModule {}
