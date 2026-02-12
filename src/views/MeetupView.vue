<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import Message from 'primevue/message';
  import { useMeetupStore } from '../stores/meetupStore';
  import { getMeetupAuthToken } from '../api/client';
  import { logPhotoEvent } from '../api/client';
  import HmsPrebuiltEmbed from '../components/HmsPrebuiltEmbed.vue';
  import type { HmsPrebuiltRef } from '../lib/hmsPrebuiltBridge';
  import type { PhotoSyncMessage } from '../lib/hmsClient';

  const route = useRoute();
  const router = useRouter();
  const meetupId = computed(() => (route.params.meetupId as string) || 'demo-meetup');
  const store = useMeetupStore();

  const isLoading = ref(true);
  const localError = ref<string | null>(null);
  let photoSyncUnsubscribe: (() => void) | null = null;
  let hmsActionsRef: HmsPrebuiltRef['hmsActions'] | null = null;

  function subscribeToPhotoSyncFromRef(ref: HmsPrebuiltRef, onMessage: (msg: PhotoSyncMessage) => void) {
    const notifications = ref.hmsNotifications as {
      onNotification: (handler: (notification: unknown) => void) => (() => void) | void;
    };
    if (!notifications?.onNotification) {
      return;
    }
    const unsub = notifications.onNotification((notification: unknown) => {
      const n = notification as { type?: string; data?: { message?: unknown } };
      if (n?.type !== 'NEW_MESSAGE') {
        return;
      }
      const rawMessage = n?.data?.message;
      if (typeof rawMessage !== 'string') {
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawMessage);
      } catch {
        return;
      }
      const data = parsed as Partial<PhotoSyncMessage>;
      if (data.type !== 'navigate_photo') {
        return;
      }
      if (
        typeof data.photoIndex !== 'number' ||
        !Number.isFinite(data.photoIndex) ||
        typeof data.photoId !== 'string'
      ) {
        return;
      }
      onMessage({
        type: 'navigate_photo',
        photoId: data.photoId,
        photoIndex: data.photoIndex,
        navigatorId: typeof data.navigatorId === 'string' ? data.navigatorId : '',
        timestamp: typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
      });
    });
    photoSyncUnsubscribe = typeof unsub === 'function' ? unsub : null;
  }

  function sendPhotoSyncFromRef(message: PhotoSyncMessage) {
    const actions = hmsActionsRef as { sendBroadcastMessage?: (payload: string, type: string) => Promise<void> } | null;
    if (!actions?.sendBroadcastMessage) {
      return;
    }
    actions.sendBroadcastMessage(JSON.stringify(message), 'PHOTO_SYNC').catch((err: unknown) => {
      console.error('[MeetupView] sendBroadcastMessage failed', err);
    });
  }

  async function initialise() {
    store.setError(null);
    localError.value = null;
    isLoading.value = true;

    try {
      await store.loadMeetup(meetupId.value);

      if (!store.hmsAuthToken || !store.currentUserId) {
        const userIdToUse = store.currentUserId || 'demo-user-1';
        const response = await getMeetupAuthToken(meetupId.value, userIdToUse);
        store.hmsAuthToken = response.token;
        store.currentUserName = response.userName;
        store.currentUserId = response.userId;
      }

      await store.startSession(meetupId.value);
      await store.loadPhotos();
      await store.loadCurrentSessionState(meetupId.value);
    } catch (error) {
      const message =
        (error as Error).message ||
        'Unable to load the meetup. Please try again.';
      localError.value = message;
      store.setError(message);
    } finally {
      isLoading.value = false;
    }
  }

  function handlePrebuiltReady(ref: HmsPrebuiltRef) {
    hmsActionsRef = ref.hmsActions;
    subscribeToPhotoSyncFromRef(ref, (message) => {
      store.setCurrentPhotoIndex(message.photoIndex);
    });
  }

  function handlePrebuiltLeave() {
    if (photoSyncUnsubscribe) {
      photoSyncUnsubscribe();
      photoSyncUnsubscribe = null;
    }
    hmsActionsRef = null;
    router.push('/');
  }

  async function handlePhotoSelected(index: number) {
    if (!store.photos.length) {
      return;
    }

    store.setCurrentPhotoIndex(index);

    const photo = store.photos[index];
    if (store.currentUserId) {
      sendPhotoSyncFromRef({
        type: 'navigate_photo',
        photoId: photo?.id || '',
        photoIndex: index,
        navigatorId: store.currentUserId,
        timestamp: Date.now(),
      });
    }

    const hasSessionContext = Boolean(
      store.sessionId && store.recordingStartTimestampMs && store.currentUserId,
    );
    if (
      !hasSessionContext ||
      !store.sessionId ||
      !store.recordingStartTimestampMs ||
      !store.currentUserId
    ) {
      return;
    }

    const timestampMs = Date.now() - store.recordingStartTimestampMs;
    try {
      await logPhotoEvent({
        meetupId: meetupId.value,
        sessionId: store.sessionId,
        photoId: photo?.id || '',
        photoIndex: index,
        timestampMs,
        navigatorUserId: store.currentUserId,
      });
    } catch {
      // Logging failures should not break the user flow.
    }
  }

  function handlePreviousPhoto() {
    if (!store.photos.length) return;
    const newIndex =
      store.currentPhotoIndex > 0 ? store.currentPhotoIndex - 1 : store.photos.length - 1;
    handlePhotoSelected(newIndex);
  }

  function handleNextPhoto() {
    if (!store.photos.length) return;
    const newIndex =
      store.currentPhotoIndex < store.photos.length - 1 ? store.currentPhotoIndex + 1 : 0;
    handlePhotoSelected(newIndex);
  }

  onMounted(() => {
    void initialise();
  });
</script>

<template>
  <div class="flex h-screen flex-col bg-slate-950 overflow-hidden">
    <!-- Photo section -->
    <div
      class="flex shrink-0 flex-col border-b border-slate-800 bg-slate-900 px-4 py-3"
    >
      <div class="flex items-center justify-between gap-2">
        <h1 class="text-sm font-semibold text-slate-100 truncate">
          {{ store.currentMeetup?.title || 'Family meetup' }}
        </h1>
        <span v-if="store.photos.length" class="text-xs text-slate-400 shrink-0">
          Photo {{ store.currentPhotoIndex + 1 }} of {{ store.photos.length }}
        </span>
      </div>

      <div
        v-if="isLoading"
        class="mt-2 flex min-h-24 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/80 text-sm text-slate-400"
      >
        Preparing meetup…
      </div>

      <div
        v-else-if="localError || store.errorMessage"
        class="mt-2"
      >
        <Message severity="error" class="text-xs">
          {{ localError || store.errorMessage }}
        </Message>
      </div>

      <div
        v-else-if="store.photos.length > 0"
        class="relative mt-2 overflow-hidden rounded-lg border border-slate-700 bg-slate-900"
      >
        <button
          type="button"
          class="absolute left-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-slate-800/90 text-white shadow transition-colors hover:bg-slate-700"
          aria-label="Previous photo"
          @click="handlePreviousPhoto"
        >
          <span class="fa-solid fa-chevron-left text-xs" />
        </button>

        <div class="flex h-32 items-center justify-center bg-black sm:h-40">
          <img
            v-if="store.photos[store.currentPhotoIndex]"
            :src="store.photos[store.currentPhotoIndex]?.url"
            :alt="store.photos[store.currentPhotoIndex]?.title"
            class="h-full w-full object-contain"
          />
        </div>

        <button
          type="button"
          class="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-slate-800/90 text-white shadow transition-colors hover:bg-slate-700"
          aria-label="Next photo"
          @click="handleNextPhoto"
        >
          <span class="fa-solid fa-chevron-right text-xs" />
        </button>

        <div class="flex gap-1 overflow-x-auto border-t border-slate-800 bg-slate-950/80 px-2 py-2">
          <button
            v-for="(photo, index) in store.photos"
            :key="photo.id"
            type="button"
            class="h-12 w-14 shrink-0 overflow-hidden rounded border transition-colors"
            :class="
              index === store.currentPhotoIndex
                ? 'border-green-500 bg-green-500/10'
                : 'border-slate-600 bg-slate-800 hover:border-slate-500'
            "
            @click="handlePhotoSelected(index)"
          >
            <img
              v-if="photo.url"
              :src="photo.url"
              :alt="photo.title || 'Photo ' + (index + 1)"
              class="h-full w-full object-cover"
            />
            <span v-else class="text-xs text-slate-300">{{ index + 1 }}</span>
          </button>
        </div>
      </div>

      <p v-else class="mt-2 text-xs text-slate-400">
        No photos in this album yet.
      </p>
    </div>

    <!-- 100ms Prebuilt: Pre-join screen, then video grid + camera/mic toggles -->
    <div class="relative min-h-0 flex-1">
      <template v-if="!isLoading && store.hmsAuthToken && store.currentUserName">
        <HmsPrebuiltEmbed
          :auth-token="store.hmsAuthToken"
          :user-name="store.currentUserName"
          :user-id="store.currentUserId ?? undefined"
          @leave="handlePrebuiltLeave"
          @ready="handlePrebuiltReady"
        />
      </template>
      <div
        v-else-if="!isLoading && !localError && !store.errorMessage"
        class="flex h-full min-h-48 items-center justify-center bg-slate-900 text-sm text-slate-400"
      >
        Waiting for session…
      </div>
    </div>
  </div>
</template>
