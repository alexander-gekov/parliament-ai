import { JSONLoader } from "langchain/document_loaders/fs/json";

const loader = new JSONLoader("data/session.json");

const docs = await loader.load();

console.log(docs);