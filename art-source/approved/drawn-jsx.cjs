/**
 * Renders one hand-drawn piece of `extras.json` as the JSX a flat part component uses.
 *
 * The pieces in that file are plain data — an outline, a fill, a line — because both the
 * flat kit and the model are generated from it, and neither may drift from the other. This
 * is the half that turns that data into the flat drawing.
 *
 * A colour that plays a repaintable role on its own creature goes through the repainter, so
 * a purple hand on a green monster comes out green; the ink line and anything fixed stay
 * exactly as drawn.
 */
/** Nothing is repainted: every piece keeps its own colours. See gen.cjs. */
const REPAINT = new Set();

function drawnJsx(spec, roles, key) {
  const attrs = ['key="' + key + '"', 'd="' + spec.d + '"'];
  const paint = (hex) => {
    const role = roles.get(hex) || 'fixed';
    if (role === 'ink') return 'INK';
    return REPAINT.has(role) ? "p('" + hex + "')" : null;
  };
  if (spec.fill) {
    const expr = paint(spec.fill);
    attrs.push(expr ? 'fill={' + expr + '}' : 'fill="' + spec.fill + '"');
  } else {
    attrs.push('fill="none"');
  }
  if (spec.stroke) {
    const expr = paint(spec.stroke);
    attrs.push(expr ? 'stroke={' + expr + '}' : 'stroke="' + spec.stroke + '"');
    attrs.push('strokeWidth="' + spec.sw + '"', 'strokeLinejoin="round"', 'strokeLinecap="round"');
  }
  return '      <path ' + attrs.join(' ') + ' />';
}

/** The box a part is placed by, once a hand-drawn piece has brought its own room. */
function grownBox(own, extra) {
  if (!extra) return own;
  const x = Math.min(own.x, extra.x);
  const y = Math.min(own.y, extra.y);
  return {
    x,
    y,
    w: Math.max(own.x + own.w, extra.x + extra.w) - x,
    h: Math.max(own.y + own.h, extra.y + extra.h) - y,
  };
}

module.exports = { drawnJsx, grownBox, REPAINT };
