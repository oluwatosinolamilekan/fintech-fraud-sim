import { registerCountryProfilesFromPlugin } from './country-profiles.js';
import { registerPlatformPresetsFromPlugin } from './platforms.js';
import type { GenerateOptions, GenerationPlugin } from './types.js';

const registeredPlugins = new Map<string, GenerationPlugin>();

export function defineGenerationPlugin(plugin: GenerationPlugin): GenerationPlugin {
  return plugin;
}

export function registerGenerationPlugin(plugin: GenerationPlugin): void {
  registeredPlugins.set(plugin.name, plugin);
  registerCountryProfilesFromPlugin(plugin);
  registerPlatformPresetsFromPlugin(plugin);
}

export function listGenerationPlugins(): GenerationPlugin[] {
  return [...registeredPlugins.values()];
}

export function applyGenerationPlugins(options: GenerateOptions): GenerateOptions {
  let nextOptions = { ...options };
  const plugins = [...registeredPlugins.values(), ...(options.plugins ?? [])];

  for (const plugin of plugins) {
    registerCountryProfilesFromPlugin(plugin);
    registerPlatformPresetsFromPlugin(plugin);
    if (plugin.configureOptions) {
      nextOptions = {
        ...nextOptions,
        ...plugin.configureOptions(nextOptions)
      };
    }
  }

  return nextOptions;
}
