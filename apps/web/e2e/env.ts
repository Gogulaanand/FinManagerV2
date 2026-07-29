export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. See apps/web/e2e/README.md.`);
  return value;
}
