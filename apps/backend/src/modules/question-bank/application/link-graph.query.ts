import { Inject, Injectable } from '@nestjs/common';
import type { PassType } from '../domain/link-graph';
import {
  type LinkedAnswer,
  QUESTION_READ_REPOSITORY,
  type QuestionReadRepository,
} from './ports/question-read-repository';

/** The neighbours of one ball for one pass type, loaded once when the pass is made (08 §15.7). */
export interface LinkedAnswers {
  ballEntityId: string;
  passType: PassType;
  /** The best known first. */
  answers: LinkedAnswer[];
}

/** Reads of the ONE_TWO link graph (08 §15.8, ADR-0024). */
@Injectable()
export class LinkGraphQuery {
  constructor(@Inject(QUESTION_READ_REPOSITORY) private readonly questions: QuestionReadRepository) {}

  async findLinkedAnswers(ballEntityId: string, passType: PassType): Promise<LinkedAnswers> {
    return { ballEntityId, passType, answers: await this.questions.findLinkedAnswers(ballEntityId, passType) };
  }

  /** What each pass type of the ball still offers once the burned names are taken out (08 §15.1 step 3). */
  countUnusedLinks(
    ballEntityId: string,
    burnedEntityIds: readonly string[],
  ): Promise<Partial<Record<PassType, number>>> {
    return this.questions.countUnusedLinks(ballEntityId, burnedEntityIds);
  }
}
