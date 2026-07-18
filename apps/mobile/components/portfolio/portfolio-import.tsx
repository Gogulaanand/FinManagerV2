import { parsePortfolioCsv, type PortfolioImportPreview } from '@finmanager/core';
import type { PortfolioImportSource } from '@finmanager/schema';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Card, CardTitle } from '../card';

export function MobilePortfolioImport({
  onImport,
}: {
  readonly onImport: (preview: PortfolioImportPreview) => Promise<void>;
}) {
  const [source, setSource] = useState<PortfolioImportSource>('zerodha');
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<PortfolioImportPreview | null>(null);
  return (
    <Card>
      <CardTitle>Import statement</CardTitle>
      <View className="mt-3 gap-3">
        <Text className="font-body text-caption text-foreground-muted">
          Source: {source}. Change to cams or kfintech if needed.
        </Text>
        <TextInput
          value={source}
          onChangeText={(value) => setSource(value as PortfolioImportSource)}
          autoCapitalize="none"
          className="h-11 rounded-md border border-border bg-background px-3 font-body text-body-md text-foreground"
        />
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          placeholder="Paste CSV export here"
          className="min-h-28 rounded-md border border-border bg-background p-3 font-body text-caption text-foreground"
        />
        <View className="flex-row gap-2">
          <Pressable
            accessibilityRole="button"
            onPress={() => setPreview(parsePortfolioCsv(source, text, null))}
            className="rounded-md border border-border px-3 py-2"
          >
            <Text className="font-body text-label text-foreground">Preview</Text>
          </Pressable>
          {preview && preview.rows.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void onImport(preview)}
              className="rounded-md bg-primary px-3 py-2"
            >
              <Text className="font-body text-label text-primary-foreground">
                Import {preview.rows.length}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {preview?.errors.map((error) => (
          <Text key={error.sourceRow} className="font-body text-caption text-loss">
            Row {error.sourceRow}: {error.message}
          </Text>
        ))}
      </View>
    </Card>
  );
}
