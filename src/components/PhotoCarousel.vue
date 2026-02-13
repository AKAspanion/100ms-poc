<script setup lang="ts">
  import { ref } from 'vue';
  import type { Photo } from '../api/types';
  import Card from 'primevue/card';
  import Image from 'primevue/image';
  import Button from 'primevue/button';

  defineProps<{
    photos: Photo[];
    currentIndex: number;
  }>();

  const emit = defineEmits<{
    (_event: 'photoSelected', _index: number): void;
  }>();

  const thumbnailListRef = ref<HTMLElement | null>(null);

  function handleThumbnailClick(index: number) {
    emit('photoSelected', index);
    scrollSelectedToStart(index);
  }

  function scrollSelectedToStart(index: number) {
    const container = thumbnailListRef.value;
    if (!container) return;
    const thumb = container.querySelector(`[data-thumb-index="${index}"]`) as HTMLElement | null;
    if (!thumb) return;
    const containerRect = container.getBoundingClientRect();
    const thumbRect = thumb.getBoundingClientRect();
    const scrollDelta = thumbRect.left - containerRect.left;
    container.scrollBy({ left: scrollDelta, behavior: 'smooth' });
  }
</script>

<template>
  <Card class="mt-4 rounded-2xl!">
    <template #title>
      <div class="flex items-baseline justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold sm:text-base">Shared photo album</h2>
          <p class="text-xs text-muted-color sm:text-[13px]">
            Everyone in the meetup stays in sync as photos change.
          </p>
        </div>

        <p v-if="photos.length" class="text-xs text-muted-color">
          Photo
          <span class="font-medium text-color">
            {{ currentIndex + 1 }}
          </span>
          of
          <span class="font-medium text-color">
            {{ photos.length }}
          </span>
        </p>
      </div>
    </template>

    <template #content>
      <div
        v-if="!photos.length"
        class="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-surface bg-surface-50/80 px-4 text-sm text-muted-color"
      >
        No photos available for this meetup yet.
      </div>

      <div v-else class="space-y-4">
        <div class="overflow-hidden rounded-xl border border-surface bg-surface-0/70">
          <Image
            :src="photos[currentIndex]?.url"
            :alt="photos[currentIndex]?.title"
            image-class="h-64 w-full object-cover sm:h-80"
            preview
          />
          <div
            class="flex items-center justify-between border-t border-surface bg-surface-0/80 px-3 py-2"
          >
            <div>
              <p class="text-xs font-medium text-color sm:text-sm">
                {{ photos[currentIndex]?.title || 'Untitled photo' }}
              </p>
              <p class="text-[11px] text-muted-color sm:text-xs">
                Click a thumbnail below to change the shared photo for everyone.
              </p>
            </div>
          </div>
        </div>

        <div ref="thumbnailListRef" class="overflow-x-auto">
          <div class="flex gap-2 pb-1">
            <div
              v-for="(photo, index) in photos"
              :key="photo.id"
              :data-thumb-index="index"
              class="shrink-0"
            >
              <Button
                type="button"
                class="group relative inline-flex rounded-xl border bg-surface-0/80 p-0"
                :class="[
                  index === currentIndex
                    ? 'border-primary ring-2 ring-primary/70'
                    : 'border-surface hover:border-surface',
                ]"
                @click="handleThumbnailClick(index)"
              >
                <img
                  :src="photo.thumbnailUrl"
                  :alt="photo.title"
                  class="h-16 w-20 rounded-[10px] object-cover sm:h-18 sm:w-24"
                />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </Card>
</template>
