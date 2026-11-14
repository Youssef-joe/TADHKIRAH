import { Global, Module } from '@nestjs/common';
import { PrayerController } from './prayer.controller.js';
import { PrayerService } from './prayer.service.js';

@Global()
@Module({ controllers: [PrayerController], providers: [PrayerService], exports: [PrayerService] })
export class PrayerModule {}
