/**
 * The landing specimen's data (REDESIGN §4 decision 4), loaded on demand so
 * the swap domain stays out of the landing chunk: the domain, the setting's
 * key, the example machine and its one-line summary. Plain data; nothing
 * here reads or writes a store or the URL.
 */
import { swapDomain } from '@/tuners/swap/index.js'
import { LANDING_EXAMPLE } from '@/tuners/swap/profile.js'
import { optionLabel } from '@/core/profile.js'
import { parseRichText } from '@/ui/richText.js'

/** "16 GiB RAM · 8 GiB nvme-ssd swap · Desktop workstation", without markup. */
function summaryOf(domain, hardware) {
  const { profile } = domain
  const parts = profile.summary(hardware, (key, value) => optionLabel(profile.fields, key, value))
  return parts.map((part) => parseRichText(part).map((seg) => seg.text).join('')).join(' · ')
}

export const landingExample = Object.freeze({
  domain: swapDomain,
  key: LANDING_EXAMPLE.key,
  hardware: LANDING_EXAMPLE.hardware,
  summary: summaryOf(swapDomain, LANDING_EXAMPLE.hardware),
})
