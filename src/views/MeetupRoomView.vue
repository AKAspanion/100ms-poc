<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useMeetupStore } from '../stores/meetupStore'
import PhotoCarousel from '../components/PhotoCarousel.vue'
import { logPhotoEvent } from '../api/client'
import {
  joinMeetupRoom,
  leaveMeetupRoom,
  sendPhotoSyncMessage,
  subscribeToPhotoSync,
} from '../lib/hmsClient'

const route = useRoute()
const meetupId = computed(() => (route.params.meetupId as string) || 'demo-meetup')

const store = useMeetupStore()

const isInitializing = ref(true)
let unsubscribePhotoSync: (() => void) | null = null

const prebuiltUrl = computed(() => store.currentMeetup?.prebuiltUrl ?? '')

async function initialiseMeetup() {
  isInitializing.value = true
  store.setError(null)

  try {
    await store.loadMeetup(meetupId.value)
    await Promise.all([
      store.loadAuthToken(meetupId.value),
      store.startSession(meetupId.value),
    ])
    await store.loadPhotos()
    await store.loadCurrentSessionState(meetupId.value)

    if (store.hmsAuthToken && store.currentUserName) {
      await joinMeetupRoom({
        authToken: store.hmsAuthToken,
        userName: store.currentUserName,
      })

      unsubscribePhotoSync = subscribeToPhotoSync((message) => {
        store.setCurrentPhotoIndex(message.photoIndex)
      })
    }
  } catch (error) {
    store.setError(
      (error as Error).message || 'Something went wrong while loading the meetup.',
    )
  } finally {
    isInitializing.value = false
  }
}

async function handlePhotoSelected(index: number) {
  if (!store.photos.length) {
    return
  }

  store.setCurrentPhotoIndex(index)

  const photo = store.photos[index]
  const hasSessionContext = Boolean(
    store.sessionId && store.recordingStartTimestampMs && store.currentUserId,
  )

  if (store.currentUserId) {
    await sendPhotoSyncMessage({
      type: 'navigate_photo',
      photoId: photo.id,
      photoIndex: index,
      navigatorId: store.currentUserId,
      timestamp: Date.now(),
    })
  }

  if (
    !hasSessionContext ||
    !store.sessionId ||
    !store.recordingStartTimestampMs ||
    !store.currentUserId
  ) {
    return
  }

  const timestampMs = Date.now() - store.recordingStartTimestampMs

  try {
    await logPhotoEvent({
      meetupId: meetupId.value,
      sessionId: store.sessionId,
      photoId: photo.id,
      photoIndex: index,
      timestampMs,
      navigatorUserId: store.currentUserId,
    })
  } catch {
    // Logging failures should not break the user flow in the UI.
  }
}

onMounted(() => {
  initialiseMeetup()
})

onUnmounted(() => {
  if (unsubscribePhotoSync) {
    unsubscribePhotoSync()
  }

  void leaveMeetupRoom()
})
</script>

<template>
  <div class="flex flex-col gap-4 pb-8">
    <section class="space-y-1">
      <p class="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
        Meetup
      </p>
      <h2 class="text-lg font-semibold tracking-tight sm:text-xl">
        {{ store.currentMeetup?.title || 'Loading meetup…' }}
      </h2>
      <p
        v-if="store.currentMeetup"
        class="text-xs text-slate-400 sm:text-sm"
      >
        Album:
        <span class="font-medium text-slate-100">
          {{ store.currentMeetup.albumName }}
        </span>
      </p>
    </section>

    <section class="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
      <div
        class="border-b border-slate-800 px-4 py-2 text-xs text-slate-400 sm:px-5 sm:py-3"
      >
        <span class="font-medium text-slate-100">
          Live meetup room
        </span>
        <span class="mx-1 text-slate-600">
          •
        </span>
        <span>
          Powered by 100ms Prebuilt. Recording, chat, and summaries are handled by 100ms.
        </span>
      </div>

      <div class="bg-black">
        <div
          v-if="isInitializing"
          class="flex h-[50vh] items-center justify-center text-sm text-slate-400 sm:h-[60vh]"
        >
          Connecting to meetup…
        </div>

        <div
          v-else-if="prebuiltUrl"
          class="h-[50vh] w-full sm:h-[60vh]"
        >
          <iframe
            :src="prebuiltUrl"
            title="Memrico Meetup"
            allow="camera *; microphone *; display-capture *; autoplay; clipboard-write"
            class="h-full w-full border-0"
          />
        </div>

        <div
          v-else
          class="flex h-[50vh] items-center justify-center px-4 text-center text-sm text-slate-400 sm:h-[60vh]"
        >
          Prebuilt room URL is not configured. In a real environment this comes from the
          Memrico backend.
        </div>
      </div>
    </section>

    <PhotoCarousel
      :photos="store.photos"
      :current-index="store.currentPhotoIndex"
      @photoSelected="handlePhotoSelected"
    />

    <p
      v-if="store.errorMessage"
      class="mt-1 text-xs text-rose-400"
    >
      {{ store.errorMessage }}
    </p>
  </div>
</template>

