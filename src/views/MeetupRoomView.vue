<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import Message from 'primevue/message'
import Button from 'primevue/button'
import { useMeetupStore } from '../stores/meetupStore'
import PhotoCarousel from '../components/PhotoCarousel.vue'
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
  <div class="flex flex-col gap-4 pb-8">
    <div class="flex items-center gap-3 overflow-x-auto pb-1">
      <div
        v-for="participant in participants"
        :key="participant.peer.id"
        class="relative min-w-[130px] overflow-hidden rounded-lg border border-slate-600 bg-slate-900/80"
        :class="participant.peer.isLocal ? '!border-teal-400' : ''"
      >
        <!-- Controls above video preview for local participant -->
        <div
          v-if="participant.peer.isLocal"
          class="flex gap-2 border-b border-slate-600 bg-slate-800/50 p-2"
        >
          <Button
            :label="cameraOn ? 'Camera On' : 'Camera Off'"
            icon="pi pi-video"
            size="small"
            :severity="cameraOn ? 'success' : 'secondary'"
            class="flex-1 justify-center text-xs"
            @click="handleToggleCamera"
          />
          <Button
            :label="micOn ? 'Mic On' : 'Mic Off'"
            icon="pi pi-microphone"
            size="small"
            :severity="micOn ? 'success' : 'secondary'"
            class="flex-1 justify-center text-xs"
            @click="handleToggleMic"
          />
        </div>

        <div class="relative aspect-video w-full overflow-hidden bg-black">
          <video
            :ref="(el) => setVideoElementRef(participant.peer.id, el as HTMLVideoElement)"
            autoplay
            playsinline
            muted
            class="h-full w-full object-cover"
          />

          <div
            v-if="!participant.peer.videoTrack"
            class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/80 text-slate-300"
          >
            <span class="pi pi-video text-xl" />
            <p class="text-xs">Camera Off</p>
          </div>
        </div>

        <div class="p-2">
          <span class="text-[11px] uppercase tracking-wide text-slate-400">
            {{ participant.peer.isLocal ? 'You' : 'Video Feed' }}
          </span>
          <p class="text-xs font-semibold text-slate-50">
            {{ participant.peer.name || (participant.peer.isLocal ? 'You' : 'Participant') }}
          </p>
        </div>
      </div>

      <div
        v-if="participants.length === 0"
        class="flex min-w-[130px] items-center justify-center rounded-lg border border-slate-600 bg-slate-900/80 p-4"
      >
        <span class="text-xs text-slate-400">No participants yet</span>
      </div>
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


