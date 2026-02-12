<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { useMeetupStore } from '../stores/meetupStore'
import { getMeetupAuthToken } from '../api/client'
import {
  startPreview,
  stopPreview,
  attachPreviewVideo,
  setLocalVideoEnabled,
  setLocalAudioEnabled,
  applyVirtualBackgroundToPreview,
  getHmsStore,
} from '../lib/hmsClient'
import {
  selectIsLocalVideoEnabled,
  selectIsLocalAudioEnabled,
  selectLocalVideoTrackID,
} from '@100mslive/hms-video-store'

const route = useRoute()
const router = useRouter()
const meetupId = computed(() => (route.params.meetupId as string) || 'demo-meetup')

const store = useMeetupStore()

const isLoading = ref(true)
const isPreviewLoading = ref(false)
const localErrorMessage = ref<string | null>(null)
const cameraOn = ref(store.preferredCameraOn ?? true)
const micOn = ref(store.preferredMicOn ?? true)
const videoElementRef = ref<HTMLVideoElement | null>(null)
const previewUnsubscribers = ref<Array<() => void>>([])

async function startHmsPreview() {
  if (!store.hmsAuthToken || !store.currentUserName) {
    return
  }

  if (isPreviewLoading.value) {
    return
  }

  isPreviewLoading.value = true
  localErrorMessage.value = null

  try {
    // Subscribe to video/audio state changes first
    const hmsStore = getHmsStore()
    if (hmsStore) {
      // Subscribe to video enabled state
      const unsubscribeVideo = hmsStore.subscribe(
        async (enabled: boolean) => {
          cameraOn.value = enabled
          // When video is enabled, ensure video track is attached
          if (enabled && videoElementRef.value) {
            // Wait a bit for track to be available
            setTimeout(async () => {
              try {
                await attachPreviewVideo(videoElementRef.value!)
              } catch (error) {
                // Track might not be ready yet, subscription to track ID will handle it
                // eslint-disable-next-line no-console
                console.warn('[PreJoinView] Failed to attach video after enabling:', error)
              }
            }, 300)
          }
        },
        selectIsLocalVideoEnabled,
      )

      // Subscribe to audio enabled state
      const unsubscribeAudio = hmsStore.subscribe(
        (enabled: boolean) => {
          micOn.value = enabled
        },
        selectIsLocalAudioEnabled,
      )

      previewUnsubscribers.value.push(unsubscribeVideo, unsubscribeAudio)

      // Subscribe to video track changes to re-attach if needed
      const unsubscribeTrack = hmsStore.subscribe(
        async (trackID: string | null) => {
          if (videoElementRef.value) {
            if (trackID) {
              // Track is available, attach it
              try {
                await attachPreviewVideo(videoElementRef.value)
              } catch (error) {
                // eslint-disable-next-line no-console
                console.error('[PreJoinView] Failed to attach video track:', error)
              }
            } else {
              // Track is null (video disabled), clear the video element
              videoElementRef.value.srcObject = null
            }
          }
        },
        selectLocalVideoTrackID,
      )

      previewUnsubscribers.value.push(unsubscribeTrack)
    }

    // Start preview
    await startPreview({
      authToken: store.hmsAuthToken,
      userName: store.currentUserName,
    })

    // Wait a moment for preview to initialize
    await new Promise((resolve) => setTimeout(resolve, 300))

    // Get initial state from HMS store after preview starts
    const initialVideoEnabled = hmsStore.getState(selectIsLocalVideoEnabled)
    const initialAudioEnabled = hmsStore.getState(selectIsLocalAudioEnabled)

    const preferredCameraOn = store.preferredCameraOn ?? true
    const preferredMicOn = store.preferredMicOn ?? true

    // Update local state to match HMS state or stored preference
    cameraOn.value = initialVideoEnabled ?? preferredCameraOn
    micOn.value = initialAudioEnabled ?? preferredMicOn

    // Persist preferences
    store.setPreferredCamera(cameraOn.value)
    store.setPreferredMic(micOn.value)

    // Apply desired initial media state to HMS
    await setLocalVideoEnabled(cameraOn.value)
    await setLocalAudioEnabled(micOn.value)

    // Wait for video element to be available and track to be ready
    // The subscription will handle attachment when track becomes available
    // But also try to attach immediately if element is ready
    if (videoElementRef.value) {
      // Wait a bit for preview to initialize and track to be available
      await new Promise((resolve) => setTimeout(resolve, 800))
      try {
        await attachPreviewVideo(videoElementRef.value)
      } catch (error) {
        // Track might not be ready yet, subscription will handle it
        // eslint-disable-next-line no-console
        console.warn('[PreJoinView] Initial video attach failed, will retry via subscription:', error)
      }
    }
  } catch (error) {
    cameraOn.value = false
    localErrorMessage.value =
      (error as Error).message ||
      'Unable to start video preview. Please check browser permissions and try again.'
  } finally {
    isPreviewLoading.value = false
  }
}

async function stopHmsPreview() {
  // Clean up subscriptions
  previewUnsubscribers.value.forEach((unsubscribe) => {
    unsubscribe()
  })
  previewUnsubscribers.value = []

  try {
    await stopPreview()
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[PreJoinView] Failed to stop preview', error)
  }

  if (videoElementRef.value) {
    videoElementRef.value.srcObject = null
  }
}

async function initialisePreJoin() {
  isLoading.value = true
  localErrorMessage.value = null
  store.setError(null)

  try {
    // Ensure meetup details are loaded.
    await store.loadMeetup(meetupId.value)

    // If we don't already have a token (e.g. user came via direct link),
    // fetch one now and populate the store.
    if (!store.hmsAuthToken || !store.currentUserId) {
      // Use userId from store if available, otherwise default to demo-user-1
      const userIdToUse = store.currentUserId || 'demo-user-1'
      const response = await getMeetupAuthToken(meetupId.value, userIdToUse)
      store.hmsAuthToken = response.token
      store.currentUserName = response.userName
      store.currentUserId = response.userId
    }

    // Start HMS preview after token is ready
    if (store.hmsAuthToken && store.currentUserName) {
      await startHmsPreview()
    }
  } catch (error) {
    const message =
      (error as Error).message ||
      'Unable to prepare the meetup. Please check your invite and try again.'
    localErrorMessage.value = message
  } finally {
    isLoading.value = false
  }
}

async function handleToggleCamera() {
  try {
    const currentState = cameraOn.value
    const nextState = !currentState
    
    // Optimistically update UI and store preference for better UX
    cameraOn.value = nextState
    store.setPreferredCamera(nextState)

    // Call HMS action to toggle video
    await setLocalVideoEnabled(nextState)
    
    // If turning off, clear video element immediately
    if (!nextState && videoElementRef.value) {
      videoElementRef.value.srcObject = null
    }
    
    // Note: State will be updated via subscription if HMS state differs
  } catch (error) {
    // Revert optimistic update on error
    cameraOn.value = currentState
    // eslint-disable-next-line no-console
    console.error('[PreJoinView] Failed to toggle camera:', error)
    localErrorMessage.value = 'Failed to toggle camera. Please try again.'
  }
}

async function handleToggleMic() {
  try {
    const currentState = micOn.value
    const nextState = !currentState
    
    // Optimistically update UI and store preference for better UX
    micOn.value = nextState
    store.setPreferredMic(nextState)

    // Call HMS action to toggle audio
    await setLocalAudioEnabled(nextState)
    
    // Note: State will be updated via subscription if HMS state differs
  } catch (error) {
    // Revert optimistic update on error
    micOn.value = currentState
    // eslint-disable-next-line no-console
    console.error('[PreJoinView] Failed to toggle mic:', error)
    localErrorMessage.value = 'Failed to toggle microphone. Please try again.'
  }
}

async function handleVirtualBackgroundChange(mode: 'none' | 'blur' | 'custom') {
  if (mode === 'custom') {
    // Static demo image served from the app; 100ms VB plugin
    // requires a same-origin or CORS-allowed image.
    const imageUrl = '/living-room.jpeg'
    store.setVirtualBackground('image', imageUrl)
    await applyVirtualBackgroundToPreview({ mode: 'image', imageUrl })
  } else if (mode === 'blur') {
    store.setVirtualBackground('blur')
    await applyVirtualBackgroundToPreview({ mode: 'blur' })
  } else {
    store.setVirtualBackground('none')
    await applyVirtualBackgroundToPreview({ mode: 'none' })
  }
}

function handleEnterMeetup() {
  if (!store.hmsAuthToken || !store.currentUserName) {
    localErrorMessage.value =
      'Video is not ready yet. Please refresh the page or try again in a moment.'
    return
  }

  router.push({
    name: 'meetup-room',
    params: { meetupId: meetupId.value },
  })
}

// Watch for video element to be available and attach preview
watch(videoElementRef, async (newVal) => {
  if (newVal && store.hmsAuthToken && store.currentUserName && !isPreviewLoading.value) {
    try {
      await attachPreviewVideo(newVal)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('[PreJoinView] Failed to attach video on element mount:', error)
    }
  }
})

onMounted(() => {
  void initialisePreJoin()
})

onUnmounted(() => {
  void stopHmsPreview()
})
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center py-10">
    <Card class="w-full max-w-3xl shadow-xl shadow-black/40">
      <template #title>
        <div class="flex flex-col gap-1">
          <span class="text-lg font-semibold tracking-tight sm:text-xl">
            {{ store.currentMeetup?.title || 'Family meetup' }}
          </span>
          <span class="text-xs font-medium text-slate-300">
            {{ store.currentMeetup?.albumName || 'Loading album...' }}
          </span>
        </div>
      </template>

      <template #content>
        <div v-if="isLoading || isPreviewLoading" class="py-8 text-center text-sm text-slate-300">
          {{ isLoading ? 'Preparing your meetup, please wait…' : 'Loading preview...' }}
        </div>

        <div v-else class="flex flex-col gap-6 lg:flex-row">
          <!-- Left: video preview (pure camera; VB handled by 100ms in room) -->
          <div class="flex-1">
            <div class="relative aspect-video overflow-hidden rounded-lg border border-slate-700 bg-black">
              <video
                ref="videoElementRef"
                autoplay
                playsinline
                muted
                class="h-full w-full object-cover"
              />

              <div
                v-if="!cameraOn"
                class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/80 text-slate-300"
              >
                <span class="pi pi-video text-xl" />
                <p class="text-xs">
                  Camera preview
                  <span class="font-semibold">
                    ({{ cameraOn ? 'On' : 'Off' }})
                  </span>
                </p>
              </div>
            </div>

            <div class="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
              <Button
                :label="cameraOn ? 'Camera On' : 'Camera Off'"
                icon="pi pi-video"
                class="justify-center"
                :severity="cameraOn ? 'success' : 'secondary'"
                @click="handleToggleCamera"
              />
              <Button
                :label="micOn ? 'Mic On' : 'Mic Off'"
                icon="pi pi-microphone"
                class="justify-center"
                :severity="micOn ? 'success' : 'secondary'"
                @click="handleToggleMic"
              />
              <div class="flex flex-col gap-1 sm:col-span-1">
                <span class="text-[11px] uppercase tracking-wide text-slate-400">
                  Virtual background
                </span>
                <div class="flex gap-2">
                  <Button
                    label="None"
                    size="small"
                    :severity="store.virtualBackgroundMode === 'none' ? 'success' : 'secondary'"
                    class="flex-1 justify-center"
                    @click="handleVirtualBackgroundChange('none')"
                  />
                  <Button
                    label="Blur"
                    size="small"
                    :severity="store.virtualBackgroundMode === 'blur' ? 'success' : 'secondary'"
                    class="flex-1 justify-center"
                    @click="handleVirtualBackgroundChange('blur')"
                  />
                  <Button
                    label="Custom"
                    size="small"
                    :severity="store.virtualBackgroundMode === 'image' ? 'success' : 'secondary'"
                    class="flex-1 justify-center"
                    @click="handleVirtualBackgroundChange('custom')"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Right: user info + join -->
          <div class="flex w-full flex-col gap-4 lg:w-80">
            <div class="rounded-lg bg-slate-900/70 p-4">
              <p class="text-[11px] uppercase tracking-wide text-slate-400">
                You are joining as
              </p>
              <p class="mt-1 text-sm font-semibold text-slate-50">
                {{ store.currentUserName || 'Guest user' }}
              </p>
            </div>

            <Button
              label="Join Meetup"
              icon="pi pi-sign-in"
              class="w-full justify-center"
              :disabled="Boolean(localErrorMessage) || isLoading"
              @click="handleEnterMeetup"
            />

            <Message
              v-if="localErrorMessage || store.errorMessage"
              severity="error"
              class="mt-1 text-xs"
            >
              {{ localErrorMessage || store.errorMessage }}
            </Message>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

