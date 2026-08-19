import { z } from 'zod';
import { TaskState } from './task-state';

export const entityRefSchema = z.object({
  type: z.enum([
    'act',
    'character',
    'identity',
    'relationship',
    'claim',
    'conflict',
    'event',
    'timeline',
    'prop',
    'clue',
    'evidence_link',
    'scene',
    'puzzle',
    'task',
    'question',
    'answer',
    'reasoning_step',
    'dm_hint',
    'branch',
    'ending',
    'asset',
  ]),
  id: z.string().min(1),
});
export const boardElementSchema = z.object({
  id: z.string(),
  layer: z.enum(['player', 'dm']),
  visibility: z.enum(['player_board', 'dm_only', 'knowledge_only', 'forbidden_in_act']),
  displayPriority: z.enum(['required', 'recommended', 'optional', 'forbidden']),
  knowledgeRefs: z.array(entityRefSchema).default([]),
  data: z.record(z.string(), z.unknown()).default({}),
});
export type BoardElement = z.infer<typeof boardElementSchema>;
export function playerSafe(elements: BoardElement[]) {
  return elements.filter(
    (e) =>
      e.layer === 'player' && e.visibility === 'player_board' && e.displayPriority !== 'forbidden',
  );
}
export function calculateQuote(
  f: { words: number; images: number; characters: number; acts: number },
  r = {
    base: 9900,
    per10kWords: 2000,
    perImage: 80,
    perCharacter: 300,
    perAct: 500,
    min: 9900,
    max: 99900,
  },
) {
  const amount =
    r.base +
    Math.ceil(f.words / 10000) * r.per10kWords +
    f.images * r.perImage +
    f.characters * r.perCharacter +
    f.acts * r.perAct;
  return Math.min(r.max, Math.max(r.min, amount));
}
const transitions: Record<TaskState, TaskState[]> = {
  DRAFT: [TaskState.QUOTING],
  QUOTING: [TaskState.QUOTED, TaskState.FAILED],
  QUOTED: [TaskState.PAID_NOT_STARTED],
  PAID_NOT_STARTED: [TaskState.QUEUED, TaskState.CANCELLED],
  QUEUED: [TaskState.RUNNING, TaskState.CANCELLED],
  RUNNING: [
    TaskState.AWAITING_DM,
    TaskState.AWAITING_OPERATOR_AUTH,
    TaskState.SUCCEEDED,
    TaskState.PARTIALLY_SUCCEEDED,
    TaskState.FAILED,
  ],
  AWAITING_DM: [TaskState.QUEUED, TaskState.AWAITING_OPERATOR_AUTH],
  AWAITING_OPERATOR_AUTH: [TaskState.OPERATOR_PROCESSING, TaskState.REFUND_PENDING],
  OPERATOR_PROCESSING: [TaskState.QUEUED, TaskState.SUCCEEDED, TaskState.REFUND_PENDING],
  SUCCEEDED: [],
  PARTIALLY_SUCCEEDED: [TaskState.QUEUED, TaskState.REFUND_PENDING],
  FAILED: [TaskState.QUEUED, TaskState.REFUND_PENDING],
  REFUND_PENDING: [TaskState.REFUNDED],
  REFUNDED: [],
  CANCELLED: [],
};
export function assertTransition(from: TaskState, to: TaskState) {
  if (!transitions[from].includes(to)) throw new Error(`Invalid transition ${from} -> ${to}`);
}
export function can(actorRoles: string[], permission: string) {
  if (actorRoles.includes('super_admin')) return true;
  const map: Record<string, string[]> = {
    dm: ['script:own', 'board:own', 'task:own'],
    player: ['chat:own'],
    content_operator: ['script:public', 'template:publish'],
    task_operator: ['task:intervene', 'task:rerun'],
    finance_operator: ['order:read', 'refund:write'],
  };
  return actorRoles.some((r) => map[r]?.includes(permission));
}
