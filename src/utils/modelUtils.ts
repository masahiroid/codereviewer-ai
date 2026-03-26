const DATED_MODEL_PATTERN = /(\d{4}-\d{2}-\d{2}|\d{8})$/;

export function isDatedModel(modelId: string): boolean {
  return DATED_MODEL_PATTERN.test(modelId.trim());
}

export function filterModels(modelIds: string[], omitDatedModels: boolean): string[] {
  const normalized = [...new Set(modelIds.map((modelId) => modelId.trim()).filter(Boolean))].sort();

  if (!omitDatedModels) {
    return normalized;
  }

  return normalized.filter((modelId) => !isDatedModel(modelId));
}
