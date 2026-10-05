/**
 * Speech-bubble copy is stored as fractions of a parent image.
 * Resizing or moving that image keeps the words inside the bubble.
 */

export function drawnImageBox(el) {
  const x = Number(el?.x) || 0;
  const y = Number(el?.y) || 0;
  const w = Number(el?.w) || 1;
  const h = Number(el?.h) || 1;
  const aspect = Number(el?.aspect);
  const fit = el?.fit || 'contain';
  if (!aspect || fit === 'fill' || fit === 'stretch' || fit === 'cover') {
    return { x, y, w, h };
  }
  if (w / h > aspect) {
    const iw = h * aspect;
    return { x: x + (w - iw) / 2, y, w: iw, h };
  }
  const ih = w / aspect;
  return { x, y: y + (h - ih) / 2, w, h: ih };
}

/** Place every `follow` element inside its parent image, and scale its type. */
export function layoutAnchoredElements(elements = []) {
  const byId = new Map(elements.map((el) => [el.id, el]));
  return elements.map((el) => {
    if (!el?.follow) return el;
    const parent = byId.get(el.follow);
    if (!parent) return el;
    const box = drawnImageBox(parent);
    const w = Math.max(0.05, (Number(el.fw) || 0.4) * box.w);
    const h = Math.max(0.05, (Number(el.fh) || 0.2) * box.h);
    const x = box.x + (Number(el.fx) || 0) * box.w;
    const y = box.y + (Number(el.fy) || 0) * box.h;
    const lines = Math.max(1, String(el.text || '').split('\n').length);
    const longest = String(el.text || '')
      .replace(/\{\{hi_name\}\}/g, 'Hi Dorothy,')
      .split('\n')
      .reduce((max, line) => Math.max(max, line.length), 1);
    // Poppins Bold is about 0.62em wide and 1.5em tall per line.
    // Caps are PDF points. drawElement prints follow text at this size directly.
    const widthCap = (w * 72) / (0.62 * longest);
    const heightCap = (h * 72) / (1.5 * lines);
    const wanted = el.fontScale ? Number(el.fontScale) * h : (Number(el.fontSize) || heightCap);
    const fontSize = Math.max(3.2, Math.min(wanted, widthCap, heightCap));
    return { ...el, x, y, w, h, fontSize };
  });
}
