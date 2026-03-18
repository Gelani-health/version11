// LLM Provider Presets - Configuration for supported AI providers

export interface LLMProviderPreset {
  name: string;
  baseUrl: string;
  models: string[];
  requiresApiKey: boolean;
  icon: string;
  description?: string;
}

export const LLM_PROVIDER_PRESETS: Record<string, LLMProviderPreset> = {
  zai: {
    name: "Z.ai",
    baseUrl: "https://api.z.ai",
    models: ["z-1", "z-2"],
    requiresApiKey: true,
    icon: "🤖",
    description: "Z.ai native AI models for healthcare applications",
  },
  openai: {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo", "gpt-4o", "gpt-4o-mini"],
    requiresApiKey: true,
    icon: "🧠",
    description: "OpenAI GPT models for general-purpose AI tasks",
  },
  gemini: {
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1",
    models: ["gemini-pro", "gemini-pro-vision", "gemini-1.5-pro", "gemini-1.5-flash"],
    requiresApiKey: true,
    icon: "💎",
    description: "Google's Gemini models for multimodal AI capabilities",
  },
  claude: {
    name: "Anthropic Claude",
    baseUrl: "https://api.anthropic.com/v1",
    models: ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku", "claude-3-5-sonnet"],
    requiresApiKey: true,
    icon: "🎭",
    description: "Anthropic's Claude models with strong reasoning capabilities",
  },
  ollama: {
    name: "Ollama (Local)",
    baseUrl: "http://localhost:11434",
    models: ["llama2", "mistral", "codellama", "phi3", "gemma"],
    requiresApiKey: false,
    icon: "🦙",
    description: "Run open-source models locally with Ollama",
  },
  other: {
    name: "Other / Custom",
    baseUrl: "",
    models: [],
    requiresApiKey: true,
    icon: "⚙️",
    description: "Custom LLM provider with your own configuration",
  },
};

export type ProviderType = keyof typeof LLM_PROVIDER_PRESETS;

// Helper function to get provider preset by key
export function getProviderPreset(provider: string): LLMProviderPreset | undefined {
  return LLM_PROVIDER_PRESETS[provider];
}

// Helper function to get all provider keys
export function getProviderKeys(): string[] {
  return Object.keys(LLM_PROVIDER_PRESETS);
}

// Helper function to get provider icon
export function getProviderIcon(provider: string): string {
  return LLM_PROVIDER_PRESETS[provider]?.icon || "🔮";
}

// Helper function to check if provider requires API key
export function providerRequiresApiKey(provider: string): boolean {
  return LLM_PROVIDER_PRESETS[provider]?.requiresApiKey ?? true;
}

// Helper function to get provider models
export function getProviderModels(provider: string): string[] {
  return LLM_PROVIDER_PRESETS[provider]?.models ?? [];
}
