export type Point = { x: number; y: number };

/** A filled arrow from one point toward another, moved sideways by `shift`.
 * `gap` stays clear at both ends for the labels there. */
export function arrow(from: Point, to: Point, width: number, gap: number, shift = 0): string {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const ux = (to.x - from.x) / length;
  const uy = (to.y - from.y) / length;
  const at = (along: number, side: number) =>
    `${(from.x + ux * along - uy * (side + shift)).toFixed(1)} ${(from.y + uy * along + ux * (side + shift)).toFixed(1)}`;
  const half = width / 2;
  const headHalf = half + 7;
  const end = length - gap;
  const neck = end - headHalf;
  return `M${at(gap, -half)}L${at(neck, -half)}L${at(neck, -headHalf)}L${at(end, 0)}L${at(neck, headHalf)}L${at(neck, half)}L${at(gap, half)}Z`;
}
