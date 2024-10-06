import express, { Request, Response } from "express";
import { processUserMessage } from "./index";

const app = express();

// Add this line to parse JSON bodies
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello from express and typescript');
  });

// New POST endpoint
app.post('/api/chat', async (req: Request, res: Response) => {
    const { name, sessionId, humanMessage } = req.body;
    
    try {
        const result = await processUserMessage(name, sessionId, humanMessage);
        res.json(result);
    } catch (error) {
        console.error('Error processing message:', error);
        res.status(500).json({ error: 'An error occurred while processing the message' });
    }
});

const port = process.env.PORT || 3000;

app.listen(port, () => console.log(`App listening on PORT ${port}`));