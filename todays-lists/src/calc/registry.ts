import type { LaceCalc, LaceSpec } from '../types';
import type { PartCalculator } from './types';
import { lacesCalculator } from './laces/calculator';

/* Every calculator the app knows, keyed by list category.
   Today the registry is typed to the lace spec/result because `Item.lace` is the only spec slot
   the saved state has and `LaceWizard` is the only wizard. Adding a second kind of part means:
   a spec type + Item field (bump AppState.v), widening this map's value type to a union, and a
   wizard branch in App. See .claude/skills/add-part-calculator/SKILL.md. */
const CALCULATORS: Record<string, PartCalculator<LaceSpec, LaceCalc>> = {
  [lacesCalculator.category]: lacesCalculator,
};

export function getCalculator(category: string): PartCalculator<LaceSpec, LaceCalc> | null {
  return CALCULATORS[category] || null;
}

export const calculatorIds = (): string[] => Object.keys(CALCULATORS);
