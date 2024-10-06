import express, { Request, Response } from "express";
import { processUserMessage } from "./index";  // Ensure correct import

const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello from express and typescript');
});

// POST endpoint with streaming
app.post('/api/chat', async (req: Request, res: Response) => {
  const { name, sessionId, humanMessage } = req.body;

  try {
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Transfer-Encoding', 'chunked');

    const eventStream = processUserMessage(name, sessionId, humanMessage);

    // Iterate over the async generator, and stream chunks to the client
    for await (const chunk of eventStream) {
      // Log the chunk content for debugging
      console.log(chunk);

      // Stream the chunk to the client
      res.write(chunk);
    }

    // End the response after all chunks are sent
    res.end();
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ error: 'An error occurred while processing the message' });
  }
});

const port = process.env.PORT || 4000;

app.listen(port, () => console.log(`App listening on PORT ${port}`));
