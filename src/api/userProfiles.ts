import * as XLSX from 'xlsx';

const YA_TOKEN = import.meta.env.VITE_YA_TOKEN;
const PROFILES_FOLDER = "UFC_Bot_Results";
const PROFILES_FILENAME = "UFC_User_Profiles.xlsx";

export interface UserProfile {
  userId: string;
  username: string;
  photoUrl?: string;
  level: number;
  experience: number;
  expPoints: number;
  coins: number;
  tickets: number;
  ton: number;
  lastUpdated: string;
  processedTournaments?: {
    coins: string[];
    exp: string[];
  };
}

// Функция для получения ссылки на загрузку файла
async function getUploadLink(filename: string): Promise<string | null> {
  try {
    console.log('📤 Получаем ссылку для загрузки файла:', filename);
    
    const response = await fetch(
      `https://cloud-api.yandex.net/v1/disk/resources/upload?path=app:/${PROFILES_FOLDER}/${filename}&overwrite=true`,
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

/**
 * Функция миграции: обновляет старый файл, добавляя новые колонки
 */
async function migrateProfilesFile(oldData: any[]): Promise<any[]> {
  console.log('🔄 Запущена миграция файла профилей...');
  
  const hasPhotoUrlColumn = oldData.length > 0 && 'Photo URL' in oldData[0];
  const hasExpPointsColumn = oldData.length > 0 && 'EXP Points' in oldData[0];
  const hasTicketsColumn = oldData.length > 0 && 'Tickets' in oldData[0];
  const hasTONColumn = oldData.length > 0 && 'TON' in oldData[0];
  
  if (hasPhotoUrlColumn && hasExpPointsColumn && hasTicketsColumn && hasTONColumn) {
    console.log('✅ Файл уже имеет все необходимые колонки, миграция не требуется');
    return oldData;
  }
  
  console.log('⚠️ Обнаружена старая версия файла. Выполняем миграцию...');
  
  const migratedData = oldData.map((item: any) => {
    const newItem: any = {};
    
    Object.keys(item).forEach(key => {
      newItem[key] = item[key];
    });
    
    if (!hasPhotoUrlColumn) newItem['Photo URL'] = '';
    if (!hasExpPointsColumn) newItem['EXP Points'] = 0;
    if (!hasTicketsColumn) newItem['Tickets'] = 0;
    if (!hasTONColumn) newItem['TON'] = 0;
    
    return newItem;
  });
  
  console.log(`✅ Миграция завершена. Обновлено ${migratedData.length} записей`);
  return migratedData;
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
    let data = XLSX.utils.sheet_to_json(sheet) as any[];
    
    console.log(`✅ Загружено ${data.length} профилей`);
    
    // Запускаем миграцию, если нужно
    data = await migrateProfilesFile(data);
    
    // Сохраняем обновленный файл обратно на диск
    const needsMigration = data.length > 0 && (!('EXP Points' in data[0]) || !('Tickets' in data[0]) || !('TON' in data[0]));
    if (needsMigration) {
      console.log('💾 Сохраняем обновленный файл с миграцией...');
      
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Профили');
      
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      
      const uploadLink = await getUploadLink(PROFILES_FILENAME);
      if (uploadLink) {
        await fetch(uploadLink, {
          method: 'PUT',
          body: new Blob([wbout], { type: 'application/octet-stream' })
        });
        console.log('✅ Файл успешно обновлен после миграции');
      }
    }
    
    if (data.length > 0) {
      console.log('📊 Пример данных из файла:', data[0]);
    }
    
    const safeNumber = (value: any, defaultValue: number): number => {
      if (typeof value === 'number') return value;
      if (value === undefined || value === null || value === '') return defaultValue;
      const parsed = Number(value);
      return isNaN(parsed) ? defaultValue : parsed;
    };
    
    return data.map((item: any) => {
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
        photoUrl: item['Photo URL'] ? String(item['Photo URL']) : undefined,
        level: safeNumber(item['Level'], 1),
        experience: safeNumber(item['Experience'], 0),
        expPoints: safeNumber(item['EXP Points'], 0),
        coins: safeNumber(item['Coins'], 100),
        tickets: safeNumber(item['Tickets'], 0),
        ton: safeNumber(item['TON'], 0),
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
    console.log('🎫 Билеты для сохранения:', profile.tickets);
    console.log('💎 TON для сохранения:', profile.ton);
    console.log('✨ EXP Points для сохранения:', profile.expPoints);
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
        'Photo URL': profile.photoUrl || '',
        'Level': profile.level,
        'Experience': profile.experience,
        'EXP Points': profile.expPoints,
        'Coins': profile.coins,
        'Tickets': profile.tickets,
        'TON': profile.ton,
        'Last Updated': profile.lastUpdated
      };
      
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
    console.log('🎫 Сохраненные билеты:', profile.tickets);
    console.log('💎 Сохраненный TON:', profile.ton);
    console.log('✨ Сохраненный EXP Points:', profile.expPoints);
    
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
    console.log('🎫 Билеты в загруженном профиле:', profile?.tickets);
    console.log('💎 TON в загруженном профиле:', profile?.ton);
    console.log('✨ EXP Points в загруженном профиле:', profile?.expPoints);
    console.log('📊 Уровень в загруженном профиле:', profile?.level);
    console.log('📈 Опыт в загруженном профиле:', profile?.experience);
    console.log('🏆 Processed tournaments:', profile?.processedTournaments);
    return profile;
  } catch (error) {
    console.error('❌ Ошибка загрузки профиля пользователя:', error);
    return null;
  }
}