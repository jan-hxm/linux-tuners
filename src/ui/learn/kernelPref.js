/**
 * Which VM image's capture the learning pages show (the kernel switcher in
 * ChapterView). A viewer preference like the parameter panel's switches
 * (Design.md §5 "Viewer preferences"): one enum value under one
 * `linux-tuners:` key, never tuner state, never in a link, and the page works
 * the same when storage is missing or throws (it starts on the first image).
 * One ref for the whole page, so every chapter shows the same kernel.
 */
import { ref } from 'vue'

export const KERNEL_STORAGE_KEY = 'linux-tuners:learn-kernel'

function read() {
  try {
    return globalThis.localStorage?.getItem(KERNEL_STORAGE_KEY) ?? null
  } catch {
    return null
  }
}

/** The stored image id, unchecked: imageIn() checks it against the list shown. */
export const storedKernel = ref(read())

/**
 * The image to show: the stored one when it is in `images`, else the first.
 * A stored value is only ever compared with the ids, never rendered.
 * @param {{ id: string }[]} images
 */
export function imageIn(images) {
  const id = storedKernel.value
  return images.some((img) => img.id === id) ? id : (images[0]?.id ?? '')
}

/** @param {string} id */
export function setKernel(id) {
  storedKernel.value = id
  try {
    globalThis.localStorage?.setItem(KERNEL_STORAGE_KEY, id)
  } catch {
    // Not remembered, but it still applies until the page closes.
  }
}
