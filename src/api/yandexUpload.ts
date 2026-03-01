import * as XLSX from 'xlsx';
import { SelectedFighter } from '../types';

const YA_TOKEN = "y0__xCOz-U8GI3sPSCOyp-2FnBLBQ7drGtOupKGVfu4CpN2qtUs";
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
    // Сначала пробуем удалить старый файл, если он существует
    await deleteFileIfExists(filename);
    
    // Затем запрашиваем ссылку на загрузку
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
      // Папка не существует, создаём
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
        // Ждём перед повторной попыткой
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
    
    // Формируем имя файла
    const cleanName = tournamentName
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/\s+/g, '_');
    const filename = `UFC_Tournament_Results_${cleanName}.xlsx`;
    
    console.log('📁 Имя файла:', filename);
    
    // Проверяем/создаём папку
    const folderOk = await ensureFolderExists();
    if (!folderOk) {
      throw new Error('Не удалось создать папку для результатов');
    }
    
    // Получаем ссылку для загрузки
    const uploadLink = await getUploadLink(filename);
    if (!uploadLink) {
      throw new Error('Не удалось получить ссылку для загрузки');
    }
    
    // Загружаем существующие результаты
    const existingResults = await loadExistingResults(tournamentName);
    
    // Обновляем или добавляем результат пользователя
    let updatedResults: UserResult[];
    
    if (overwrite) {
      // Режим перезаписи - заменяем существующий результат пользователя
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
      // Обычный режим - добавляем новый результат, если его нет
      const exists = existingResults.some(r => r.userId === userResult.userId);
      if (!exists) {
        updatedResults = [...existingResults, userResult];
        console.log('➕ Добавлен новый результат пользователя');
      } else {
        console.log('ℹ️ Результат пользователя уже существует, используйте overwrite для обновления');
        updatedResults = existingResults;
      }
    }
    
    // Сортируем по урону (от большего к меньшему)
    updatedResults.sort((a, b) => b.totalDamage - a.totalDamage);
    
    // Преобразуем в формат Excel
    const excelData = updatedResults.map((result, index) => {
      // Создаем базовый объект
      const row: any = {
        'Место': index + 1,
        'User ID': result.userId,
        'Username': result.username,
        'Total Damage': result.totalDamage,
        'Timestamp': result.timestamp,
      };
      
      // Добавляем каждого бойца
      result.selections.forEach((sel, i) => {
        row[`Боец ${i + 1}`] = sel.fighter.Fighter;
        row[`Вес ${i + 1}`] = sel.weightClass;
        row[`Урон ${i + 1}`] = sel.fighter['Total Damage'];
      });
      
      return row;
    });
    
    // Создаём Excel файл
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    XLSX.utils.book_append_sheet(wb, ws, 'Результаты');
    
    // Конвертируем в бинарные данные
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    
    // Загружаем файл с повторными попытками
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
    
    // ИСПОЛЬЗУЕМ ПРОКСИ
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(downloadLink)}`;
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
      console.error('❌ Ошибка скачивания через прокси:', response.status);
      return [];
    }
    
    const arrayBuffer = await response.arrayBuffer();
    
    // Читаем Excel
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);
    
    console.log(`✅ Загружено ${data.length} существующих записей`);
    
    // Преобразуем в формат UserResult
    return data.map((item: any) => {
      // Собираем выбранных бойцов
      const selections: SelectedFighter[] = [];
      let i = 1;
      
      while (item[`Боец ${i}`]) {
        selections.push({
          weightClass: String(item[`Вес ${i}`] || ''),
          fighter: {
            Fighter: String(item[`Боец ${i}`]),
            'Total Damage': Number(item[`Урон ${i}`]) || 0,
            'Weight class': String(item[`Вес ${i}`] || ''),
            'Fight_ID': 0,
            'W/L': 'lose' as const,
            'Kd': 0,
            'Str': 0,
            'Td': 0,
            'Sub': 0,
            'Head': 0,
            'Body': 0,
            'Leg': 0,
            'Weight Coefficient': 1,
            'Method': '',
            'Round': 0,
            'Time': ''
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
    
    // ИСПОЛЬЗУЕМ ПРОКСИ (как везде)
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(downloadLink)}`;
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
      console.error('❌ Ошибка скачивания через прокси:', response.status);
      return [];
    }
    const arrayBuffer = await response.arrayBuffer();
    
    // Читаем Excel
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);
    
    console.log(`✅ Загружено ${data.length} записей`);
    
    // Преобразуем в нужный формат
    const entries: LeaderboardEntry[] = data.map((item: any) => ({
      rank: 0, // будет пересчитано позже
      username: String(item['Username'] || 'Anonymous'),
      totalDamage: Number(item['Total Damage']) || 0,
      userId: String(item['User ID'] || ''),
      timestamp: String(item['Timestamp'] || '')
    }));
    
    // Сортируем по урону (от большего к меньшему)
    entries.sort((a, b) => b.totalDamage - a.totalDamage);
    
    // Присваиваем места (с учётом одинакового урона)
    let currentRank = 1;
    for (let i = 0; i < entries.length; i++) {
      if (i > 0 && entries[i].totalDamage === entries[i-1].totalDamage) {
        entries[i].rank = entries[i-1].rank;
      } else {
        entries[i].rank = currentRank;
      }
      currentRank++;
    }
    
    return entries.slice(0, 100); // Топ-100
    
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