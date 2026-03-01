import * as XLSX from 'xlsx';
import { SelectedFighter } from '../types';

const YA_TOKEN = import.meta.env.VITE_YA_TOKEN;
const RESULTS_FOLDER = "UFC_Bot_Results";

export interface UserResult {
  userId: string;
  username: string;
  totalDamage: number;
  timestamp: string;
  selections: SelectedFighter[];
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  totalDamage: number;
  userId: string;
  timestamp: string;
}

// Функция для проверки существования файла
async function checkFileExists(filename: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://cloud-api.yandex.net/v1/disk/resources?path=app:/${RESULTS_FOLDER}/${filename}`,
      {
        headers: {
          'Authorization': `OAuth ${YA_TOKEN}`
        }
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}

// Функция для удаления файла, если он существует
async function deleteFileIfExists(filename: string): Promise<boolean> {
  try {
    const exists = await checkFileExists(filename);
    if (exists) {
      const response = await fetch(
        `https://cloud-api.yandex.net/v1/disk/resources?path=app:/${RESULTS_FOLDER}/${filename}&permanently=true`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `OAuth ${YA_TOKEN}`
          }
        }
      );
      return response.ok;
    }
    return true;
  } catch (error) {
    console.error('❌ Ошибка удаления файла:', error);
    return false;
  }
}

// Функция для получения ссылки на загрузку файла
async function getUploadLink(filename: string): Promise<string | null> {
  try {
    await deleteFileIfExists(filename);
    
    const response = await fetch(
      `https://cloud-api.yandex.net/v1/disk/resources/upload?path=app:/${RESULTS_FOLDER}/${filename}&overwrite=true`,
      {
        headers: {
          'Authorization': `OAuth ${YA_TOKEN}`
        }
      }
    );
    
    if (!response.ok) {
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

// Функция для загрузки с повторными попытками
async function uploadWithRetry(
  uploadLink: string, 
  data: Blob, 
  maxRetries: number = 3
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const uploadResponse = await fetch(uploadLink, {
        method: 'PUT',
        body: data,
        headers: {
          'Content-Type': 'application/octet-stream'
        }
      });
      
      if (uploadResponse.ok) {
        return true;
      }
      
      if (uploadResponse.status === 423) {
        console.log(`⚠️ Файл заблокирован, попытка ${i + 1} из ${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }
      
      throw new Error(`Ошибка загрузки: ${uploadResponse.status}`);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.log(`⚠️ Ошибка загрузки, попытка ${i + 1} из ${maxRetries}`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  return false;
}

// Основная функция сохранения результатов
export async function saveUserResults(
  tournamentName: string,
  userResult: UserResult,
  overwrite: boolean = false
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
    
    const uploadLink = await getUploadLink(filename);
    if (!uploadLink) {
      throw new Error('Не удалось получить ссылку для загрузки');
    }
    
    const existingResults = await loadExistingResults(tournamentName);
    
    let updatedResults: UserResult[];
    
    if (overwrite) {
      const userIndex = existingResults.findIndex(r => r.userId === userResult.userId);
      if (userIndex >= 0) {
        updatedResults = [...existingResults];
        updatedResults[userIndex] = userResult;
        console.log('🔄 Обновлен существующий результат пользователя');
      } else {
        updatedResults = [...existingResults, userResult];
        console.log('➕ Добавлен новый результат пользователя');
      }
    } else {
      const exists = existingResults.some(r => r.userId === userResult.userId);
      if (!exists) {
        updatedResults = [...existingResults, userResult];
        console.log('➕ Добавлен новый результат пользователя');
      } else {
        console.log('ℹ️ Результат пользователя уже существует, используйте overwrite для обновления');
        updatedResults = existingResults;
      }
    }
    
    updatedResults.sort((a, b) => b.totalDamage - a.totalDamage);
    
    const excelData = updatedResults.map((result, index) => {
      const row: any = {
        'Место': index + 1,
        'User ID': result.userId,
        'Username': result.username,
        'Total Damage': Math.round(result.totalDamage),
        'Timestamp': result.timestamp,
      };
      
      result.selections.forEach((sel, i) => {
        row[`Боец ${i + 1}`] = sel.fighter.Fighter;
        row[`Вес ${i + 1}`] = sel.weightClass;
        row[`Урон ${i + 1}`] = Math.round(sel.fighter['Total Damage']);
        row[`W/L ${i + 1}`] = sel.fighter['W/L'] || '';
        row[`Method ${i + 1}`] = sel.fighter['Method'] || '';
        row[`Round ${i + 1}`] = sel.fighter['Round'] || 0;
        row[`Time ${i + 1}`] = sel.fighter['Time'] || '';
      });
      
      return row;
    });
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    XLSX.utils.book_append_sheet(wb, ws, 'Результаты');
    
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    
    const uploadSuccess = await uploadWithRetry(
      uploadLink,
      new Blob([wbout], { type: 'application/octet-stream' })
    );
    
    if (!uploadSuccess) {
      throw new Error('Не удалось загрузить файл после нескольких попыток');
    }
    
    console.log('✅ Результаты успешно сохранены на Яндекс.Диск');
    return true;
    
  } catch (error) {
    console.error('❌ Ошибка сохранения:', error);
    return false;
  }
}

// Функция для загрузки существующих результатов
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
    
    console.log(`✅ Загружено ${data.length} существующих записей`);
    
    // Загружаем существующие результаты
return data.map((item: any) => {
  const selections: SelectedFighter[] = [];
  let i = 1;
  
  while (item[`Боец ${i}`]) {
    // Преобразуем строковое значение W/L в корректный тип
    const wlValue = String(item[`W/L ${i}`] || '').toLowerCase();
    let wl: 'win' | 'lose' = 'lose'; // По умолчанию 'lose', если значение не определено
    
    if (wlValue === 'win') {
      wl = 'win';
    } else if (wlValue === 'lose') {
      wl = 'lose';
    } else {
      wl = 'lose'; // Для всех остальных случаев (пустая строка, undefined и т.д.) ставим 'lose'
    }
    
    selections.push({
      weightClass: String(item[`Вес ${i}`] || ''),
      fighter: {
        Fighter: String(item[`Боец ${i}`]),
        'Total Damage': Number(item[`Урон ${i}`]) || 0,
        'W/L': wl,  // Теперь всегда 'win' или 'lose'
        'Method': String(item[`Method ${i}`] || ''),
        'Round': Number(item[`Round ${i}`]) || 0,
        'Time': String(item[`Time ${i}`] || ''),
        'Weight class': String(item[`Вес ${i}`] || ''),
        'Fight_ID': 0,
        'Kd': 0,
        'Str': 0,
        'Td': 0,
        'Sub': 0,
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
    selections: selections
  };
});
    
  } catch (error) {
    console.error('❌ Ошибка загрузки существующих результатов:', error);
    return [];
  }
}

// Функция для загрузки рейтинга
export async function loadLeaderboard(tournamentName: string): Promise<LeaderboardEntry[]> {
  try {
    const cleanName = tournamentName
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/\s+/g, '_');
    const filename = `UFC_Tournament_Results_${cleanName}.xlsx`;
    
    console.log('📥 Загружаем рейтинг из файла:', filename);
    
    const downloadLink = await getDownloadLink(filename);
    if (!downloadLink) {
      console.log('📁 Файл рейтинга ещё не создан');
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
    
    console.log(`✅ Загружено ${data.length} записей`);
    
    const entries: LeaderboardEntry[] = data.map((item: any) => ({
      rank: 0,
      username: String(item['Username'] || 'Anonymous'),
      totalDamage: Math.round(Number(item['Total Damage']) || 0),
      userId: String(item['User ID'] || ''),
      timestamp: String(item['Timestamp'] || '')
    }));
    
    entries.sort((a, b) => b.totalDamage - a.totalDamage);
    
    let currentRank = 1;
    for (let i = 0; i < entries.length; i++) {
      if (i > 0 && entries[i].totalDamage === entries[i-1].totalDamage) {
        entries[i].rank = entries[i-1].rank;
      } else {
        entries[i].rank = currentRank;
      }
      currentRank++;
    }
    
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