<script setup lang="ts">
  import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
  import { getHmsStore, getHmsActions } from '../lib/hmsClient';
  import { selectHMSMessages, selectLocalPeer } from '@100mslive/hms-video-store';
  import type { HMSMessage } from '@100mslive/hms-video-store';
  import Button from 'primevue/button';
  import InputText from 'primevue/inputtext';

  const props = defineProps<{
    isOpen: boolean;
  }>();

  const emit = defineEmits<{
    (_event: 'close'): void;
  }>();

  const messages = ref<HMSMessage[]>([]);
  const messageInput = ref('');
  const messagesContainerRef = ref<HTMLElement | null>(null);
  const isRoomJoined = ref(false);
  let unsubscribeMessages: (() => void) | null = null;
  let unsubscribeLocalPeer: (() => void) | null = null;

  const chatMessages = computed(() => {
    // Filter out PHOTO_SYNC messages and only show chat messages
    // The message.type field already indicates if it's PHOTO_SYNC or chat
    return messages.value.filter((msg) => {
      // Filter out PHOTO_SYNC messages - only show chat type messages
      return msg.type === 'chat';
    });
  });

  function scrollToBottom() {
    if (messagesContainerRef.value) {
      messagesContainerRef.value.scrollTop = messagesContainerRef.value.scrollHeight;
    }
  }

  function loadMessages() {
    // Only load messages if room is joined
    if (!isRoomJoined.value) {
      return;
    }

    const hmsStore = getHmsStore();
    if (!hmsStore) {
      return;
    }

    // Get current messages from store
    // selectHMSMessages returns ALL messages (broadcast, direct, group)
    // We'll filter for chat type messages in the computed property
    const currentMessages = hmsStore.getState(selectHMSMessages);

    // Handle both array and undefined/null cases
    if (Array.isArray(currentMessages)) {
      messages.value = currentMessages;
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    } else {
      // Initialize with empty array if no messages
      messages.value = [];
    }
  }

  function setupRoomJoinDetection() {
    const hmsStore = getHmsStore();
    if (!hmsStore) {
      // Retry if store is not ready yet
      setTimeout(() => {
        setupRoomJoinDetection();
      }, 500);
      return;
    }

    // Subscribe to local peer changes to detect when room is joined
    unsubscribeLocalPeer = hmsStore.subscribe((localPeer) => {
      const wasJoined = isRoomJoined.value;
      isRoomJoined.value = Boolean(localPeer);

      // If room just joined, set up message subscription and load messages
      if (!wasJoined && isRoomJoined.value) {
        setupMessageSubscription();
        // Load messages after a short delay to ensure store is ready
        setTimeout(() => {
          loadMessages();
        }, 500);
      }
    }, selectLocalPeer);

    // Check initial state
    const initialLocalPeer = hmsStore.getState(selectLocalPeer);
    if (initialLocalPeer) {
      isRoomJoined.value = true;
      // Set up subscription immediately
      setupMessageSubscription();
    }
  }

  function setupMessageSubscription() {
    // Only set up subscription if room is joined
    if (!isRoomJoined.value) {
      return;
    }

    const hmsStore = getHmsStore();
    if (!hmsStore) {
      return;
    }

    // Unsubscribe from previous subscription if it exists
    if (unsubscribeMessages) {
      unsubscribeMessages();
      unsubscribeMessages = null;
    }

    // Subscribe to message changes - this will keep messages updated even when chat is closed
    unsubscribeMessages = hmsStore.subscribe((msgs: HMSMessage[]) => {
      if (Array.isArray(msgs)) {
        messages.value = msgs;
        // Only scroll if chat is open
        if (props.isOpen) {
          setTimeout(() => {
            scrollToBottom();
          }, 100);
        }
      } else {
        // Ensure we have an array even if selector returns undefined/null
        messages.value = [];
      }
    }, selectHMSMessages);

    // Load messages immediately after subscription is set up
    loadMessages();

    // Also retry loading after a delay to catch any messages that arrive
    setTimeout(() => {
      loadMessages();
    }, 1000);
  }

  async function handleSendMessage() {
    const messageText = messageInput.value.trim();
    if (!messageText) {
      return;
    }

    const hmsActions = getHmsActions();
    if (!hmsActions) {
      console.error('[ChatComponent] HMS actions not available');
      return;
    }

    try {
      // Send as broadcast message (to everyone in the room)
      await hmsActions.sendBroadcastMessage(messageText);
      messageInput.value = '';
    } catch (error) {
      console.error('[ChatComponent] Failed to send message:', error);
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  }

  function formatTime(timestamp: Date | number | string | undefined): string {
    if (!timestamp) {
      return '';
    }

    const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
    if (isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  function getSenderName(message: HMSMessage): string {
    if (message.senderName) {
      return message.senderName;
    }

    const hmsStore = getHmsStore();
    if (!hmsStore) {
      return 'Unknown';
    }

    const localPeer = hmsStore.getState(selectLocalPeer);
    if (localPeer && message.sender === localPeer.id) {
      return 'You';
    }

    return message.sender || 'Unknown';
  }

  function isLocalMessage(message: HMSMessage): boolean {
    const hmsStore = getHmsStore();
    if (!hmsStore) {
      return false;
    }

    const localPeer = hmsStore.getState(selectLocalPeer);
    return localPeer ? message.sender === localPeer.id : false;
  }

  // Load messages and scroll to bottom when chat opens
  watch(
    () => props.isOpen,
    (isOpen) => {
      if (isOpen && isRoomJoined.value) {
        // Ensure subscription is set up
        setupMessageSubscription();

        // Load messages immediately
        loadMessages();

        // Retry loading messages a few times to ensure we get all messages
        let retryCount = 0;
        const maxRetries = 3;
        const retryInterval = setInterval(() => {
          loadMessages();
          retryCount++;
          if (retryCount >= maxRetries) {
            clearInterval(retryInterval);
          }
        }, 300);

        setTimeout(() => {
          scrollToBottom();
        }, 200);
      }
    },
  );

  // Watch for room join completion
  watch(
    () => isRoomJoined.value,
    (joined) => {
      if (joined && props.isOpen) {
        // Room just joined and chat is open, set up subscription and load messages
        setupMessageSubscription();
        setTimeout(() => {
          loadMessages();
        }, 300);
      }
    },
  );

  onMounted(() => {
    // Set up room join detection first
    setupRoomJoinDetection();
  });

  onUnmounted(() => {
    if (unsubscribeMessages) {
      unsubscribeMessages();
      unsubscribeMessages = null;
    }
    if (unsubscribeLocalPeer) {
      unsubscribeLocalPeer();
      unsubscribeLocalPeer = null;
    }
  });
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed bottom-20 left-4 z-50 flex h-96 w-80 max-w-[calc(100vw-2rem)] flex-col rounded-xl border border-surface-100 bg-surface-0 shadow-xl overflow-hidden"
  >
    <!-- Chat Header -->
    <div
      class="flex items-center justify-between border-b border-surface-50 bg-surface-50 px-4 py-3"
    >
      <h3 class="text-sm font-semibold text-color">Chat</h3>
      <Button
        rounded
        icon="fa-solid fa-xmark"
        class="flex h-6 w-6 items-center justify-center rounded-full bg-surface-100 text-color transition-colors hover:bg-surface-200 p-0!"
        @click="emit('close')"
      />
    </div>

    <!-- Messages Container -->
    <div ref="messagesContainerRef" class="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-3">
      <div
        v-if="chatMessages.length === 0"
        class="flex flex-1 items-center justify-center text-sm text-muted-color"
      >
        No messages yet. Start the conversation!
      </div>

      <div
        v-for="message in chatMessages"
        :key="message.id"
        class="flex flex-col gap-1"
        :class="isLocalMessage(message) ? 'items-end' : 'items-start'"
      >
        <div
          class="max-w-[80%] rounded-lg px-3 py-2"
          :class="
            isLocalMessage(message) ? 'bg-primary text-surface-0' : 'bg-surface-100 text-color'
          "
        >
          <div v-if="!isLocalMessage(message)" class="mb-1 text-xs font-semibold">
            {{ getSenderName(message) }}
          </div>
          <div class="text-sm">{{ message.message }}</div>
          <div
            class="mt-1 text-[10px] opacity-70"
            :class="isLocalMessage(message) ? 'text-surface-0' : 'text-muted-color'"
          >
            {{ formatTime(message.time) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Message Input -->
    <div class="border-t border-surface-50 bg-surface-50 p-3">
      <div class="flex gap-2">
        <InputText
          v-model="messageInput"
          placeholder="Type a message..."
          class="flex-1"
          @keydown="handleKeyDown"
        />
        <Button
          rounded
          icon="fa-solid fa-paper-plane"
          class="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-surface-0 transition-colors hover:bg-primary/90 p-0!"
          :disabled="!messageInput.trim()"
          @click="handleSendMessage"
        />
      </div>
    </div>
  </div>
</template>
