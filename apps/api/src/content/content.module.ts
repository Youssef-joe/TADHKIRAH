import { Module } from '@nestjs/common';
import { ContentAdminController } from './admin.controller.js';
import { ContentAdminService } from './admin.service.js';
import { ContentController } from './content.controller.js';
import { PublicContentService } from './public.service.js';
import { ReviewDigestService } from './review-digest.service.js';
import { RolesService } from './roles.service.js';

@Module({
  controllers: [ContentController, ContentAdminController],
  providers: [ContentAdminService, PublicContentService, RolesService, ReviewDigestService],
  exports: [ReviewDigestService],
})
export class ContentModule {}
