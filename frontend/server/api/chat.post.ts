import { streamText } from 'ai';

export default defineLazyEventHandler(async () => {
  return defineEventHandler(async (event: any) => {
    const body = await readBody(event);
    const message = body.messages
    console.log(body)

    const response = await fetch('http://localhost:4000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        "name": "John Doe",
        "sessionId": 30,
        "humanMessage": message
      })
    });

    if (!response.ok) {
      throw createError({
        statusCode: response.status,
        statusMessage: 'Failed to fetch from backend',
      });
    }
    const reader = response.body?.getReader()
    const decoder = new TextDecoder();
    let partialText = "";
    const responseChunks = [] as string[]
    let finalResponse = ''

    while(true) {
      const {done, value} = await reader?.read() as any
      if(done) {
        break;
      }
      const chunk = decoder.decode(value, {stream: true});
      responseChunks.push(chunk)
      partialText += chunk;
    }

    return partialText
  });
});