'use server';

import { and, eq } from 'drizzle-orm';
import { DBAccess } from './db';
import { ModelSetting, modelSettings } from './schema';

export async function getModelSettings(dbAccess: DBAccess, projectId: string): Promise<ModelSetting[]> {
  return dbAccess.query(async ({ db }) => {
    return await db.select().from(modelSettings).where(eq(modelSettings.projectId, projectId));
  });
}

export async function getModelSetting(
  dbAccess: DBAccess,
  projectId: string,
  modelId: string
): Promise<ModelSetting | null> {
  return dbAccess.query(async ({ db }) => {
    const result = await db
      .select()
      .from(modelSettings)
      .where(and(eq(modelSettings.projectId, projectId), eq(modelSettings.modelId, modelId)));
    return result[0] ?? null;
  });
}

export async function getDefaultModel(dbAccess: DBAccess, projectId: string): Promise<ModelSetting | null> {
  return dbAccess.query(async ({ db }) => {
    const result = await db
      .select()
      .from(modelSettings)
      .where(
        and(eq(modelSettings.projectId, projectId), eq(modelSettings.isDefault, true), eq(modelSettings.enabled, true))
      );
    return result[0] ?? null;
  });
}

export async function getEnabledModelIds(dbAccess: DBAccess, projectId: string): Promise<string[]> {
  return dbAccess.query(async ({ db }) => {
    const settings = await db
      .select({ modelId: modelSettings.modelId })
      .from(modelSettings)
      .where(and(eq(modelSettings.projectId, projectId), eq(modelSettings.enabled, true)));
    return settings.map((s) => s.modelId);
  });
}

export type EnabledModel = {
  id: string;
  name: string;
  isDefault: boolean;
};

export async function getEnabledModelsFromDB(dbAccess: DBAccess, projectId: string): Promise<EnabledModel[] | null> {
  return dbAccess.query(async ({ db }) => {
    const settings = await db
      .select({
        modelId: modelSettings.modelId,
        modelName: modelSettings.modelName,
        isDefault: modelSettings.isDefault
      })
      .from(modelSettings)
      .where(and(eq(modelSettings.projectId, projectId), eq(modelSettings.enabled, true)));

    // If no settings exist, return null to signal that registry should be used
    if (settings.length === 0) {
      return null;
    }

    // Sort: default first, then alphabetically by name
    return settings
      .map((s) => ({
        id: s.modelId,
        name: s.modelName ?? s.modelId, // Fallback to modelId if name not saved
        isDefault: s.isDefault
      }))
      .sort((a, b) => {
        if (a.isDefault !== b.isDefault) {
          return a.isDefault ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
  });
}

export async function getDisabledModelIds(dbAccess: DBAccess, projectId: string): Promise<string[]> {
  return dbAccess.query(async ({ db }) => {
    const settings = await db
      .select({ modelId: modelSettings.modelId })
      .from(modelSettings)
      .where(and(eq(modelSettings.projectId, projectId), eq(modelSettings.enabled, false)));
    return settings.map((s) => s.modelId);
  });
}

export async function updateModelEnabled(
  dbAccess: DBAccess,
  projectId: string,
  modelId: string,
  enabled: boolean,
  modelName?: string
): Promise<ModelSetting> {
  return dbAccess.query(async ({ db }) => {
    const existing = await db
      .select()
      .from(modelSettings)
      .where(and(eq(modelSettings.projectId, projectId), eq(modelSettings.modelId, modelId)));

    if (existing[0]) {
      const updateData: { enabled: boolean; updatedAt: Date; modelName?: string } = {
        enabled,
        updatedAt: new Date()
      };
      // Update modelName if provided and not already set
      if (modelName && !existing[0].modelName) {
        updateData.modelName = modelName;
      }
      const result = await db
        .update(modelSettings)
        .set(updateData)
        .where(and(eq(modelSettings.projectId, projectId), eq(modelSettings.modelId, modelId)))
        .returning();
      return result[0]!;
    } else {
      const result = await db
        .insert(modelSettings)
        .values({
          projectId,
          modelId,
          modelName,
          enabled,
          isDefault: false
        })
        .returning();
      return result[0]!;
    }
  });
}

export async function setDefaultModel(
  dbAccess: DBAccess,
  projectId: string,
  modelId: string,
  modelName?: string
): Promise<ModelSetting> {
  return dbAccess.query(async ({ db }) => {
    return await db.transaction(async (trx) => {
      // Clear existing default
      await trx
        .update(modelSettings)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(eq(modelSettings.projectId, projectId), eq(modelSettings.isDefault, true)));

      // Check if setting exists for this model
      const existing = await trx
        .select()
        .from(modelSettings)
        .where(and(eq(modelSettings.projectId, projectId), eq(modelSettings.modelId, modelId)));

      if (existing[0]) {
        // Update existing to be default and ensure it's enabled
        const updateData: { isDefault: boolean; enabled: boolean; updatedAt: Date; modelName?: string } = {
          isDefault: true,
          enabled: true,
          updatedAt: new Date()
        };
        // Update modelName if provided and not already set
        if (modelName && !existing[0].modelName) {
          updateData.modelName = modelName;
        }
        const result = await trx
          .update(modelSettings)
          .set(updateData)
          .where(and(eq(modelSettings.projectId, projectId), eq(modelSettings.modelId, modelId)))
          .returning();
        return result[0]!;
      } else {
        // Create new setting as default
        const result = await trx
          .insert(modelSettings)
          .values({
            projectId,
            modelId,
            modelName,
            enabled: true,
            isDefault: true
          })
          .returning();
        return result[0]!;
      }
    });
  });
}

export async function deleteModelSetting(dbAccess: DBAccess, projectId: string, modelId: string): Promise<void> {
  return dbAccess.query(async ({ db }) => {
    await db
      .delete(modelSettings)
      .where(and(eq(modelSettings.projectId, projectId), eq(modelSettings.modelId, modelId)));
  });
}
