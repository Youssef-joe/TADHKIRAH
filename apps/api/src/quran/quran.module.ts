import { Module } from '@nestjs/common';
import { QuranController } from './quran.controller.js';
import { QuranService } from './quran.service.js';

@Module({ controllers: [QuranController], providers: [QuranService] })
export class QuranModule {}
