import { faker } from '@faker-js/faker';
import { FRAUD_PATTERNS, FraudPattern, GenerateOptions, OutputFormat } from './types.js';

export const COUNTRY_POOL = ['NG', 'GH', 'KE', 'ZA', 'US', 'GB', 'CA', 'AE', 'IN', 'CN'];
export const REVIEW_THRESHOLD = 500000;

export class SimRandom {
  private state: number;

  constructor(seed: string | number = Date.now()) {
    this.state = hashSeed(seed);
  }

  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  float(min: number, max: number, decimals = 2): number {
    return Number((this.next() * (max - min) + min).toFixed(decimals));
  }

  bool(probability = 0.5): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)];
  }

  sample<T>(items: readonly T[], count: number): T[] {
    const copy = [...items];
    const selected: T[] = [];
    while (copy.length > 0 && selected.length < count) {
      selected.push(copy.splice(this.int(0, copy.length - 1), 1)[0]);
    }
    return selected;
  }
}

export function hashSeed(seed: string | number): number {
  const text = String(seed);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seedFaker(seed: string | number | undefined): void {
  faker.seed(seed === undefined ? Date.now() : hashSeed(seed));
}

export function syntheticId(prefix: string, rng: SimRandom): string {
  const token = faker.string.alphanumeric({ length: 8, casing: 'lower' });
  return `${prefix}_${token}_${rng.int(100000, 999999)}`;
}

export function countryOtherThan(country: string, rng: SimRandom): string {
  const choices = COUNTRY_POOL.filter((item) => item !== country.toUpperCase());
  return rng.pick(choices);
}

export function currencyMinorUnits(amount: number): number {
  return Number(amount.toFixed(2));
}

export function normalizeCountry(country: string): string {
  return country.trim().toUpperCase();
}

export function parsePatterns(value?: string): FraudPattern[] {
  if (!value || value.trim() === '' || value.trim().toLowerCase() === 'all') {
    return [...FRAUD_PATTERNS];
  }

  const patterns = value
    .split(',')
    .map((pattern) => normalizePatternAlias(pattern.trim()))
    .filter(Boolean);

  const invalid = patterns.filter((pattern) => !FRAUD_PATTERNS.includes(pattern as FraudPattern));
  if (invalid.length > 0) {
    throw new Error(`Unknown fraud pattern(s): ${invalid.join(', ')}. Allowed patterns: ${FRAUD_PATTERNS.join(', ')}`);
  }

  return patterns as FraudPattern[];
}

function normalizePatternAlias(pattern: string): string {
  return pattern === 'mule' ? 'mule_account' : pattern;
}

export function parseOutputFormat(value: string): OutputFormat {
  const format = value.toLowerCase();
  if (format !== 'csv' && format !== 'json' && format !== 'ndjson' && format !== 'sql' && format !== 'both' && format !== 'all') {
    throw new Error('--format must be one of: csv, json, ndjson, sql, both, all');
  }
  return format;
}

export function validateGenerateOptions(options: GenerateOptions): void {
  if (!Number.isInteger(options.users) || options.users < 1) {
    throw new Error('--users must be a positive integer');
  }
  if (options.fraudRate < 0 || options.fraudRate > 1 || Number.isNaN(options.fraudRate)) {
    throw new Error('--fraud-rate must be a number between 0 and 1');
  }
  if (!Number.isInteger(options.transactionsMin) || options.transactionsMin < 0) {
    throw new Error('--transactions-min must be a non-negative integer');
  }
  if (!Number.isInteger(options.transactionsMax) || options.transactionsMax < 1) {
    throw new Error('--transactions-max must be a positive integer');
  }
  if (options.transactionsMin > options.transactionsMax) {
    throw new Error('--transactions-min cannot be greater than --transactions-max');
  }
  if (options.patterns.length === 0) {
    throw new Error('At least one fraud pattern must be selected');
  }
  const invalidPatterns = options.patterns.filter((pattern) => !FRAUD_PATTERNS.includes(pattern));
  if (invalidPatterns.length > 0) {
    throw new Error(`Unknown fraud pattern(s): ${invalidPatterns.join(', ')}. Allowed patterns: ${FRAUD_PATTERNS.join(', ')}`);
  }
  if (normalizeCountry(options.country).length !== 2) {
    throw new Error('--country must be a 2-letter ISO country code such as NG');
  }
  if (options.currency.trim().length < 3) {
    throw new Error('--currency must be a currency code such as NGN');
  }
}

export function toNumber(value: string, flag: string): number {
  const number = Number(value);
  if (Number.isNaN(number)) {
    throw new Error(`${flag} must be numeric`);
  }
  return number;
}

export function toInteger(value: string, flag: string): number {
  const number = Number(value);
  if (!Number.isInteger(number)) {
    throw new Error(`${flag} must be an integer`);
  }
  return number;
}
