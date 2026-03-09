import * as XLSX from 'xlsx';
import { Fighter, Tournament, DiskFileInfo } from '../types';

// Токен для доступа к Яндекс.Диску (тот же, что в парсере)
const YA_TOKEN = "y0__xCOz-U8GI3sPSCOyp-2FnBLBQ7drGtOupKGVfu4CpN2qtUs";

// Базовая папка с файлами на Диске
const DISK_FOLDER = "app:/";

export async function getTournamentFiles(): Promise<DiskFileInfo[]> {
  try {
    console.log('📥 Получаю список файлов с Яндекс.Диска...');
    
    // Используем API Яндекс.Диска для получения списка файлов
    const response = await fetch(`https://cloud-api.yandex.net/v1/disk/resources?path=${DISK_FOLDER}`, {
      headers: {
        'Authorization': `OAuth ${YA_TOKEN}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка получения списка: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Фильтруем только Excel-файлы турниров
    const tournamentFiles = data._embedded.items
      .filter((item: any) => 
        item.name.endsWith('.xlsx') && 
        (item.name.startsWith('UFC_') || item.name.startsWith('UPCOMING_'))
      )
      .map((item: any) => ({
        name: item.name,
        path: item.path,
        created: item.created
      }));
    
    console.log(`✅ Найдено файлов турниров: ${tournamentFiles.length}`);
    return tournamentFiles;
    
  } catch (error) {
    console.error('❌ Ошибка получения списка файлов:', error);
    return [];
  }
}

export async function downloadTournamentFile(filename: string): Promise<Fighter[] | null> {
  try {
    console.log(`📥 Скачиваю файл: ${filename}`);
    
    // Получаем ссылку на скачивание
    const downloadUrl = `https://cloud-api.yandex.net/v1/disk/resources/download?path=app:/${filename}`;
    const response = await fetch(downloadUrl, {
      headers: {
        'Authorization': `OAuth ${YA_TOKEN}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка получения ссылки: ${response.status}`);
    }
    
    const { href } = await response.json();
    
    // ИСПОЛЬЗУЕМ ПРОКСИ
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(href)}`;
    const fileResponse = await fetch(proxyUrl);
    
    if (!fileResponse.ok) {
      throw new Error(`Ошибка скачивания через прокси: ${fileResponse.status}`);
    }
    
    const arrayBuffer = await fileResponse.arrayBuffer();
    
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet) as Fighter[];
  } catch (error) {
    console.error(`❌ Ошибка скачивания ${filename}:`, error);
    return null;
  }
}

export function parseTournamentFromFilename(filename: string): Partial<Tournament> {
  const isUpcoming = filename.startsWith('UPCOMING_');
  
  // Определяем лигу по названию файла
  let league = 'UFC'; // по умолчанию
  if (filename.includes('PFL_')) {
    league = 'PFL';
  } else if (filename.includes('ONE_')) {
    league = 'ONE';
  } else if (filename.includes('Bellator_')) {
    league = 'Bellator';
  }
  
  // Убираем префикс UPCOMING_ если есть, и расширение
  let namePart = filename;
  if (isUpcoming) {
    namePart = filename.replace(/^UPCOMING_/, '').replace('.xlsx', '');
  } else {
    namePart = filename.replace('.xlsx', '');
  }
  
  // Заменяем подчеркивания на пробелы
  namePart = namePart.replace(/_/g, ' ');
  
  console.log('Parsing filename:', filename);
  console.log('Name part:', namePart);
  console.log('League:', league);
  
  // Ищем дату в формате "Month DD, YYYY" в имени файла
  const datePattern = /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/;
  const dateMatch = namePart.match(datePattern);
  
  let eventDate = 'Date TBD';
  let eventName = namePart;
  
  if (dateMatch) {
    eventDate = dateMatch[0];
    const dateIndex = namePart.indexOf(dateMatch[0]);
    if (dateIndex > 0) {
      eventName = namePart.substring(0, dateIndex).trim();
    }
    console.log('Found date:', eventDate);
    console.log('Event name:', eventName);
  } else {
    console.log('No date found in filename');
  }
  
  return {
    name: eventName || namePart,
    league: league,
    status: isUpcoming ? 'upcoming' : 'active',
    date: eventDate,
    filename: filename,
    data: null,
    id: filename,
    url: ''
  };
}