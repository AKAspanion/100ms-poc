<script setup lang="ts">
  import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import Card from 'primevue/card';
  import Button from 'primevue/button';
  import Message from 'primevue/message';
  import { useMeetupStore } from '../stores/meetupStore';
  import { getMeetupAuthToken } from '../api/client';
  import {
    startPreview,
    stopPreview,
    attachPreviewVideo,
    setLocalVideoEnabled,
    setLocalAudioEnabled,
    applyVirtualBackgroundToPreview,
    getHmsStore,
  } from '../lib/hmsClient';
  import {
    selectIsLocalVideoEnabled,
    selectIsLocalAudioEnabled,
    selectLocalVideoTrackID,
  } from '@100mslive/hms-video-store';

  const route = useRoute();
  const router = useRouter();
  const meetupId = computed(() => (route.params.meetupId as string) || 'demo-meetup');

  const store = useMeetupStore();

  const isLoading = ref(true);
  const isPreviewLoading = ref(false);
  const localErrorMessage = ref<string | null>(null);
  const cameraOn = ref(store.preferredCameraOn ?? true);
  const micOn = ref(store.preferredMicOn ?? true);
  const videoElementRef = ref<HTMLVideoElement | null>(null);
  const previewUnsubscribers = ref<Array<() => void>>([]);

  async function startHmsPreview() {
    if (!store.hmsAuthToken || !store.currentUserName) {
      return;
    }

    if (isPreviewLoading.value) {
      return;
    }

    isPreviewLoading.value = true;
    localErrorMessage.value = null;

    try {
      // Subscribe to video/audio state changes first
      const hmsStore = getHmsStore();
      if (hmsStore) {
        // Subscribe to video enabled state
        const unsubscribeVideo = hmsStore.subscribe(async (enabled: boolean) => {
          cameraOn.value = enabled;
          // When video is enabled, ensure video track is attached
          if (enabled && videoElementRef.value) {
            // Wait a bit for track to be available
            setTimeout(async () => {
              try {
                await attachPreviewVideo(videoElementRef.value!);
              } catch (error) {
                // Track might not be ready yet, subscription to track ID will handle it
                 
                console.warn('[PreJoinView] Failed to attach video after enabling:', error);
              }
            }, 300);
          }
        }, selectIsLocalVideoEnabled);

        // Subscribe to audio enabled state
        const unsubscribeAudio = hmsStore.subscribe((enabled: boolean) => {
          micOn.value = enabled;
        }, selectIsLocalAudioEnabled);

        previewUnsubscribers.value.push(unsubscribeVideo, unsubscribeAudio);

        // Subscribe to video track changes to re-attach if needed
        // Note: selectLocalVideoTrackID returns string | undefined, but we need string | null
        const unsubscribeTrack = hmsStore.subscribe(async (trackID: string | undefined) => {
          if (videoElementRef.value) {
            // Convert undefined to null for consistency
            const trackId = trackID ?? null;
            if (trackId) {
              // Track is available, attach it
              try {
                await attachPreviewVideo(videoElementRef.value);
              } catch (error) {
                 
                console.error('[PreJoinView] Failed to attach video track:', error);
              }
            } else {
              // Track is null/undefined (video disabled), clear the video element
              videoElementRef.value.srcObject = null;
            }
          }
        }, selectLocalVideoTrackID);

        previewUnsubscribers.value.push(unsubscribeTrack);
      }

      // Start preview
      await startPreview({
        authToken: store.hmsAuthToken,
        userName: store.currentUserName,
      });

      // Wait a moment for preview to initialize
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Get initial state from HMS store after preview starts
      const initialVideoEnabled = hmsStore?.getState(selectIsLocalVideoEnabled);
      const initialAudioEnabled = hmsStore?.getState(selectIsLocalAudioEnabled);

      const preferredCameraOn = store.preferredCameraOn ?? true;
      const preferredMicOn = store.preferredMicOn ?? true;

      // Update local state to match HMS state or stored preference
      cameraOn.value = initialVideoEnabled ?? preferredCameraOn;
      micOn.value = initialAudioEnabled ?? preferredMicOn;

      // Persist preferences
      store.setPreferredCamera(cameraOn.value);
      store.setPreferredMic(micOn.value);

      // Apply desired initial media state to HMS
      await setLocalVideoEnabled(cameraOn.value);
      await setLocalAudioEnabled(micOn.value);

      // Wait for video element to be available and track to be ready
      // The subscription will handle attachment when track becomes available
      // But also try to attach immediately if element is ready
      if (videoElementRef.value) {
        // Wait a bit for preview to initialize and track to be available
        await new Promise((resolve) => setTimeout(resolve, 800));
        try {
          await attachPreviewVideo(videoElementRef.value);
        } catch (error) {
          // Track might not be ready yet, subscription will handle it
           
          console.warn(
            '[PreJoinView] Initial video attach failed, will retry via subscription:',
            error,
          );
        }
      }

      // Apply the initial virtual background based on the store setting
      // so that the preview matches the user's last choice (none / blur / image).
      const initialVirtualBackgroundMode = store.virtualBackgroundMode;
      const initialVirtualBackgroundImageUrl = store.virtualBackgroundImageUrl;

      if (initialVirtualBackgroundMode === 'blur') {
        await applyVirtualBackgroundToPreview({ mode: 'blur' });
      } else if (initialVirtualBackgroundMode === 'image' && initialVirtualBackgroundImageUrl) {
        await applyVirtualBackgroundToPreview({
          mode: 'image',
          imageUrl: initialVirtualBackgroundImageUrl,
        });
      } else {
        await applyVirtualBackgroundToPreview({ mode: 'none' });
      }
    } catch (error) {
      cameraOn.value = false;
      localErrorMessage.value =
        (error as Error).message ||
        'Unable to start video preview. Please check browser permissions and try again.';
    } finally {
      isPreviewLoading.value = false;
    }
  }

  async function stopHmsPreview() {
    // Clean up subscriptions
    previewUnsubscribers.value.forEach((unsubscribe) => {
      unsubscribe();
    });
    previewUnsubscribers.value = [];

    try {
      await stopPreview();
    } catch (error) {
       
      console.error('[PreJoinView] Failed to stop preview', error);
    }

    if (videoElementRef.value) {
      videoElementRef.value.srcObject = null;
    }
  }

  async function initialisePreJoin() {
    isLoading.value = true;
    localErrorMessage.value = null;
    store.setError(null);

    try {
      // Ensure meetup details are loaded.
      await store.loadMeetup(meetupId.value);

      // If we don't already have a token (e.g. user came via direct link),
      // fetch one now and populate the store.
      if (!store.hmsAuthToken || !store.currentUserId) {
        // Use userId from store if available, otherwise default to demo-user-1
        const userIdToUse = store.currentUserId || 'demo-user-1';
        const response = await getMeetupAuthToken(meetupId.value, userIdToUse);
        store.hmsAuthToken = response.token;
        store.currentUserName = response.userName;
        store.currentUserId = response.userId;
      }

      // Start HMS preview after token is ready
      if (store.hmsAuthToken && store.currentUserName) {
        await startHmsPreview();
      }
    } catch (error) {
      const message =
        (error as Error).message ||
        'Unable to prepare the meetup. Please check your invite and try again.';
      localErrorMessage.value = message;
    } finally {
      isLoading.value = false;
    }
  }

  async function handleToggleCamera() {
    const currentState = cameraOn.value;
    try {
      const nextState = !currentState;

      // Optimistically update UI and store preference for better UX
      cameraOn.value = nextState;
      store.setPreferredCamera(nextState);

      // Call HMS action to toggle video
      await setLocalVideoEnabled(nextState);

      // If turning off, clear video element immediately
      if (!nextState && videoElementRef.value) {
        videoElementRef.value.srcObject = null;
      }

      // Note: State will be updated via subscription if HMS state differs
    } catch (error) {
      // Revert optimistic update on error
      cameraOn.value = currentState;
       
      console.error('[PreJoinView] Failed to toggle camera:', error);
      localErrorMessage.value = 'Failed to toggle camera. Please try again.';
    }
  }

  async function handleToggleMic() {
    const currentState = micOn.value;
    try {
      const nextState = !currentState;

      // Optimistically update UI and store preference for better UX
      micOn.value = nextState;
      store.setPreferredMic(nextState);

      // Call HMS action to toggle audio
      await setLocalAudioEnabled(nextState);

      // Note: State will be updated via subscription if HMS state differs
    } catch (error) {
      // Revert optimistic update on error
      micOn.value = currentState;
       
      console.error('[PreJoinView] Failed to toggle mic:', error);
      localErrorMessage.value = 'Failed to toggle microphone. Please try again.';
    }
  }

  async function handleVirtualBackgroundChange(mode: 'none' | 'blur' | 'custom') {
    if (mode === 'custom') {
      // Static demo image served from the app; 100ms VB plugin
      // requires a same-origin or CORS-allowed image.
      const imageUrl = '/living-room.jpeg';
      store.setVirtualBackground('image', imageUrl);
      await applyVirtualBackgroundToPreview({ mode: 'image', imageUrl });
    } else if (mode === 'blur') {
      store.setVirtualBackground('blur');
      await applyVirtualBackgroundToPreview({ mode: 'blur' });
    } else {
      store.setVirtualBackground('none');
      await applyVirtualBackgroundToPreview({ mode: 'none' });
    }
  }

  function handleEnterMeetup() {
    if (!store.hmsAuthToken || !store.currentUserName) {
      localErrorMessage.value =
        'Video is not ready yet. Please refresh the page or try again in a moment.';
      return;
    }

    router.push({
      name: 'meetup-room',
      params: { meetupId: meetupId.value },
    });
  }

  // Watch for video element to be available and attach preview
  watch(videoElementRef, async (newVal) => {
    if (newVal && store.hmsAuthToken && store.currentUserName && !isPreviewLoading.value) {
      try {
        await attachPreviewVideo(newVal);
      } catch (error) {
         
        console.warn('[PreJoinView] Failed to attach video on element mount:', error);
      }
    }
  });

  onMounted(() => {
    void initialisePreJoin();
  });

  onUnmounted(() => {
    void stopHmsPreview();
  });
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center p-4 md:p-6">
    <Card class="w-full max-w-3xl shadow-xl shadow-surface-0/40 rounded-2xl!">
      <template #title>
        <div class="flex flex-col gap-1">
          <span class="text-lg font-semibold tracking-tight sm:text-xl">
            {{ store.currentMeetup?.title || 'Family meetup' }}
          </span>
          <span class="text-xs font-medium text-muted-color">
            {{ store.currentMeetup?.albumName || 'Loading album...' }}
          </span>
        </div>
      </template>

      <template #content>
        <div v-if="isLoading || isPreviewLoading" class="py-8 text-center text-sm text-muted-color">
          {{ isLoading ? 'Preparing your meetup, please wait…' : 'Loading preview...' }}
        </div>

        <div v-else class="flex flex-col gap-6 lg:flex-row">
          <!-- Left: video preview (pure camera; VB handled by 100ms in room) -->
          <div class="flex-1">
            <div
              class="relative aspect-video overflow-hidden rounded-lg border border-surface bg-surface-0"
            >
              <video
                ref="videoElementRef"
                autoplay
                playsinline
                muted
                class="h-full w-full object-cover"
              />

              <div
                v-if="!cameraOn"
                class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-50/80 text-color"
              >
                <span class="fa-solid fa-video text-xl" />
                <p class="text-xs">
                  Camera preview
                  <span class="font-semibold"> ({{ cameraOn ? 'On' : 'Off' }}) </span>
                </p>
              </div>
            </div>

            <div
              class="mt-4 flex flex-col gap-4 text-xs sm:flex-row sm:items-center sm:justify-between"
            >
              <div class="flex items-center gap-3">
                <Button
                rounded
                  :icon="cameraOn ? 'fa-solid fa-video' : 'fa-solid fa-video-slash'"
                  :severity="cameraOn ? 'success' : 'secondary'"
                  class="flex h-10 w-10 items-center justify-center rounded-full p-0!"
                  :aria-label="cameraOn ? 'Turn camera off' : 'Turn camera on'"
                  @click="handleToggleCamera"
                />
                <Button
                rounded
                  :icon="micOn ? 'fa-solid fa-microphone' : 'fa-solid fa-microphone-slash'"
                  :severity="micOn ? 'success' : 'secondary'"
                  class="flex h-10 w-10 items-center justify-center rounded-full p-0!"
                  :aria-label="micOn ? 'Turn microphone off' : 'Turn microphone on'"
                  @click="handleToggleMic"
                />
              </div>
              <div class="flex flex-1 flex-col gap-1 sm:items-end">
                <div class="flex w-full gap-2 sm:justify-end">
                  <Button
                  rounded
                    label="None"
                    size="small"
                    :severity="store.virtualBackgroundMode === 'none' ? 'success' : 'secondary'"
                    class="flex-1 justify-center sm:flex-none"
                    @click="handleVirtualBackgroundChange('none')"
                  />
                  <Button
                  rounded
                    label="Blur"
                    size="small"
                    :severity="store.virtualBackgroundMode === 'blur' ? 'success' : 'secondary'"
                    class="flex-1 justify-center sm:flex-none"
                    @click="handleVirtualBackgroundChange('blur')"
                  />
                  <Button
                  rounded
                    label="Custom"
                    size="small"
                    :severity="store.virtualBackgroundMode === 'image' ? 'success' : 'secondary'"
                    class="flex-1 justify-center sm:flex-none"
                    @click="handleVirtualBackgroundChange('custom')"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Right: user info + join -->
          <div class="flex w-full flex-col gap-4 lg:w-80">
            <div class="rounded-lg bg-surface-50/70 p-4">
              <p class="text-[11px] uppercase tracking-wide text-muted-color">You are joining as</p>
              <p class="mt-1 text-sm font-semibold text-color">
                {{ store.currentUserName || 'Guest user' }}
              </p>
            </div>

            <Button
            rounded
              label="Join"
              icon="fa-solid fa-right-to-bracket"
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
