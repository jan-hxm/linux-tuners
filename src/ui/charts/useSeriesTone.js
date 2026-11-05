import { computed } from 'vue'
import { useActiveTuner } from '../useActiveTuner.js'

/**
 * Whose value a chart's main series shows, as its tone (Design.md §7): `mine`
 * once the visitor changed any of the parameters the series is drawn from,
 * otherwise `fit` (the profile's values fit the machine). A series drawn from
 * no parameter is `ink`. Each chart names its parameters; nothing here knows
 * a tuner.
 *
 * @param {string[]} keys the parameters the series depends on
 * @returns {import('vue').ComputedRef<'mine' | 'fit' | 'ink'>}
 */
export function useSeriesTone(keys) {
  const store = useActiveTuner()
  return computed(() => {
    if (!keys.length) return 'ink'
    return keys.some((k) => store.changedKeys.includes(k)) ? 'mine' : 'fit'
  })
}
