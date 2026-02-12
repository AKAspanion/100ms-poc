<script setup lang="ts">
  import { onMounted, onUnmounted, ref } from 'vue';
  import { mountHmsPrebuilt, type HmsPrebuiltRef } from '../lib/hmsPrebuiltBridge';

  const props = withDefaults(
    defineProps<{
      authToken: string | null;
      userName?: string | null;
      userId?: string | null;
    }>(),
    {
      userName: null,
      userId: null,
    },
  );

  const emit = defineEmits<{
    (_e: 'leave'): void;
    (_e: 'ready', ref: HmsPrebuiltRef): void;
    (_e: 'join'): void;
  }>();

  const containerRef = ref<HTMLElement | null>(null);
  let unmountPrebuilt: (() => void) | null = null;

  function getProps() {
    return {
      authToken: props.authToken ?? '',
      userName: props.userName ?? undefined,
      userId: props.userId ?? undefined,
      onLeave: () => emit('leave'),
      onJoin: () => emit('join'),
      onReady: (ref: HmsPrebuiltRef) => emit('ready', ref),
    };
  }

  function mount() {
    if (!containerRef.value || !props.authToken) {
      return;
    }
    unmountPrebuilt = mountHmsPrebuilt(containerRef.value, getProps());
  }

  function unmount() {
    if (unmountPrebuilt) {
      unmountPrebuilt();
      unmountPrebuilt = null;
    }
  }

  onMounted(() => {
    mount();
  });

  onUnmounted(() => {
    unmount();
  });
</script>

<template>
  <div ref="containerRef" class="hms-prebuilt-embed h-full w-full min-h-0" />
</template>

<style scoped>
  .hms-prebuilt-embed :deep(iframe),
  .hms-prebuilt-embed :deep(> div) {
    height: 100%;
    width: 100%;
  }
</style>
