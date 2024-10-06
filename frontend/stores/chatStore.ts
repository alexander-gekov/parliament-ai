import { defineStore } from "pinia";

export const useCurrentChatStore = defineStore("chat", () => {
  const id = ref("test");
  const messages = ref([] as any);

  const setConversation = (
    incomingId: string,
    incomingMessages: any[]
  ) => {
    id.value = incomingId;
    messages.value = incomingMessages;
  };

  return {
    id,
    messages,
    setConversation,
  };
});
