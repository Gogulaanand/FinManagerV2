'use client';

import { parseCsv, previewCsv, type CsvImportPreview } from '@finmanager/core';
import type {
  Account,
  CsvField,
  CsvImportRow,
  CsvMapping,
  CsvMappingSet,
} from '@finmanager/schema';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardLabel, CardTitle } from '@/components/ui/card';
import { Input, SelectField, UploadButton } from '@/components/ui/input';

const fieldOptions: readonly { value: CsvField | ''; label: string }[] = [
  { value: '', label: 'Not mapped' },
  { value: 'date', label: 'Date' },
  { value: 'description', label: 'Description' },
  { value: 'merchant', label: 'Merchant' },
  { value: 'amount', label: 'Amount' },
  { value: 'debit', label: 'Withdrawal / debit' },
  { value: 'credit', label: 'Deposit / credit' },
];

export interface CsvImportProps {
  readonly accounts: readonly Account[];
  readonly mappings: CsvMappingSet;
  readonly onSaveMappings: (mappings: CsvMappingSet) => Promise<void>;
  readonly onImport: (rows: readonly CsvImportRow[]) => Promise<void>;
}

export function CsvImport({ accounts, mappings, onSaveMappings, onImport }: CsvImportProps) {
  const [bankKey, setBankKey] = useState('');
  const [csvText, setCsvText] = useState('');
  const [filename, setFilename] = useState<string | undefined>();
  const [headers, setHeaders] = useState<readonly string[]>([]);
  const [columns, setColumns] = useState<Record<string, CsvField>>({});
  const [preview, setPreview] = useState<CsvImportPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [accountId, setAccountId] = useState('');
  const hasSeparateAmounts = useMemo(
    () => Object.values(columns).some((field) => field === 'debit' || field === 'credit'),
    [columns],
  );

  async function readFile(file: File | undefined) {
    if (!file) return;
    setFilename(file.name);
    const text = await file.text();
    const document = parseCsv(text);
    setCsvText(text);
    setHeaders(document.headers);
    setColumns((current) => {
      const next = { ...current };
      for (const header of document.headers) {
        const known = mappings.mappings.find((mapping) => mapping.bankKey === bankKey)?.columns[
          header
        ];
        if (known) next[header] = known;
      }
      return next;
    });
    setPreview(null);
    setMessage(`${document.rows.length} rows loaded. Map the columns below.`);
  }

  function mapping(): CsvMapping {
    return {
      bankKey: bankKey.trim() || 'custom-bank',
      columns: Object.fromEntries(Object.entries(columns).filter(([, field]) => field)) as Record<
        string,
        CsvField
      >,
      defaultCategoryId: null,
    };
  }

  function makePreview() {
    const selectedAccountId = accountId || accounts[0]?.id || '';
    if (!selectedAccountId) {
      setMessage('Add an account before importing a statement.');
      return;
    }
    const next = previewCsv(parseCsv(csvText), mapping(), selectedAccountId);
    setPreview(next);
    setMessage(`${next.rows.length} valid rows, ${next.errors.length} errors.`);
  }

  async function saveMapping() {
    const next = mapping();
    const withoutCurrent = mappings.mappings.filter((item) => item.bankKey !== next.bankKey);
    await onSaveMappings({ mappings: [...withoutCurrent, next] });
    setMessage(`Saved the ${next.bankKey} mapping across devices.`);
  }

  return (
    <Card className="flex flex-col gap-4">
      <CardTitle>Import a bank statement</CardTitle>
      <CardLabel>
        Choose a CSV, map its columns once, and reuse that mapping for the same bank.
      </CardLabel>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 font-body text-label text-foreground-muted">
          Bank name
          <Input
            value={bankKey}
            onChange={(event) => setBankKey(event.target.value)}
            placeholder="e.g. HDFC"
          />
        </label>
        <label className="flex flex-col gap-1.5 font-body text-label text-foreground-muted">
          Statement CSV
          <UploadButton
            accept=".csv,text/csv"
            filename={filename}
            onFile={(file) => void readFile(file)}
          />
        </label>
        <SelectField
          label="Import into account"
          value={accountId || accounts[0]?.id || ''}
          options={accounts.map((account) => ({ value: account.id!, label: account.name }))}
          onChange={setAccountId}
        />
      </div>
      {headers.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {headers.map((header) => (
            <SelectField
              key={header}
              label={header}
              value={columns[header] ?? ''}
              options={fieldOptions}
              onChange={(value) =>
                setColumns((current) => {
                  const next = { ...current };
                  if (value) next[header] = value;
                  else delete next[header];
                  return next;
                })
              }
            />
          ))}
        </div>
      ) : null}
      {hasSeparateAmounts ? (
        <CardLabel>Withdrawals become debit expenses; deposits become credit income.</CardLabel>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!csvText || accounts.length === 0}
          onClick={makePreview}
        >
          Preview import
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={!headers.length}
          onClick={() => void saveMapping()}
        >
          Save mapping
        </Button>
        {preview && preview.rows.length > 0 ? (
          <Button
            type="button"
            disabled={!preview.rows.length}
            onClick={() => void onImport(preview.rows)}
          >
            Import valid rows
          </Button>
        ) : null}
      </div>
      {preview ? (
        <div className="rounded-md bg-surface-muted p-3 font-body text-caption text-foreground-muted">
          <p>
            {preview.rows.length} rows ready; {preview.errors.length} rows need attention.
          </p>
          {preview.errors.map((error) => (
            <p key={`${error.sourceRow}-${error.message}`}>
              Row {error.sourceRow}: {error.message}
            </p>
          ))}
        </div>
      ) : null}
      {message ? <p className="font-body text-caption text-foreground-muted">{message}</p> : null}
    </Card>
  );
}
