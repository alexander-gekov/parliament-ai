import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import * as dotenv from "dotenv";
import weaviate, { WeaviateClient, ApiKey } from 'weaviate-ts-client';
import { WeaviateStore } from "@langchain/weaviate";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { pull } from "langchain/hub";
import { StateGraph, MessagesAnnotation, Annotation } from "@langchain/langgraph";
import { createRetrieverTool } from "langchain/tools/retriever";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { DocumentInterface } from "@langchain/core/documents";
import { formatDocumentsAsString } from "langchain/util/document";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";
import { DynamicTool } from "@langchain/core/tools";

dotenv.config();

const llm = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0,
    streaming: true
  })

  const finalLlm = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0,
    streaming: true
  }).withConfig({
    tags: ["final"]
  })
  
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

  // Generate Answer Tool
const generateTool = new DynamicTool({
  name: "generate_answer",
  description: "Generate an answer based on the given context and question. Input should be a JSON string with 'context' and 'question' keys.",
  func: async (input: string) => {
    console.log("---GENERATE---");
    const { context, question } = JSON.parse(input);
    const prompt = await pull<ChatPromptTemplate>("rlm/rag-prompt");
    const ragChain = prompt.pipe(llm).pipe(new StringOutputParser());
    return ragChain.invoke({ context, question });
  },
});

// Grade Documents Tool
const gradeDocumentsTool = new DynamicTool({
  name: "grade_documents",
  description: "Grade documents based on relevance to a question. Always use this tool to check if a document is relevant to a question before using it in a response.",
  func: async (input: string) => {
    console.log("---CHECK RELEVANCE---");
    const { documents, question } = JSON.parse(input);
    const llmWithTool = llm.withStructuredOutput(
      z.object({
        binaryScore: z.enum(["yes", "no"]).describe("Relevance score 'yes' or 'no'"),
      }),
      { name: "grade" }
    );

    const prompt = ChatPromptTemplate.fromTemplate(`You are a grader assessing relevance of a retrieved document to a user question.
    Here is the retrieved document:
    
    {context}
    
    Here is the user question: {question}
  
    If the document contains keyword(s) or semantic meaning related to the user question, grade it as relevant.
    Give a binary score 'yes' or 'no' score to indicate whether the document is relevant to the question.`);

    const chain = prompt.pipe(llmWithTool);
    const filteredDocs: Array<DocumentInterface> = [];

    for (const doc of documents) {
      const grade = await chain.invoke({
        context: doc.pageContent,
        question: question,
      });
      if (grade.binaryScore === "yes") {
        console.log("---GRADE: DOCUMENT RELEVANT---");
        filteredDocs.push(doc);
      } else {
        console.log("---GRADE: DOCUMENT NOT RELEVANT---");
      }
    }

    return JSON.stringify(filteredDocs);
  },
});

// Transform Query Tool
const transformQueryTool = new DynamicTool({
  name: "transform_query",
  description: "Transform a query to produce a better question for semantic search",
  func: async (question: string) => {
    console.log("---TRANSFORM QUERY---");
    const prompt = ChatPromptTemplate.fromTemplate(
      `You are generating a question that is well optimized for semantic search retrieval.
    Look at the input and try to reason about the underlying sematic intent / meaning.
    Here is the initial question:
    \n ------- \n
    {question} 
    \n ------- \n
    Formulate an improved question: `
    );
    const chain = prompt.pipe(llm).pipe(new StringOutputParser());
    return chain.invoke({ question });
  },
});

// Decide to Generate Tool
const decideToGenerateTool = new DynamicTool({
  name: "decide_to_generate",
  description: "Decide whether to generate an answer or transform the query based on document availability. Input should be a JSON string with a 'documents' key containing an array of documents.",
  func: async (input: string): Promise<"transformQuery" | "generate"> => {
    console.log("---DECIDE TO GENERATE---");
    const { documents } = JSON.parse(input);
    if (documents.length === 0) {
      console.log("---DECISION: TRANSFORM QUERY---");
      return "transformQuery";
    }
    console.log("---DECISION: GENERATE---");
    return "generate";
  },
});

  const tools = [tavilySearchTool, ragTool, generateTool, gradeDocumentsTool, transformQueryTool, decideToGenerateTool];
  const toolNode = new ToolNode<typeof GraphState.State>(tools);

  const llm_tools = llm.bindTools(tools);
//#endregion

//#region LangGraph Agent Setup
const GraphState = Annotation.Root({
    documents: Annotation<DocumentInterface[]>({
        reducer: (x, y) => y ?? x ?? [],
      }),
      question: Annotation<string>({
        reducer: (x, y) => y ?? x ?? "",
      }),
      generation: Annotation<string>({
        reducer: (x, y) => y ?? x,
      }),
  })

function shouldContinue({ messages }: typeof MessagesAnnotation.State) {
  const lastMessage = messages[messages.length - 1];
  console.log("DECIDING...")

  if (lastMessage.additional_kwargs.tool_calls) {
    console.log("tool call", lastMessage.additional_kwargs.tool_calls);
    return "tools";
  }

  return "final";
}

async function callModel(state: typeof MessagesAnnotation.State) {
  const response = await llm_tools.invoke(state.messages);
  return { messages: [response] };
}

const callFinalModel = async (state: typeof MessagesAnnotation.State) => {
  const messages = state.messages;
  const lastAIMessage = messages[messages.length - 1];
  const response = await finalLlm.invoke([
    new SystemMessage("Format the docs to human readable format and display sources as citations inline"),
    new HumanMessage({ content: lastAIMessage.content })
  ]);
  // MessagesAnnotation allows you to overwrite messages from the agent
  // by returning a message with the same id
  response.id = lastAIMessage.id;
  return { messages: [response] };
}

const workflow = new StateGraph(MessagesAnnotation)
  .addNode("agent", callModel)
  .addEdge("__start__", "agent")
  .addNode("tools", toolNode)
  .addEdge("tools", "agent")
  .addNode("final", callFinalModel)
  .addConditionalEdges("agent", shouldContinue, {
    tools: "tools",
    final: "final"
  })
  .addEdge("final", "__end__");

const app = workflow.compile();
//#endregion

// Add this function at the end of the file
export async function processUserMessage(name: string, sessionId: string, humanMessage: string) {
  const question = humanMessage;

  const eventStream = await app.streamEvents({
    messages: [new HumanMessage(question)],
  }, { version: "v2"});

  let response = '';
  for await (const { event, tags, data } of eventStream) {
    if (event === "on_chat_model_stream" && tags?.includes("final")) {
      if (data.chunk.content) {
        response += data.chunk.content;
      }
    }
  }

  return {
    name,
    sessionId,
    question,
    response
  };
}