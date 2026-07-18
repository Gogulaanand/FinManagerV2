/**
 * RFC 4122 v4 UUID generator.
 *
 * Synced rows use a Postgres `uuid` primary key, so client-generated ids must be
 * real UUIDs (the old `s_<timestamp>` fallback would be rejected by Postgres).
 * We build one from the platform CSPRNG rather than taking a dependency:
 *   - Web: `crypto.getRandomValues` is always present.
 *   - React Native: present once `react-native-get-random-values` is imported at
 *     the app entry point (the mobile app does this before anything else).
 */
export function uuidv4(): string {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.getRandomValues) {
    throw new Error(
      'crypto.getRandomValues is unavailable. On React Native, import "react-native-get-random-values" at the app entry point.',
    );
  }
  const bytes = new Uint8Array(16);
  cryptoObj.getRandomValues(bytes);
  // Set the version (4) and variant (10xx) bits per RFC 4122.
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex: string[] = [];
  for (let i = 0; i < 256; i++) hex.push((i + 0x100).toString(16).slice(1));
  const b = bytes;
  return (
    hex[b[0]!]! +
    hex[b[1]!]! +
    hex[b[2]!]! +
    hex[b[3]!]! +
    '-' +
    hex[b[4]!]! +
    hex[b[5]!]! +
    '-' +
    hex[b[6]!]! +
    hex[b[7]!]! +
    '-' +
    hex[b[8]!]! +
    hex[b[9]!]! +
    '-' +
    hex[b[10]!]! +
    hex[b[11]!]! +
    hex[b[12]!]! +
    hex[b[13]!]! +
    hex[b[14]!]! +
    hex[b[15]!]!
  );
}
