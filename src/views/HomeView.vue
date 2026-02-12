<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'

const router = useRouter()
const meetupIdInput = ref('demo-meetup')

function handleJoinMeetup() {
  const trimmed = meetupIdInput.value.trim()

  if (!trimmed) {
    return
  }

  router.push({ name: 'meetup', params: { meetupId: trimmed } })
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
          />
        </form>

        <p class="mt-4 text-xs text-slate-400">
          This POC uses mocked APIs when no backend URL is configured, so you can run it locally
          without extra setup.
        </p>
      </template>
    </Card>
  </div>
</template>

