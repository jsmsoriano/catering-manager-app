// ============================================================================
// APP SETTINGS (Business Template) – server-side read/write
// ============================================================================
// Used by API routes. If Supabase is unavailable, getTemplateConfig returns
// default; saveTemplateConfig returns false (caller may fall back to localStorage).

import { createClient } from '@/lib/supabase/server';
import {
  DEFAULT_TEMPLATE,
  HIBACHI_TEMPLATE,
  normalizeTemplateConfig,
  type BusinessTemplateConfig,
} from './templateConfig';

const APP_SETTINGS_ID = 'default';

export interface AppSettingsRow {
  id: string;
  settings: Record<string, unknown>;
  updated_at: string;
}

/** Fetch raw app_settings row from Supabase. Returns null if not configured or row missing. */
export async function getAppSettings(): Promise<AppSettingsRow | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('app_settings')
    .select('id, settings, updated_at')
    .eq('id', APP_SETTINGS_ID)
    .single();
  if (error || !data) return null;
  return data as AppSettingsRow;
}

/** Get normalized BusinessTemplateConfig. Seeds HIBACHI if settings empty. */
export async function getTemplateConfig(): Promise<BusinessTemplateConfig> {
  const row = await getAppSettings();
  if (!row || !row.settings || typeof row.settings !== 'object') {
    return { ...DEFAULT_TEMPLATE };
  }
  const raw = (row.settings as Record<string, unknown>).templateConfig ?? row.settings;
  if (!raw || (typeof raw === 'object' && Object.keys(raw).length === 0)) {
    return { ...HIBACHI_TEMPLATE };
  }
  return normalizeTemplateConfig(raw);
}

/** Save template config to Supabase. Returns true if saved, false if Supabase unavailable or error. */
export async function saveTemplateConfig(config: BusinessTemplateConfig): Promise<boolean> {
  const supabase = await createClient();
  if (!supabase) return false;
  const { error } = await supabase
    .from('app_settings')
    .upsert(
      {
        id: APP_SETTINGS_ID,
        settings: { templateConfig: config },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
  return !error;
}
