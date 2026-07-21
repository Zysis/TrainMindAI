export const BASKETBALL_POSITIONS = [
  'Point Guard', 'Shooting Guard', 'Small Forward', 'Power Forward', 'Center',
] as const;

export type BasketballPosition = typeof BASKETBALL_POSITIONS[number];

/** Position options formatted for Select components */
export const POSITION_OPTIONS = BASKETBALL_POSITIONS.map((p) => ({
  value: p,
  label: p,
}));
