'use client';

import { parsePortfolioCsv, type PortfolioImportPreview } from '@finmanager/core';
import type { PortfolioImportSource } from '@finmanager/schema';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/input';

export function PortfolioImport({
  onImport,
}: {
  readonly onImport: (preview: PortfolioImportPreview) => Promise<void>;
}) {
  const [source, setSource] = useState<PortfolioImportSource>('zerodha');
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<PortfolioImportPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  function parse() {
    const next = parsePortfolioCsv(source, text, null);
    setPreview(next);
    setMessage(
      next.errors.length
        ? `${next.errors.length} row or header errors`
        : `${next.rows.length} rows ready`,
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Import broker statement</CardTitle>
      </CardHeader>
      <div className="grid gap-4 md:grid-cols-[12rem_1fr]">
        <Field label="Source">
          {(id) => (
            <select
              id={id}
              className="h-10 rounded-md border border-border bg-background px-3 font-body text-body-md text-foreground"
              value={source}
              onChange={(event) => setSource(event.target.value as PortfolioImportSource)}
            >
              <option value="zerodha">Zerodha</option>
              <option value="cams">CAMS</option>
              <option value="kfintech">KFintech</option>
            </select>
          )}
        </Field>
        <Field label="CSV text" hint="Paste a CSV export for preview">
          {(id) => (
            <textarea
              id={id}
              className="min-h-28 rounded-md border border-border bg-background p-3 font-mono text-caption text-foreground"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="trade_date,symbol,..."
            />
          )}
        </Field>
      </div>
      <div className="mt-4 flex gap-2">
        <Button type="button" variant="outline" onClick={parse}>
          Preview
        </Button>
        {preview && preview.rows.length > 0 ? (
          <Button type="button" onClick={() => void onImport(preview)}>
            Import {preview.rows.length} rows
          </Button>
        ) : null}
      </div>
      {message ? (
        <p className="mt-3 font-body text-caption text-foreground-muted">{message}</p>
      ) : null}
      {preview?.errors.map((error) => (
        <p key={error.sourceRow} className="font-body text-caption text-loss">
          Row {error.sourceRow}: {error.message}
        </p>
      ))}
    </Card>
  );
}
