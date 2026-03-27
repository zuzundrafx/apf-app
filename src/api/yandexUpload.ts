import * as XLSX from 'xlsx';
import { SelectedFighter, UserResult } from '../types';

const YA_TOKEN = import.meta.env.VITE_YA_TOKEN;
const RESULTS_FOLDER = "UFC_Bot_Results";

export interface LeaderboardEntry {
  rank: number;
  username: string;
  totalDamage: number;
  userId: string;
  timestamp: string;
}

// Функция для получения ссылки на загрузку файла
async function getUploadLink(filename: string): Promise<string | null> {
  try {
    console.log('📤 Получаем ссылку для загрузки файла:', filename);
    
    const response = await fetch(
      `https://cloud-api.yandex.net/v1/disk/resources/upload?path=app:/${RESULTS_FOLDER}/${filename}&overwrite=true`,
      {
        headers: {
          'Authorization': `OAuth ${YA_TOKEN}`
        }
      }
    );
    
    if (!response.ok) {
      if (response.status === 423) {
        console.log('⚠️ Файл заблокирован, пробуем через секунду...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return getUploadLink(filename);
      }
      throw new Error(`Ошибка получения ссылки: ${response.status}`);
    }
    
    const data = await response.json();
    return data.href;
    
  } catch (error) {
    console.error('❌ Ошибка получения ссылки на загрузку:', error);
    return null;
  }
}

// Функция для получения ссылки на скачивание файла
async function getDownloadLink(filename: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://cloud-api.yandex.net/v1/disk/resources/download?path=app:/${RESULTS_FOLDER}/${filename}`,
      {
        headers: {
          'Authorization': `OAuth ${YA_TOKEN}`
        }
      }
    );
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Ошибка получения ссылки: ${response.status}`);
    }
    
    const data = await response.json();
    return data.href;
  } catch (error) {
    console.error('❌ Ошибка получения ссылки на скачивание:', error);
    return null;
  }
}

// Функция для создания папки, если её нет
async function ensureFolderExists(): Promise<boolean> {
  try {
    const response = await fetch(
      `https://cloud-api.yandex.net/v1/disk/resources?path=app:/${RESULTS_FOLDER}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `OAuth ${YA_TOKEN}`
        }
      }
    );
    
    if (response.status === 404) {
      const mkdirResponse = await fetch(
        `https://cloud-api.yandex.net/v1/disk/resources?path=app:/${RESULTS_FOLDER}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `OAuth ${YA_TOKEN}`
          }
        }
      );
      
      return mkdirResponse.ok;
    }
    
    return response.ok;
  } catch (error) {
    console.error('❌ Ошибка проверки папки:', error);
    return false;
  }
}

// Загрузка всех существующих результатов (ВСЕХ пользователей)
export async function loadExistingResults(
  tournamentName: string
): Promise<UserResult[]> {
  try {
    const cleanName = tournamentName
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/\s+/g, '_');
    const filename = `UFC_Tournament_Results_${cleanName}.xlsx`;
    
    console.log('📥 Загружаем существующие результаты из файла:', filename);
    
    const downloadLink = await getDownloadLink(filename);
    if (!downloadLink) {
      console.log('📁 Файл результатов ещё не существует');
      return [];
    }
    
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(downloadLink)}&t=${Date.now()}`;
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
      console.error('❌ Ошибка скачивания через прокси:', response.status);
      return [];
    }
    
    const arrayBuffer = await response.arrayBuffer();
    
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);
    
    console.log(`✅ Загружено ${data.length} записей пользователей`);
    
    return data.map((item: any) => {
      const selections: SelectedFighter[] = [];
      let i = 1;
      
      while (item[`Боец ${i}`]) {
        const wlValue = String(item[`W/L ${i}`] || '').toLowerCase();
        let wl: 'win' | 'lose' | null = null;
        
        if (wlValue === 'win') {
          wl = 'win';
        } else if (wlValue === 'lose') {
          wl = 'lose';
        }
        
        selections.push({
          weightClass: String(item[`Вес ${i}`] || ''),
          fighter: {
            Fighter: String(item[`Боец ${i}`]),
            'Total Damage': Number(item[`Урон ${i}`]) || 0,
            'W/L': wl,
            'Method': String(item[`Method ${i}`] || ''),
            'Round': Number(item[`Round ${i}`]) || 0,
            'Time': String(item[`Time ${i}`] || ''),
            'Weight class': String(item[`Вес ${i}`] || ''),
            'Str': Number(item[`Str ${i}`]) || 0,
            'Td': Number(item[`Td ${i}`]) || 0,
            'Sub': Number(item[`Sub ${i}`]) || 0,
            'Fight_ID': 0,
            'Kd': 0,
            'Head': 0,
            'Body': 0,
            'Leg': 0,
            'Weight Coefficient': 1
          }
        });
        i++;
      }
      
      return {
        userId: String(item['User ID'] || ''),
        username: String(item['Username'] || 'Anonymous'),
        totalDamage: Number(item['Total Damage']) || 0,
        timestamp: String(item['Timestamp'] || ''),
        selections: selections,
        betAmount: item['Bet Amount'] ? Number(item['Bet Amount']) : undefined,
        rewardsAccepted: item['Rewards Accepted'] === 'true' || item['Rewards Accepted'] === true,
        rewards: item['Reward Coins'] ? {
          coins: Number(item['Reward Coins']) || 0,
          experience: Number(item['Reward Exp']) || 0
        } : undefined
      };
    });
    
  } catch (error) {
    console.error('❌ Ошибка загрузки существующих результатов:', error);
    return [];
  }
}

// Основная функция сохранения результатов (СОХРАНЯЕТ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ)
export async function saveUserResults(
  tournamentName: string,
  userResult: UserResult
): Promise<boolean> {
  try {
    console.log('📤 Сохраняем результаты пользователя:', userResult);
    
    const cleanName = tournamentName
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/\s+/g, '_');
    const filename = `UFC_Tournament_Results_${cleanName}.xlsx`;
    
    console.log('📁 Имя файла:', filename);
    
    const folderOk = await ensureFolderExists();
    if (!folderOk) {
      throw new Error('Не удалось создать папку для результатов');
    }
    
    const existingResults = await loadExistingResults(tournamentName);
    
    const existingUserIndex = existingResults.findIndex(r => r.userId === userResult.userId);
    
    let updatedResults: UserResult[];
    
    if (existingUserIndex >= 0) {
      updatedResults = [...existingResults];
      updatedResults[existingUserIndex] = userResult;
      console.log('🔄 Обновлен существующий результат пользователя');
    } else {
      updatedResults = [...existingResults, userResult];
      console.log('➕ Добавлен новый результат пользователя');
    }
    
    updatedResults.sort((a, b) => b.totalDamage - a.totalDamage);
    
    const excelData = updatedResults.map((result, index) => {
      const row: any = {
        'Место': index + 1,
        'User ID': result.userId,
        'Username': result.username,
        'Total Damage': Math.round(result.totalDamage),
        'Bet Amount': result.betAmount || '',
        'Timestamp': result.timestamp,
        'Rewards Accepted': result.rewardsAccepted ? 'true' : '',
        'Reward Coins': result.rewards?.coins || '',
        'Reward Exp': result.rewards?.experience || ''
      };
      
      result.selections.forEach((sel, i) => {
        const num = i + 1;
        row[`Боец ${num}`] = sel.fighter.Fighter;
        row[`Вес ${num}`] = sel.weightClass;
        row[`Урон ${num}`] = Math.round(sel.fighter['Total Damage']);
        row[`W/L ${num}`] = sel.fighter['W/L'] || '';
        row[`Method ${num}`] = sel.fighter['Method'] || '';
        row[`Round ${num}`] = sel.fighter['Round'] || 0;
        row[`Time ${num}`] = sel.fighter['Time'] || '';
        row[`Str ${num}`] = sel.fighter.Str || 0;
        row[`Td ${num}`] = sel.fighter.Td || 0;
        row[`Sub ${num}`] = sel.fighter.Sub || 0;
      });
      
      return row;
    });
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    XLSX.utils.book_append_sheet(wb, ws, 'Результаты');
    
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    
    const uploadLink = await getUploadLink(filename);
    if (!uploadLink) {
      throw new Error('Не удалось получить ссылку для загрузки');
    }
    
    const uploadResponse = await fetch(uploadLink, {
      method: 'PUT',
      body: new Blob([wbout], { type: 'application/octet-stream' })
    });
    
    if (!uploadResponse.ok) {
      throw new Error(`Ошибка загрузки: ${uploadResponse.status}`);
    }
    
    console.log(`✅ Результаты сохранены. Всего пользователей: ${updatedResults.length}`);
    return true;
    
  } catch (error) {
    console.error('❌ Ошибка сохранения:', error);
    return false;
  }
}

// Функция для загрузки рейтинга
export async function loadLeaderboard(tournamentName: string): Promise<LeaderboardEntry[]> {
  try {
    const allResults = await loadExistingResults(tournamentName);
    
    const entries: LeaderboardEntry[] = allResults.map((result, index) => ({
      rank: index + 1,
      username: result.username,
      totalDamage: Math.round(result.totalDamage),
      userId: result.userId,
      timestamp: result.timestamp
    }));
    
    return entries.slice(0, 100);
  } catch (error) {
    console.error('❌ Ошибка загрузки рейтинга:', error);
    return [];
  }
}

// Функция для загрузки результатов конкретного пользователя
export async function loadUserResults(
  tournamentName: string,
  userId: string
): Promise<UserResult | null> {
  try {
    const allResults = await loadExistingResults(tournamentName);
    const userResult = allResults.find(r => r.userId === userId);
    return userResult || null;
  } catch (error) {
    console.error('❌ Ошибка загрузки результатов пользователя:', error);
    return null;
  }
}