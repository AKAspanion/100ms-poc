<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import Button from 'primevue/button'
import Message from 'primevue/message'
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

const mockParticipants = [
  { id: 'you', label: 'You', isActive: true },
  { id: 'mom', label: 'Mom', isActive: false },
  { id: 'dad', label: 'Dad', isActive: false },
  { id: 'sister', label: 'Sister', isActive: false },
  { id: 'brother', label: 'Brother', isActive: false },
]

let unsubscribePhotoSync: (() => void) | null = null

async function initialiseMeetup() {
  store.setError(null)

  try {
    await store.loadMeetup(meetupId.value)
    await store.startSession(meetupId.value)
    await store.loadPhotos()
    await store.loadCurrentSessionState(meetupId.value)

    if (store.hmsAuthToken && store.currentUserName) {
      await joinMeetupRoom({
        authToken: store.hmsAuthToken,
        userName: store.currentUserName,
        virtualBackgroundMode: store.virtualBackgroundMode,
        virtualBackgroundImageUrl: store.virtualBackgroundImageUrl ?? undefined,
      })

      unsubscribePhotoSync = subscribeToPhotoSync((message) => {
        store.setCurrentPhotoIndex(message.photoIndex)
      })
    }
  } catch (error) {
    store.setError(
      (error as Error).message || 'Something went wrong while loading the meetup.',
    )
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
  void initialiseMeetup()
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
    <div class="flex items-center gap-3 overflow-x-auto pb-1">
      <Button
        v-for="participant in mockParticipants"
        :key="participant.id"
        outlined
        class="min-w-[130px] justify-start !border-slate-600 !bg-slate-900/80 text-left"
        :class="participant.isActive ? '!border-teal-400' : ''"
      >
        <div class="flex flex-col items-start">
          <span class="text-[11px] uppercase tracking-wide text-slate-400">
            Video Feed
          </span>
          <span class="text-xs font-semibold text-slate-50">
            {{ participant.label }}
          </span>
        </div>
      </Button>
    </div>

    <PhotoCarousel
      :photos="store.photos"
      :current-index="store.currentPhotoIndex"
      @photoSelected="handlePhotoSelected"
    />

    <Message
      v-if="store.errorMessage"
      severity="error"
      class="mt-1 text-xs"
    >
      {{ store.errorMessage }}
    </Message>
  </div>
</template>


