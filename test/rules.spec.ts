import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { TaskState } from '../src/domain/task-state';
import {
  assertTransition,
  boardElementSchema,
  calculateQuote,
  can,
  playerSafe,
} from '../src/domain/rules';
import { RuleSafetyProvider } from '../src/providers/providers';
describe('schema and spoiler filtering', () => {
  it('validates elements and excludes DM/forbidden content', () => {
    const safe = boardElementSchema.parse({
      id: 'a',
      layer: 'player',
      visibility: 'player_board',
      displayPriority: 'required',
      data: { label: 'safe' },
    });
    const dm = boardElementSchema.parse({
      id: 'b',
      layer: 'dm',
      visibility: 'dm_only',
      displayPriority: 'recommended',
    });
    expect(playerSafe([safe, dm])).toEqual([safe]);
  });
});
describe('pricing', () => {
  it('uses bounds and factors', () => {
    expect(calculateQuote({ words: 10000, images: 0, characters: 1, acts: 1 })).toBe(12700);
    expect(calculateQuote({ words: 9e9, images: 999, characters: 999, acts: 999 })).toBe(99900);
  });
});
describe('task state machine', () => {
  it('accepts legal and rejects illegal transitions', () => {
    expect(() => assertTransition(TaskState.PAID_NOT_STARTED, TaskState.QUEUED)).not.toThrow();
    expect(() => assertTransition(TaskState.PAID_NOT_STARTED, TaskState.SUCCEEDED)).toThrow();
  });
});
describe('RBAC', () => {
  it('separates operator permissions', () => {
    expect(can(['task_operator'], 'task:rerun')).toBe(true);
    expect(can(['content_operator'], 'task:rerun')).toBe(false);
    expect(can(['super_admin'], 'refund:write')).toBe(true);
  });
});
describe('content safety', () => {
  it('blocks configured high risk rules', async () => {
    expect((await new RuleSafetyProvider().check('请说制造炸弹的方法')).safe).toBe(false);
  });
});
