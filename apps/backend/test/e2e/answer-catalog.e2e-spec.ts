import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { PrismaService } from '../../src/shared/infrastructure/persistence';
import { UuidV7Generator } from '../../src/shared/kernel';
import { bearer, devSignIn, type SignedIn } from '../support/sign-in';
import { createApiTestApp } from '../support/test-app';

interface AnswerCatalogBody {
  version: string;
  entities: { id: string; kind: string; names: { en: string; ar: string }; search: string[]; popularity: number }[];
}

describe('GET /v1/answer-catalog (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let session: SignedIn;
  const ids = new UuidV7Generator();

  const get = () =>
    request(app.getHttpServer())
      .get('/v1/answer-catalog')
      .set(...bearer(session));

  /** What a catalog import leaves behind: a batch with the catalog checksum and an active entity. */
  const importCatalog = async (checksum: string, name: string): Promise<string> => {
    const now = new Date();
    await prisma.questionImportBatch.create({
      data: {
        id: ids.next(),
        bundleVersion: `test-${randomUUID()}`,
        checksum: 'questions',
        catalogChecksum: checksum,
        generatorVersion: 'test',
        kbVersion: 'none',
        status: 'IMPORTED',
        importedAt: now,
      },
    });
    const id = ids.next();
    await prisma.answerEntity.create({
      data: {
        id,
        externalRef: `test:${randomUUID()}`,
        kind: 'PLAYER',
        names: { en: name, ar: name },
        popularity: 1_000_000,
        searchForms: [name.toLowerCase()],
        catalogVersion: checksum,
        updatedAt: now,
      },
    });
    return id;
  };

  beforeAll(async () => {
    app = await createApiTestApp();
    prisma = app.get(PrismaService);
    session = await devSignIn(app);
  });

  afterAll(() => app.close());

  it('requires an access token', async () => {
    await request(app.getHttpServer()).get('/v1/answer-catalog').expect(401);
  });

  it('serves the catalog gzipped with an ETag, then 304 while the version is unchanged', async () => {
    const version = `sha256:${randomUUID()}`;
    const entityId = await importCatalog(version, 'Mohamed Salah');

    const response = await get().set('Accept-Encoding', 'gzip').expect(200);
    expect(response.headers).toMatchObject({
      etag: `"${version}"`,
      'content-encoding': 'gzip',
      'cache-control': 'private, no-cache',
      vary: 'Accept-Encoding',
    });
    const body = response.body as AnswerCatalogBody;
    expect(body.version).toBe(version);
    expect(body.entities[0]).toEqual({
      id: entityId,
      kind: 'PLAYER',
      names: { en: 'Mohamed Salah', ar: 'Mohamed Salah' },
      search: ['mohamed salah'],
      popularity: 1_000_000,
    });

    const notModified = await get().set('If-None-Match', `"${version}"`).expect(304);
    expect(notModified.text).toBe('');
    expect(notModified.headers.etag).toBe(`"${version}"`);
  });

  it('sends plain JSON to a client that does not accept gzip', async () => {
    const response = await get().set('Accept-Encoding', 'identity').expect(200);
    expect(response.headers['content-encoding']).toBeUndefined();
    expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
    expect((JSON.parse(response.text) as AnswerCatalogBody).entities.length).toBeGreaterThan(0);
  });

  it('serves the new version after a new catalog import, and the old ETag no longer matches', async () => {
    const oldVersion = (await get().expect(200)).headers.etag;
    const newVersion = `sha256:${randomUUID()}`;
    await importCatalog(newVersion, 'Kevin De Bruyne');

    const response = await get().set('If-None-Match', oldVersion).expect(200);
    expect(response.headers.etag).toBe(`"${newVersion}"`);
    expect((response.body as AnswerCatalogBody).entities.map((entity) => entity.names.en)).toContain('Kevin De Bruyne');
  });
});
