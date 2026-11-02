/**
 * Copy and download for generated text, shared by the tuner output and the
 * guided setup's file list.
 */

/**
 * The names files download under: the last part of each install path, with
 * its folder in front when two files share it (systemd's two slice drop-ins,
 * the huge pages sysctl.d and tmpfiles.d files), so neither download
 * replaces the other.
 *
 * @param {string[]} paths
 * @returns {string[]}
 */
export function downloadNames(paths) {
  const base = (p) => p.split('/').pop()
  return paths.map((p) => {
    if (paths.filter((q) => base(q) === base(p)).length === 1) return base(p)
    const [dir, name] = p.split('/').slice(-2)
    return `${dir}-${name}`
  })
}

/**
 * @param {string} text
 * @returns {Promise<boolean>} whether the clipboard took it
 */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * Save text as a file, with the trailing newline a config file ends with.
 *
 * @param {string} name
 * @param {string} text
 */
export function downloadText(name, text) {
  const blob = new Blob([text + '\n'], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Defer revoke to next tick so the browser has a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
