/**
 * The machine roles of the guided setup (Design.md §5 "Guided setup"): what a
 * machine is for. The landing page orders the tuners by them, and each tuner
 * maps them onto its own workloads.
 *
 * Plain data with no imports: the registry names these ids, and
 * scripts/generate-static-routes.mjs reads the registry under Node.
 */

export const MACHINE_ROLES = Object.freeze([
  { value: 'server', label: 'General server' },
  { value: 'web', label: 'Web or API server' },
  { value: 'database', label: 'Database' },
  { value: 'container-host', label: 'Container or Kubernetes host' },
  { value: 'vm-host', label: 'VM host' },
  { value: 'router', label: 'Router or firewall' },
  { value: 'desktop', label: 'Desktop or workstation' },
])
