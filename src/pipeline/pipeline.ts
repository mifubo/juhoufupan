import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Job, Queue } from 'bullmq';
import { Repository } from 'typeorm';
import {
  Board,
  BoardVersion,
  Clarification,
  GenerationTask,
  ModelRun,
  Notification,
  TaskState,
} from '../domain/entities';
import { assertTransition } from '../domain/rules';
import { MockAIProvider } from '../providers/providers';

export const PIPELINE_QUEUE = 'generation';
export const STAGES = [
  'file-validation',
  'document-act-classification',
  'image-ocr',
  'characters-identities',
  'questions-answers',
  'events-claims-conflicts',
  'props-clues-evidence',
  'reasoning-timeline',
  'dm-hints',
  'endings-character-knowledge',
  'player-board-selection',
  'board-layout',
  'spoiler-consistency',
  'save-notify',
];
@Injectable()
export class TaskService {
  constructor(
    @InjectRepository(GenerationTask) private repo: Repository<GenerationTask>,
    @InjectRepository(Clarification) private qs: Repository<Clarification>,
    @InjectQueue(PIPELINE_QUEUE) private queue: Queue,
  ) {}
  async start(task: GenerationTask) {
    assertTransition(task.state, TaskState.QUEUED);
    task.state = TaskState.QUEUED;
    await this.repo.save(task);
    await this.queue.add(
      'run',
      { taskId: task.id },
      { jobId: `task-${task.id}-${task.stage}`, removeOnComplete: 100 },
    );
    return task;
  }
  async answer(taskId: string, userId: string, answer: string) {
    const task = await this.repo.findOneByOrFail({ id: taskId, userId });
    if (task.state !== TaskState.AWAITING_DM) throw new Error('Task is not waiting for DM');
    const q = await this.qs.findOneByOrFail({ taskId, status: 'open' });
    q.answer = answer;
    q.status = 'answered';
    await this.qs.save(q);
    task.checkpoint = { ...task.checkpoint, dmAnswer: answer };
    task.state = TaskState.QUEUED;
    await this.repo.save(task);
    await this.queue.add('run', { taskId: task.id });
    return task;
  }
}
@Processor(PIPELINE_QUEUE)
export class PipelineProcessor extends WorkerHost {
  constructor(
    @InjectRepository(GenerationTask) private tasks: Repository<GenerationTask>,
    @InjectRepository(Clarification) private qs: Repository<Clarification>,
    @InjectRepository(ModelRun) private runs: Repository<ModelRun>,
    @InjectRepository(Board) private boards: Repository<Board>,
    @InjectRepository(BoardVersion) private versions: Repository<BoardVersion>,
    @InjectRepository(Notification) private notices: Repository<Notification>,
  ) {
    super();
  }
  async process(job: Job<{ taskId: string }>) {
    const task = await this.tasks.findOneByOrFail({ id: job.data.taskId });
    if (task.state !== TaskState.QUEUED) return;
    task.state = TaskState.RUNNING;
    await this.tasks.save(task);
    const ai = new MockAIProvider();
    for (let i = task.stage; i < STAGES.length; i++) {
      const started = Date.now();
      const result = await ai.chat({
        stage: STAGES[i],
        system: `Prompt v1 for ${STAGES[i]}`,
        input: task.checkpoint,
      });
      await this.runs.save(
        this.runs.create({
          taskId: task.id,
          stage: STAGES[i],
          provider: 'mock',
          model: result.model,
          promptVersion: 'v1',
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          latencyMs: Date.now() - started,
          costAmount: '0',
          resultState: 'success',
        }),
      );
      task.stage = i + 1;
      task.progress = Math.round(((i + 1) / STAGES.length) * 100);
      task.checkpoint = { ...task.checkpoint, [STAGES[i]]: result.content };
      await this.tasks.save(task);
      if (i === 4 && !('dmAnswer' in task.checkpoint) && task.clarificationRounds < 1) {
        task.clarificationRounds++;
        task.state = TaskState.AWAITING_DM;
        await this.tasks.save(task);
        await this.qs.save(
          this.qs.create({
            taskId: task.id,
            question: '请确认关键问题：本剧本的核心案件答案是否以 DM 手册为准？',
          }),
        );
        await this.notices.save(
          this.notices.create({
            userId: task.userId,
            type: 'task_clarification',
            title: 'AI 任务等待确认',
            body: '请回复关键问题后继续生成。',
          }),
        );
        return;
      }
    }
    const board = await this.boards.save(
      this.boards.create({
        scriptId: task.scriptId,
        ownerId: task.userId,
        actIndex: 1,
        currentVersion: 1,
      }),
    );
    await this.versions.save(
      this.versions.create({
        boardId: board.id,
        version: 1,
        method: 'ai_generated',
        snapshot: {
          nodes: [
            {
              id: 'title',
              type: 'text',
              position: { x: 80, y: 60 },
              data: { label: '第一幕玩家板报' },
              layer: 'player',
              visibility: 'player_board',
              displayPriority: 'required',
            },
            {
              id: 'hint',
              type: 'note',
              position: { x: 80, y: 180 },
              data: { label: 'DM：留意玩家卡点' },
              layer: 'dm',
              visibility: 'dm_only',
              displayPriority: 'recommended',
            },
          ],
          edges: [],
        },
      }),
    );
    task.state = TaskState.SUCCEEDED;
    task.progress = 100;
    await this.tasks.save(task);
    await this.notices.save(
      this.notices.create({
        userId: task.userId,
        type: 'task_succeeded',
        title: '板报生成完成',
        body: '第一幕板报已生成。',
      }),
    );
  }
}
