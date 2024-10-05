import { JSONLoader } from "langchain/document_loaders/fs/json";

const loader = new JSONLoader("src/document_loaders/example_data/example.json");

const docs = await loader.load();