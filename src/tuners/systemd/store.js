import { defineTunerStore } from '@/core/createTunerStore.js'
import { systemdDomain } from './index.js'

/**
 * The systemd tuner's Pinia store, built from the generic store factory with the
 * systemd domain. Distinct id ('systemd') from the swap store so both can exist
 * independently and decode their own URL-hash state.
 */
export const useSystemdStore = defineTunerStore('systemd', systemdDomain)
