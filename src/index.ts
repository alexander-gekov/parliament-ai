import { JSONLoader } from "langchain/document_loaders/fs/json";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { pull } from "langchain/hub";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import * as dotenv from "dotenv";

dotenv.config();

const llm = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0
  });

const loader = new JSONLoader("data/session.json");
const docs = await loader.load();

// Split the documents
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});
const splitDocs = await textSplitter.splitDocuments(docs);

// Create vector store from split documents
const vectorStore = await MemoryVectorStore.fromDocuments(
    splitDocs,
    new OpenAIEmbeddings()
  );

const retriever = vectorStore.asRetriever({
    searchType: "similarity",
    k: 10
  });
const prompt = ChatPromptTemplate.fromTemplate(`Вие сте полезен асистент, специализиран в анализа на стенограми от заседания на българския парламент. Моля, прегледайте внимателно предоставения контекст и отговорете на следния въпрос, като се съсредоточите върху следните аспекти:

Контекст: {context}

Въпрос: {question}

При отговора си, моля обърнете специално внимание на следното:
1. Основната тема или теми на заседанието
2. Ключови решения, които са били взети
3. Имена на политици, които са взели думата, и кратко резюме на техните основни изказвания
4. Важни дебати или разногласия, ако има такива
5. Всякакви гласувания и техните резултати
6. Дата на заседанието, ако е посочена

Моля, структурирайте отговора си ясно и стегнато, като използвате подзаглавия за различните аспекти, ако е уместно. Ако някоя информация не е налична в предоставения контекст, просто посочете това.

Отговор:`);

const ragChain = await createStuffDocumentsChain({
    llm,
    prompt,
    outputParser: new StringOutputParser(),
});

const retrievedDocs = await retriever.invoke("С какво е свързана информацията?");

const response = await ragChain.invoke({
    question: "Кои са основните участници в разговора и какви теми обсъждат?",
    context: retrievedDocs,
});

console.log(response);