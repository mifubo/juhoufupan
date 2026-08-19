import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { Identity, RefreshToken, User } from '../domain/entities';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Identity) private ids: Repository<Identity>,
    @InjectRepository(RefreshToken) private tokens: Repository<RefreshToken>,
    private jwt: JwtService,
  ) {}
  async register(phone: string, password: string) {
    if (await this.users.findOneBy({ phone })) throw new Error('Phone already registered');
    const u = await this.users.save(
      this.users.create({
        phone,
        passwordHash: await bcrypt.hash(password, 12),
        roles: ['dm', 'player'],
      }),
    );
    return this.issue(u);
  }
  async login(phone: string, password: string) {
    const u = await this.users.findOneBy({ phone });
    if (!u?.passwordHash || !(await bcrypt.compare(password, u.passwordHash)))
      throw new UnauthorizedException();
    return this.issue(u);
  }
  async sms(phone: string, code: string) {
    if (code !== '000000') throw new UnauthorizedException('Mock SMS code is 000000');
    let u = await this.users.findOneBy({ phone });
    if (!u) u = await this.users.save(this.users.create({ phone, roles: ['dm', 'player'] }));
    return this.issue(u);
  }
  async wechat(openid: string) {
    const id = await this.ids.findOneBy({ provider: 'wechat', externalId: openid });
    const u = id
      ? await this.users.findOneByOrFail({ id: id.userId })
      : await this.users.save(this.users.create({ roles: ['dm', 'player'] }));
    if (!id)
      await this.ids.save(
        this.ids.create({ userId: u.id, provider: 'wechat', externalId: openid }),
      );
    return this.issue(u);
  }
  async bind(userId: string, provider: string, externalId: string) {
    const existing = await this.ids.findOneBy({ provider, externalId });
    if (existing && existing.userId !== userId)
      throw new Error('Identity belongs to another account; explicit merge required');
    return this.ids.save(this.ids.create({ userId, provider, externalId }));
  }
  async merge(primaryId: string, secondaryId: string, proof: string) {
    if (proof !== 'verified') throw new UnauthorizedException('Identity verification required');
    await this.ids.update({ userId: secondaryId }, { userId: primaryId });
    await this.users.update(secondaryId, { status: 'merged' });
    return { primaryId, secondaryId };
  }
  async refresh(refreshToken: string) {
    const hash = createHash('sha256').update(refreshToken).digest('hex');
    const stored = await this.tokens.findOneBy({ tokenHash: hash });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date())
      throw new UnauthorizedException();
    stored.revokedAt = new Date();
    await this.tokens.save(stored);
    return this.issue(await this.users.findOneByOrFail({ id: stored.userId }));
  }
  private async issue(u: User) {
    const payload = { sub: u.id, roles: u.roles };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: '15m',
    });
    const refreshToken = await this.jwt.signAsync(
      { ...payload, jti: randomUUID() },
      { secret: process.env.JWT_REFRESH_SECRET, expiresIn: '30d' },
    );
    await this.tokens.save(
      this.tokens.create({
        userId: u.id,
        tokenHash: createHash('sha256').update(refreshToken).digest('hex'),
        expiresAt: new Date(Date.now() + 30 * 864e5),
      }),
    );
    return { accessToken, refreshToken, user: { id: u.id, phone: u.phone, roles: u.roles } };
  }
}
@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private jwt: JwtService) {}
  async canActivate(c: ExecutionContext) {
    const req = c.switchToHttp().getRequest();
    const token = req.headers.authorization?.replace(/^Bearer /, '');
    if (!token) throw new UnauthorizedException();
    try {
      req.user = await this.jwt.verifyAsync(token, { secret: process.env.JWT_ACCESS_SECRET });
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
export const CurrentUser = createParamDecorator((_d, c) => c.switchToHttp().getRequest().user);
