import { filterModels } from '../utils/modelUtils';
import { OpenAiClient } from './openaiClient';

export class ModelService {
  public constructor(private readonly openAiClient: OpenAiClient) {}

  public async listModels(apiKey: string, omitDatedModels: boolean): Promise<string[]> {
    const models = await this.openAiClient.listModels(apiKey);
    return filterModels(models, omitDatedModels);
  }
}
