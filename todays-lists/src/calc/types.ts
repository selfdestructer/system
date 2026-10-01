/* A part calculator turns a free-text list entry ("Vans Old Skool white, 8 eyelets")
   into the exact thing to buy ("54″ flat laces"). Laces are the first one; see
   .claude/skills/add-part-calculator/SKILL.md for adding the next. */

export interface WizardField {
  /** Key on the spec object. */
  key: string;
  /** Short label shown when the field is still needed. */
  label: string;
}

export interface PartCalculator<Spec, Result> {
  /** Stable id, also the list category this calculator serves. */
  id: string;
  category: string;
  label: string;
  /** Everything the user might have to answer, in the order the wizard asks. */
  fields: WizardField[];
  /** Pull what you can out of the typed text. */
  parse(text: string): Spec;
  /** Work out the part. Must never throw; return a "need" result instead. */
  calc(spec: Spec): Result;
  /** Field labels still missing before `calc` can give a real answer. */
  missing(spec: Spec): string[];
  /** True when the entry can be added without opening the wizard. */
  complete(spec: Spec, result: Result): boolean;
  /** Human title for the thing the part fits, e.g. "Vans Old Skool". */
  title(spec: Spec): string;
  /** One-line "buy this" summary, or null when there is nothing to buy. */
  summary(spec: Spec, result: Result): string | null;
  /** Search query for store and online lookups, or null if not sized yet. */
  search(spec: Spec, result: Result): string | null;
}
