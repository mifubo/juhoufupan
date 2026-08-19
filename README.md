# 局后复盘后端

NestJS 模块化单体 API 与独立 BullMQ Worker，使用 PostgreSQL + pgvector 和 Redis。默认 AI/OCR/支付/微信登录均是可演示 Mock，Kimi 通过环境变量切换。

```bash
cp .env.example .env
pnpm install
pnpm infra:up
pnpm start:dev
pnpm start:worker:dev
```

Swagger: `http://localhost:3100/docs`；健康检查: `http://localhost:3100/api/v1/health`。Mock 短信码为 `000000`。
