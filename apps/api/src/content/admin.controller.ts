import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  AuthenticationInputSchema,
  ContentStatusSchema,
  ContentTypeSchema,
  DifferenceInputSchema,
  HadithInputSchema,
  HadithPatchSchema,
  LinksInputSchema,
  NarratorInputSchema,
  OccasionInputSchema,
  OccasionPatchSchema,
  RoleChangeSchema,
  SourceInputSchema,
  SunnahInputSchema,
  SunnahPatchSchema,
  TransitionInputSchema,
  type ContentType,
} from '@tadhkirah/contracts';
import { z } from 'zod';
import { SessionGuard } from '../auth/session.guard.js';
import { AppError, CurrentAuth, type AuthContext } from '../common/http.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { ContentAdminService } from './admin.service.js';
import { RolesService } from './roles.service.js';

const TypePipe = new ZodPipe(ContentTypeSchema);
const Uuid = new ParseUUIDPipe();
const ListQuery = z.object({
  status: ContentStatusSchema.optional(),
  q: z.string().max(100).optional(),
});
const PATCH_SCHEMAS = {
  hadiths: HadithPatchSchema,
  sunnahs: SunnahPatchSchema,
  occasions: OccasionPatchSchema,
};
const EDITORS = ['editor', 'reviewer', 'publisher', 'admin'] as const;

/** Editorial back office (ADR-003, CON-10). Every route needs an editorial role. */
@Controller('admin')
@UseGuards(SessionGuard)
export class ContentAdminController {
  constructor(
    private readonly admin: ContentAdminService,
    private readonly roles: RolesService,
  ) {}

  @Get('me')
  async me(@CurrentAuth() auth: AuthContext) {
    return {
      roles: await this.roles.rolesOf(auth.userId),
      twoPersonRule: this.admin.twoPersonRule,
    };
  }

  @Get('sources')
  async sources(@CurrentAuth() a: AuthContext) {
    await this.roles.require(a.userId, ...EDITORS);
    return this.admin.sources();
  }
  @Post('sources')
  async addSource(
    @CurrentAuth() a: AuthContext,
    @Body(new ZodPipe(SourceInputSchema)) body: z.output<typeof SourceInputSchema>,
  ) {
    await this.roles.require(a.userId, 'editor');
    return this.admin.addSource(body);
  }
  @Get('narrators')
  async narrators(@CurrentAuth() a: AuthContext) {
    await this.roles.require(a.userId, ...EDITORS);
    return this.admin.narrators();
  }
  @Post('narrators')
  async addNarrator(
    @CurrentAuth() a: AuthContext,
    @Body(new ZodPipe(NarratorInputSchema)) body: z.output<typeof NarratorInputSchema>,
  ) {
    await this.roles.require(a.userId, 'editor');
    return this.admin.addNarrator(body);
  }

  @Post('import-candidates')
  async importCandidates(@CurrentAuth() a: AuthContext) {
    await this.roles.require(a.userId, 'admin');
    return this.admin.importCandidates(a.userId);
  }

  @Get('team')
  async team(@CurrentAuth() a: AuthContext) {
    await this.roles.require(a.userId, 'admin');
    return this.roles.team();
  }
  @Put('team')
  @HttpCode(204)
  async changeRole(
    @CurrentAuth() a: AuthContext,
    @Body(new ZodPipe(RoleChangeSchema)) body: z.output<typeof RoleChangeSchema>,
  ) {
    await this.roles.require(a.userId, 'admin');
    await this.roles.change(a.userId, body.email, body.role, body.grant);
  }

  /** The verification loop: published items due for re-review, or reported. */
  @Get('review-queue')
  async reviewQueue(@CurrentAuth() a: AuthContext) {
    await this.roles.require(a.userId, 'reviewer', 'publisher', 'admin');
    return this.admin.reviewQueue();
  }

  @Get('issue-reports')
  async issues(@CurrentAuth() a: AuthContext) {
    await this.roles.require(a.userId, 'reviewer', 'publisher', 'admin');
    return this.admin.issueReports();
  }
  @Post('issue-reports/:id/resolve')
  @HttpCode(204)
  async resolve(@CurrentAuth() a: AuthContext, @Param('id', Uuid) id: string) {
    await this.roles.require(a.userId, 'reviewer', 'publisher', 'admin');
    await this.admin.resolveIssue(a.userId, id);
  }

  @Get(':type')
  async list(
    @CurrentAuth() a: AuthContext,
    @Param('type', TypePipe) type: ContentType,
    @Query(new ZodPipe(ListQuery)) q: z.output<typeof ListQuery>,
  ) {
    await this.roles.require(a.userId, ...EDITORS);
    return this.admin.list(type, q.status, q.q);
  }

  @Post(':type')
  async create(
    @CurrentAuth() a: AuthContext,
    @Param('type', TypePipe) type: ContentType,
    @Body() raw: unknown,
  ) {
    await this.roles.require(a.userId, 'editor');
    if (type === 'hadiths')
      return this.admin.createHadith(a.userId, new ZodPipe(HadithInputSchema).transform(raw));
    if (type === 'sunnahs')
      return this.admin.createSunnah(a.userId, new ZodPipe(SunnahInputSchema).transform(raw));
    return this.admin.createOccasion(a.userId, new ZodPipe(OccasionInputSchema).transform(raw));
  }

  @Get(':type/:id')
  async detail(
    @CurrentAuth() a: AuthContext,
    @Param('type', TypePipe) type: ContentType,
    @Param('id', Uuid) id: string,
  ) {
    await this.roles.require(a.userId, ...EDITORS);
    return this.admin.detail(a.userId, type, id);
  }

  @Patch(':type/:id')
  async patch(
    @CurrentAuth() a: AuthContext,
    @Param('type', TypePipe) type: ContentType,
    @Param('id', Uuid) id: string,
    @Body() raw: unknown,
  ) {
    await this.roles.require(a.userId, 'editor');
    return this.admin.patch(
      a.userId,
      type,
      id,
      new ZodPipe(PATCH_SCHEMAS[type] as z.ZodType<object>).transform(raw),
    );
  }

  @Post(':type/:id/transitions')
  async transition(
    @CurrentAuth() a: AuthContext,
    @Param('type', TypePipe) type: ContentType,
    @Param('id', Uuid) id: string,
    @Body(new ZodPipe(TransitionInputSchema)) body: z.output<typeof TransitionInputSchema>,
  ) {
    await this.roles.require(a.userId, ...EDITORS);
    return this.admin.transition(a.userId, a.sessionId, type, id, body.action, body.notes);
  }

  @Post(':type/:id/revisions')
  async revise(
    @CurrentAuth() a: AuthContext,
    @Param('type', TypePipe) type: ContentType,
    @Param('id', Uuid) id: string,
  ) {
    await this.roles.require(a.userId, 'editor');
    return this.admin.revise(a.userId, type, id);
  }

  @Post(':type/:id/differences')
  async addDifference(
    @CurrentAuth() a: AuthContext,
    @Param('type', TypePipe) type: ContentType,
    @Param('id', Uuid) id: string,
    @Body(new ZodPipe(DifferenceInputSchema)) body: z.output<typeof DifferenceInputSchema>,
  ) {
    await this.roles.require(a.userId, 'editor', 'reviewer');
    return this.admin.addDifference(a.userId, type, id, body);
  }
  @Delete(':type/:id/differences/:did')
  @HttpCode(204)
  async removeDifference(
    @CurrentAuth() a: AuthContext,
    @Param('type', TypePipe) type: ContentType,
    @Param('id', Uuid) id: string,
    @Param('did', Uuid) did: string,
  ) {
    await this.roles.require(a.userId, 'editor', 'reviewer');
    await this.admin.removeDifference(type, id, did);
  }

  @Post('hadiths/:id/authentications')
  async addAuthentication(
    @CurrentAuth() a: AuthContext,
    @Param('id', Uuid) id: string,
    @Body(new ZodPipe(AuthenticationInputSchema)) body: z.output<typeof AuthenticationInputSchema>,
  ) {
    await this.roles.require(a.userId, 'editor', 'reviewer');
    return this.admin.addAuthentication(a.userId, id, body);
  }
  @Delete('hadiths/:id/authentications/:aid')
  @HttpCode(204)
  async removeAuthentication(
    @CurrentAuth() a: AuthContext,
    @Param('id', Uuid) id: string,
    @Param('aid', Uuid) aid: string,
  ) {
    await this.roles.require(a.userId, 'editor', 'reviewer');
    await this.admin.removeAuthentication(a.userId, id, aid);
  }

  @Put(':type/:id/hadiths')
  @HttpCode(204)
  async setLinks(
    @CurrentAuth() a: AuthContext,
    @Param('type', TypePipe) type: ContentType,
    @Param('id', Uuid) id: string,
    @Body(new ZodPipe(LinksInputSchema)) body: z.output<typeof LinksInputSchema>,
  ) {
    await this.roles.require(a.userId, 'editor');
    if (type === 'hadiths') throw new AppError(404, 'not_found');
    await this.admin.setLinks(a.userId, type, id, body);
  }
}
