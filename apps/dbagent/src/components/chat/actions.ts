'use server';

import {
  getDefaultLanguageModel,
  getDefaultLanguageModelForProject,
  getDefaultModelIdForProject,
  getLanguageModel,
  listLanguageModels,
  listLanguageModelsForProject,
  Model
} from '~/lib/ai/providers';
import { getUserSessionDBAccess } from '~/lib/db/db';

export async function actionGetLanguageModels() {
  const models = await listLanguageModels();
  return models.map(getModelInfo);
}

export async function actionGetLanguageModelsForProject(projectId: string) {
  const dbAccess = await getUserSessionDBAccess();
  const models = await listLanguageModelsForProject(dbAccess, projectId);
  const defaultModelId = await getDefaultModelIdForProject(dbAccess, projectId);

  // Sort: default first, then alphabetically by name
  const modelsWithInfo = models.map(getModelInfo);
  modelsWithInfo.sort((a, b) => {
    // Default model first
    if (a.id === defaultModelId && b.id !== defaultModelId) return -1;
    if (b.id === defaultModelId && a.id !== defaultModelId) return 1;
    // Alphabetical by name
    return a.name.localeCompare(b.name);
  });

  return modelsWithInfo;
}

export async function actionGetDefaultLanguageModel() {
  const model = await getDefaultLanguageModel();
  return getModelInfo(model);
}

export async function actionGetDefaultLanguageModelForProject(projectId: string) {
  const dbAccess = await getUserSessionDBAccess();
  const model = await getDefaultLanguageModelForProject(dbAccess, projectId);
  if (!model) {
    return null;
  }
  return getModelInfo(model);
}

export async function actionGetLanguageModel(modelId: string) {
  const model = await getLanguageModel(modelId);
  return getModelInfo(model);
}

function getModelInfo(model: Model): { id: string; name: string } {
  const { private: _, ...info } = model.info();
  return info;
}
