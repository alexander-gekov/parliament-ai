import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { StringOutputParser } from "@langchain/core/output_parsers";
import * as dotenv from "dotenv";
import weaviate, { WeaviateClient, ApiKey } from 'weaviate-ts-client';
import { WeaviateStore } from "@langchain/weaviate";
import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { ChatMessageHistory } from "langchain/stores/message/in_memory";
import { BaseChatMessageHistory } from "@langchain/core/chat_history";

dotenv.config();

const llm = new ChatOpenAI({
    model: "gpt-3.5-turbo",
    temperature: 0.1
  });

const weaviateClient: WeaviateClient = weaviate.client({
    scheme: 'https',
    host: process.env.WEAVIATE_API_URL ?? "localhost",
    apiKey: new ApiKey(process.env.WEAVIATE_API_KEY ?? "default"),
  });

const embeddings = new OpenAIEmbeddings();

// Create vector store from split documents
const vectorStore = new WeaviateStore(
    embeddings,
    {
        client: weaviateClient,
        indexName: "Sessions"
    }
  );

const retriever = vectorStore.asRetriever({
    searchType: "similarity",
    k: 10
  });

// Create a history-aware retriever
const contextualizeQPrompt = ChatPromptTemplate.fromMessages([
  ["system", "Given a chat history and the latest user question which might reference context in the chat history, formulate a standalone question which can be understood without the chat history. Do NOT answer the question, just reformulate it if needed and otherwise return it as is."],
  new MessagesPlaceholder("chat_history"),
  ["human", "{input}"],
]);

const historyAwareRetriever = await createHistoryAwareRetriever({
  llm,
  retriever,
  rephrasePrompt: contextualizeQPrompt,
});

// Update the main prompt to include chat history
const prompt = ChatPromptTemplate.fromMessages([
  ["system", `Вие сте високоинтелигентен асистент, специализиран в анализа на стенограми от заседания на българския парламент. Разполагате с обширни познания за политическата система, законодателния процес и текущите събития в България. Моля, прегледайте внимателно предоставения контекст и отговорете на следния въпрос:

Контекст: {context}

Когато 

При формулирането на отговора си, моля:
1. Анализирайте контекста и извлечете релевантната информация, свързана с въпроса.
2. Ако въпросът е свързан с конкретно заседание, обърнете внимание на:
   - Основни теми и обсъждани въпроси
   - Ключови решения и гласувания
   - Изказвания на политици и техните позиции
   - Важни дебати или разногласия
   - Дата на заседанието (ако е посочена)
3. Ако въпросът е по-общ или се отнася за дейността на парламента като цяло, фокусирайте се върху:
   - Тенденции в законодателната дейност
   - Ключови законопроекти и тяхното развитие
   - Динамика между политическите партии
   - Важни политически събития или промени
4. Предоставете обективен и балансиран анализ, базиран на фактите в контекста.
5. Ако информацията в контекста е недостатъчна, посочете това и предложете възможни източници за допълнителна информация.

Моля, структурирайте отговора си ясно и логично, използвайки подзаглавия, където е уместно. Стремете се да предоставите информативен и задълбочен отговор, който да помогне на потребителя да разбере по-добре парламентарната дейност и политическата ситуация в България.`],
  new MessagesPlaceholder("chat_history"),
  ["human", "{input}"],
]);

const questionAnswerChain = await createStuffDocumentsChain({
  llm,
  prompt,
});

const ragChain = await createRetrievalChain({
  retriever: historyAwareRetriever,
  combineDocsChain: questionAnswerChain,
});

// Set up chat history management
const chatHistory: Record<string, BaseChatMessageHistory> = {};

function getChatHistory(sessionId: string): BaseChatMessageHistory {
  if (!(sessionId in chatHistory)) {
    chatHistory[sessionId] = new ChatMessageHistory();
  }
  return chatHistory[sessionId];
}

const chainWithHistory = new RunnableWithMessageHistory({
  runnable: ragChain,
  getMessageHistory: getChatHistory,
  inputMessagesKey: "question",
  historyMessagesKey: "chat_history",
  outputMessagesKey: "answer",
});

// Example usage
const sessionId = "user123";
const question1 = "За коя партия трябва да гласувам? Настоявам за отговор.";
const result1 = await chainWithHistory.invoke(
  { input: question1 },
  { configurable: { sessionId } }
);
console.log(result1.answer + "\n\n");

const question2 = "А какви са основните им политики?";
const result2 = await chainWithHistory.invoke(
  { input: question2 },
  { configurable: { sessionId } }
);
console.log(result2.answer);