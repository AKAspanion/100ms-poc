<script setup lang="ts">
  import { ref } from 'vue';
  import type { Photo } from '../api/types';

  const props = defineProps<{
    photos: Photo[];
    currentIndex: number;
    meetupTitle?: string;
  }>();

  const emit = defineEmits<{
    (_event: 'photoSelected', _index: number): void;
  }>();

  const thumbnailListRef = ref<HTMLElement | null>(null);

  function scrollSelectedToCenter(index: number) {
    const container = thumbnailListRef.value;
    if (!container) return;
    const thumb = container.querySelector(`[data-thumb-index="${index}"]`) as HTMLElement | null;
    if (!thumb) return;
    const containerRect = container.getBoundingClientRect();
    const thumbRect = thumb.getBoundingClientRect();
    const thumbCenter = thumbRect.left + thumbRect.width / 2;
    const containerCenter = containerRect.left + containerRect.width / 2;
    const scrollDelta = thumbCenter - containerCenter;
    container.scrollBy({ left: scrollDelta, behavior: 'smooth' });
  }

  function handleThumbnailClick(index: number) {
    emit('photoSelected', index);
    scrollSelectedToCenter(index);
  }

  function handlePreviousPhoto() {
    if (!props.photos.length) return;
    const newIndex = props.currentIndex > 0 ? props.currentIndex - 1 : props.photos.length - 1;
    emit('photoSelected', newIndex);
    scrollSelectedToCenter(newIndex);
  }

  function handleNextPhoto() {
    if (!props.photos.length) return;
    const newIndex = props.currentIndex < props.photos.length - 1 ? props.currentIndex + 1 : 0;
    emit('photoSelected', newIndex);
    scrollSelectedToCenter(newIndex);
  }
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <!-- Middle Section: Photo Display -->
    <div
      class="relative w-full flex flex-1 flex-col items-center justify-center overflow-y-auto bg-surface-0 px-4 py-4"
    >
      <div class="relative flex h-full w-full items-center">
        <div
          v-if="!photos.length"
          class="flex min-h-100 h-full w-full items-center justify-center rounded-lg border border-surface-50 bg-surface-50 text-center"
        >
          <div class="space-y-2">
            <p class="text-lg font-semibold text-color">PHOTO DISPLAY</p>
            <p class="text-sm text-muted-color">No photos available</p>
          </div>
        </div>

        <div
          v-else
          class="relative h-full w-full overflow-hidden rounded-lg border border-surface-50 bg-surface-50"
        >
          <!-- Previous Button -->
          <button
            type="button"
            class="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-surface-0 text-color shadow-lg transition-colors hover:bg-surface-100"
            @click="handlePreviousPhoto"
          >
            <span class="fa-solid fa-chevron-left text-sm" />
          </button>

          <!-- Photo Display -->
          <div class="relative h-full w-full overflow-hidden bg-surface-50">
            <img
              v-if="photos[currentIndex]"
              :src="photos[currentIndex]?.url"
              :alt="photos[currentIndex]?.title"
              class="h-full w-full object-contain"
            />
            <div
              v-else
              class="flex h-full w-full flex-col items-center justify-center gap-2 bg-surface-50 text-color"
            >
              <p class="text-lg font-semibold">PHOTO DISPLAY</p>
              <p class="text-sm">{{ meetupTitle || 'Family Reunion 2024' }}</p>
              <p class="text-xs text-muted-color">Swipe or tap arrows</p>
            </div>
          </div>

          <!-- Next Button -->
          <button
            type="button"
            class="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-surface-0 text-color shadow-lg transition-colors hover:bg-surface-100"
            @click="handleNextPhoto"
          >
            <span class="fa-solid fa-chevron-right text-sm" />
          </button>
        </div>
      </div>
    </div>

    <!-- Pagination Thumbnails -->
    <div v-if="photos.length > 0" class="border-t border-surface-50 bg-surface-50 px-4 py-4">
      <div ref="thumbnailListRef" class="mb-4 flex gap-2 overflow-x-auto pb-1">
        <div
          v-for="(photo, index) in photos"
          :key="photo.id"
          :data-thumb-index="index"
          class="shrink-0"
        >
          <button
            type="button"
            class="flex h-15 w-20 items-center justify-center overflow-hidden rounded-lg border transition-colors"
            :class="
              index === currentIndex
                ? 'border-primary bg-highlight'
                : 'border-surface-50 bg-surface-100 hover:border-primary-500'
            "
            @click="handleThumbnailClick(index)"
          >
            <img
              v-if="photo.url"
              :src="photo.url"
              :alt="photo.title || 'Photo ' + (index + 1)"
              class="h-full w-full object-cover"
            />
            <span v-else class="text-xs text-color">
              {{ index + 1 }}
            </span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
