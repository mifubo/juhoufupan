import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import * as mammoth from 'mammoth';
import PDFDocument = require('pdfkit');
import { join } from 'path';
import { Repository } from 'typeorm';
import {
  Asset,
  AuditLog,
  Board,
  BoardVersion,
  ChatMessage,
  ChatSession,
  Clarification,
  Entitlement,
  GenerationTask,
  Notification,
  OperatorAuthorization,
  Order,
  PaymentEvent,
  Quote,
  Refund,
  Script,
  TaskState,
  UploadBatch,
} from './domain/entities';
import { calculateQuote, playerSafe } from './domain/rules';
import { RuleSafetyProvider } from './providers/providers';

@Injectable()
export class AppService {
  constructor(
    @InjectRepository(Script) private scripts: Repository<Script>,
    @InjectRepository(Asset) private assets: Repository<Asset>,
    @InjectRepository(UploadBatch) private batches: Repository<UploadBatch>,
    @InjectRepository(Quote) private quotes: Repository<Quote>,
    @InjectRepository(Order) private orders: Repository<Order>,
    @InjectRepository(PaymentEvent) private payments: Repository<PaymentEvent>,
    @InjectRepository(Entitlement) private rights: Repository<Entitlement>,
    @InjectRepository(GenerationTask) private tasks: Repository<GenerationTask>,
    @InjectRepository(Clarification) private questions: Repository<Clarification>,
    @InjectRepository(Board) private boards: Repository<Board>,
    @InjectRepository(BoardVersion) private versions: Repository<BoardVersion>,
    @InjectRepository(Notification) private notices: Repository<Notification>,
    @InjectRepository(ChatSession) private chats: Repository<ChatSession>,
    @InjectRepository(ChatMessage) private messages: Repository<ChatMessage>,
    @InjectRepository(OperatorAuthorization) private authz: Repository<OperatorAuthorization>,
    @InjectRepository(AuditLog) private audit: Repository<AuditLog>,
    @InjectRepository(Refund) private refunds: Repository<Refund>,
  ) {}
  listScripts(userId: string) {
    return this.scripts.find({
      where: [{ ownerId: userId }, { copyrightScope: 'platform_licensed' }],
      order: { updatedAt: 'DESC' },
    });
  }
  getScript(id: string, userId: string) {
    return this.scripts.findOne({
      where: [
        { id, ownerId: userId },
        { id, copyrightScope: 'platform_licensed' },
      ],
    });
  }
  async upload(userId: string, title: string, file: Express.Multer.File) {
    if (!file?.originalname.toLowerCase().endsWith('.docx'))
      throw new BadRequestException('Only .docx is accepted');
    const sha = createHash('sha256').update(file.buffer).digest('hex');
    const root = process.env.STORAGE_LOCAL_ROOT || '../.local-data/backend-storage';
    await mkdir(root, { recursive: true });
    const key = `${userId}/${randomUUID()}.docx`;
    await mkdir(join(root, userId), { recursive: true });
    await writeFile(join(root, key), file.buffer);
    const script = await this.scripts.save(
      this.scripts.create({
        ownerId: userId,
        title: title || file.originalname.replace(/\.docx$/i, ''),
        copyrightScope: 'user_private',
      }),
    );
    const asset = await this.assets.save(
      this.assets.create({
        scriptId: script.id,
        ownerId: userId,
        storageKey: key,
        originalName: file.originalname,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sha256: sha,
        size: file.size,
      }),
    );
    const parsed = await mammoth.extractRawText({ buffer: file.buffer });
    const words = parsed.value.replace(/\s/g, '').length;
    const images = (file.buffer.toString('binary').match(/word\/media\//g) || []).length;
    const batch = await this.batches.save(
      this.batches.create({
        scriptId: script.id,
        uploaderId: userId,
        visibilityScope: 'user_private',
        fileFingerprint: sha,
        processingState: 'quoted',
        documentIds: [asset.id],
        parseSummary: {
          words,
          images,
          characters: Math.max(1, (parsed.value.match(/[一-龥]{2,4}：/g) || []).length),
          acts: Math.max(1, (parsed.value.match(/第[一-龥一-龥数字]+(?:幕|章)/g) || []).length),
        },
      }),
    );
    return { script, batch };
  }
  async quote(userId: string, batchId: string) {
    const b = await this.batches.findOneByOrFail({ id: batchId, uploaderId: userId });
    const features = b.parseSummary as any;
    const amountFen = calculateQuote(features);
    return this.quotes.save(
      this.quotes.create({
        userId,
        batchId,
        amountFen,
        features,
        priceSnapshot: { version: 'v1', currency: 'CNY', amountFen },
        expiresAt: new Date(Date.now() + 24 * 3600e3),
      }),
    );
  }
  async order(userId: string, quoteId: string) {
    const q = await this.quotes.findOneByOrFail({ id: quoteId, userId });
    return this.orders.save(
      this.orders.create({
        userId,
        quoteId,
        amountFen: q.amountFen,
        status: 'pending',
        priceSnapshot: q.priceSnapshot,
      }),
    );
  }
  async pay(userId: string, orderId: string, callbackId: string) {
    const order = await this.orders.findOneByOrFail({ id: orderId, userId });
    const exists = await this.payments.findOneBy({ provider: 'mock', callbackId });
    if (exists) return { order, idempotent: true };
    await this.payments.save(
      this.payments.create({ provider: 'mock', callbackId, orderId, payload: { paid: true } }),
    );
    order.status = 'paid';
    await this.orders.save(order);
    await this.rights.save(this.rights.create({ userId, orderId, type: 'board_generation' }));
    const q = await this.quotes.findOneByOrFail({ id: order.quoteId });
    const b = await this.batches.findOneByOrFail({ id: q.batchId });
    const task = await this.tasks.save(
      this.tasks.create({
        userId,
        scriptId: b.scriptId,
        orderId,
        state: TaskState.PAID_NOT_STARTED,
      }),
    );
    return { order, task, idempotent: false };
  }
  task(id: string, userId: string) {
    return this.tasks.findOneBy({ id, userId });
  }
  clarification(taskId: string, userId: string) {
    return this.tasks
      .findOneBy({ id: taskId, userId })
      .then((t) =>
        t ? this.questions.find({ where: { taskId }, order: { createdAt: 'ASC' } }) : [],
      );
  }
  listBoards(userId: string) {
    return this.boards.findBy({ ownerId: userId });
  }
  async board(id: string, userId: string) {
    const b = await this.boards.findOneBy({ id, ownerId: userId });
    if (!b) throw new NotFoundException();
    const v = await this.versions.findOneByOrFail({ boardId: id, version: b.currentVersion });
    return { board: b, version: v };
  }
  async saveBoard(id: string, userId: string, snapshot: any) {
    const b = await this.boards.findOneByOrFail({ id, ownerId: userId });
    b.currentVersion++;
    await this.boards.save(b);
    return this.versions.save(
      this.versions.create({
        boardId: id,
        version: b.currentVersion,
        method: 'user_saved',
        snapshot,
      }),
    );
  }
  async exportPdf(id: string, userId: string) {
    const { board, version } = await this.board(id, userId);
    const elements = playerSafe((version.snapshot as any).nodes || []);
    const root = process.env.STORAGE_LOCAL_ROOT || '../.local-data/backend-storage';
    const dir = join(root, 'pdf');
    await mkdir(dir, { recursive: true });
    const path = join(dir, `${board.id}-${version.version}.pdf`);
    await new Promise<void>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape' });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => writeFile(path, Buffer.concat(chunks)).then(() => resolve(), reject));
      doc.fontSize(24).fillColor('#6b21a8').text('局后复盘 · 玩家板报', 40, 35);
      doc.fontSize(9).fillColor('#999').text(`WATERMARK 局后复盘 / ${board.id}`, 40, 565);
      let y = 100;
      for (const e of elements) {
        doc
          .fontSize(15)
          .fillColor('#222')
          .text(String((e.data as any).label || e.id), 60, y);
        y += 35;
      }
      doc.end();
    });
    return { path, expiresAt: new Date(Date.now() + 15 * 60e3) };
  }
  noticesFor(userId: string) {
    return this.notices.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }
  async createChat(userId: string, d: any) {
    return this.chats.save(this.chats.create({ userId, ...d, remainingRounds: 10 }));
  }
  async chat(userId: string, id: string, text: string) {
    const s = await this.chats.findOneByOrFail({ id, userId });
    if (s.remainingRounds < 1) throw new BadRequestException('No remaining rounds');
    const safety = await new RuleSafetyProvider().check(text);
    if (!safety.safe)
      return { blocked: true, charged: false, reply: '这个话题我无法继续，我们换个安全的话题吧。' };
    await this.messages.save(this.messages.create({ sessionId: id, role: 'user', content: text }));
    const reply = `[角色回忆] 我只能根据自己在结局时知道的事回答：${text.slice(0, 80)}`;
    await this.messages.save(
      this.messages.create({
        sessionId: id,
        role: 'assistant',
        content: reply,
        charged: true,
        usage: { provider: 'mock', inputTokens: text.length, outputTokens: reply.length },
      }),
    );
    s.remainingRounds--;
    await this.chats.save(s);
    return { reply, charged: true, remainingRounds: s.remainingRounds };
  }
  async authorizeOperator(userId: string, taskId: string, scope: string) {
    await this.tasks.findOneByOrFail({ id: taskId, userId });
    const a = await this.authz.save(
      this.authz.create({
        taskId,
        userId,
        scope,
        termsVersion: 'v1',
        expiresAt: new Date(Date.now() + 7 * 864e5),
      }),
    );
    await this.audit.save(
      this.audit.create({
        actorId: userId,
        action: 'operator.authorize',
        targetType: 'task',
        targetId: taskId,
        details: { scope },
      }),
    );
    return a;
  }
  async refund(orderId: string, reason: string) {
    return this.refunds.save(this.refunds.create({ orderId, reason }));
  }
}
