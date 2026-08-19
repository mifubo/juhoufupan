import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TaskState } from './task-state';

export { TaskState } from './task-state';
export abstract class Base {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
@Entity()
export class User extends Base {
  @Column('varchar', { nullable: true, unique: true }) phone?: string;
  @Column('varchar', { nullable: true }) passwordHash?: string;
  @Column({ default: 'active' }) status!: string;
  @Column('simple-array', { default: '' }) roles!: string[];
}
@Entity()
@Index(['provider', 'externalId'], { unique: true })
export class Identity extends Base {
  @Column() userId!: string;
  @Column() provider!: string;
  @Column() externalId!: string;
}
@Entity()
export class RefreshToken extends Base {
  @Column() userId!: string;
  @Column({ unique: true }) tokenHash!: string;
  @Column() expiresAt!: Date;
  @Column('timestamp', { nullable: true }) revokedAt?: Date;
}
@Entity()
export class Script extends Base {
  @Column() ownerId!: string;
  @Column() title!: string;
  @Column({ default: 'user_private' }) copyrightScope!: string;
  @Column({ default: 'active' }) status!: string;
  @Column({ default: '1.0' }) schemaVersion!: string;
}
@Entity()
export class Asset extends Base {
  @Column() scriptId!: string;
  @Column() ownerId!: string;
  @Column() storageKey!: string;
  @Column() originalName!: string;
  @Column() mimeType!: string;
  @Column() sha256!: string;
  @Column({ default: 0 }) size!: number;
  @Column({ default: 'source_document' }) assetType!: string;
}
@Entity()
export class UploadBatch extends Base {
  @Column() scriptId!: string;
  @Column() uploaderId!: string;
  @Column() visibilityScope!: string;
  @Column() fileFingerprint!: string;
  @Column({ default: 'uploaded' }) processingState!: string;
  @Column('jsonb', { default: [] }) documentIds!: string[];
  @Column('jsonb', { nullable: true }) parseSummary?: object;
}
@Entity()
export class Product extends Base {
  @Column() name!: string;
  @Column() type!: string;
  @Column('int') basePriceFen!: number;
  @Column({ default: true }) active!: boolean;
}
@Entity()
export class PriceRule extends Base {
  @Column() name!: string;
  @Column('jsonb') formula!: object;
  @Column({ default: true }) active!: boolean;
}
@Entity()
export class Quote extends Base {
  @Column() userId!: string;
  @Column() batchId!: string;
  @Column('int') amountFen!: number;
  @Column('jsonb') features!: object;
  @Column('jsonb') priceSnapshot!: object;
  @Column() expiresAt!: Date;
}
@Entity()
export class Order extends Base {
  @Column() userId!: string;
  @Column() quoteId!: string;
  @Column('int') amountFen!: number;
  @Column({ default: 'pending' }) status!: string;
  @Column('jsonb') priceSnapshot!: object;
}
@Entity()
@Index(['provider', 'callbackId'], { unique: true })
export class PaymentEvent extends Base {
  @Column() provider!: string;
  @Column() callbackId!: string;
  @Column() orderId!: string;
  @Column('jsonb') payload!: object;
}
@Entity()
export class Entitlement extends Base {
  @Column() userId!: string;
  @Column() orderId!: string;
  @Column() type!: string;
  @Column({ default: 'available' }) status!: string;
  @Column({ default: 1 }) quantity!: number;
}
@Entity()
export class GenerationTask extends Base {
  @Column() userId!: string;
  @Column() scriptId!: string;
  @Column() orderId!: string;
  @Column({ type: 'enum', enum: TaskState, default: TaskState.PAID_NOT_STARTED }) state!: TaskState;
  @Column({ default: 0 }) stage!: number;
  @Column({ default: 0 }) clarificationRounds!: number;
  @Column('jsonb', { default: {} }) checkpoint!: object;
  @Column({ default: 0 }) progress!: number;
  @Column('text', { nullable: true }) error?: string;
}
@Entity()
export class Clarification extends Base {
  @Column() taskId!: string;
  @Column() question!: string;
  @Column('text', { nullable: true }) answer?: string;
  @Column({ default: 'open' }) status!: string;
}
@Entity()
export class Board extends Base {
  @Column() scriptId!: string;
  @Column() ownerId!: string;
  @Column({ default: 1 }) actIndex!: number;
  @Column({ default: 1 }) currentVersion!: number;
}
@Entity()
@Index(['boardId', 'version'], { unique: true })
export class BoardVersion extends Base {
  @Column() boardId!: string;
  @Column() version!: number;
  @Column() method!: string;
  @Column('jsonb') snapshot!: object;
}
@Entity()
export class Notification extends Base {
  @Column() userId!: string;
  @Column() type!: string;
  @Column() title!: string;
  @Column() body!: string;
  @Column('timestamp', { nullable: true }) readAt?: Date;
}
@Entity()
export class OperatorAuthorization extends Base {
  @Column() taskId!: string;
  @Column() userId!: string;
  @Column() scope!: string;
  @Column() termsVersion!: string;
  @Column() expiresAt!: Date;
  @Column('timestamp', { nullable: true }) revokedAt?: Date;
}
@Entity()
export class AuditLog extends Base {
  @Column('varchar', { nullable: true }) actorId?: string;
  @Column() action!: string;
  @Column() targetType!: string;
  @Column() targetId!: string;
  @Column('jsonb', { default: {} }) details!: object;
}
@Entity()
export class ModelRun extends Base {
  @Column() taskId!: string;
  @Column() stage!: string;
  @Column() provider!: string;
  @Column() model!: string;
  @Column() promptVersion!: string;
  @Column({ default: 0 }) inputTokens!: number;
  @Column({ default: 0 }) outputTokens!: number;
  @Column({ default: 0 }) latencyMs!: number;
  @Column('decimal', { precision: 12, scale: 6, default: 0 }) costAmount!: string;
  @Column() resultState!: string;
}
@Entity()
export class ChatSession extends Base {
  @Column() userId!: string;
  @Column() scriptId!: string;
  @Column() endingId!: string;
  @Column() characterId!: string;
  @Column() knowledgeSnapshotId!: string;
  @Column({ default: 10 }) remainingRounds!: number;
  @Column('text', { default: '' }) summary!: string;
}
@Entity()
export class ChatMessage extends Base {
  @Column() sessionId!: string;
  @Column() role!: string;
  @Column('text') content!: string;
  @Column({ default: false }) charged!: boolean;
  @Column('jsonb', { default: {} }) usage!: object;
}
@Entity()
export class Refund extends Base {
  @Column() orderId!: string;
  @Column() reason!: string;
  @Column({ default: 'pending' }) status!: string;
}
export const entities = [
  User,
  Identity,
  RefreshToken,
  Script,
  Asset,
  UploadBatch,
  Product,
  PriceRule,
  Quote,
  Order,
  PaymentEvent,
  Entitlement,
  GenerationTask,
  Clarification,
  Board,
  BoardVersion,
  Notification,
  OperatorAuthorization,
  AuditLog,
  ModelRun,
  ChatSession,
  ChatMessage,
  Refund,
];
