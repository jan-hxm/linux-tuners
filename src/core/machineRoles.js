/**
 * The machine roles of the guided setup (Design.md §5 "Guided setup"): what a
 * machine is for. The landing page orders the tuners by them, and each tuner
 * maps them onto its own workloads.
 *
 * Plain data with no imports: the registry names these ids, and
 * scripts/generate-static-routes.mjs reads the registry under Node.
 */

/** `hint` is optional plain text: one short line under the label on the landing page. */
export const MACHINE_ROLES = Object.freeze([
  { value: 'server', label: 'General server', hint: 'Services on a box you administer, no special load' },
  { value: 'web', label: 'Web or API server', hint: 'Many short requests; connections and latency matter' },
  { value: 'database', label: 'Database', hint: 'Large caches, steady writes, memory kept for the data' },
  { value: 'container-host', label: 'Container or Kubernetes host', hint: 'Many workloads sharing one kernel, with limits' },
  { value: 'vm-host', label: 'VM host', hint: 'Guests with fixed RAM, memory overcommit and I/O' },
  { value: 'router', label: 'Router or firewall', hint: 'Forwarding traffic, connection tracking, firewall rules' },
  { value: 'desktop', label: 'Desktop or workstation', hint: 'Browser, IDE, games; responsiveness first' },
])

/** True for a known role id; anything else (an array, a typo) is false. */
export function isMachineRole(value) {
  return MACHINE_ROLES.some((r) => r.value === value)
}

/**
 * The roles a registry `setup.roles` names, as a sentence for the "Matters
 * for" line: their labels in role order, or "Every kind of machine." for
 * `'all'`. Empty when it names none.
 *
 * @param {'all' | string[] | undefined} roles
 */
export function rolesText(roles) {
  if (roles === 'all') return 'Every kind of machine.'
  const labels = MACHINE_ROLES.filter((r) => roles?.includes(r.value)).map((r) => r.label)
  return labels.length ? `${labels.join(', ')}.` : ''
}

/**
 * Splits tuners into those recommended for a role and the rest, each kept in
 * the given (setup) order. A tuner without a `setup` block is optional.
 */
export function tunersForRole(tuners, role) {
  const recommended = []
  const optional = []
  for (const t of tuners) {
    const roles = t.setup?.roles
    ;(roles === 'all' || roles?.includes(role) ? recommended : optional).push(t)
  }
  return { recommended, optional }
}
