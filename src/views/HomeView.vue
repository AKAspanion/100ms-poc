<script setup lang="ts">
  import { ref } from 'vue';
  import { useRouter } from 'vue-router';
  import Card from 'primevue/card';
  import InputText from 'primevue/inputtext';
  import Button from 'primevue/button';
  import Message from 'primevue/message';
  import Dropdown from 'primevue/dropdown';
  import { getMeetupAuthToken } from '../api/client';
  import { useMeetupStore } from '../stores/meetupStore';

  const router = useRouter();
  const meetupIdInput = ref('demo-meetup');
  const selectedUserId = ref('demo-user-1');
  const isJoining = ref(false);
  const joinErrorMessage = ref<string | null>(null);
  const meetupStore = useMeetupStore();

  const userOptions = [
    { label: 'you (Host)', value: 'demo-user-1' },
    { label: 'mom (Guest)', value: 'demo-user-2' },
    { label: 'dad (Guest)', value: 'demo-user-3' },
    { label: 'sister (Guest)', value: 'demo-user-4' },
    { label: 'brother (Guest)', value: 'demo-user-5' },
  ];

  async function handleJoinMeetup() {
    const trimmed = meetupIdInput.value.trim();

    joinErrorMessage.value = null;

    if (!trimmed) {
      return;
    }

    if (!selectedUserId.value) {
      joinErrorMessage.value = 'Please select a user';
      return;
    }

    isJoining.value = true;

    try {
      // Verify the user is logged in and invited for this meetup, and get a 100ms JWT.
      const response = await getMeetupAuthToken(trimmed, selectedUserId.value);

      meetupStore.hmsAuthToken = response.token;
      meetupStore.currentUserName = response.userName;
      meetupStore.currentUserId = response.userId;

      router.push({ name: 'meetup', params: { meetupId: trimmed } });
    } catch (error) {
      const message =
        (error as Error).message ||
        'Unable to join this meetup. Please check your invite and try again.';
      joinErrorMessage.value = message;
    } finally {
      isJoining.value = false;
    }
  }
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center px-4 py-6">
    <Card class="w-full max-w-xl shadow-xl shadow-black/40">
      <template #title>
        <span class="text-lg font-semibold tracking-tight sm:text-xl"> Start a family meetup </span>
      </template>

      <template #subtitle>
        <span class="mt-1 text-sm text-slate-300">
          Enter a Meetup ID from Memrico, or use the demo meetup to explore the experience.
        </span>
      </template>

      <template #content>
        <div class="flex flex-col gap-3">
          <div class="flex flex-col gap-2">
            <label class="text-xs font-medium text-slate-300">Select User</label>
            <Dropdown
              v-model="selectedUserId"
              :options="userOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Select a user"
              class="w-full"
            />
          </div>

          <form class="flex flex-col gap-3 sm:flex-row" @submit.prevent="handleJoinMeetup">
            <span class="p-input-icon-left w-full flex-1">
              <i class="fa-solid fa-users text-slate-400" />
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
              icon="fa-solid fa-video"
              class="w-full justify-center sm:w-auto"
              :loading="isJoining"
            />
          </form>
        </div>

        <Message v-if="joinErrorMessage" severity="error" class="mt-3 text-xs">
          {{ joinErrorMessage }}
        </Message>

        <p class="mt-4 text-xs text-slate-400">This is a POC. It's not production ready.</p>
      </template>
    </Card>
  </div>
</template>
