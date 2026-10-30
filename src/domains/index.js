/**
 * Every tuner domain. The contract test suite iterates over this list, so a
 * tuner added here gets the shared checks for free. Replaced by
 * src/tuners/registry.js in migration step 3 (TODO.md §4).
 */

import { swapDomain } from './swap/index.js'
import { systemdDomain } from './systemd/index.js'

export const TUNER_DOMAINS = [swapDomain, systemdDomain]
