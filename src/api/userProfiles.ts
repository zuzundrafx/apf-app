import * as XLSX from 'xlsx';

const YA_TOKEN = import.meta.env.VITE_YA_TOKEN;
const PROFILES_FOLDER = "UFC_Bot_Results";
const PROFILES_FILENAME = "UFC_User_Profiles.xlsx";

export interface UserProfile {
  userId: string;
  username: string;
  level: number;
  experience: number;
  coins: number;
  lastUpdated: string;
  processedTournaments?: {
    coins: string[];  // массив ID турниров, за которые начислены монеты
    exp: string[];    // массив ID турниров, за которые начислен опыт
  };
}

// Функция для проверки существования файла
async function checkFileExists(filename: string): Promise<boolean> {
  try {
    console.log('🔍 Проверяем существование файла:', filename);
    const response = await fetch(
      `https://cloud-api.yandex.net/v1/disk/resources?path=app:/${PROFILES_FOLDER}/${filename}`,
      {
        headers: {
          'Authorization': `OAuth ${YA_TOKEN}`
        }
      }
    );
    console.log('📁 Результат проверки:', response.status, response.ok);
    return response.ok;
  } catch (error) {
    console.error('❌ Ошибка проверки файла:', error);
    return false;
  }
}

// Функция для удаления файла, если он существует
async function deleteFileIfExists(filename: string): Promise<boolean> {
  try {
    const exists = await checkFileExists(filename);
    if (exists) {
      console.log('🗑️ Удаляем существующий файл:', filename);
      const response = await fetch(
        `https://cloud-api.yandex.net/v1/disk/resources?path=app:/${PROFILES_FOLDER}/${filename}&permanently=true`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `OAuth ${YA_TOKEN}`
          }
        }
      );
      console.log('✅ Результат удаления:', response.status, response.ok);
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
    console.log('📤 Получаем ссылку для загрузки файла:', filename);
    
    await deleteFileIfExists(filename);
    
    const response = await fetch(
      `https://cloud-api.yandex.net/v1/disk/resources/upload?path=app:/${PROFILES_FOLDER}/${filename}&overwrite=true`,
      {
        headers: {
          'Authorization': `OAuth ${YA_TOKEN}`
        }
      }
    );
    
    if (!response.ok) {
      console.error('❌ Ошибка получения ссылки:', response.status, response.statusText);
      throw new Error(`Ошибка получения ссылки: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('✅ Получена ссылка для загрузки:', data.href ? 'да' : 'нет');
    return data.href;
  } catch (error) {
    console.error('❌ Ошибка получения ссылки на загрузку:', error);
    return null;
  }
}

// Функция для получения ссылки на скачивание файла
async function getDownloadLink(filename: string): Promise<string | null> {
  try {
    console.log('📥 Получаем ссылку для скачивания файла:', filename);
    
    const response = await fetch(
      `https://cloud-api.yandex.net/v1/disk/resources/download?path=app:/${PROFILES_FOLDER}/${filename}`,
      {
        headers: {
          'Authorization': `OAuth ${YA_TOKEN}`
        }
      }
    );
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log('📁 Файл не найден (404)');
        return null;
      }
      console.error('❌ Ошибка получения ссылки:', response.status, response.statusText);
      throw new Error(`Ошибка получения ссылки: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('✅ Получена ссылка для скачивания:', data.href ? 'да' : 'нет');
    return data.href;
  } catch (error) {
    console.error('❌ Ошибка получения ссылки на скачивание:', error);
    return null;
  }
}

// Функция для создания папки, если её нет
async function ensureFolderExists(): Promise<boolean> {
  try {
    console.log('📁 Проверяем существование папки:', PROFILES_FOLDER);
    
    const response = await fetch(
      `https://cloud-api.yandex.net/v1/disk/resources?path=app:/${PROFILES_FOLDER}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `OAuth ${YA_TOKEN}`
        }
      }
    );
    
    if (response.status === 404) {
      console.log('📁 Папка не существует, создаём...');
      const mkdirResponse = await fetch(
        `https://cloud-api.yandex.net/v1/disk/resources?path=app:/${PROFILES_FOLDER}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `OAuth ${YA_TOKEN}`
          }
        }
      );
      
      console.log('✅ Результат создания папки:', mkdirResponse.status, mkdirResponse.ok);
      return mkdirResponse.ok;
    }
    
    console.log('✅ Папка существует');
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
      console.log(`📤 Попытка загрузки ${i + 1} из ${maxRetries}...`);
      
      const uploadResponse = await fetch(uploadLink, {
        method: 'PUT',
        body: data,
        headers: {
          'Content-Type': 'application/octet-stream'
        }
      });
      
      if (uploadResponse.ok) {
        console.log(`✅ Файл успешно загружен (попытка ${i + 1})`);
        return true;
      }
      
      if (uploadResponse.status === 423) {
        console.log(`⚠️ Файл заблокирован, попытка ${i + 1} из ${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }
      
      console.error(`❌ Ошибка загрузки: ${uploadResponse.status} (попытка ${i + 1})`);
      throw new Error(`Ошибка загрузки: ${uploadResponse.status}`);
    } catch (error) {
      if (i === maxRetries - 1) {
        console.error(`❌ Все попытки загрузки исчерпаны`);
        throw error;
      }
      console.log(`⚠️ Ошибка загрузки, повтор через ${1000 * (i + 1)}мс...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  return false;
}

// Загрузка всех профилей пользователей
export async function loadAllProfiles(): Promise<UserProfile[]> {
  try {
    console.log('📥 Загружаем профили пользователей...');
    
    const folderOk = await ensureFolderExists();
    if (!folderOk) {
      throw new Error('Не удалось создать папку для профилей');
    }
    
    const downloadLink = await getDownloadLink(PROFILES_FILENAME);
    if (!downloadLink) {
      console.log('📁 Файл профилей ещё не существует');
      return [];
    }
    
    console.log('📥 Скачиваем файл по ссылке...');
    
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
    
    console.log(`✅ Загружено ${data.length} профилей`);
    
    if (data.length > 0) {
      console.log('📊 Пример данных из файла:', data[0]);
    }
    
    return data.map((item: any) => {
      // Функция для безопасного получения числа
      const safeNumber = (value: any, defaultValue: number): number => {
        if (typeof value === 'number') return value;
        if (value === undefined || value === null || value === '') return defaultValue;
        const parsed = Number(value);
        return isNaN(parsed) ? defaultValue : parsed;
      };

      // Парсим processedTournaments
      let processedTournaments = undefined;
      if (item['Processed Coins'] || item['Processed Exp']) {
        processedTournaments = {
          coins: item['Processed Coins'] ? String(item['Processed Coins']).split(',').filter(Boolean) : [],
          exp: item['Processed Exp'] ? String(item['Processed Exp']).split(',').filter(Boolean) : []
        };
      }

      return {
        userId: String(item['User ID'] || ''),
        username: String(item['Username'] || 'Anonymous'),
        level: safeNumber(item['Level'], 1),
        experience: safeNumber(item['Experience'], 0),
        coins: safeNumber(item['Coins'], 100),
        lastUpdated: String(item['Last Updated'] || new Date().toISOString()),
        processedTournaments: processedTournaments
      };
    });
  } catch (error) {
    console.error('❌ Ошибка загрузки профилей:', error);
    return [];
  }
}

// Сохранение профиля пользователя
export async function saveUserProfile(profile: UserProfile): Promise<boolean> {
  try {
    console.log('📤 Сохраняем профиль пользователя:', profile.userId);
    console.log('💰 Монеты для сохранения:', profile.coins);
    console.log('📊 Уровень:', profile.level, 'Опыт:', profile.experience);
    console.log('🏆 Processed tournaments:', profile.processedTournaments);
    
    const folderOk = await ensureFolderExists();
    if (!folderOk) {
      throw new Error('Не удалось создать папку для профилей');
    }
    
    const allProfiles = await loadAllProfiles();
    console.log('📊 Загружено существующих профилей:', allProfiles.length);
    
    const existingIndex = allProfiles.findIndex(p => p.userId === profile.userId);
    if (existingIndex >= 0) {
      allProfiles[existingIndex] = {
        ...profile,
        lastUpdated: new Date().toISOString()
      };
      console.log('🔄 Обновлен существующий профиль');
    } else {
      allProfiles.push({
        ...profile,
        lastUpdated: new Date().toISOString()
      });
      console.log('➕ Добавлен новый профиль');
    }
    
    allProfiles.sort((a, b) => {
      if (b.level !== a.level) return b.level - a.level;
      return b.experience - a.experience;
    });
    
    const excelData = allProfiles.map(profile => {
      const row: any = {
        'User ID': profile.userId,
        'Username': profile.username,
        'Level': profile.level,
        'Experience': profile.experience,
        'Coins': profile.coins,
        'Last Updated': profile.lastUpdated
      };
      
      // Сохраняем processedTournaments как строки с запятыми
      if (profile.processedTournaments) {
        row['Processed Coins'] = profile.processedTournaments.coins.join(',');
        row['Processed Exp'] = profile.processedTournaments.exp.join(',');
      }
      
      return row;
    });
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    XLSX.utils.book_append_sheet(wb, ws, 'Профили');
    
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    
    const uploadLink = await getUploadLink(PROFILES_FILENAME);
    if (!uploadLink) {
      throw new Error('Не удалось получить ссылку для загрузки');
    }
    
    console.log('📤 Загружаем файл на Яндекс.Диск...');
    console.log('📁 Путь для загрузки:', `app:/${PROFILES_FOLDER}/${PROFILES_FILENAME}`);
    
    const uploadResponse = await fetch(uploadLink, {
      method: 'PUT',
      body: new Blob([wbout], { type: 'application/octet-stream' })
    });
    
    console.log('📤 Результат загрузки:', uploadResponse.status, uploadResponse.ok);
    
    if (!uploadResponse.ok) {
      console.error('❌ Ошибка загрузки файла:', uploadResponse.status, uploadResponse.statusText);
      throw new Error(`Ошибка загрузки: ${uploadResponse.status}`);
    }
    
    console.log('✅ Файл успешно загружен');
    console.log('📁 Полный путь к файлу:', `app:/${PROFILES_FOLDER}/${PROFILES_FILENAME}`);
    console.log('💰 Сохраненные монеты:', profile.coins);
    
    return true;
    
  } catch (error) {
    console.error('❌ Ошибка сохранения профиля:', error);
    return false;
  }
}

// Загрузка конкретного профиля пользователя
export async function loadUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    console.log('🔍 Загружаем профиль пользователя:', userId);
    const allProfiles = await loadAllProfiles();
    const profile = allProfiles.find(p => p.userId === userId) || null;
    console.log('📥 Загружен профиль из файла:', profile);
    console.log('💰 Монеты в загруженном профиле:', profile?.coins);
    console.log('📊 Уровень в загруженном профиле:', profile?.level);
    console.log('📈 Опыт в загруженном профиле:', profile?.experience);
    console.log('🏆 Processed tournaments:', profile?.processedTournaments);
    return profile;
  } catch (error) {
    console.error('❌ Ошибка загрузки профиля пользователя:', error);
    return null;
  }
}

// Обновление профиля (если были изменения)
export async function updateUserProfileIfChanged(
  userId: string,
  username: string,
  newLevel: number,
  newExperience: number,
  newCoins: number,
  processedTournaments?: { coins: string[]; exp: string[] }
): Promise<boolean> {
  try {
    console.log('🔄 Проверяем необходимость обновления профиля:', userId);
    console.log('💰 Новые монеты:', newCoins);
    console.log('📊 Новый уровень:', newLevel);
    console.log('📈 Новый опыт:', newExperience);
    
    const currentProfile = await loadUserProfile(userId);
    
    if (!currentProfile || 
        currentProfile.level !== newLevel ||
        currentProfile.experience !== newExperience ||
        currentProfile.coins !== newCoins ||
        currentProfile.username !== username ||
        JSON.stringify(currentProfile.processedTournaments) !== JSON.stringify(processedTournaments)) {
      
      console.log('📝 Данные изменились, сохраняем...');
      if (currentProfile) {
        console.log('📊 Было - Уровень:', currentProfile.level, 
                   'Опыт:', currentProfile.experience, 
                   'Монеты:', currentProfile.coins,
                   'Processed:', currentProfile.processedTournaments);
        console.log('➡️ Стало - Уровень:', newLevel, 
                   'Опыт:', newExperience, 
                   'Монеты:', newCoins,
                   'Processed:', processedTournaments);
      }
      
      return await saveUserProfile({
        userId,
        username,
        level: newLevel,
        experience: newExperience,
        coins: newCoins,
        lastUpdated: new Date().toISOString(),
        processedTournaments
      });
    }
    
    console.log('ℹ️ Данные не изменились, пропускаем сохранение');
    return true;
  } catch (error) {
    console.error('❌ Ошибка обновления профиля:', error);
    return false;
  }
}