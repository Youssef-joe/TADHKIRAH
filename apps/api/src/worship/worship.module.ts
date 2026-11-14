import { Module } from '@nestjs/common';
import { WorshipController } from './worship.controller.js';
import { WorshipService } from './worship.service.js';

@Module({ controllers: [WorshipController], providers: [WorshipService] })
export class WorshipModule {}
