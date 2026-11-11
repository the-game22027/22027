import { Controller, Get, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiNotModifiedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AnswerCatalogQuery } from '../application/answer-catalog.query';
import { AnswerCatalogDocumentCache } from './answer-catalog-document.cache';
import { AnswerCatalogDto } from './dto/answer-catalog.dto';
import { acceptsGzipEncoding, ifNoneMatchIncludesETag } from './http-caching';

const etagOf = (version: string): string => `"${version}"`;

@ApiTags('question-bank')
@ApiBearerAuth()
@Controller({ version: '1' })
export class AnswerCatalogController {
  constructor(
    private readonly catalog: AnswerCatalogQuery,
    private readonly documents: AnswerCatalogDocumentCache,
  ) {}

  /** 08 §5.5. The body is written by hand: it is pre-serialized and pre-gzipped once per version. */
  @Get('answer-catalog')
  @ApiOkResponse({ type: AnswerCatalogDto })
  @ApiNotModifiedResponse({ description: 'The If-None-Match ETag is still the current version' })
  async answerCatalog(@Req() request: Request, @Res() response: Response): Promise<void> {
    response.setHeader('Cache-Control', 'private, no-cache');
    response.setHeader('Vary', 'Accept-Encoding');

    const currentVersion = await this.catalog.findCurrentVersion();
    if (ifNoneMatchIncludesETag(request.headers['if-none-match'], etagOf(currentVersion))) {
      response.setHeader('ETag', etagOf(currentVersion));
      response.status(304).end();
      return;
    }

    const document = await this.documents.getDocumentForVersion(currentVersion);
    const gzipped = acceptsGzipEncoding(request.headers['accept-encoding']);
    const body = gzipped ? document.gzipped : document.json;
    response.setHeader('ETag', etagOf(document.version));
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Content-Length', body.length);
    if (gzipped) response.setHeader('Content-Encoding', 'gzip');
    response.status(200).end(body);
  }
}
