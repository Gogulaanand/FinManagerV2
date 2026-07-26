import * as Sentry from '@sentry/nextjs';

export async function POST(request: Request) {
  const expected = process.env.SENTRY_TEST_TOKEN;
  if (!expected) return new Response('Not found', { status: 404 });
  if (request.headers.get('authorization') !== `Bearer ${expected}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  const error = new Error('FinManager Phase 9 intentional monitoring test');
  Sentry.captureException(error, { tags: { verification: 'phase-9' } });
  await Sentry.flush(2_000);
  return Response.json({ captured: true }, { status: 202 });
}
