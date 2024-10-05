import { END } from "@langchain/langgraph";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import * as dotenv from "dotenv";
import weaviate, { WeaviateClient, ApiKey } from 'weaviate-ts-client';
import { WeaviateStore } from "@langchain/weaviate";
import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import { StateGraph, MessagesAnnotation, Annotation } from "@langchain/langgraph";
import { createRetrieverTool } from "langchain/tools/retriever";

dotenv.config();

const embeddings = new OpenAIEmbeddings();

//#region Weaviate Setup
const weaviateClient: WeaviateClient = weaviate.client({
    scheme: 'https',
    host: process.env.WEAVIATE_API_URL ?? "localhost",
    apiKey: new ApiKey(process.env.WEAVIATE_API_KEY ?? "default"),
  });
  
  const vectorStore = new WeaviateStore(
    embeddings,
    {
      client: weaviateClient,
      indexName: "Sessions"
    }
  );
  
  const retriever = vectorStore.asRetriever({
    searchType: "similarity",
    k: 6
  });
  //#endregion

//#region Tool Setup
const tavilySearchTool = new TavilySearchResults({
    apiKey: process.env.TAVILY_API_KEY,
    maxResults: 3
  });
  
  const ragTool = createRetrieverTool(
    retriever,
    {
      name: "retrieve_parliament_session_statements",
      description:
        "Search and return statements from the parliament session, including which politicians said what and what they talked about.",
    },
  );
  
  const tools = [tavilySearchTool, ragTool];
  const toolNode = new ToolNode<typeof GraphState.State>(tools);
  //#endregion
  
//#region LLM and Embeddings Setup
const llm = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0,
    streaming: true
  }).bindTools(tools);
//#endregion

//#region History-Aware Retriever Setup
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
//#endregion

//#region Main Prompt and Chain Setup
const prompt = ChatPromptTemplate.fromMessages([
  ["system", `Вие сте високоинтелигентен асистент, специализиран в анализа на стенограми от заседания на българския парламент. Разполагате с обширни познания за политическата система, законодателния процес и текущите събития в България. Моля, прегледайте внимателно предоставения контекст и отговорете на следния въпрос:

Контекст: {context}

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
//#endregion

//#region LangGraph Agent Setup
const GraphState = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
      reducer: (x, y) => x.concat(y),
      default: () => [],
    })
  })

function shouldContinue({ messages }: typeof MessagesAnnotation.State) {
  const lastMessage = messages[messages.length - 1];
  console.log("DECIDING...")

  if (lastMessage.additional_kwargs.tool_calls) {
    console.log("tool call", lastMessage.additional_kwargs.tool_calls);
    return "tools";
  }

  return "__end__";
}

async function callModel(state: typeof MessagesAnnotation.State) {
  const response = await llm.invoke(state.messages);
  return { messages: [response] };
}

const workflow = new StateGraph(MessagesAnnotation)
  .addNode("agent", callModel)
  .addEdge("__start__", "agent")
  .addNode("tools", toolNode)
  .addEdge("tools", "agent")
  .addConditionalEdges("agent", shouldContinue);

const app = workflow.compile();
//#endregion

//#region Example Usage
const question1 = "Направи анализ на репликите на депутата Цончо Ганев и ми разкажи за него като депутат.";

const finalState = await app.invoke({
  messages: [new HumanMessage(question1)],
});

console.log(finalState.messages[finalState.messages.length - 1].content);
//#endregion