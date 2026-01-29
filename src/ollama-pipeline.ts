import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { AzureOpenAI } from 'openai';

interface OllamaConfig {
  provider: 'ollama' | 'azure';
  ollama: {
    baseUrl: string;
    model: string;
    options: {
      temperature: number;
      stream: boolean;
    };
  };
  azure: {
    options: {
      temperature: number;
      maxTokens: number;
    };
  };
  targetFile: string;
}

interface Prompts {
  analyzeContext: string;
  countWord: string;
}

interface OllamaResponse {
  response: string;
  done: boolean;
}

interface AnalysisResult {
  contextSummary: string;
  wordCount: string;
  rawFileContent: string;
}

interface AzureEnvConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiVersion: string;
}

export class OllamaPipeline {
  private config: OllamaConfig;
  private prompts: Prompts;
  private extensionPath: string;
  private azureClient: AzureOpenAI | null = null;
  private azureEnv: AzureEnvConfig | null = null;

  constructor(extensionPath: string) {
    this.extensionPath = extensionPath;
    this.loadEnv();
    this.config = this.loadConfig();
    this.prompts = this.loadPrompts();
    this.initializeAzureClient();
  }

  private loadEnv(): void {
    const envPath = path.join(this.extensionPath, '.env');
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      this.azureEnv = {
        endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
        apiKey: process.env.AZURE_OPENAI_API_KEY || '',
        deployment: process.env.AZURE_OPENAI_DEPLOYMENT || '',
        apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview'
      };
    }
  }

  private initializeAzureClient(): void {
    if (this.azureEnv && this.azureEnv.endpoint && this.azureEnv.apiKey) {
      this.azureClient = new AzureOpenAI({
        endpoint: this.azureEnv.endpoint,
        apiKey: this.azureEnv.apiKey,
        apiVersion: this.azureEnv.apiVersion
      });
    }
  }

  private loadConfig(): OllamaConfig {
    const configPath = path.join(this.extensionPath, 'ollama-config.json');
    const configContent = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configContent);
  }

  private loadPrompts(): Prompts {
    const promptsPath = path.join(this.extensionPath, 'prompts.json');
    const promptsContent = fs.readFileSync(promptsPath, 'utf-8');
    return JSON.parse(promptsContent);
  }

  public reloadConfig(): void {
    this.loadEnv();
    this.config = this.loadConfig();
    this.prompts = this.loadPrompts();
    this.initializeAzureClient();
  }

  public getConfig(): OllamaConfig {
    return this.config;
  }

  public getProvider(): string {
    return this.config.provider;
  }

  public getModelName(): string {
    if (this.config.provider === 'azure') {
      return this.azureEnv?.deployment || 'Azure OpenAI';
    }
    return this.config.ollama.model;
  }

  private readTextFile(): string {
    const filePath = this.config.targetFile;
    if (!fs.existsSync(filePath)) {
      throw new Error(`Target file not found: ${filePath}`);
    }
    return fs.readFileSync(filePath, 'utf-8');
  }

  private formatPrompt(template: string, replacements: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
  }

  private async queryOllama(prompt: string): Promise<string> {
    const url = `${this.config.ollama.baseUrl}/api/generate`;

    const requestBody = {
      model: this.config.ollama.model,
      prompt: prompt,
      stream: this.config.ollama.options.stream,
      options: {
        temperature: this.config.ollama.options.temperature
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as OllamaResponse;
    return data.response;
  }

  private async queryAzure(prompt: string): Promise<string> {
    if (!this.azureClient || !this.azureEnv) {
      throw new Error('Azure OpenAI is not configured. Please check your .env file.');
    }

    const response = await this.azureClient.chat.completions.create({
      model: this.azureEnv.deployment,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that analyzes text.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: this.config.azure.options.maxTokens,
      temperature: this.config.azure.options.temperature
    });

    return response.choices[0]?.message?.content || '';
  }

  private async query(prompt: string): Promise<string> {
    if (this.config.provider === 'azure') {
      return this.queryAzure(prompt);
    }
    return this.queryOllama(prompt);
  }

  public async analyzeText(wordToCount: string = 'dog'): Promise<AnalysisResult> {
    // Read the target file
    const fileContent = this.readTextFile();

    // Phase 1: Analyze context
    const contextPrompt = this.formatPrompt(this.prompts.analyzeContext, {
      content: fileContent
    });
    const contextSummary = await this.query(contextPrompt);

    // Phase 2: Count word occurrences
    const countPrompt = this.formatPrompt(this.prompts.countWord, {
      word: wordToCount,
      content: fileContent
    });
    const wordCount = await this.query(countPrompt);

    return {
      contextSummary,
      wordCount,
      rawFileContent: fileContent
    };
  }

  public async testConnection(): Promise<boolean> {
    try {
      if (this.config.provider === 'azure') {
        if (!this.azureClient || !this.azureEnv) {
          return false;
        }
        // Test Azure connection with a minimal request
        const response = await this.azureClient.chat.completions.create({
          model: this.azureEnv.deployment,
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 5
        });
        return !!response.choices[0]?.message?.content;
      } else {
        const url = `${this.config.ollama.baseUrl}/api/tags`;
        const response = await fetch(url);
        return response.ok;
      }
    } catch {
      return false;
    }
  }

  public saveAnalysisToFile(result: AnalysisResult, wordSearched: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `analysis-${timestamp}.txt`;
    const outputPath = path.join(this.extensionPath, filename);

    const providerInfo = this.config.provider === 'azure'
      ? `Provider: Azure OpenAI\nDeployment: ${this.azureEnv?.deployment}`
      : `Provider: Ollama\nModel: ${this.config.ollama.model}`;

    const content = [
      '='.repeat(50),
      'TEXT ANALYSIS REPORT',
      '='.repeat(50),
      '',
      `Generated: ${new Date().toLocaleString()}`,
      providerInfo,
      `Source File: ${this.config.targetFile}`,
      '',
      'RAW FILE CONTENT:',
      '-'.repeat(50),
      result.rawFileContent,
      '',
      'CONTEXT SUMMARY:',
      '-'.repeat(50),
      result.contextSummary,
      '',
      `WORD COUNT ("${wordSearched}"):`,
      '-'.repeat(50),
      result.wordCount,
      '',
      '='.repeat(50),
      'END OF REPORT',
      '='.repeat(50),
    ].join('\n');

    fs.writeFileSync(outputPath, content, 'utf-8');
    return outputPath;
  }
}
