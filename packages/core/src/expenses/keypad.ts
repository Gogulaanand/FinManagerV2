export type KeypadAction =
  | { readonly type: 'digit'; readonly value: `${number}` }
  | { readonly type: 'decimal' }
  | { readonly type: 'backspace' };

export function reduceKeypad(value: string, action: KeypadAction): string {
  if (action.type === 'backspace') return value.slice(0, -1);
  if (action.type === 'decimal') return value.includes('.') ? value : `${value || '0'}.`;
  if (!/^\d$/.test(action.value)) return value;
  if (value.includes('.') && value.split('.')[1]!.length >= 2) return value;
  if (value === '0') return action.value;
  return `${value}${action.value}`;
}
