/**
 * Comment helpers shared by the output writers: rules, section headers, file
 * banners and the header-block fields every tuner prints.
 */

const SEP_WIDTH = 78
// U+2028/2029 built from char codes: written literally they would end the regex.
const LINE_BREAK = new RegExp(`[\\r\\n${String.fromCharCode(0x2028, 0x2029)}]`)

/** `# text`, refusing text that would start a new line. */
export function commentLine(text) {
  if (LINE_BREAK.test(text)) throw new Error('Comment text contains a line break')
  return `# ${text}`
}

/** Full-width comment rule used to fence header blocks. */
export function rule() {
  return '# ' + '─'.repeat(SEP_WIDTH - 2)
}

/** `# ── Title ───…` padded to the full width. */
export function sectionHeader(title) {
  const lead = `# ── ${title} `
  return lead + '─'.repeat(Math.max(2, SEP_WIDTH - lead.length))
}

/** `# ===== /path ===…` opening one file of a multi-file output. */
export function fileBanner(path) {
  const lead = `# ===== ${path} `
  return lead + '='.repeat(Math.max(2, SEP_WIDTH - lead.length))
}

/** Date stamp for the header, YYYY-MM-DD in UTC. */
export function isoDate(now) {
  return (now ?? new Date()).toISOString().slice(0, 10)
}

/** "Label", "Label (customised)" or "custom" when no preset is active. */
export function presetSummary(presetLabel, customised) {
  if (!presetLabel) return 'custom'
  return `${presetLabel}${customised ? ' (customised)' : ''}`
}
