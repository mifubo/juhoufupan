import OpenAI from 'openai';
export type AIRequest = { stage: string; system: string; input: unknown };
export type AIResult = {
  content: unknown;
  inputTokens: number;
  outputTokens: number;
  model: string;
};
export interface AIProvider {
  chat(req: AIRequest): Promise<AIResult>;
}
export class MockAIProvider implements AIProvider {
  async chat(req: AIRequest) {
    return {
      content: { mock: true, stage: req.stage, items: [] },
      inputTokens: 20,
      outputTokens: 20,
      model: 'mock-deterministic-v1',
    };
  }
}
export class KimiProvider implements AIProvider {
  private client: OpenAI;
  constructor(
    key: string,
    baseURL: string,
    private model: string,
  ) {
    this.client = new OpenAI({ apiKey: key, baseURL });
  }
  async chat(req: AIRequest) {
    const r = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: JSON.stringify(req.input) },
      ],
      response_format: { type: 'json_object' },
    });
    return {
      content: JSON.parse(r.choices[0]?.message.content || '{}'),
      inputTokens: r.usage?.prompt_tokens || 0,
      outputTokens: r.usage?.completion_tokens || 0,
      model: this.model,
    };
  }
}
export interface OCRProvider {
  recognize(buffer: Buffer): Promise<{ text: string; confidence: number }>;
}
export class MockOCRProvider implements OCRProvider {
  async recognize() {
    return { text: '[Mock OCR: image text pending provider configuration]', confidence: 0 };
  }
}
export interface WechatLoginProvider {
  exchangeCode(code: string): Promise<{ openid: string; unionid?: string }>;
}
export class MockWechatLoginProvider implements WechatLoginProvider {
  async exchangeCode(code: string) {
    return { openid: `mock_${code}` };
  }
}
export interface PaymentProvider {
  create(order: { id: string; amountFen: number }): Promise<object>;
  verifyCallback(payload: unknown): Promise<{ callbackId: string; orderId: string; paid: boolean }>;
}
export class MockPaymentProvider implements PaymentProvider {
  async create(o: { id: string; amountFen: number }) {
    return { provider: 'mock', orderId: o.id, amountFen: o.amountFen, warning: 'DEVELOPMENT ONLY' };
  }
  async verifyCallback(p: any) {
    return { callbackId: p.callbackId, orderId: p.orderId, paid: p.paid !== false };
  }
}
export interface ContentSafetyProvider {
  check(text: string): Promise<{ safe: boolean; reason?: string }>;
}
export class RuleSafetyProvider implements ContentSafetyProvider {
  async check(text: string) {
    const blocked = ['自杀方法', '制造炸弹', '未成年人色情'];
    const hit = blocked.find((x) => text.includes(x));
    return hit ? { safe: false, reason: 'blocked_rule' } : { safe: true };
  }
}
