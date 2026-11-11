import { Injectable } from '@nestjs/common';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';
import { AnswerCatalogQuery } from '../application/answer-catalog.query';

const gzipBuffer = promisify(gzip);

export interface AnswerCatalogDocument {
  version: string;
  json: Buffer;
  gzipped: Buffer;
}

/**
 * The catalog response, built once per version and kept in memory (08 §5.5): about 11 MB of JSON
 * and 2 MB gzipped, so building it per request would cost seconds of CPU on every app start.
 */
@Injectable()
export class AnswerCatalogDocumentCache {
  private cached: AnswerCatalogDocument | undefined;
  private building: Promise<AnswerCatalogDocument> | undefined;

  constructor(private readonly catalog: AnswerCatalogQuery) {}

  /** The document for the current version; concurrent callers share one build. */
  async getDocumentForVersion(currentVersion: string): Promise<AnswerCatalogDocument> {
    if (this.cached?.version === currentVersion) return this.cached;
    this.building ??= this.buildDocument().finally(() => {
      this.building = undefined;
    });
    return this.building;
  }

  private async buildDocument(): Promise<AnswerCatalogDocument> {
    const snapshot = await this.catalog.getSnapshot();
    const json = Buffer.from(JSON.stringify(snapshot));
    const document = { version: snapshot.version, json, gzipped: await gzipBuffer(json) };
    this.cached = document;
    return document;
  }
}
