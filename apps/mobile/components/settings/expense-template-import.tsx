import { EXPENSE_TEMPLATE_SAMPLE, previewExpenseTemplate } from '@finmanager/core';
import type { CsvImportRow } from '@finmanager/schema';
import { uuidv4 } from '@finmanager/sync';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';

import { useExpenses } from '../../lib/expenses';
import { Card, CardLabel, CardTitle } from '../card';

export function MobileExpenseTemplateImport() {
  const api = useExpenses();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function downloadSample() {
    const file = new File(Paths.cache, 'finmanager-expense-template.csv');
    file.write(EXPENSE_TEMPLATE_SAMPLE);
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv' });
  }

  async function pickAndImport() {
    const accountId = api.accounts[0]?.id;
    if (!accountId) {
      setMessage('Add an account before importing expenses.');
      return;
    }
    setBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const preview = previewExpenseTemplate(
        await new File(result.assets[0]!.uri).text(),
        api.categories,
        accountId,
      );
      if (preview.errors.length > 0) {
        setMessage(
          preview.errors.map((error) => `Row ${error.sourceRow}: ${error.message}`).join('\n'),
        );
        return;
      }

      const categoryIds = new Map<string, string>();
      for (const missing of preview.missingCategories) {
        const id = uuidv4();
        categoryIds.set(`${missing.kind}\u001f${missing.name.toLowerCase()}`, id);
        await api.saveCategory({
          id,
          name: missing.name,
          kind: missing.kind,
          icon: null,
          color: null,
          parentId: null,
          isSystem: false,
          sortOrder: api.categories.length + categoryIds.size,
        });
      }
      const rows: CsvImportRow[] = preview.rows.map(({ categoryName, categoryType, ...row }) => ({
        ...row,
        categoryId:
          row.categoryId ??
          categoryIds.get(`${categoryType}\u001f${categoryName.toLowerCase()}`) ??
          null,
      }));
      const imported = await api.importCsvRows(rows);
      setMessage(
        `${imported.created} created, ${imported.skipped} duplicates skipped, ${categoryIds.size} categories created.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Template import failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="gap-3">
      <CardTitle>Expense template import</CardTitle>
      <CardLabel>
        Exact columns: date, category, amount, type. Invalid rows are rejected with row numbers.
      </CardLabel>
      <Pressable
        onPress={() => void downloadSample()}
        accessibilityRole="button"
        className="h-11 justify-center rounded-md bg-surface-muted px-4"
      >
        <Text className="text-center font-body text-body-md text-foreground">Share sample CSV</Text>
      </Pressable>
      <Pressable
        onPress={() => void pickAndImport()}
        disabled={busy}
        accessibilityRole="button"
        className="h-11 justify-center rounded-md bg-primary px-4"
      >
        <Text className="text-center font-body text-body-md text-primary-foreground">
          {busy ? 'Importing…' : 'Choose template CSV'}
        </Text>
      </Pressable>
      {message ? <CardLabel>{message}</CardLabel> : null}
    </Card>
  );
}
