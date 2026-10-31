/**
 * Every tuner domain. The contract test suite iterates over this list, so a
 * tuner added here gets the shared checks for free. Kept apart from the
 * registry, which must stay plain data; registry.test.js checks that these ids
 * match the live registry entries.
 */

import { swapDomain } from './swap/index.js'
import { systemdDomain } from './systemd/index.js'
import { securityDomain } from './security/index.js'

export const TUNER_DOMAINS = [swapDomain, systemdDomain, securityDomain]
