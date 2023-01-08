import {readFileSync, writeFileSync, existsSync} from 'fs';
import {homedir} from 'os';
import enquirer from 'enquirer';

import {ClientConfig, refreshAccessToken} from './client.js';

const CONFIG_FILE_NAME = `${homedir()}/.commit-gpt.json`;

export async function ensureSessionToken(clean?: boolean): Promise<ClientConfig> {
    let config: Partial<ClientConfig> = {};

    if (existsSync(CONFIG_FILE_NAME) && !clean) {
        config = JSON.parse(readFileSync(CONFIG_FILE_NAME, 'utf-8'));
    }

    if (!config.sessionToken || !config.cfClearance || !config.userAgent) {
        config = await promptToken();
    }

    while (true) {
        try {
            await refreshAccessToken(config as ClientConfig);
            writeFileSync(CONFIG_FILE_NAME, JSON.stringify(config, null, 2));
            return config as ClientConfig;
        } catch (e) {
            console.log('Invalid token. Please try again.');
            console.log(e);
            config = await promptToken();
        }
    }
}

async function promptToken() {
    try {
        console.log(
            'Follow instructions here to get your OpenAI session token, CF clearance & user agent: https://github.com/transitive-bullshit/chatgpt-api/tree/v3.3.11#authentication'
        );

        const answers = await enquirer.prompt<{ sessionToken: string, cfClearance: string, userAgent: string }>([
            {
                type: 'password',
                name: 'sessionToken',
                message: 'Paste your session token here:',
            },
            {
                type: 'password',
                name: 'cfClearance',
                message: "Paste your CF Clearance token here:",
            },
            {
                type: 'input',
                name: 'userAgent',
                message: "Paste your user agent here:",
            }
        ]);

        return answers;
    } catch (e) {
        console.log('Aborted.');
        process.exit(1);
    }
}