/**
 * Generated config is a list of files, `{ path, content }[]`. Paths are
 * constants from tuner code (Design.md §10 "Paths are constants"); configFile
 * enforces the shape at runtime so a bad path can never reach the page.
 */

const SAFE_PATH = /^\/etc\/[a-z0-9._/-]+$/

/**
 * @typedef {Object} ConfigFile
 * @property {string} path     Absolute install path under /etc
 * @property {string} content  File text, no trailing newline
 */

/** @param {string} path */
export function isSafeConfigPath(path) {
  return typeof path === 'string' && SAFE_PATH.test(path) && !path.split('/').includes('..')
}

/**
 * Build one file from its lines, dropping trailing blank lines for a tidier
 * copy-paste.
 *
 * @param {string}   path
 * @param {string[]} lines
 * @returns {ConfigFile}
 */
export function configFile(path, lines) {
  if (!isSafeConfigPath(path)) throw new Error(`Unsafe config path "${path}"`)
  const out = [...lines]
  while (out.at(-1) === '') out.pop()
  return { path, content: out.join('\n') }
}

/**
 * The text the output panel shows and copies: every file, separated by one
 * blank line. A multi-file tuner starts each file with a banner naming its path.
 *
 * @param {ConfigFile[]} files
 * @returns {string}
 */
export function combineFiles(files) {
  return files.map((f) => f.content).join('\n\n')
}
