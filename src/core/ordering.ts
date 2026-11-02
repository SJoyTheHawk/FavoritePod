import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';

export function keyBetween(before: string | null, after: string | null): string {
  return generateKeyBetween(before, after);
}

export function keysBetween(
  before: string | null,
  after: string | null,
  count: number,
): string[] {
  return generateNKeysBetween(before, after, count);
}

export function nextOrderKey(orderKeys: readonly string[]): string {
  const last = [...orderKeys].sort().at(-1) ?? null;
  return keyBetween(last, null);
}
