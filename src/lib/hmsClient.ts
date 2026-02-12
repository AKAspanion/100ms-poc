import { HMSReactiveStore } from '@100mslive/hms-video-store'

// Toggle real 100ms SDK usage. When this flag is not set to "true",
// all functions in this file become safe no-ops so the POC can run
// without 100ms credentials or a working token.
const isHmsEnabled = import.meta.env.VITE_ENABLE_100MS_SDK === 'true'

let hmsStoreInstance: HMSReactiveStore | null = null
let hmsActions: ReturnType<HMSReactiveStore['getActions']> | null = null
let hmsNotifications: ReturnType<HMSReactiveStore['getNotifications']> | null = null

function ensureHms() {
  if (!isHmsEnabled) {
    return null
  }

  if (!hmsStoreInstance) {
    hmsStoreInstance = new HMSReactiveStore()
    hmsStoreInstance.triggerOnSubscribe()
    hmsActions = hmsStoreInstance.getActions()
    hmsNotifications = hmsStoreInstance.getNotifications()
  }

  return hmsStoreInstance
}

export interface PhotoSyncMessage {
  type: 'navigate_photo'
  photoId: string
  photoIndex: number
  navigatorId: string
  timestamp: number
}

export async function joinMeetupRoom(params: {
  authToken: string
  userName: string
}): Promise<void> {
  if (!isHmsEnabled) {
    return
  }

  const instance = ensureHms()
  if (!instance || !hmsActions) {
    return
  }

  try {
    await hmsActions.join({
      authToken: params.authToken,
      userName: params.userName,
    })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[100ms] join failed', error)
  }
}

export async function leaveMeetupRoom(): Promise<void> {
  if (!isHmsEnabled || !hmsActions) {
    return
  }

  try {
    await hmsActions.leave()
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[100ms] leave failed', error)
  }
}

export async function sendPhotoSyncMessage(message: PhotoSyncMessage): Promise<void> {
  if (!isHmsEnabled || !hmsActions) {
    return
  }

  try {
    await hmsActions.sendBroadcastMessage(JSON.stringify(message), 'PHOTO_SYNC')
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[100ms] sendBroadcastMessage failed', error)
  }
}

export function subscribeToPhotoSync(
  handleMessage: (message: PhotoSyncMessage) => void,
): () => void {
  if (!isHmsEnabled) {
    // No-op unsubscribe
    return () => {}
  }

  const instance = ensureHms()
  if (!instance || !hmsNotifications) {
    return () => {}
  }

  const unsubscribe = hmsNotifications.onNotification((notification: any) => {
    if (notification?.type !== 'NEW_MESSAGE') {
      return
    }

    const rawMessage = notification?.data?.message
    if (typeof rawMessage !== 'string') {
      return
    }

    let parsed: unknown

    try {
      parsed = JSON.parse(rawMessage)
    } catch {
      return
    }

    const data = parsed as Partial<PhotoSyncMessage>

    if (data.type !== 'navigate_photo') {
      return
    }

    if (
      typeof data.photoIndex !== 'number' ||
      !Number.isFinite(data.photoIndex) ||
      typeof data.photoId !== 'string'
    ) {
      return
    }

    handleMessage({
      type: 'navigate_photo',
      photoId: data.photoId,
      photoIndex: data.photoIndex,
      navigatorId: typeof data.navigatorId === 'string' ? data.navigatorId : '',
      timestamp: typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
    })
  })

  return typeof unsubscribe === 'function' ? unsubscribe : () => {}
}

