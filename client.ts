// Adapted from: https://github.com/wong2/chat-gpt-google-extension/blob/main/background/index.mjs

import { createParser } from 'eventsource-parser';
import { v4 as uuidv4 } from 'uuid';
import ExpiryMap from 'expiry-map';
import fetch, { Response } from 'node-fetch';

export type ClientConfig = {
  cfClearance: string;
  sessionToken: string;
  userAgent: string;
};

const KEY_ACCESS_TOKEN = 'accessToken';
const cache = new ExpiryMap(10 * 1000);

export async function refreshAccessToken(config: ClientConfig) {
  if (cache.get(KEY_ACCESS_TOKEN)) {
    return cache.get(KEY_ACCESS_TOKEN);
  }
  const resp = await fetch('https://chat.openai.com/api/auth/session', {
    headers: {
      'User-Agent': config.userAgent,
      cookie: `__Secure-next-auth.session-token=${config.sessionToken}; cf_clearance=${config.cfClearance}`,
      'x-openai-assistant-app-id': '',
      'accept-language': 'en-US,en;q=0.9',
      'accept-encoding': 'gzip, deflate, br',
      origin: 'https://chat.openai.com',
      referer: 'https://chat.openai.com/chat',
      'sec-ch-ua': '"Not?A_Brand";v="8", "Chromium";v="108", "Google Chrome";v="108"',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
    },
  })
    .then(r => r.json() as any)
    .catch((e) => {
      console.log(e); return {}
    });

  if (!resp.accessToken) {
    throw new Error('Unauthorized');
  }

  cache.set(KEY_ACCESS_TOKEN, resp.accessToken);
  return resp.accessToken;
}

export class ChatGPTClient {
  constructor(public config: ClientConfig, public converstationId: string = uuidv4()) {}

  async ensureAuth() {
    await refreshAccessToken(this.config);
  }
  async getAnswer(question: string): Promise<string> {
    const accessToken = await refreshAccessToken(this.config);

    let response = '';
    return new Promise((resolve, reject) => {
      fetchSSE('https://chat.openai.com/backend-api/conversation', {
        method: 'POST',
        headers: {
          'User-Agent': this.config.userAgent,
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'x-openai-assistant-app-id': '',
          'accept-language': 'en-US,en;q=0.9',
          'accept-encoding': 'gzip, deflate, br',
          origin: 'https://chat.openai.com',
          referer: 'https://chat.openai.com/chat',
          'sec-ch-ua':
              '"Not?A_Brand";v="8", "Chromium";v="108", "Google Chrome";v="108"',
          'sec-ch-ua-platform': '"macOS"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
        },
        body: JSON.stringify({
          action: 'next',
          messages: [
            {
              id: uuidv4(),
              role: 'user',
              content: {
                content_type: 'text',
                parts: [question],
              },
            },
          ],
          model: 'text-davinci-002-render',
          parent_message_id: this.converstationId,
        }),
        onMessage: (message: string) => {
          if (message === '[DONE]') {
            return resolve(response);
          }
          const data = JSON.parse(message);
          const text = data.message?.content?.parts?.[0];
          if (text) {
            response = text;
          }
        },
      }).catch(reject);
    });
  }
}

async function fetchSSE(resource, options) {
  const { onMessage, ...fetchOptions } = options;
  const resp = await fetch(resource, fetchOptions);
  if (!resp.ok) {
    const err = new Error(resp.statusText);
    (err as any).details = await resp.text(); // quick hack to persist the error details
    throw err;
  }
  const parser = createParser(event => {
    if (event.type === 'event') {
      onMessage(event.data);
    }
  });

  resp.body.on('readable', () => {
    let chunk;
    while (null !== (chunk = resp.body.read())) {
      parser.feed(chunk.toString());
    }
  });
}
