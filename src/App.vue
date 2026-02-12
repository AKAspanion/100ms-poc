<script setup lang="ts"></script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-50">
    <div class="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 lg:px-8">
      <header class="mb-6 flex items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div class="flex items-center gap-3">
          <div
            class="flex h-9 w-9 items-center justify-center rounded-xl bg-memrico-accent/10 text-memrico-accent"
          >
            <span class="text-lg font-semibold">M</span>
          </div>
          <div>
            <h1 class="text-base font-semibold tracking-tight sm:text-lg">
              Memrico Meetups
            </h1>
            <p class="text-xs text-slate-400 sm:text-sm">
              Collaborative family meetups around shared photos.
            </p>
          </div>
        </div>
      </header>

      <main class="flex-1">
        <RouterView />
      </main>
    </div>
  </div>
</template>

