import { Module } from '@nestjs/common';
import { ExportService } from './export.service.js';
import { PrivacyController } from './privacy.controller.js';
import { PrivacyService } from './privacy.service.js';

@Module({ controllers: [PrivacyController], providers: [ExportService, PrivacyService] })
export class PrivacyModule {}
