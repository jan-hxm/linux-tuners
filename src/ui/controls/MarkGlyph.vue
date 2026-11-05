<script setup>
/**
 * One of the three marks that say where a value comes from (Design.md §7), as a small inline glyph for keys and legends. They differ in
 * shape as well as colour, so they read without colour: a thin ink tick for
 * the kernel default, a heavier verdigris bar for what fits the machine, an
 * ochre dot for a value changed by you. The slider draws the same marks on
 * its scale. Decorative: the text beside it carries the meaning.
 */
defineProps({
  kind: {
    type: String,
    required: true,
    validator: (k) => ['default', 'fit', 'mine'].includes(k),
  },
})

const CLASSES = {
  default: 'h-3 w-0.5 bg-ink',
  fit: 'h-3 w-1 bg-fit',
  mine: 'h-[9px] w-[9px] rounded-full bg-mine',
}
</script>

<template>
  <span aria-hidden="true" class="inline-block shrink-0" :class="CLASSES[kind]" />
</template>
