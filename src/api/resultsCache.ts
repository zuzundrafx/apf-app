// resultsCache.ts
import { UserResult, loadExistingResults } from './yandexUpload';

class ResultsCache {
  private cache: Map<string, UserResult[]> = new Map();
  private loading: Map<string, Promise<UserResult[]>> = new Map();

  async getTournamentResults(tournamentName: string): Promise<UserResult[]> {
    // Если уже загружаем - ждем тот же промис
    if (this.loading.has(tournamentName)) {
      return this.loading.get(tournamentName)!;
    }

    // Если есть в кэше - возвращаем
    if (this.cache.has(tournamentName)) {
      return this.cache.get(tournamentName)!;
    }

    // Загружаем и кэшируем
    const promise = loadExistingResults(tournamentName).then(results => {
      this.cache.set(tournamentName, results);
      this.loading.delete(tournamentName);
      return results;
    });

    this.loading.set(tournamentName, promise);
    return promise;
  }

  getUserResults(tournamentName: string, userId: string): UserResult | null {
    const results = this.cache.get(tournamentName);
    if (!results) return null;
    return results.find(r => r.userId === userId) || null;
  }

  clear() {
    this.cache.clear();
    this.loading.clear();
  }
}

export const resultsCache = new ResultsCache();