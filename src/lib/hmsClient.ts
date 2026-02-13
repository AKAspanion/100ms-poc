import {
  HMSReactiveStore,
  selectIsLocalVideoPluginPresent,
  selectLocalVideoTrackID,
  selectLocalPeer,
} from '@100mslive/hms-video-store';
import { HMSVBPlugin, HMSVirtualBackgroundTypes } from '@100mslive/hms-virtual-background';

type VirtualBackgroundSupport =
  | {
      isSupported?: boolean;
      errMsg?: string;
    }
  | null
  | undefined;

// 100ms client-side helpers wired to HMSReactiveStore.
let hmsStoreInstance: HMSReactiveStore | null = null;
let hmsStore: ReturnType<HMSReactiveStore['getStore']> | null = null;
let hmsActions: ReturnType<HMSReactiveStore['getActions']> | null = null;
let hmsNotifications: ReturnType<HMSReactiveStore['getNotifications']> | null = null;
let virtualBackgroundPlugin: HMSVBPlugin | null = null;

function ensureHms() {
  if (!hmsStoreInstance) {
    hmsStoreInstance = new HMSReactiveStore();
    hmsStoreInstance.triggerOnSubscribe();
    hmsStore = hmsStoreInstance.getStore();
    hmsActions = hmsStoreInstance.getActions();
    hmsNotifications = hmsStoreInstance.getNotifications();
  }

  return hmsStoreInstance;
}

export interface PhotoSyncMessage {
  type: 'navigate_photo';
  photoId: string;
  photoIndex: number;
  navigatorId: string;
  timestamp: number;
}

export async function applyVirtualBackground(options: {
  mode?: 'none' | 'blur' | 'image';
  imageUrl?: string;
}): Promise<void> {
  if (!hmsActions || !hmsStore) {
    return;
  }

  const mode = options.mode ?? 'none';

  if (mode === 'none') {
    if (!virtualBackgroundPlugin) {
      return;
    }

    try {
      const isVirtualBackgroundEnabled = hmsStore.getState(
        selectIsLocalVideoPluginPresent(virtualBackgroundPlugin.getName()),
      );

      if (isVirtualBackgroundEnabled) {
        await hmsActions.removePluginFromVideoTrack(virtualBackgroundPlugin);
      }

      await virtualBackgroundPlugin.setBackground(
        HMSVirtualBackgroundTypes.NONE,
        HMSVirtualBackgroundTypes.NONE,
      );
    } catch (error) {
      console.error('[100ms] remove virtual background failed', error);
    }

    return;
  }

  if (!virtualBackgroundPlugin) {
    virtualBackgroundPlugin = new HMSVBPlugin(
      HMSVirtualBackgroundTypes.NONE,
      HMSVirtualBackgroundTypes.NONE,
    );
  }

  const support = virtualBackgroundPlugin.checkSupport() as VirtualBackgroundSupport;
  if (!support || support.errMsg) {
    console.warn('[100ms] virtual background not supported:', support?.errMsg);
    return;
  }

  try {
    if (mode === 'blur') {
      await virtualBackgroundPlugin.setBackground(
        HMSVirtualBackgroundTypes.BLUR,
        HMSVirtualBackgroundTypes.BLUR,
      );
    } else if (mode === 'image' && options.imageUrl) {
      const image = document.createElement('img');
      const isAbsoluteUrl = /^https?:\/\//i.test(options.imageUrl);

      // Only set crossOrigin for external URLs; same-origin public assets
      // (e.g. `/living-room.jpeg`) don't need it and some dev servers will
      // fail CORS if this is set.
      if (isAbsoluteUrl) {
        image.crossOrigin = 'anonymous';
      }

      image.src = options.imageUrl;
      await image.decode();
      await virtualBackgroundPlugin.setBackground(image, HMSVirtualBackgroundTypes.IMAGE);
    }

    const isVirtualBackgroundEnabled = hmsStore.getState(
      selectIsLocalVideoPluginPresent(virtualBackgroundPlugin.getName()),
    );

    if (!isVirtualBackgroundEnabled) {
      // Recommended value from 100ms docs.
      const pluginFrameRate = 15;
      await hmsActions.addPluginToVideoTrack(virtualBackgroundPlugin, pluginFrameRate);
    }
  } catch (error) {
    console.error('[100ms] virtual background failure', error);
  }
}

export async function joinMeetupRoom(params: {
  authToken: string;
  userName: string;
  virtualBackgroundMode?: 'none' | 'blur' | 'image';
  virtualBackgroundImageUrl?: string;
}): Promise<void> {
  const instance = ensureHms();
  if (!instance || !hmsActions) {
    return;
  }

  try {
    await hmsActions.join({
      authToken: params.authToken,
      userName: params.userName,
    });

    await applyVirtualBackground({
      mode: params.virtualBackgroundMode,
      imageUrl: params.virtualBackgroundImageUrl,
    });
  } catch (error) {
    console.error('[100ms] join failed', error);
  }
}

export async function leaveMeetupRoom(): Promise<void> {
  if (!hmsActions) {
    return;
  }

  try {
    await hmsActions.leave();
  } catch (error) {
    console.error('[100ms] leave failed', error);
  }
}

export async function sendPhotoSyncMessage(message: PhotoSyncMessage): Promise<void> {
  if (!hmsActions) {
    return;
  }

  try {
    await hmsActions.sendBroadcastMessage(JSON.stringify(message), 'PHOTO_SYNC');
  } catch (error) {
    console.error('[100ms] sendBroadcastMessage failed', error);
  }
}

export function subscribeToPhotoSync(
  handleMessage: (message: PhotoSyncMessage) => void,
): () => void {
  const instance = ensureHms();
  if (!instance || !hmsNotifications) {
    return () => {};
  }

  const unsubscribe = hmsNotifications.onNotification((notification) => {
    if (notification?.type !== 'NEW_MESSAGE') {
      return;
    }

    // Safely access data.message by checking structure
    const notificationData = notification as unknown as {
      type?: string;
      data?: {
        message?: unknown;
        [key: string]: unknown;
      };
    };

    const rawMessage = notificationData?.data?.message;
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

    handleMessage({
      type: 'navigate_photo',
      photoId: data.photoId,
      photoIndex: data.photoIndex,
      navigatorId: typeof data.navigatorId === 'string' ? data.navigatorId : '',
      timestamp: typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
    });
  });

  return typeof unsubscribe === 'function' ? unsubscribe : () => {};
}

export function getHmsStore() {
  ensureHms();
  return hmsStore;
}

export function getHmsActions() {
  ensureHms();
  return hmsActions;
}

export async function startPreview(params: { authToken: string; userName: string }): Promise<void> {
  const instance = ensureHms();
  if (!instance || !hmsActions) {
    return;
  }

  try {
    await hmsActions.preview({
      authToken: params.authToken,
      userName: params.userName,
    });
  } catch (error) {
    console.error('[100ms] preview failed', error);
    throw error;
  }
}

export async function stopPreview(): Promise<void> {
  if (!hmsActions) {
    return;
  }

  try {
    // Use leave() to stop preview, as there's no explicit stopPreview method
    await hmsActions.leave();
  } catch (error) {
    console.error('[100ms] stop preview failed', error);
  }
}

export async function attachPreviewVideo(
  videoElement: HTMLVideoElement,
  retries = 5,
): Promise<void> {
  if (!hmsStore || !hmsActions) {
    return;
  }

  // Ensure video element has required attributes
  videoElement.autoplay = true;
  videoElement.muted = true;
  videoElement.playsInline = true;

  for (let i = 0; i < retries; i++) {
    try {
      // Try to get video track from local peer first (more reliable)
      const localPeer = hmsStore.getState(selectLocalPeer);
      const videoTrack = localPeer?.videoTrack;

      // Fallback to track ID if peer object doesn't have track
      if (!videoTrack) {
        const videoTrackID = hmsStore.getState(selectLocalVideoTrackID);
        if (videoTrackID) {
          // Use track ID for attachment
          await hmsActions.attachVideo(videoTrackID, videoElement);

          // Ensure video plays after attachment
          try {
            await videoElement.play();
          } catch (playError) {
            console.warn('[100ms] Video play failed, but track is attached:', playError);
          }

          return;
        }
      } else {
        // Use track object directly (as shown in React example)
        await hmsActions.attachVideo(videoTrack, videoElement);

        // Ensure video plays after attachment
        try {
          await videoElement.play();
        } catch (playError) {
          console.warn('[100ms] Video play failed, but track is attached:', playError);
        }

        return;
      }

      // If track not available, wait a bit before retrying
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    } catch (error) {
      console.error('[100ms] attach preview video failed (attempt ' + (i + 1) + '):', error);
      if (i === retries - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  console.warn('[100ms] Video track not available after', retries, 'attempts');
}

export async function setLocalVideoEnabled(enabled: boolean): Promise<void> {
  if (!hmsActions) {
    console.warn('[100ms] HMS actions not available');
    return;
  }

  try {
    await hmsActions.setLocalVideoEnabled(enabled);
    // eslint-disable-next-line no-console
    console.log('[100ms] Video enabled set to:', enabled);
  } catch (error) {
    console.error('[100ms] set local video enabled failed', error);
    throw error; // Re-throw to let caller handle it
  }
}

export async function setLocalAudioEnabled(enabled: boolean): Promise<void> {
  if (!hmsActions) {
    console.warn('[100ms] HMS actions not available');
    return;
  }

  try {
    await hmsActions.setLocalAudioEnabled(enabled);
    // eslint-disable-next-line no-console
    console.log('[100ms] Audio enabled set to:', enabled);
  } catch (error) {
    console.error('[100ms] set local audio enabled failed', error);
    throw error; // Re-throw to let caller handle it
  }
}

export async function applyVirtualBackgroundToPreview(options: {
  mode?: 'none' | 'blur' | 'image';
  imageUrl?: string;
}): Promise<void> {
  if (!hmsActions || !hmsStore) {
    return;
  }

  const mode = options.mode ?? 'none';

  // Initialize plugin if needed
  if (!virtualBackgroundPlugin && mode !== 'none') {
    virtualBackgroundPlugin = new HMSVBPlugin(
      HMSVirtualBackgroundTypes.NONE,
      HMSVirtualBackgroundTypes.NONE,
    );

    const support = virtualBackgroundPlugin.checkSupport() as VirtualBackgroundSupport;
    if (!support || support.errMsg) {
      console.warn('[100ms] virtual background not supported:', support?.errMsg);
      return;
    }
  }

  if (mode === 'none') {
    if (!virtualBackgroundPlugin) {
      return;
    }

    try {
      const isVirtualBackgroundEnabled = hmsStore.getState(
        selectIsLocalVideoPluginPresent(virtualBackgroundPlugin.getName()),
      );

      if (isVirtualBackgroundEnabled) {
        await hmsActions.removePluginFromVideoTrack(virtualBackgroundPlugin);
      }

      await virtualBackgroundPlugin.setBackground(
        HMSVirtualBackgroundTypes.NONE,
        HMSVirtualBackgroundTypes.NONE,
      );
    } catch (error) {
      console.error('[100ms] remove virtual background failed', error);
    }

    return;
  }

  if (!virtualBackgroundPlugin) {
    return;
  }

  try {
    if (mode === 'blur') {
      await virtualBackgroundPlugin.setBackground(
        HMSVirtualBackgroundTypes.BLUR,
        HMSVirtualBackgroundTypes.BLUR,
      );
    } else if (mode === 'image' && options.imageUrl) {
      const image = document.createElement('img');
      const isAbsoluteUrl = /^https?:\/\//i.test(options.imageUrl);

      if (isAbsoluteUrl) {
        image.crossOrigin = 'anonymous';
      }

      image.src = options.imageUrl;
      await image.decode();
      await virtualBackgroundPlugin.setBackground(image, HMSVirtualBackgroundTypes.IMAGE);
    }

    const isVirtualBackgroundEnabled = hmsStore.getState(
      selectIsLocalVideoPluginPresent(virtualBackgroundPlugin.getName()),
    );

    if (!isVirtualBackgroundEnabled) {
      // Recommended value from 100ms docs.
      const pluginFrameRate = 15;
      await hmsActions.addPluginToVideoTrack(virtualBackgroundPlugin, pluginFrameRate);
    }
  } catch (error) {
    console.error('[100ms] virtual background failure', error);
  }
}
