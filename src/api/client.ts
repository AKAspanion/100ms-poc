import type {
  CurrentSessionState,
  MeetupAuthTokenResponse,
  MeetupDetail,
  MeetupSummaryResponse,
  Photo,
  PhotoClipsResponse,
  SessionStartResponse,
} from './types'

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:4000'

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`API ${path} failed with ${response.status}: ${text}`)
  }

  return (await response.json()) as T
}

// Public API – uses the lightweight Node backend

export async function getMeetup(meetupId: string): Promise<MeetupDetail> {
  return http<MeetupDetail>(`/meetups/${encodeURIComponent(meetupId)}`)
}

export async function getMeetupAuthToken(meetupId: string): Promise<MeetupAuthTokenResponse> {
  return http<MeetupAuthTokenResponse>(`/meetups/${encodeURIComponent(meetupId)}/auth-token`)
}

export async function getAlbumPhotos(albumId: string): Promise<Photo[]> {
  return http<Photo[]>(`/albums/${encodeURIComponent(albumId)}/photos`)
}

export async function startMeetupSession(meetupId: string): Promise<SessionStartResponse> {
  return http<SessionStartResponse>(`/meetups/${encodeURIComponent(meetupId)}/session`, {
    method: 'POST',
  })
}

export async function logPhotoEvent(params: {
  meetupId: string
  sessionId: string
  photoId: string
  photoIndex: number
  timestampMs: number
  navigatorUserId: string
}): Promise<void> {
  const { meetupId, sessionId, photoId, photoIndex, timestampMs, navigatorUserId } = params

  await http(`/meetups/${encodeURIComponent(meetupId)}/photo-events`, {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      photo_id: photoId,
      photo_index: photoIndex,
      timestamp_ms: timestampMs,
      navigator_user_id: navigatorUserId,
    }),
  })
}

export async function getCurrentSessionState(meetupId: string): Promise<CurrentSessionState | null> {
  try {
    return await http<CurrentSessionState>(`/meetups/${encodeURIComponent(meetupId)}/session/current`)
  } catch {
    // Endpoint is optional; treat errors as "no state"
    return null
  }
}

export async function getMeetupSummary(meetupId: string): Promise<MeetupSummaryResponse> {
  return http<MeetupSummaryResponse>(`/meetups/${encodeURIComponent(meetupId)}/summary`)
}

export async function getPhotoClips(photoId: string): Promise<PhotoClipsResponse> {
  return http<PhotoClipsResponse>(`/photos/${encodeURIComponent(photoId)}/meetup-clips`)
}

