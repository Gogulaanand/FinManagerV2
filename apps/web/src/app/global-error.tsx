'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="mx-auto flex min-h-screen max-w-lg items-center p-6">
          <div>
            <h1>Something went wrong</h1>
            <p>The error was recorded. Reload FinManager and try again.</p>
          </div>
        </main>
      </body>
    </html>
  );
}
