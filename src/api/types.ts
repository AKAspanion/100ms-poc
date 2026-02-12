export interface MeetupDetail {
  id: string
  title: string
  albumId: string
  albumName: string
  recordedAt: string | null
  durationSeconds: number | null
  photoCount: number
}

export interface MeetupAuthTokenResponse {
  token: string
  userName: string
  userId: string
  userType: 'host' | 'guest'
  role: string
}

export interface Photo {
  id: string
  albumId: string
  url: string
  thumbnailUrl: string
  title: string
  index: number
}

export interface SessionStartResponse {
  sessionId: string
  recordingStartTimestampMs: number | null
}

export interface CurrentSessionState {
  currentPhotoIndex: number
}

export interface MeetupSummaryResponse {
  meetup_id: string
  title: string
  recorded_at: string
  duration_seconds: number
  participants: string[]
  photo_count: number
  summary: {
    short_summary: string
    key_points: string[]
    action_items: string[]
  }
}

export interface PhotoClipTranscriptSentence {
  speaker: string
  text: string
}

export interface PhotoClip {
  meetup_id: string
  meetup_title: string
  clip_url: string
  thumbnail_url: string
  duration_seconds: number
  transcript: {
    sentences: PhotoClipTranscriptSentence[]
  }
  participants: string[]
  recorded_at: string
}

export interface PhotoClipsResponse {
  photo_id: string
  clips: PhotoClip[]
}

