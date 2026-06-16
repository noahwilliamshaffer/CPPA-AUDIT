import { describe, it, expect } from 'vitest';
import { AUDIT_COMPONENTS, CORE_COMPONENT_COUNT } from './components';

describe('AUDIT_COMPONENTS', () => {
  it('has 18 core components + the ADMT sub-assessment (19 total)', () => {
    expect(CORE_COMPONENT_COUNT).toBe(18);
    expect(AUDIT_COMPONENTS).toHaveLength(19);
  });

  it('numbers are exactly 1..19 and unique', () => {
    const nums = AUDIT_COMPONENTS.map((c) => c.number);
    expect(nums).toEqual(Array.from({ length: 19 }, (_, i) => i + 1));
    expect(new Set(nums).size).toBe(19);
  });

  it('every component has a title, citation, and description', () => {
    for (const c of AUDIT_COMPONENTS) {
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.citation.length).toBeGreaterThan(0);
      expect(c.description.length).toBeGreaterThan(0);
    }
  });

  it('component 19 is the ADMT sub-assessment (not a §7123(c) subsection)', () => {
    const admt = AUDIT_COMPONENTS.find((c) => c.number === 19);
    expect(admt?.isAdmt).toBe(true);
    expect(admt?.citation).not.toMatch(/7123\(c\)/);
  });

  it('core components 1..18 cite §7123(c)', () => {
    for (const c of AUDIT_COMPONENTS.filter((c) => c.number <= 18)) {
      expect(c.citation).toContain('§7123(c)');
    }
  });
});
