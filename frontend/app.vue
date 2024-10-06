<script setup lang="ts">
	import { ref } from 'vue'
	import { Input } from '@/components/ui/input'
	import { Button } from '@/components/ui/button'
	import { ScrollArea } from '@/components/ui/scroll-area'
  import { useChat } from '@ai-sdk/vue';
  
  const { messages, input, handleSubmit } = useChat();

	const loading = ref(false);
</script>

<template>
	<div class="flex flex-col w-1/2 mx-auto h-screen bg-background text-foreground">
		<header class="p-4 border-b">
			<h1 class="text-2xl font-bold text-center">AI Chatbot</h1>
		</header>
		<main class="flex-1 overflow-hidden">
			<ScrollArea class="h-full p-4 pb-32">
				<div v-for="(message, i) in messages" :key="i" class="flex flex-col mb-4">
					<div v-if="message.role === 'assistant'" class="flex items-start">
						<div class="p-3 rounded-lg bg-muted text-muted-foreground max-w-[80%]">
							{{ message.content }}
						</div>
					</div>
					<div v-else class="flex items-start justify-end">
						<div class="p-3 rounded-lg bg-primary text-primary-foreground max-w-[80%]">
							{{ message.content }}
						</div>
					</div>
				</div>
			</ScrollArea>
		</main>
		<footer class="relative p-4 border-t">
			<div class="absolute inset-x-0 top-0 h-24 bg-gradient-to-t from-background to-transparent pointer-events-none"></div>
			<form @submit.prevent="handleSubmit" class="flex items-center space-x-2">
				<Input
					v-model="input"
					placeholder="Type your message here..."
					class="flex-1 text-lg py-6"
				/>
				<Button type="submit" size="icon" :disabled="loading">
					<svg
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6"
					>
						<path
							d="M22 2L11 13"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
						<path
							d="M22 2L15 22L11 13L2 9L22 2Z"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</Button>
			</form>
		</footer>
	</div>
</template>

<style scoped>
	.loader {
		/* ... existing loader styles ... */
	}

	@keyframes animloader {
		/* ... existing animation keyframes ... */
	}
</style>