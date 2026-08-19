import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtGuard, AuthService } from './auth/auth';
import { AppService } from './app.service';
import { TaskService } from './pipeline/pipeline';
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}
  @Post('register') register(@Body() d: any) {
    return this.auth.register(d.phone, d.password);
  }
  @Post('login') login(@Body() d: any) {
    return this.auth.login(d.phone, d.password);
  }
  @Post('sms/mock') sms(@Body() d: any) {
    return this.auth.sms(d.phone, d.code);
  }
  @Post('wechat/mock') wechat(@Body() d: any) {
    return this.auth.wechat(`mock_${d.code}`);
  }
  @Post('refresh') refresh(@Body() d: any) {
    return this.auth.refresh(d.refreshToken);
  }
  @UseGuards(JwtGuard) @Post('bind') bind(@CurrentUser() u: any, @Body() d: any) {
    return this.auth.bind(u.sub, d.provider, d.externalId);
  }
  @UseGuards(JwtGuard) @Post('merge') merge(@CurrentUser() u: any, @Body() d: any) {
    return this.auth.merge(u.sub, d.secondaryUserId, d.proof);
  }
}
@ApiTags('platform')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller()
export class AppController {
  constructor(
    private app: AppService,
    private tasks: TaskService,
  ) {}
  @Get('scripts') scripts(@CurrentUser() u: any) {
    return this.app.listScripts(u.sub);
  }
  @Get('scripts/:id') script(@CurrentUser() u: any, @Param('id') id: string) {
    return this.app.getScript(id, u.sub);
  }
  @Post('uploads')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  upload(
    @CurrentUser() u: any,
    @Body('title') title: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.app.upload(u.sub, title, file);
  }
  @Post('quotes') quote(@CurrentUser() u: any, @Body() d: any) {
    return this.app.quote(u.sub, d.batchId);
  }
  @Post('orders') order(@CurrentUser() u: any, @Body() d: any) {
    return this.app.order(u.sub, d.quoteId);
  }
  @Post('payments/mock') pay(@CurrentUser() u: any, @Body() d: any) {
    return this.app.pay(u.sub, d.orderId, d.callbackId);
  }
  @Post('tasks/:id/start') async start(@CurrentUser() u: any, @Param('id') id: string) {
    const t = await this.app.task(id, u.sub);
    if (!t) throw new Error('Not found');
    return this.tasks.start(t);
  }
  @Get('tasks/:id') task(@CurrentUser() u: any, @Param('id') id: string) {
    return this.app.task(id, u.sub);
  }
  @Get('tasks/:id/clarifications') qs(@CurrentUser() u: any, @Param('id') id: string) {
    return this.app.clarification(id, u.sub);
  }
  @Post('tasks/:id/clarifications/reply') reply(
    @CurrentUser() u: any,
    @Param('id') id: string,
    @Body() d: any,
  ) {
    return this.tasks.answer(id, u.sub, d.answer);
  }
  @Post('tasks/:id/operator-authorization') authz(
    @CurrentUser() u: any,
    @Param('id') id: string,
    @Body() d: any,
  ) {
    return this.app.authorizeOperator(u.sub, id, d.scope);
  }
  @Get('boards') boards(@CurrentUser() u: any) {
    return this.app.listBoards(u.sub);
  }
  @Get('boards/:id') board(@CurrentUser() u: any, @Param('id') id: string) {
    return this.app.board(id, u.sub);
  }
  @Patch('boards/:id') save(@CurrentUser() u: any, @Param('id') id: string, @Body() d: any) {
    return this.app.saveBoard(id, u.sub, d.snapshot);
  }
  @Post('boards/:id/pdf') pdf(@CurrentUser() u: any, @Param('id') id: string) {
    return this.app.exportPdf(id, u.sub);
  }
  @Get('notifications') notices(@CurrentUser() u: any) {
    return this.app.noticesFor(u.sub);
  }
  @Post('chats') chatCreate(@CurrentUser() u: any, @Body() d: any) {
    return this.app.createChat(u.sub, d);
  }
  @Post('chats/:id/messages') chat(@CurrentUser() u: any, @Param('id') id: string, @Body() d: any) {
    return this.app.chat(u.sub, id, d.text);
  }
}
@ApiTags('health')
@Controller()
export class PublicController {
  @Get('health') health() {
    return { status: 'ok', service: 'juhoufupan-api', timestamp: new Date().toISOString() };
  }
  @Get('metrics') metrics() {
    return '# HELP juhoufupan_up Service availability\n# TYPE juhoufupan_up gauge\njuhoufupan_up 1\n';
  }
}
