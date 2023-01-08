import {existsSync, readFileSync, writeFileSync} from 'fs';
import {homedir} from 'os';
import enquirer from 'enquirer';

export type ClientConfig = {
  email: string;
  password: string;
};

const CONFIG_FILE_NAME = `${homedir()}/.commit-gpt.json`;

export async function ensureEmailAndPassword(clean?: boolean): Promise<ClientConfig> {
  let config: ClientConfig;

  if (existsSync(CONFIG_FILE_NAME) && !clean) {
    config = JSON.parse(readFileSync(CONFIG_FILE_NAME, 'utf-8'));
  }

  if (!config.email || !config.password) {
    config = await promptEmailAndPassword();
  }

  writeFileSync(CONFIG_FILE_NAME, JSON.stringify(config, null, 2));
  return config;
}

async function promptEmailAndPassword() {
  try {
    return enquirer.prompt<{ email: string, password: string }>([
      {
        type: 'input',
        name: 'email',
        message: "What's your OpenAI email?",
      },
      {
        type: 'password',
        name: 'password',
        message: "What's your OpenAI password?",
      }]
    );
  } catch (e) {
    console.log('Aborted.');
    process.exit(1);
  }
}
