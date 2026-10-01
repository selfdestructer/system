import type { LaceCalc, LaceSpec } from '../../types';
import type { PartCalculator } from '../types';
import { calcLace, modelOf, parseLace, shoeTitle, sizeMens } from './index';

export const lacesCalculator: PartCalculator<LaceSpec, LaceCalc> = {
  id: 'laces',
  category: 'laces',
  label: 'Shoelaces',
  fields: [
    { key: 'modelKey', label: 'shoe model' },
    { key: 'size', label: 'shoe size' },
    { key: 'eyelets', label: 'eyelet pairs' },
    { key: 'color', label: 'lace color' },
    { key: 'laceType', label: 'lace style' },
  ],
  parse: parseLace,
  calc: calcLace,
  missing(spec) {
    const m = modelOf(spec.modelKey);
    const out: string[] = [];
    const pairs = spec.eyelets || (m && !m.noLaces ? m.pairs(sizeMens(spec)) : 0) || spec.aiPairs || 0;
    if (!pairs) out.push('eyelet pairs');
    if (!spec.color) out.push('lace color');
    if (!spec.size && !m) out.push('shoe size');
    return out;
  },
  complete(spec, r) {
    return !r.need && !r.noLaces && !!spec.eyelets && !!spec.color && !!(spec.modelKey || spec.size);
  },
  title: shoeTitle,
  summary(spec, r) {
    if (!r.inches) return null;
    return `${shoeTitle(spec)}: buy ${r.inches}″ ${r.typeLabel.split(' · ')[0].toLowerCase()}`;
  },
  search(spec, r) {
    if (!r.inches) return null;
    const col = spec.color ? ' ' + spec.color.split(/ or |\//)[0].toLowerCase() : '';
    return `${r.inches} inch shoelaces${col}`;
  },
};
