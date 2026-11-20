import { Inject, Injectable } from '@nestjs/common';
import type { PassType } from '../domain/link-graph';
import type { AnswerCandidate } from '../domain/typed-text-judgement';
import {
  type CommonNeighbour,
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

/** The entities linked to both of two balls by one pass type, loaded once when a BRIDGE line is picked (08 §16.7). */
export interface CommonNeighbours {
  ballEntityIds: [string, string];
  passType: PassType;
  /** The best known first. */
  answers: CommonNeighbour[];
}

/** Candidates a typed answer is judged against, read from the link graph: one ball's or two balls' neighbours. */
export interface LinkCandidates {
  passType: PassType;
  answers: readonly AnswerCandidate[];
}

/** Reads of the ONE_TWO link graph (08 §15.8, ADR-0024). */
@Injectable()
export class LinkGraphQuery {
  constructor(@Inject(QUESTION_READ_REPOSITORY) private readonly questions: QuestionReadRepository) {}

  async findLinkedAnswers(ballEntityId: string, passType: PassType): Promise<LinkedAnswers> {
    return { ballEntityId, passType, answers: await this.questions.findLinkedAnswers(ballEntityId, passType) };
  }

  /** BRIDGE: the scorers two clubs have in common are the `CONCEDED_TO` neighbours of both (08 §16.7). */
  async findCommonNeighbours(
    firstEntityId: string,
    secondEntityId: string,
    passType: PassType,
  ): Promise<CommonNeighbours> {
    return {
      ballEntityIds: [firstEntityId, secondEntityId],
      passType,
      answers: await this.questions.findCommonNeighbours(firstEntityId, secondEntityId, passType),
    };
  }

  /** What each pass type of the ball still offers once the burned names are taken out (08 §15.1 step 3). */
  countUnusedLinks(
    ballEntityId: string,
    burnedEntityIds: readonly string[],
  ): Promise<Partial<Record<PassType, number>>> {
    return this.questions.countUnusedLinks(ballEntityId, burnedEntityIds);
  }
}
