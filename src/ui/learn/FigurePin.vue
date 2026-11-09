<script setup>
/**
 * A setting drawn on a figure (Design.md §5 "Learning pages > Figures"): a
 * pressed-state button with a dot and the setting's name, which selects the
 * chapter's pin like the row under the figure. The gauge, compare, tree and
 * modes figures draw them where the setting acts; the caller places it
 * through ordinary attributes and shows it from `md` up, since the row under
 * the figure has the same buttons below `md`.
 */
defineOptions({ inheritAttrs: false })

defineProps({
  /** The setting's name, as its card shows it. */
  name: { type: String, required: true },
  /** "<name>, <where it sits>", the button's accessible name. */
  label: { type: String, required: true },
  pressed: { type: Boolean, default: false },
  /** The id of the panel the button controls. */
  controls: { type: String, default: null },
})
defineEmits(['select'])
</script>

<template>
  <button
    type="button"
    v-bind="$attrs"
    class="inline-flex min-h-7 items-center gap-2 whitespace-nowrap border-[1.5px] border-ink px-2 font-mono text-[13px] text-ink"
    :class="pressed ? 'bg-fit-tint' : 'bg-paper hover:bg-paper-hover'"
    :aria-pressed="pressed"
    :aria-controls="controls ?? undefined"
    :aria-label="label"
    @click="$emit('select')"
  ><span aria-hidden="true" class="size-2 shrink-0 rounded-full" :class="pressed ? 'bg-fit' : 'border border-ink'" />{{ name }}</button>
</template>
