import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Which of the given page sections the reader is in, for highlighting an
 * in-page nav. A section counts once its top has scrolled above a line a
 * fraction of the way down the viewport; above the first section the first
 * one counts, and past the bottom of the last one none does.
 *
 * @param {string[]} ids section element ids, in page order
 * @param {{ line?: number }} [options] line as a fraction of the viewport height
 * @returns {import('vue').Ref<string|null>}
 */
export function useScrollSpy(ids, { line = 0.3 } = {}) {
  const active = ref(ids[0] ?? null)
  let frame = 0

  function update() {
    frame = 0
    const y = window.innerHeight * line
    const sections = ids.map((id) => document.getElementById(id)).filter(Boolean)
    if (!sections.length) return
    let current = sections[0]
    for (const el of sections) {
      if (el.getBoundingClientRect().top <= y) current = el
    }
    const last = sections[sections.length - 1]
    active.value = current === last && last.getBoundingClientRect().bottom < y ? null : current.id
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(update)
  }

  onMounted(() => {
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    update()
  })
  onBeforeUnmount(() => {
    window.removeEventListener('scroll', schedule)
    window.removeEventListener('resize', schedule)
    cancelAnimationFrame(frame)
  })

  return active
}
