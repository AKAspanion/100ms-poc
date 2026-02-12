<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { getMeetupAuthToken } from '../api/client'

const router = useRouter()
const meetupIdInput = ref('demo-meetup')
const isJoining = ref(false)
const joinErrorMessage = ref<string | null>(null)

async function handleJoinMeetup() {
  const trimmed = meetupIdInput.value.trim()

  joinErrorMessage.value = null

  if (!trimmed) {
    return
  }

  isJoining.value = true

  try {
    // Verify the user is logged in and invited for this meetup.
    // This also pre-generates a 100ms JWT token on the backend.
    await getMeetupAuthToken(trimmed)

    router.push({ name: 'meetup', params: { meetupId: trimmed } })
  } catch (error) {
    const message =
      (error as Error).message ||
      'Unable to join this meetup. Please check your invite and try again.'
    joinErrorMessage.value = message
  } finally {
    isJoining.value = false
  }
}
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center py-10">
    <Card class="w-full max-w-xl shadow-xl shadow-black/40">
      <template #title>
        <span class="text-lg font-semibold tracking-tight sm:text-xl">
          Start a family meetup
        </span>
      </template>

      <template #subtitle>
        <span class="mt-1 text-sm text-slate-300">
          Enter a Meetup ID from Memrico, or use the demo meetup to explore the experience.
        </span>
      </template>

      <template #content>
        <form
          class="mt-6 flex flex-col gap-3 sm:flex-row"
          @submit.prevent="handleJoinMeetup"
        >
          <span class="p-input-icon-left w-full flex-1">
            <i class="pi pi-users text-slate-400" />
            <InputText
              v-model="meetupIdInput"
              name="meetupId"
              autocomplete="off"
              placeholder="e.g. demo-meetup"
              class="w-full text-sm"
            />
          </span>

          <Button
            type="submit"
            label="Join Meetup"
            icon="pi pi-video"
            class="w-full justify-center sm:w-auto"
            :loading="isJoining"
          />
        </form>

        <Message
          v-if="joinErrorMessage"
          severity="error"
          class="mt-3 text-xs"
        >
          {{ joinErrorMessage }}
        </Message>

        <p class="mt-4 text-xs text-slate-400">
          This POC uses mocked APIs when no backend URL is configured, so you can run it locally
          without extra setup.
        </p>
      </template>
    </Card>
  </div>
</template>

