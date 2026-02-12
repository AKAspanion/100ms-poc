<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

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
    <div
      class="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl shadow-black/40"
    >
      <h2 class="text-lg font-semibold tracking-tight sm:text-xl">
        Start a family meetup
      </h2>
      <p class="mt-1 text-sm text-slate-400">
        Enter a Meetup ID from Memrico, or use the demo meetup to explore the experience.
      </p>

      <form
        class="mt-6 flex flex-col gap-3 sm:flex-row"
        @submit.prevent="handleJoinMeetup"
      >
        <input
          v-model="meetupIdInput"
          type="text"
          name="meetupId"
          autocomplete="off"
          placeholder="e.g. demo-meetup"
          class="w-full flex-1 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none ring-0 transition focus:border-memrico-accent focus:ring-2 focus:ring-memrico-accent/40"
        />
        <button
          type="submit"
          class="inline-flex items-center justify-center rounded-xl bg-memrico-accent px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:ring-memrico-accent"
        >
          Join Meetup
        </button>
      </form>

      <div class="mt-4 text-xs text-slate-500">
        This POC uses mocked APIs when no backend URL is configured, so you can run it locally
        without extra setup.
      </div>
    </div>
  </div>
</template>

