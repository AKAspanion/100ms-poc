<script setup lang="ts">
  import type { Photo } from '../api/types';
  import Card from 'primevue/card';
  import Image from 'primevue/image';
  import Button from 'primevue/button';

  const props = defineProps<{
    photos: Photo[];
    currentIndex: number;
  }>();

  const emit = defineEmits<{
    (event: 'photoSelected', index: number): void;
  }>();

  function handleThumbnailClick(index: number) {
    emit('photoSelected', index);
  }
</script>

<template>
  <Card class="mt-4">
    <template #title>
      <div class="flex items-baseline justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold sm:text-base">Shared photo album</h2>
          <p class="text-xs text-slate-400 sm:text-[13px]">
            Everyone in the meetup stays in sync as photos change.
          </p>
        </div>

        <p v-if="photos.length" class="text-xs text-slate-400">
          Photo
          <span class="font-medium text-slate-50">
            {{ currentIndex + 1 }}
          </span>
          of
          <span class="font-medium text-slate-50">
            {{ photos.length }}
          </span>
        </p>
      </div>
    </template>

    <template #content>
      <div
        v-if="!photos.length"
        class="flex min-h-[160px] items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/80 px-4 text-sm text-slate-400"
      >
        No photos available for this meetup yet.
      </div>

      <div v-else class="space-y-4">
        <div class="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/70">
          <Image
            :src="photos[currentIndex]?.url"
            :alt="photos[currentIndex]?.title"
            image-class="h-64 w-full object-cover sm:h-80"
            preview
          />
          <div
            class="flex items-center justify-between border-t border-slate-800 bg-slate-950/80 px-3 py-2"
          >
            <div>
              <p class="text-xs font-medium text-slate-100 sm:text-sm">
                {{ photos[currentIndex]?.title || 'Untitled photo' }}
              </p>
              <p class="text-[11px] text-slate-400 sm:text-xs">
                Click a thumbnail below to change the shared photo for everyone.
              </p>
            </div>
          </div>
        </div>

        <div class="overflow-x-auto">
          <div class="flex gap-2 pb-1">
            <Button
              v-for="(photo, index) in photos"
              :key="photo.id"
              type="button"
              class="group relative inline-flex shrink-0 rounded-xl border bg-slate-950/80 p-0"
              :class="[
                index === currentIndex
                  ? 'border-memrico-accent ring-2 ring-memrico-accent/70'
                  : 'border-slate-700 hover:border-slate-400',
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
    </template>
  </Card>
</template>
