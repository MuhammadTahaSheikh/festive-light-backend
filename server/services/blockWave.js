/** Group campaign homes by street name for "block wave" outreach stats. */

export function streetKey(address = '') {
  const line = String(address).split(',')[0]?.trim() || '';
  const m = line.match(/^\d+[\w-]*\s+(.+)/i);
  return (m ? m[1] : line).toLowerCase().trim();
}

export function blockWaveStats(homes = []) {
  const blocks = {};
  for (const home of homes) {
    const key = streetKey(home.address);
    if (!key) continue;
    if (!blocks[key]) {
      blocks[key] = {
        street: key,
        label: key.replace(/\b\w/g, (c) => c.toUpperCase()),
        total: 0,
        rendered: 0,
        mailed: 0,
      };
    }
    blocks[key].total += 1;
    if (home.render_id) blocks[key].rendered += 1;
    if (home.mail_status || home.status === 'quote_sent') blocks[key].mailed += 1;
  }
  const list = Object.values(blocks).sort((a, b) => b.rendered - a.rendered);
  const best = list.find((b) => b.rendered >= 2 && b.rendered < b.total) || null;
  return { blocks: list, wave: best };
}
