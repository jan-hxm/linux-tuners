/**
 * Every tuner domain. The contract test suite iterates over this list, so a
 * tuner added here gets the shared checks for free. Kept apart from the
 * registry, which must stay plain data; registry.test.js checks that these ids
 * match the live registry entries.
 */

import { swapDomain } from './swap/index.js'
import { systemdDomain } from './systemd/index.js'
import { securityDomain } from './security/index.js'
import { networkDomain } from './network/index.js'
import { filesystemDomain } from './filesystem/index.js'
import { hugepagesDomain } from './hugepages/index.js'
import { sysvIpcDomain } from './sysv-ipc/index.js'
import { kernelDomain } from './kernel/index.js'
import { blockIoDomain } from './block-io/index.js'

export const TUNER_DOMAINS = [swapDomain, systemdDomain, securityDomain, networkDomain, filesystemDomain, hugepagesDomain, sysvIpcDomain, kernelDomain, blockIoDomain]
