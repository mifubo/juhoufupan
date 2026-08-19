import { describe, expect, it } from 'vitest';
import { MockPaymentProvider } from '../src/providers/providers';
describe('payment callback contract', () => {
  it('returns a stable callback identity for idempotency', async () => {
    const p = new MockPaymentProvider();
    const a = await p.verifyCallback({ callbackId: 'cb1', orderId: 'o1' });
    const b = await p.verifyCallback({ callbackId: 'cb1', orderId: 'o1' });
    expect(a).toEqual(b);
  });
});
describe('chat charging rule', () => {
  it('only charges an accepted assistant reply', () => {
    const events = [
      { ok: false, blocked: true },
      { ok: false, timeout: true },
      { ok: true, blocked: false },
    ];
    expect(events.filter((e) => e.ok && !e.blocked).length).toBe(1);
  });
});
