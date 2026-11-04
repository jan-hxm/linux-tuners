/**
 * What the footer's colophon says the output was tested on. It is the matrix
 * in vm/README.md and vm/lib/images.mjs, kept here as plain data because the
 * VM harness is not part of the app bundle. testedOn.test.js fails when the
 * two drift apart, so update this file whenever the matrix changes.
 */

/** Distribution families and the releases the VM suite boots. */
export const TESTED_DISTROS = [
  { name: 'Debian', versions: ['11', '13'] },
  { name: 'Ubuntu', versions: ['18.04', '24.04'] },
  { name: 'Fedora', versions: ['43'] },
]

/** The oldest and newest kernel among those images. */
export const TESTED_KERNELS = { from: '4.15', to: '6.17' }

const join = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`)

/** "Debian 11 and 13, Ubuntu 18.04 and 24.04 and Fedora 43 (kernels 4.15 to 6.17)" */
export function testedOnText() {
  const families = TESTED_DISTROS.map((d) => `${d.name} ${join(d.versions)}`)
  return `${join(families)} (kernels ${TESTED_KERNELS.from} to ${TESTED_KERNELS.to})`
}
