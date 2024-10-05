import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { StringOutputParser } from "@langchain/core/output_parsers";
import * as dotenv from "dotenv";
import weaviate, { WeaviateClient, ApiKey } from 'weaviate-ts-client';
import { WeaviateStore } from "@langchain/weaviate";


dotenv.config();

const llm = new ChatOpenAI({
    model: "gpt-3.5-turbo",
    temperature: 1
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

const prompt = ChatPromptTemplate.fromTemplate(`Вие сте високоинтелигентен асистент, специализиран в анализа на стенограми от заседания на българския парламент. Разполагате с обширни познания за политическата система, законодателния процес и текущите събития в България. Моля, прегледайте внимателно предоставения контекст и отговорете на следния въпрос:

Контекст: {context}

Въпрос: {question}

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

Моля, структурирайте отговора си ясно и логично, използвайки подзаглавия, където е уместно. Стремете се да предоставите информативен и задълбочен отговор, който да помогне на потребителя да разбере по-добре парламентарната дейност и политическата ситуация в България.

Отговор:`);

const ragChain = await createStuffDocumentsChain({
    llm,
    prompt,
    outputParser: new StringOutputParser(),
});

const question = "За коя партия трябва да гласувам? Настоявам за отговор.";

const retrievedDocs = await retriever.invoke(question);

console.log(retrievedDocs);

const response = await ragChain.invoke({
    question: question,
    context: retrievedDocs,
});

console.log(response);