import type { LaceCalc, LaceSpec } from '../types';
import type { PartCalculator } from './types';
import { lacesCalculator } from './laces/calculator';

/* Every calculator the app knows, keyed by list category.
   Add a new one here after writing it under src/calc/<part>/. */
const CALCULATORS: Record<string, PartCalculator<LaceSpec, LaceCalc>> = {
  [lacesCalculator.category]: lacesCalculator,
};

export function getCalculator(category: string): PartCalculator<LaceSpec, LaceCalc> | null {
  return CALCULATORS[category] || null;
}

export const calculatorIds = (): string[] => Object.keys(CALCULATORS);
