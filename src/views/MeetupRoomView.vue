<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Message from 'primevue/message'
import { useMeetupStore } from '../stores/meetupStore'
import { logPhotoEvent } from '../api/client'
import {
  joinMeetupRoom,
  leaveMeetupRoom,
  sendPhotoSyncMessage,
  subscribeToPhotoSync,
  getHmsStore,
  getHmsActions,
  setLocalVideoEnabled,
  setLocalAudioEnabled,
} from '../lib/hmsClient'
import {
  selectPeers,
  selectIsLocalVideoEnabled,
  selectIsLocalAudioEnabled,
} from '@100mslive/hms-video-store'
import type { HMSPeer } from '@100mslive/hms-video-store'

const route = useRoute()
const router = useRouter()
const meetupId = computed(() => (route.params.meetupId as string) || 'demo-meetup')

const store = useMeetupStore()

const participants = ref<Array<{ peer: HMSPeer; videoElementRef: HTMLVideoElement | null }>>([])
const videoElementRefs = ref<Map<string, HTMLVideoElement>>(new Map())
const cameraOn = ref(true)
const micOn = ref(true)

let unsubscribePhotoSync: (() => void) | null = null
let unsubscribePeers: (() => void) | null = null
let unsubscribeVideoState: (() => void) | null = null
let unsubscribeAudioState: (() => void) | null = null

async function attachPeerVideo(peer: HMSPeer, videoElement: HTMLVideoElement) {
  const hmsActions = getHmsActions()
  if (!hmsActions || !peer.videoTrack) {
    return
  }

  try {
    // Ensure video element has required attributes
    videoElement.autoplay = true
    videoElement.playsInline = true

    // Always mute participant video elements so browsers allow autoplay
    // without requiring an explicit user gesture for each media element.
    // If you later want to hear a specific participant, explicitly unmute
    // their video element in response to a user interaction.
    videoElement.muted = true

    // Attach video track. Use the track object directly, which
    // mirrors the working preview implementation and 100ms examples.
    await hmsActions.attachVideo(peer.videoTrack, videoElement)
    
    // Ensure video plays after attachment
    try {
      await videoElement.play()
    } catch (playError) {
      // eslint-disable-next-line no-console
      console.warn('[MeetupRoomView] Video play failed, but track is attached:', playError)
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[MeetupRoomView] Failed to attach video for peer:', peer.id, error)
  }
}

async function detachPeerVideo(peer: HMSPeer, videoElement: HTMLVideoElement) {
  const hmsActions = getHmsActions()
  if (!hmsActions || !peer.videoTrack) {
    return
  }

  try {
    // Detach using the track object for symmetry with attach
    await hmsActions.detachVideo(peer.videoTrack, videoElement)
    videoElement.srcObject = null
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[MeetupRoomView] Failed to detach video for peer:', peer.id, error)
  }
}

async function updateParticipants(peers: HMSPeer[]) {
  // Create a map of existing participants by peer ID to track changes
  const existingParticipantsMap = new Map(
    participants.value.map((p) => [p.peer.id, p]),
  )

  // Update participants list
  const newParticipants = peers.map((peer) => {
    const existing = existingParticipantsMap.get(peer.id)
    return {
      peer,
      videoElementRef: existing?.videoElementRef || videoElementRefs.value.get(peer.id) || null,
    }
  })

  participants.value = newParticipants

  // Handle video track attachments/detachments
  for (const { peer, videoElementRef } of newParticipants) {
    if (peer.videoTrack && videoElementRef) {
      // Check if video is already attached to avoid re-attaching
      const existingParticipant = existingParticipantsMap.get(peer.id)
      const trackChanged = !existingParticipant || existingParticipant.peer.videoTrack?.id !== peer.videoTrack.id
      
      if (trackChanged || !videoElementRef.srcObject) {
        await attachPeerVideo(peer, videoElementRef)
      }
    } else if (!peer.videoTrack && videoElementRef) {
      // Clear video element if track is removed
      videoElementRef.srcObject = null
    }
  }
}

function setupPeerSubscriptions() {
  const hmsStore = getHmsStore()
  if (!hmsStore) {
    return
  }

  // Subscribe to peer changes
  unsubscribePeers = hmsStore.subscribe(
    async (peers: HMSPeer[]) => {
      await updateParticipants(peers)
    },
    selectPeers,
  )

  // Subscribe to video enabled state
  unsubscribeVideoState = hmsStore.subscribe(
    (enabled: boolean) => {
      cameraOn.value = enabled
    },
    selectIsLocalVideoEnabled,
  )

  // Subscribe to audio enabled state
  unsubscribeAudioState = hmsStore.subscribe(
    (enabled: boolean) => {
      micOn.value = enabled
    },
    selectIsLocalAudioEnabled,
  )

  // Get initial state
  const initialVideoEnabled = hmsStore.getState(selectIsLocalVideoEnabled)
  const initialAudioEnabled = hmsStore.getState(selectIsLocalAudioEnabled)
  if (initialVideoEnabled !== undefined) {
    cameraOn.value = initialVideoEnabled
  }
  if (initialAudioEnabled !== undefined) {
    micOn.value = initialAudioEnabled
  }

  // Get initial peers
  const initialPeers = hmsStore.getState(selectPeers)
  if (initialPeers) {
    void updateParticipants(initialPeers)
  }
}

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

      // Wait a bit for room to join and peers to be available
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Apply user's preferred initial media state from pre-join
      const preferredCameraOn = store.preferredCameraOn ?? true
      const preferredMicOn = store.preferredMicOn ?? true

      cameraOn.value = preferredCameraOn
      micOn.value = preferredMicOn

      await Promise.all([
        setLocalVideoEnabled(preferredCameraOn),
        setLocalAudioEnabled(preferredMicOn),
      ])

      // Setup peer subscriptions
      setupPeerSubscriptions()

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

// Watch for video element refs to attach videos when elements become available
watch(
  () => participants.value,
  async (newParticipants) => {
    for (const { peer, videoElementRef } of newParticipants) {
      if (peer.videoTrack && videoElementRef) {
        await attachPeerVideo(peer, videoElementRef)
      }
    }
  },
  { deep: true },
)

function setVideoElementRef(peerId: string, element: HTMLVideoElement | null) {
  if (element) {
    videoElementRefs.value.set(peerId, element)
    
    // Find the peer and attach video if track is available
    const participant = participants.value.find((p) => p.peer.id === peerId)
    if (participant && participant.peer.videoTrack) {
      attachPeerVideo(participant.peer, element)
    }
  } else {
    videoElementRefs.value.delete(peerId)
  }
}

async function handleToggleCamera() {
  try {
    const currentState = cameraOn.value
    const nextState = !currentState
    
    // Optimistically update UI for better UX
    cameraOn.value = nextState
    
    // Call HMS action to toggle video
    await setLocalVideoEnabled(nextState)
  } catch (error) {
    // Revert optimistic update on error
    cameraOn.value = !cameraOn.value
    // eslint-disable-next-line no-console
    console.error('[MeetupRoomView] Failed to toggle camera:', error)
  }
}

async function handleToggleMic() {
  try {
    const currentState = micOn.value
    const nextState = !currentState
    
    // Optimistically update UI for better UX
    micOn.value = nextState
    
    // Call HMS action to toggle audio
    await setLocalAudioEnabled(nextState)
  } catch (error) {
    // Revert optimistic update on error
    micOn.value = !micOn.value
    // eslint-disable-next-line no-console
    console.error('[MeetupRoomView] Failed to toggle mic:', error)
  }
}

function handlePreviousPhoto() {
  if (!store.photos.length) {
    return
  }
  const newIndex = store.currentPhotoIndex > 0 
    ? store.currentPhotoIndex - 1 
    : store.photos.length - 1
  handlePhotoSelected(newIndex)
}

function handleNextPhoto() {
  if (!store.photos.length) {
    return
  }
  const newIndex = store.currentPhotoIndex < store.photos.length - 1 
    ? store.currentPhotoIndex + 1 
    : 0
  handlePhotoSelected(newIndex)
}

function handleChat() {
  // TODO: Implement chat functionality
  // eslint-disable-next-line no-console
  console.log('Chat clicked')
}

function handleScreenShare() {
  // TODO: Implement screen share functionality
  // eslint-disable-next-line no-console
  console.log('Screen share clicked')
}

async function handleEndCall() {
  await leaveMeetupRoom()
  // Navigate back to home
  router.push('/')
}

onMounted(() => {
  void initialiseMeetup()
})

onUnmounted(async () => {
  // Clean up peer subscriptions
  if (unsubscribePeers) {
    unsubscribePeers()
  }

  // Clean up video/audio state subscriptions
  if (unsubscribeVideoState) {
    unsubscribeVideoState()
  }
  if (unsubscribeAudioState) {
    unsubscribeAudioState()
  }

  // Detach all video tracks
  for (const { peer, videoElementRef } of participants.value) {
    if (videoElementRef && peer.videoTrack) {
      await detachPeerVideo(peer, videoElementRef)
    }
  }

  // Clean up photo sync subscription
  if (unsubscribePhotoSync) {
    unsubscribePhotoSync()
  }

  await leaveMeetupRoom()
})
</script>

<template>
  <div class="flex min-h-screen flex-col bg-slate-950">
    <!-- Top Section: Participants -->
    <div class="flex gap-2 overflow-x-auto border-b border-slate-800 bg-slate-900 px-3 py-3">
      <div
        v-for="participant in participants"
        :key="participant.peer.id"
        class="relative h-[60px] w-[80px] shrink-0 overflow-hidden rounded-lg border"
        :class="participant.peer.isLocal ? 'border-green-500' : 'border-slate-600'"
      >
        <div class="relative h-[60px] w-[80px] overflow-hidden bg-slate-800">
          <video
            :ref="(el) => setVideoElementRef(participant.peer.id, el as HTMLVideoElement)"
            autoplay
            playsinline
            muted
            class="h-full w-full object-cover"
          />

          <div
            v-if="!participant.peer.videoTrack"
            class="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-slate-800 text-slate-300"
          >
            <span class="pi pi-desktop text-xs" />
          </div>
        </div>

        <span
          class="absolute bottom-[3px] left-1 bg-black/70 px-[5px] py-[2px] rounded-[3px] text-[9px] text-slate-50"
        >
          {{ participant.peer.isLocal ? 'You' : (participant.peer.name || 'Participant') }}
        </span>
      </div>

      <div
        v-if="participants.length === 0"
        class="flex h-[60px] w-[80px] shrink-0 items-center justify-center rounded-lg border border-slate-600 bg-slate-800 p-2"
      >
        <span class="text-[10px] text-slate-400">No participants yet</span>
      </div>
    </div>

    <!-- Middle Section: Photo Display -->
    <div class="relative flex flex-1 flex-col items-center justify-center bg-slate-950 px-4 py-6">
      <div class="relative w-full max-w-2xl">
        <div
          v-if="!store.photos.length"
          class="flex min-h-[400px] items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-center"
        >
          <div class="space-y-2">
            <p class="text-lg font-semibold text-slate-300">PHOTO DISPLAY</p>
            <p class="text-sm text-slate-400">No photos available</p>
          </div>
        </div>

        <div
          v-else
          class="relative overflow-hidden rounded-lg border border-slate-700 bg-slate-900"
        >
          <!-- Previous Button -->
          <button
            class="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-slate-800/90 text-white shadow-lg transition-colors hover:bg-slate-700"
            @click="handlePreviousPhoto"
          >
            <span class="pi pi-chevron-left text-sm" />
          </button>

          <!-- Photo Display -->
          <div class="relative aspect-[4/3] w-full overflow-hidden bg-black">
            <img
              v-if="store.photos[store.currentPhotoIndex]"
              :src="store.photos[store.currentPhotoIndex].url"
              :alt="store.photos[store.currentPhotoIndex].title"
              class="h-full w-full object-contain"
            />
            <div
              v-else
              class="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-900 text-slate-300"
            >
              <p class="text-lg font-semibold">PHOTO DISPLAY</p>
              <p class="text-sm">{{ store.currentMeetup?.title || 'Family Reunion 2024' }}</p>
              <p class="text-xs text-slate-400">Swipe or tap arrows</p>
            </div>
          </div>

          <!-- Next Button -->
          <button
            class="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-slate-800/90 text-white shadow-lg transition-colors hover:bg-slate-700"
            @click="handleNextPhoto"
          >
            <span class="pi pi-chevron-right text-sm" />
          </button>
        </div>
      </div>
    </div>

    <!-- Bottom Section: Pagination and Actions -->
    <div class="border-t border-slate-800 bg-slate-900 px-4 py-4">
      <!-- Pagination Buttons -->
      <div
        v-if="store.photos.length > 0"
        class="mb-4 flex gap-2 overflow-x-auto pb-1"
      >
        <button
          v-for="(photo, index) in store.photos"
          :key="photo.id"
          class="flex h-8 min-w-[40px] shrink-0 items-center justify-center rounded-lg border text-sm font-medium transition-colors"
          :class="
            index === store.currentPhotoIndex
              ? 'border-green-500 bg-green-500/10 text-green-400'
              : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500'
          "
          @click="handlePhotoSelected(index)"
        >
          {{ index + 1 }}
        </button>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center justify-center gap-4">
        <!-- Chat Button -->
        <button
          class="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-300 transition-colors hover:bg-slate-700"
          @click="handleChat"
        >
          <span class="pi pi-comments text-lg" />
        </button>

        <!-- Microphone Button -->
        <button
          class="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-300 transition-colors hover:bg-slate-700"
          :class="micOn ? 'bg-green-500/20 text-green-400' : ''"
          @click="handleToggleMic"
        >
          <span
            :class="[
              'text-lg',
              micOn ? 'pi pi-microphone' : 'pi pi-volume-off',
            ]"
          />
        </button>

        <!-- Camera Button -->
        <button
          class="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-300 transition-colors hover:bg-slate-700"
          :class="cameraOn ? 'bg-green-500/20 text-green-400' : ''"
          @click="handleToggleCamera"
        >
          <span
            :class="[
              'text-lg',
              cameraOn ? 'pi pi-video' : 'pi pi-eye-slash',
            ]"
          />
        </button>

        <!-- End Call Button -->
        <button
          class="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white transition-colors hover:bg-red-700"
          @click="handleEndCall"
        >
          <span class="pi pi-times text-lg" />
        </button>
      </div>
    </div>

    <!-- Error Message -->
    <Message
      v-if="store.errorMessage"
      severity="error"
      class="mx-4 mb-4 text-xs"
    >
      {{ store.errorMessage }}
    </Message>
  </div>
</template>


