'use client';

import {
  EXPENSE_TEMPLATE_SAMPLE,
  parseCsv,
  previewCsv,
  previewExpenseTemplate,
  type CsvImportPreview,
  type ExpenseTemplatePreview,
} from '@finmanager/core';
import type {
  Account,
  Category,
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
  readonly categories: readonly Category[];
  readonly onCreateCategory: (category: Category) => Promise<void>;
  readonly onSaveMappings: (mappings: CsvMappingSet) => Promise<void>;
  readonly onImport: (rows: readonly CsvImportRow[]) => Promise<void>;
}

export function CsvImport({
  accounts,
  categories,
  mappings,
  onCreateCategory,
  onSaveMappings,
  onImport,
}: CsvImportProps) {
  const [bankKey, setBankKey] = useState('');
  const [csvText, setCsvText] = useState('');
  const [filename, setFilename] = useState<string | undefined>();
  const [headers, setHeaders] = useState<readonly string[]>([]);
  const [columns, setColumns] = useState<Record<string, CsvField>>({});
  const [preview, setPreview] = useState<CsvImportPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [accountId, setAccountId] = useState('');
  const [templateFilename, setTemplateFilename] = useState<string | undefined>();
  const [templatePreview, setTemplatePreview] = useState<ExpenseTemplatePreview | null>(null);
  const [templateMessage, setTemplateMessage] = useState<string | null>(null);
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

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([EXPENSE_TEMPLATE_SAMPLE], { type: 'text/csv' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'finmanager-expense-template.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function readTemplate(file: File | undefined) {
    if (!file) return;
    setTemplateFilename(file.name);
    const selectedAccountId = accountId || accounts[0]?.id || '';
    if (!selectedAccountId) {
      setTemplateMessage('Add an account before importing the expense template.');
      return;
    }
    const next = previewExpenseTemplate(await file.text(), categories, selectedAccountId);
    setTemplatePreview(next);
    setTemplateMessage(
      `${next.rows.length} valid rows, ${next.errors.length} errors, ${next.missingCategories.length} categories to create.`,
    );
  }

  async function importTemplate() {
    if (!templatePreview) return;
    const ids = new Map<string, string>();
    for (const missing of templatePreview.missingCategories) {
      const id = crypto.randomUUID();
      ids.set(`${missing.kind}\u001f${missing.name.toLowerCase()}`, id);
      await onCreateCategory({
        id,
        name: missing.name,
        kind: missing.kind,
        icon: null,
        color: null,
        parentId: null,
        isSystem: false,
        sortOrder: categories.length + ids.size,
      });
    }
    await onImport(
      templatePreview.rows.map(({ categoryName, categoryType, ...row }) => ({
        ...row,
        categoryId:
          row.categoryId ?? ids.get(`${categoryType}\u001f${categoryName.toLowerCase()}`) ?? null,
      })),
    );
    setTemplateMessage(
      `${templatePreview.rows.length} template rows submitted; ${ids.size} missing categories created.`,
    );
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

      <div className="border-t border-border pt-4">
        <CardTitle>Import the FinManager expense template</CardTitle>
        <CardLabel>
          Only date,category,amount,type is accepted. Invalid rows are rejected with line numbers;
          missing categories are created after review.
        </CardLabel>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Button type="button" variant="outline" onClick={downloadTemplate}>
          Download sample CSV
        </Button>
        <div className="min-w-64 flex-1">
          <UploadButton
            accept=".csv,text/csv"
            filename={templateFilename}
            onFile={(file) => void readTemplate(file)}
          />
        </div>
        <Button
          type="button"
          disabled={!templatePreview || templatePreview.rows.length === 0}
          onClick={() => void importTemplate()}
        >
          Import template rows
        </Button>
      </div>
      {templatePreview?.errors.map((error) => (
        <p key={`${error.sourceRow}-${error.message}`} className="font-body text-caption text-loss">
          Row {error.sourceRow}: {error.message}
        </p>
      ))}
      {templateMessage ? (
        <p className="font-body text-caption text-foreground-muted">{templateMessage}</p>
      ) : null}
    </Card>
  );
}
