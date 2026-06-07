import { defineTunerStore } from './createTunerStore.js'
import { swapDomain } from '@/domains/swap/index.js'

/**
 * The swap tuner's Pinia store. Built from the generic store factory with the
 * swap domain. Kept under the id 'tuner' and exported as useTunerStore so the
 * existing components, tests, and shared-URL hashes continue to work unchanged.
 */
export const useTunerStore = defineTunerStore('tuner', swapDomain)
