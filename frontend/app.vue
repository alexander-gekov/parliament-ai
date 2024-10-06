<script setup lang="ts">
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {storeToRefs} from 'pinia'
import { useCurrentChatStore } from './stores/chatStore';

const chatStore = useCurrentChatStore();
const { setConversation } = chatStore;
const { id: conversationId, messages } = storeToRefs(chatStore);

const query = ref("");
const isLoading = ref(false);

const INITIAL_MESSAGES = [
  {
    role: 'user',
    content: "Какви решения бяха взети свързани с образованието?"
  },
  {
    role: 'user',
    content: "Какви са основните политики и инициативи на партия ДПС?"
  },
  {
    role: 'user',
    content: "Какви решения са взети/дискутирани относно приемането на еврото?"
  },
  {
    role: 'user',
    content: "Кой е председател на парламента? Коя е Рая Назарян?"
  },
]

const initiateSearch = (message: string) => {
  query.value = message;
  handleSubmit();
};

const handleSubmit = async () => {
  // try {
  //   window.scrollTo({
  //     top: document.body.scrollHeight,
  //     behavior: "smooth",
  //   });
  //   if (conversationId.value !== "") {
  //     setConversation(conversationId.value, [
  //       ...messages.value,
  //       query.value,
  //     ]);
  //   }
  //   const aiResponse = await $fetch("/api/chat", {
  //     method: "POST",
  //     headers: {
  //       "Content-Type": "application/json",
  //     },
  //     body: JSON.stringify({
  //       query: query.value,
  //       conversationId: conversationId.value,
  //     }),
  //   });
    
  //   query.value = "";
  // } catch (error) {
  //   console.error("Error fetching data:", error);
  //   query.value = "";
  // }
  isLoading.value = true;
  let tempQuery = query.value;
  query.value = ""
  setConversation("test", [
    ...messages.value,
    {
      role: 'user',
      content: tempQuery
    },
  ]);
  setConversation("test", [
    ...messages.value,
    {
      role: 'assistant',
      content: "Thinking..."
    }
  ]);
  const text = await $fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: tempQuery
    }),
  })
  setConversation("test", [
    ...messages.value,
    {
      role: 'assistant',
      content: text
    }
  ]);
  isLoading.value = false;
};

// Simplified talent sheet logic for demonstrat
</script>

<template>
    <div class="w-1/2 mx-auto min-h-screen flex flex-col pt-4">
      <div class="flex items-center gap-4">
        <h1 class="font-bold text-2xl">Parliament AI</h1>
        <Avatar size="sm" shape="circle" class="m-4">
          <AvatarImage :src="''" />
          <AvatarFallback>AI</AvatarFallback>
        </Avatar>
      </div>
      <hr class="mb-4">
      <div class="flex flex-col flex-wrap text-wrap w-full pl-4">
        <div v-for="message in messages" :key="message.id">
          <div
            v-if="message.role === 'user'"
            class="flex gap-6 justify-end mb-4"
          >
            <div class="flex flex-col gap-2">
              <div class="text-xs font-bold text-muted-foreground text-end">
                User
              </div>
              <p
                class="prose text-sm whitespace-pre-wrap"
                
              >
              {{ message.content }}
              </p>
            </div>
            <Avatar size="sm" shape="square">
              <AvatarFallback>User</AvatarFallback>
            </Avatar>
          </div>
          <div
            v-if="message.role === 'assistant'"
            class="flex w-full text-wrap gap-6 justify-start mb-4"
          >
            <Avatar size="sm" shape="square">
              <AvatarFallback>AI</AvatarFallback>
            </Avatar>

            <div class="flex flex-col gap-2 text-wrap">
              <div class="text-xs font-bold text-muted-foreground">
                ParliamentAI
              </div>
              <p
                class="prose text-sm whitespace-pre-line text-wrap max-w-lg"
                
              >
              {{ message.content }}
              </p>
            </div>
          </div>
        </div>

        <div v-if="false" className="leading-relaxed">
          <!-- Add loading animation here -->
          <div class="flex justify-center items-center">
            <LucideLoader2 class="animate-spin w-8 h-8" />
            <span class="ml-2 text-lg">Loading...</span>
          </div>
        </div>
      </div>
      <div
        v-if="messages.length === 0"
        class="mt-auto sticky bottom-60 max-w-2xl mx-auto flex flex-col gap-4 items-center"
      >
        <div class="flex items-center gap-4">
          <Avatar size="sm" shape="circle" class="mb-4">
            <AvatarImage :src="''" />
            <AvatarFallback>ParlAI</AvatarFallback>
          </Avatar>
          <h1 class="font-bold text-2xl">Welcome! I'm Parliament AI</h1>
        </div>

        <div class="grid grid-cols-2 gap-4 items-center">
          <Button
            class="text-wrap px-2 py-10"
            variant="secondary"
            v-for="message in INITIAL_MESSAGES"
            :key="message.content"
            @click="initiateSearch(message.content)"
          >
            {{ message.content }}
          </Button>
        </div>
      </div>
      <div
        class="mt-auto flex justify-center sticky inset-x-0 bottom-10 pt-12 pb-4 xs:pb-8 bg-gradient-to-b from-transparent via-[40%] via-white to-white dark:via-background dark:to-background"
      >
        <form
          @submit.prevent="handleSubmit"
          class="w-full max-w-4xl flex items-start gap-2 justify-items-center pb-10"
        >
          <Input
            type="text"
            size="sm"
            v-model="query"
            placeholder="Какви решения бяха взети свързани с образованието?"
            class="w-full p-2 border rounded ring-3 ring-forest-500 dark:ring-forest-800"
          />
          <Button type="submit" :disabled="isLoading">
            Ask
          </Button>
        </form>
      </div>
    </div>
</template>

<style scoped>
</style>