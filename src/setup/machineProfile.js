/**
 * The machine profile as a profile the shared ProfileForm renders: the field
 * list from core/machine.js, with the form's title, button and summary.
 */

import { MACHINE_FIELDS } from '@/core/machine.js'
import { formatSizeGiB } from '@/core/formatting.js'

/** The parts of the one-line summary, also the combined output's header. */
function summaryParts(machine, label, code = (s) => s) {
  return [
    label('role', machine.role),
    `${code(formatSizeGiB(machine.ramGiB))} RAM`,
    `cgroup ${label('cgroupVersion', machine.cgroupVersion)}`,
    `kernel ${label('kernel', machine.kernel)}`,
    `systemd ${label('systemd', machine.systemd)}`,
  ]
}

/** An option's label, looked up in the field list, never taken from the state. */
export function machineOptionLabel(key, value) {
  return MACHINE_FIELDS.find((f) => f.key === key)?.options?.find((o) => o.value === value)?.label ?? ''
}

export const MACHINE_PROFILE = Object.freeze({
  title: 'Your machine',
  applyLabel: 'Apply to every step',
  fields: MACHINE_FIELDS,
  summary: (machine, label) => summaryParts(machine, label, (s) => `\`${s}\``),
})

/**
 * The header of the combined copy: what the files were made for.
 *
 * @param {Object} machine
 * @returns {string}
 */
export function machineHeader(machine) {
  return [
    '# Guided setup from linux-tuners.dev/setup',
    `# Machine: ${summaryParts(machine, machineOptionLabel).join(', ')}`,
    '# Each file below says where to save it and how to apply it.',
  ].join('\n')
}
