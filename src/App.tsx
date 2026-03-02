﻿﻿﻿﻿﻿﻿﻿﻿import { useState, useEffect } from 'react';
import './App.css';
import { Fighter, Tournament, SelectedFighter } from './types';
import { useTournaments } from './hooks/useTournaments';
import { groupFightersByWeight } from './data/loadFighters';
import { 
  saveUserResults, 
  UserResult, 
  loadLeaderboard, 
  LeaderboardEntry, 
  loadUserResults 
} from './api/yandexUpload';
import {
  loadUserProfile,
  saveUserProfile
} from './api/userProfiles';
import * as XLSX from 'xlsx';

// Объявляем глобальный тип для Telegram WebApp
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
            photo_url?: string;
          };
        };
        ready: () => void;
        close: () => void;
        BackButton: {
          isVisible: boolean;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
        };
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          onClick: (callback: () => void) => void;
        };
      };
    };
  }
}

// Пороговые значения для уровней (10 уровней) - сколько опыта нужно для перехода на следующий уровень
const LEVEL_THRESHOLDS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 0]; // 0 для 10 уровня (максимальный)

const BASE_URL = import.meta.env.PROD ? '' : '/reactjs-template';
const YA_TOKEN = import.meta.env.VITE_YA_TOKEN;

// Функция для округления урона до целого числа
const roundDamage = (damage: number): number => {
  return Math.round(damage);
};

// Функция для расчета уровня по общему опыту
const calculateLevel = (totalExp: number): { level: number; currentExp: number; nextLevelExp: number } => {
  let remainingExp = totalExp;
  let level = 1;
  
  // Проходим по порогам уровней
  for (let i = 0; i < LEVEL_THRESHOLDS.length - 1; i++) {
    const expNeeded = LEVEL_THRESHOLDS[i];
    
    if (remainingExp >= expNeeded) {
      // Вычитаем опыт, нужный для этого уровня
      remainingExp -= expNeeded;
      level = i + 2; // +2 потому что i=0 это переход с 1 на 2 уровень
    } else {
      break;
    }
  }
  
  // Следующий порог опыта (сколько нужно для следующего уровня)
  const nextLevelExp = level < 10 ? LEVEL_THRESHOLDS[level - 1] : 0;
  
  return { 
    level, 
    currentExp: remainingExp,  // Текущий опыт на этом уровне
    nextLevelExp 
  };
};

function getAvatarFilename(weightClass: string): string {
  const map: { [key: string]: string } = {
    'Flyweight': 'Flyweight_avatar.png',
    'Bantamweight': 'Bantamweight_avatar.png',
    'Featherweight': 'Featherweight_avatar.png',
    'Lightweight': 'Lightweight_avatar.png',
    'Welterweight': 'Welterweight_avatar.png',
    'Middleweight': 'Middleweight_avatar.png',
    'Light Heavyweight': 'Light_Heavyweight_avatar.png',
    'Heavyweight': 'Heavyweight_avatar.png',
    "Women's Strawweight": "Women's_Strawweight_avatar.png",
    "Women's Flyweight": "Women's_Flyweight_avatar.png",
    "Women's Bantamweight": "Women's_Bantamweight_avatar.png",
    "Catch Weight": 'default-avatar.png'
  };
  
  return map[weightClass] || 'default-avatar.png';
}

function getWeightClassColor(weightClass: string): string {
  const colors: { [key: string]: string } = {
    'Flyweight': '#168760',
    'Bantamweight': '#446E87',
    'Featherweight': '#424A87',
    'Lightweight': '#5F3A87',
    'Welterweight': '#813D87',
    'Middleweight': '#87863B',
    'Light Heavyweight': '#876A0B',
    'Heavyweight': '#870000',
    "Women's Strawweight": '#A6125F',
    "Women's Flyweight": '#58C467',
    "Women's Bantamweight": '#66A4C9',
    "Catch Weight": '#666666'
  };
  return colors[weightClass] || '#666666';
}

function App() {
  const { pastTournament, upcomingTournament, loading, error } = useTournaments();
  
  const [selectedFighters, setSelectedFighters] = useState<Map<string, Fighter>>(new Map());
  const [currentView, setCurrentView] = useState<'main' | 'leaderboard' | 'selection'>('main');
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [loadingUserResults, setLoadingUserResults] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [telegramUser, setTelegramUser] = useState<{
    id: string;
    username: string;
    photoUrl?: string;
  } | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [processedTournaments, setProcessedTournaments] = useState<Set<string>>(new Set());

  const [userData, setUserData] = useState({
    username: 'Player',
    level: 1,
    currentExp: 0,
    totalExp: 0,
    nextLevelExp: 5,
    coins: 100,
    upcomingSelections: [] as SelectedFighter[],
    pastSelections: [] as SelectedFighter[],
    hasBet: false
  });

  // Логируем начальное состояние
  console.log('🏁 Начальное состояние userData:', {
    coins: 100,
    username: 'Player',
    level: 1,
    currentExp: 0,
    totalExp: 0
  });

  const hasUpcomingBet = userData.upcomingSelections.length > 0;
  const hasPastBet = userData.pastSelections.length > 0;

  // Функция для подсчета общего урона с округлением
  const calculateTotalDamage = (selections: SelectedFighter[]): number => {
    const total = selections.reduce((sum, sel) => sum + (sel.fighter['Total Damage'] || 0), 0);
    return roundDamage(total);
  };

  // Функция для начисления монет за победителей
  const awardCoins = async (winners: number, tournamentId: string): Promise<number> => {
    console.log('🎯 awardCoins вызвана:', { winners, tournamentId });
    
    if (processedTournaments.has(`coins_${tournamentId}`)) {
      console.log('ℹ️ Монеты за этот турнир уже были начислены в этой сессии');
      return userData.coins;
    }
    
    if (telegramUser) {
      const currentProfile = await loadUserProfile(telegramUser.id);
      if (currentProfile?.processedTournaments?.coins?.includes(tournamentId)) {
        console.log('ℹ️ Монеты за этот турнир уже были начислены ранее');
        setProcessedTournaments(prev => new Set(prev).add(`coins_${tournamentId}`));
        return userData.coins;
      }
    }
    
    const coinGain = winners * 50;
    const newCoins = userData.coins + coinGain;
    
    setUserData(prev => ({
      ...prev,
      coins: newCoins
    }));
    
    if (telegramUser) {
      const profile = await loadUserProfile(telegramUser.id) || {
        userId: telegramUser.id,
        username: userData.username,
        level: userData.level,
        experience: userData.totalExp,
        coins: newCoins,
        lastUpdated: new Date().toISOString(),
        processedTournaments: { coins: [], exp: [] }
      };
      
      const updatedProfile = {
        ...profile,
        coins: newCoins,
        processedTournaments: {
          coins: [...(profile.processedTournaments?.coins || []), tournamentId],
          exp: profile.processedTournaments?.exp || []
        }
      };
      
      const saved = await saveUserProfile(updatedProfile);
      
      if (saved) {
        console.log(`💰 Начислено монет: +${coinGain} (${winners} победителей)`);
        console.log(`💰 Новый баланс: ${newCoins}`);
        setProcessedTournaments(prev => new Set(prev).add(`coins_${tournamentId}`));
      }
    }
    
    return newCoins;
  };

  // Функция для начисления опыта за угаданных бойцов (с правильным расчетом уровней)
  const awardExperience = async (correctPicks: number, tournamentId: string, currentCoins: number) => {
    console.log('🎯 awardExperience вызвана:', { correctPicks, tournamentId, currentCoins });
    
    if (processedTournaments.has(`exp_${tournamentId}`)) {
      console.log('ℹ️ Опыт за этот турнир уже был начислен в этой сессии');
      return;
    }
    
    if (telegramUser) {
      const currentProfile = await loadUserProfile(telegramUser.id);
      if (currentProfile?.processedTournaments?.exp?.includes(tournamentId)) {
        console.log('ℹ️ Опыт за этот турнир уже был начислен ранее');
        setProcessedTournaments(prev => new Set(prev).add(`exp_${tournamentId}`));
        return;
      }
    }
    
    const expGain = correctPicks * 5;
    const newTotalExp = userData.totalExp + expGain;
    const { level, currentExp, nextLevelExp } = calculateLevel(newTotalExp);
    
    console.log('📊 Расчет опыта:', {
      былоTotal: userData.totalExp,
      gain: expGain,
      сталоTotal: newTotalExp,
      новыйУровень: level,
      опытНаУровне: currentExp,
      нужноДляСледующего: nextLevelExp
    });
    
    setUserData(prev => ({
      ...prev,
      totalExp: newTotalExp,
      currentExp: currentExp,
      level,
      nextLevelExp
    }));
    
    if (telegramUser) {
      console.log('💰 Сохраняем опыт, текущие монеты:', currentCoins);
      
      const profile = await loadUserProfile(telegramUser.id) || {
        userId: telegramUser.id,
        username: userData.username,
        level: level,
        experience: newTotalExp,
        coins: currentCoins,
        lastUpdated: new Date().toISOString(),
        processedTournaments: { coins: [], exp: [] }
      };
      
      const updatedProfile = {
        ...profile,
        level: level,
        experience: newTotalExp, // Сохраняем общий опыт
        coins: currentCoins,
        processedTournaments: {
          coins: profile.processedTournaments?.coins || [],
          exp: [...(profile.processedTournaments?.exp || []), tournamentId]
        }
      };
      
      const saved = await saveUserProfile(updatedProfile);
      
      if (saved) {
        console.log(`✨ Начислено опыта: +${expGain} (${correctPicks} угаданных бойцов)`);
        console.log(`📊 Текущий уровень: ${level}, опыт на уровне: ${currentExp}/${nextLevelExp}`);
        console.log(`💰 Баланс монет: ${currentCoins}`);
        setProcessedTournaments(prev => new Set(prev).add(`exp_${tournamentId}`));
      }
    }
    
    return expGain;
  };

  // Функция для подсчета угаданных бойцов в прошедшем турнире
  const calculateCorrectPicks = (selections: SelectedFighter[]): number => {
    return selections.filter(sel => {
      const fighter = sel.fighter;
      return fighter['W/L'] === 'win';
    }).length;
  };

  // Инициализация Telegram WebApp и загрузка профиля
  useEffect(() => {
    let isMounted = true;
    
    const initTelegram = async () => {
      if (window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.ready();
        
        const user = tg.initDataUnsafe.user;
        if (user && isMounted) {
          const username = user.username || `${user.first_name} ${user.last_name || ''}`.trim();
          const userId = `user_${user.id}`;
          
          setTelegramUser({
            id: userId,
            username: username,
            photoUrl: user.photo_url
          });
          
          setLoadingProfile(true);
          const profile = await loadUserProfile(userId);
          
          if (profile && isMounted) {
            // Из профиля загружаем общий опыт и рассчитываем уровень
            const totalExp = profile.experience || 0;
            const { level, currentExp, nextLevelExp } = calculateLevel(totalExp);
            
            console.log('✅ Профиль загружен:', profile);
            console.log('💰 Загруженные монеты из профиля:', profile.coins);
            console.log('📊 Загружен общий опыт:', totalExp);
            console.log('📈 Рассчитанный уровень:', { level, currentExp, nextLevelExp });
            
            if (profile.processedTournaments) {
              const newProcessed = new Set<string>();
              if (profile.processedTournaments.coins) {
                profile.processedTournaments.coins.forEach(id => 
                  newProcessed.add(`coins_${id}`)
                );
              }
              if (profile.processedTournaments.exp) {
                profile.processedTournaments.exp.forEach(id => 
                  newProcessed.add(`exp_${id}`)
                );
              }
              setProcessedTournaments(newProcessed);
              console.log('🔄 Восстановлены флаги начислений:', Array.from(newProcessed));
            }
            
            setUserData(prev => ({
              ...prev,
              username: profile.username,
              level,
              currentExp,
              totalExp,
              nextLevelExp,
              coins: profile.coins
            }));
            
          } else if (isMounted) {
            console.log('🆕 Создаем новый профиль');
            const newProfile = {
              userId: userId,
              username: username,
              level: 1,
              experience: 0,
              coins: 100,
              lastUpdated: new Date().toISOString()
            };
            
            const saved = await saveUserProfile(newProfile);
            
            if (saved) {
              console.log('✅ Новый профиль создан с монетами: 100');
              setUserData(prev => ({
                ...prev,
                username: username,
                coins: 100
              }));
            }
          }
          
          if (isMounted) {
            setProfileLoaded(true);
            setLoadingProfile(false);
          }
        }
        
        window.addEventListener('beforeunload', () => {
          console.log('🔄 Приложение закрывается');
        });
        
        return () => {
          window.removeEventListener('beforeunload', () => {});
        };
      } else {
        console.log('⚠️ Telegram WebApp не обнаружен, работаем в тестовом режиме');
        
        if (isMounted) {
          setTelegramUser({
            id: 'user_123',
            username: 'Test Player',
            photoUrl: undefined
          });
          
          const profile = await loadUserProfile('user_123');
          if (profile && isMounted) {
            const totalExp = profile.experience || 0;
            const { level, currentExp, nextLevelExp } = calculateLevel(totalExp);
            
            console.log('✅ Тестовый профиль загружен:', profile);
            console.log('💰 Загруженные монеты из тестового профиля:', profile.coins);
            console.log('📊 Загружен общий опыт:', totalExp);
            
            if (profile.processedTournaments) {
              const newProcessed = new Set<string>();
              if (profile.processedTournaments.coins) {
                profile.processedTournaments.coins.forEach(id => 
                  newProcessed.add(`coins_${id}`)
                );
              }
              if (profile.processedTournaments.exp) {
                profile.processedTournaments.exp.forEach(id => 
                  newProcessed.add(`exp_${id}`)
                );
              }
              setProcessedTournaments(newProcessed);
            }
            
            setUserData(prev => ({
              ...prev,
              username: profile.username,
              level,
              currentExp,
              totalExp,
              nextLevelExp,
              coins: profile.coins
            }));
            
          } else if (isMounted) {
            console.log('🆕 Создаем новый тестовый профиль');
            const newProfile = {
              userId: 'user_123',
              username: 'Test Player',
              level: 1,
              experience: 0,
              coins: 100,
              lastUpdated: new Date().toISOString()
            };
            
            const saved = await saveUserProfile(newProfile);
            
            if (saved) {
              console.log('✅ Новый тестовый профиль создан с монетами: 100');
            }
          }
          
          setProfileLoaded(true);
          setLoadingProfile(false);
        }
      }
    };
    
    initTelegram();
    
    return () => {
      isMounted = false;
    };
  }, []);

  // Следим за изменениями userData
  useEffect(() => {
    console.log('📊 userData обновился:', {
      coins: userData.coins,
      level: userData.level,
      currentExp: userData.currentExp,
      totalExp: userData.totalExp,
      username: userData.username
    });
  }, [userData]);

  // Периодическая проверка обновлений профиля (раз в 30 секунд)
  useEffect(() => {
    if (!telegramUser || !profileLoaded) return;
    
    const checkProfileUpdates = async () => {
      console.log('🔄 Проверяю обновления профиля...');
      const updatedProfile = await loadUserProfile(telegramUser.id);
      
      if (updatedProfile) {
        const totalExp = updatedProfile.experience || 0;
        const { level, currentExp, nextLevelExp } = calculateLevel(totalExp);
        
        if (updatedProfile.coins !== userData.coins ||
            updatedProfile.experience !== userData.totalExp ||
            level !== userData.level) {
          
          console.log('📊 Профиль обновлен:', updatedProfile);
          
          setUserData(prev => ({
            ...prev,
            username: updatedProfile.username,
            level,
            currentExp,
            totalExp,
            nextLevelExp,
            coins: updatedProfile.coins
          }));
        }
      }
    };
    
    const interval = setInterval(checkProfileUpdates, 60 * 1000);
    
    return () => clearInterval(interval);
  }, [telegramUser, profileLoaded, userData.coins, userData.totalExp, userData.level]);

  // Функция для скачивания файла с Яндекс.Диска
  const downloadTournamentFile = async (filename: string): Promise<Fighter[] | null> => {
    try {
      const downloadUrl = `https://cloud-api.yandex.net/v1/disk/resources/download?path=app:/${filename}`;
      const response = await fetch(downloadUrl, {
        headers: {
          'Authorization': `OAuth ${YA_TOKEN}`
        }
      });
      
      if (!response.ok) {
        return null;
      }
      
      const { href } = await response.json();
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(href)}&t=${Date.now()}`;
      const fileResponse = await fetch(proxyUrl);
      
      if (!fileResponse.ok) {
        throw new Error(`Ошибка скачивания через прокси: ${fileResponse.status}`);
      }
      
      const arrayBuffer = await fileResponse.arrayBuffer();
      
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      return XLSX.utils.sheet_to_json(sheet) as Fighter[];
    } catch (error) {
      console.error('Ошибка скачивания файла:', error);
      return null;
    }
  };

  // Функция для проверки доступности ставок по дате
  const isBetsAvailable = (): boolean => {
    if (!upcomingTournament) return false;
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tournamentDateStr = upcomingTournament.date;
    
    const months: { [key: string]: string } = {
      'January': '01', 'February': '02', 'March': '03', 'April': '04',
      'May': '05', 'June': '06', 'July': '07', 'August': '08',
      'September': '09', 'October': '10', 'November': '11', 'December': '12'
    };
    
    const parts = tournamentDateStr.split(' ');
    if (parts.length >= 3) {
      const month = parts[0];
      const day = parts[1].replace(',', '');
      const year = parts[2];
      
      if (months[month]) {
        const formattedDay = day.padStart(2, '0');
        const tournamentStr = `${year}-${months[month]}-${formattedDay}`;
        
        console.log('📅 Сегодня:', todayStr, 'Турнир:', tournamentStr);
        
        return todayStr < tournamentStr;
      }
    }
    
    return false;
  };

  // Проверка, начался ли турнир (появились ли первые данные)
  const hasTournamentStarted = (): boolean => {
    if (!upcomingTournament?.data) return false;
    
    return upcomingTournament.data.some(fighter => {
      if (fighter['W/L'] === 'win' || fighter['W/L'] === 'lose') return true;
      if (fighter['Method'] && fighter['Method'] !== '' && fighter['Method'] !== '--') return true;
      return false;
    });
  };

  // Функция для загрузки данных турнира
  const loadTournamentData = async (tournamentName: string, isUpcoming: boolean = true): Promise<Fighter[] | null> => {
    const cleanName = tournamentName
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/\s+/g, '_');
    
    const prefix = isUpcoming ? 'UPCOMING_' : '';
    const filename = `${prefix}${cleanName}.xlsx`;
    
    console.log(`📥 Пробую загрузить файл: ${filename}`);
    const data = await downloadTournamentFile(filename);
    
    if (data) {
      console.log(`✅ Загружен файл: ${filename}`);
      return data;
    }
    
    return null;
  };

  // Функция для принудительной загрузки актуальных данных турнира
  const loadFreshTournamentData = async () => {
    if (!upcomingTournament) return;
    
    setIsCheckingUpdates(true);
    console.log('📥 Загружаю свежие данные для турнира:', upcomingTournament.name);
    
    try {
      const data = await loadTournamentData(upcomingTournament.name, true);
      
      if (data) {
        const fightersWithResults = data.filter(f => {
          return f['W/L'] === 'win' || f['W/L'] === 'lose';
        }).length;
        
        const totalFighters = data.length;
        
        console.log(`📊 Статистика результатов: ${fightersWithResults}/${totalFighters} бойцов с результатами`);
        
        upcomingTournament.data = data;
        
        if (userData.upcomingSelections.length > 0) {
          const fightersMap = new Map();
          data.forEach(fighter => {
            fightersMap.set(fighter.Fighter, fighter);
          });
          
          const updatedSelections = userData.upcomingSelections.map(sel => {
            const updatedFighter = fightersMap.get(sel.fighter.Fighter);
            if (updatedFighter) {
              return {
                ...sel,
                fighter: updatedFighter
              };
            }
            return sel;
          });
          
          setUserData(prev => ({
            ...prev,
            upcomingSelections: updatedSelections
          }));
        }
      }
    } catch (error) {
      console.error('Ошибка при загрузке данных:', error);
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  // Загружаем свежие данные при старте
  useEffect(() => {
    if (upcomingTournament) {
      loadFreshTournamentData();
    }
  }, [upcomingTournament?.name]);

  // Периодическая проверка обновлений (раз в 5 минут)
  useEffect(() => {
    if (!upcomingTournament) return;
    
    const interval = setInterval(() => {
      loadFreshTournamentData();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [upcomingTournament?.name]);

  // Проверка при возвращении на главный экран
  useEffect(() => {
    if (currentView === 'main' && upcomingTournament) {
      loadFreshTournamentData();
    }
  }, [currentView]);

  // Загружаем результаты пользователя для обоих турниров
  useEffect(() => {
    let isMounted = true;
    
    const loadUserData = async () => {
      if (!telegramUser || !profileLoaded) return;
      
      setLoadingUserResults(true);
      
      if (upcomingTournament && isMounted) {
        console.log('📥 Загружаем результаты для будущего турнира:', upcomingTournament.name);
        const upcomingResults = await loadUserResults(upcomingTournament.name, telegramUser.id);
        
        if (upcomingResults && upcomingResults.selections.length > 0 && isMounted) {
          console.log('✅ Найдены выборы для будущего турнира');
          
          setUserData(prev => ({
            ...prev,
            upcomingSelections: upcomingResults.selections,
            hasBet: true
          }));
          
          const selectionsMap = new Map();
          upcomingResults.selections.forEach((sel: SelectedFighter) => {
            selectionsMap.set(sel.weightClass, sel.fighter);
          });
          setSelectedFighters(selectionsMap);
        }
      }
      
      if (pastTournament && isMounted) {
        console.log('📥 Загружаем результаты для прошедшего турнира:', pastTournament.name);
        const pastResults = await loadUserResults(pastTournament.name, telegramUser.id);
        
        if (pastResults && pastResults.selections.length > 0 && isMounted) {
          console.log('✅ Найдены выборы для прошедшего турнира');
          
          setUserData(prev => ({
            ...prev,
            pastSelections: pastResults.selections
          }));
          
          const winners = pastResults.selections.filter(sel => 
            sel.fighter['W/L'] === 'win'
          ).length;
          
          const correctPicks = pastResults.selections.filter(sel => 
            sel.fighter['W/L'] === 'win'
          ).length;
          
          console.log('📊 Статистика:', { winners, correctPicks });
          
          if (winners > 0) {
            const newCoins = await awardCoins(winners, pastTournament.name);
            if (correctPicks > 0) {
              await awardExperience(correctPicks, pastTournament.name, newCoins);
            }
          } else {
            if (correctPicks > 0) {
              await awardExperience(correctPicks, pastTournament.name, userData.coins);
            }
          }
        }
      }
      
      if (isMounted) {
        setLoadingUserResults(false);
      }
    };
    
    loadUserData();
    
    return () => {
      isMounted = false;
    };
  }, [upcomingTournament, pastTournament, telegramUser, profileLoaded]);

  // Загружаем рейтинг при переходе на экран
  useEffect(() => {
    if (currentView === 'leaderboard' && pastTournament) {
      setLeaderboardLoading(true);
      loadLeaderboard(pastTournament.name)
        .then(data => {
          setLeaderboardData(data);
          setLeaderboardLoading(false);
        })
        .catch(err => {
          console.error('Ошибка загрузки рейтинга:', err);
          setLeaderboardLoading(false);
        });
    }
  }, [currentView, pastTournament]);

  const deductCoinsForBet = async () => {
    if (!telegramUser) return false;
    
    if (userData.coins >= 100) {
      const newCoins = userData.coins - 100;
      
      console.log('💰 Списание монет: было', userData.coins, 'станет', newCoins);
      
      setUserData(prev => ({
        ...prev,
        coins: newCoins
      }));
      
      const saved = await saveUserProfile({
        userId: telegramUser.id,
        username: userData.username,
        level: userData.level,
        experience: userData.totalExp,
        coins: newCoins,
        lastUpdated: new Date().toISOString()
      });
      
      if (saved) {
        console.log(`💰 Монеты списаны: 100, осталось: ${newCoins}`);
      }
      
      return true;
    }
    return false;
  };

  const refundCoins = async () => {
    if (!telegramUser) return;
    
    const newCoins = userData.coins + 100;
    
    console.log('💰 Возврат монет: было', userData.coins, 'станет', newCoins);
    
    setUserData(prev => ({
      ...prev,
      coins: newCoins
    }));
    
    const saved = await saveUserProfile({
      userId: telegramUser.id,
      username: userData.username,
      level: userData.level,
      experience: userData.totalExp,
      coins: newCoins,
      lastUpdated: new Date().toISOString()
    });
    
    if (saved) {
      console.log(`💰 Монеты возвращены: 100, теперь: ${newCoins}`);
    }
  };

  const saveSelections = async (selections: Map<string, Fighter>) => {
    if (!telegramUser) return;
    
    const selectionsArray = Array.from(selections.entries()).map(([weightClass, fighter]) => ({
      weightClass,
      fighter
    }));
    
    const totalDamage = 0;
    
    const userResult: UserResult = {
      userId: telegramUser.id,
      username: telegramUser.username,
      totalDamage,
      timestamp: new Date().toISOString(),
      selections: selectionsArray
    };
    
    if (selectedTournament) {
      const saved = await saveUserResults(selectedTournament.name, userResult);
      if (saved) {
        setUserData(prev => ({
          ...prev,
          upcomingSelections: selectionsArray,
          hasBet: true
        }));
        console.log('✅ Результаты сохранены');
      }
    }
  };

  const handleSelectFighter = (weightClass: string, fighter: Fighter) => {
    const newSelection = new Map(selectedFighters);
    
    if (newSelection.has(weightClass) && newSelection.get(weightClass)?.Fighter === fighter.Fighter) {
      newSelection.delete(weightClass);
    } else {
      newSelection.set(weightClass, fighter);
    }
    
    setSelectedFighters(newSelection);
  };

  const getFighterPairs = (fighters: Fighter[]): Fighter[][] => {
    const pairs: Fighter[][] = [];
    for (let i = 0; i < fighters.length; i += 2) {
      if (i + 1 < fighters.length) {
        pairs.push([fighters[i], fighters[i + 1]]);
      }
    }
    return pairs;
  };

  const formatDate = (dateStr: string): string => {
    try {
      if (!dateStr) return 'Date TBD';
      
      const months: { [key: string]: number } = {
        'January': 0, 'February': 1, 'March': 2, 'April': 3,
        'May': 4, 'June': 5, 'July': 6, 'August': 7,
        'September': 8, 'October': 9, 'November': 10, 'December': 11
      };
      
      const parts = dateStr.split(' ');
      if (parts.length >= 3) {
        const month = parts[0];
        const day = parseInt(parts[1].replace(',', ''));
        const year = parseInt(parts[2]);
        
        if (months[month] !== undefined) {
          const date = new Date(year, months[month], day);
          return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
        }
      }
      
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  if (loading || loadingProfile) {
    return (
      <div className="app">
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <div className="loading-text">⏳ Загрузка...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app">
        <div className="error-screen">
          <div className="error-icon">❌</div>
          <div className="error-text">{error}</div>
          <button className="retry-button" onClick={() => window.location.reload()}>
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="profile-header">
        <div className="profile-avatar">
          {telegramUser?.photoUrl ? (
            <img src={telegramUser.photoUrl} alt="avatar" />
          ) : (
            <img src={`${BASE_URL}/Home_button.png`} alt="avatar" />
          )}
        </div>
        <div className="profile-info">
          <div className="profile-name">{userData.username}</div>
          <div className="level-bar">
            <div 
              className="level-progress" 
              style={{ 
                width: `${userData.nextLevelExp > 0 ? Math.min(100, (userData.currentExp / userData.nextLevelExp) * 100) : 100}%` 
              }}
            ></div>
            <span className="level-text">
              {userData.nextLevelExp > 0 
                ? `${userData.currentExp}/${userData.nextLevelExp} (Level ${userData.level})`
                : `Level ${userData.level} (MAX)`}
            </span>
          </div>
          <div className="profile-coins">🪙 {userData.coins}</div>
        </div>
      </header>

      <main className="main-content">
        {currentView === 'main' && (
          <div className="tournaments-container">
            {pastTournament && (
              <section className="tournament-section past">
                <div className="tournament-header">
                  <h2>{pastTournament.name}</h2>
                  <div className="tournament-meta">
                    <span className="tournament-date">{formatDate(pastTournament.date)}</span>
                    <span className="tournament-status active">Active</span>
                  </div>
                </div>
                
                <div className="tournament-content">
                  {loadingUserResults ? (
                    <div className="tournament-message">Загрузка...</div>
                  ) : hasPastBet ? (
                    <>
                      <div className="selected-fighters-grid">
                        {userData.pastSelections.map((selection, index) => {
                          const weightClass = selection.fighter['Weight class'];
                          const isWinner = selection.fighter['W/L'] === 'win';
                          
                          return (
                            <div 
                              key={index} 
                              className="selected-fighter-card"
                              style={{ 
                                backgroundColor: getWeightClassColor(weightClass),
                                border: isWinner ? '2px solid #FFD700' : 'none'
                              }}
                            >
                              <div className="selected-fighter-damage-box">
                                {selection.fighter['Total Damage'] !== undefined 
                                  ? roundDamage(selection.fighter['Total Damage']) 
                                  : '?'}
                              </div>
                              <div className="selected-fighter-avatar-square">
                                <img 
                                  src={`${BASE_URL}/avatars/${getAvatarFilename(weightClass)}`}
                                  alt={selection.fighter.Fighter}
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    const parent = (e.target as HTMLImageElement).parentElement;
                                    if (parent) {
                                      parent.innerHTML = weightClass.includes("Women") ? "👩" : "👤";
                                      parent.style.fontSize = '24px';
                                    }
                                  }}
                                />
                              </div>
                              <span className="selected-fighter-name">{selection.fighter.Fighter}</span>
                              {isWinner && (
                                <span style={{ 
                                  position: 'absolute', 
                                  top: 2, 
                                  right: 2, 
                                  fontSize: '10px',
                                  color: '#FFD700'
                                }}>👑</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      
                      <div className="total-damage-button">
                        <span>Total Damage: {calculateTotalDamage(userData.pastSelections)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="tournament-message">Bets are no longer accepted</div>
                  )}
                </div>
              </section>
            )}

            {upcomingTournament && (
              <section className="tournament-section upcoming">
                <div className="tournament-header">
                  <div className="tournament-title-row">
                    <h2>{upcomingTournament.name}</h2>
                    {isCheckingUpdates && (
                      <span className="updating-indicator">🔄</span>
                    )}
                  </div>
                  <div className="tournament-meta">
                    <span className="tournament-date">{formatDate(upcomingTournament.date)}</span>
                    <span className="tournament-status upcoming">Upcoming</span>
                  </div>
                </div>
                
                <div className="tournament-content">
                  {loadingUserResults ? (
                    <div className="tournament-message">Собираем информацию...</div>
                  ) : hasUpcomingBet ? (
                    <>
                      <div className="selected-fighters-grid">
                        {userData.upcomingSelections.map((selection, index) => {
                          const weightClass = selection.fighter['Weight class'];
                          const hasResult = selection.fighter['W/L'] === 'win' || selection.fighter['W/L'] === 'lose';
                          
                          return (
                            <div 
                              key={index} 
                              className="selected-fighter-card"
                              style={{ backgroundColor: getWeightClassColor(weightClass) }}
                            >
                              <div className="selected-fighter-damage-box">
                                {hasResult 
                                  ? roundDamage(selection.fighter['Total Damage']) 
                                  : '?'}
                              </div>
                              <div className="selected-fighter-avatar-square">
                                <img 
                                  src={`${BASE_URL}/avatars/${getAvatarFilename(weightClass)}`}
                                  alt={selection.fighter.Fighter}
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    const parent = (e.target as HTMLImageElement).parentElement;
                                    if (parent) {
                                      parent.innerHTML = weightClass.includes("Women") ? "👩" : "👤";
                                      parent.style.fontSize = '24px';
                                    }
                                  }}
                                />
                              </div>
                              <span className="selected-fighter-name">{selection.fighter.Fighter}</span>
                            </div>
                          );
                        })}
                      </div>
                      
                      <div className="total-damage-button">
                        <span>Total Damage: {calculateTotalDamage(userData.upcomingSelections)}</span>
                      </div>
                    </>
                  ) : (
                    upcomingTournament.data ? (
                      userData.coins >= 100 && isBetsAvailable() && !hasTournamentStarted() ? (
                        <button 
                          className="select-button"
                          onClick={async () => {
                            if (await deductCoinsForBet()) {
                              setSelectedTournament(upcomingTournament);
                              setCurrentView('selection');
                              setSelectedFighters(new Map());
                            }
                          }}
                        >
                          Select your Fight card
                        </button>
                      ) : (
                        <div className="tournament-message">
                          {!isBetsAvailable() 
                            ? 'Bets are closed by date' 
                            : hasTournamentStarted()
                              ? 'Tournament has started - bets are closed'
                              : 'Not enough coins to place bets'}
                        </div>
                      )
                    ) : (
                      <div className="tournament-message">Loading tournament data...</div>
                    )
                  )}
                </div>
              </section>
            )}
          </div>
        )}

{currentView === 'leaderboard' && (
  <div className="leaderboard-screen">
    <div className="leaderboard-header">
      <h2>{pastTournament?.name || 'Рейтинг'}</h2>
      {isCheckingUpdates && (
        <span className="updating-indicator" style={{ marginLeft: '8px' }}>🔄</span>
      )}
    </div>
    {leaderboardLoading ? (
      <div className="leaderboard-loading">Загрузка рейтинга...</div>
    ) : leaderboardData.length > 0 ? (
      <div className="leaderboard-list">
        {leaderboardData.map((entry) => (
          <div key={entry.userId} className="leaderboard-item">
            <span className="leaderboard-rank">{entry.rank}</span>
            <div className="leaderboard-user-info">
              <div className="leaderboard-avatar">
                {/* Показываем аватарку только если это текущий пользователь и у него есть фото */}
                {entry.userId === telegramUser?.id && telegramUser?.photoUrl ? (
                  <img src={telegramUser.photoUrl} alt={entry.username} />
                ) : (
                  <span>👤</span>
                )}
              </div>
              <span className="leaderboard-username">{entry.username}</span>
            </div>
            <span className="leaderboard-score">{entry.totalDamage}</span>
          </div>
        ))}
      </div>
    ) : (
      <div className="leaderboard-empty">Пока нет результатов</div>
    )}
  </div>
)}

        {currentView === 'selection' && selectedTournament && selectedTournament.data && (
          <div className="selection-modal">
            <div className="selection-content">
              <div className="selection-header">
                <h2>{selectedTournament.name}</h2>
                <button 
                  className="close-button" 
                  onClick={async () => {
                    await refundCoins();
                    setCurrentView('main');
                  }}
                >
                  CLOSE
                </button>
              </div>
              
              <div className="selection-progress">
                Выбрано: {selectedFighters.size} / 5
              </div>

              <div className="fighters-scroll">
                {selectedTournament.data && Object.entries(groupFightersByWeight(selectedTournament.data)).map(([weightClass, fighters]) => {
                  const pairs = getFighterPairs(fighters);
                  const isWeightSelected = selectedFighters.has(weightClass);
                  const selectedFighter = selectedFighters.get(weightClass);

                  return (
                    <div key={weightClass} className="weight-section">
                      <div className="weight-header" style={{ backgroundColor: getWeightClassColor(weightClass) }}>
                        <span>{weightClass}</span>
                        {isWeightSelected && (
                          <span className="selected-badge">{selectedFighter?.Fighter}</span>
                        )}
                      </div>

                      {pairs.map((pair, idx) => (
                        <div key={idx} className="fight-pair">
                          {pair.map(fighter => (
                            <button
                              key={fighter.Fighter}
                              className={`fighter-card ${
                                selectedFighter?.Fighter === fighter.Fighter ? 'selected' : ''
                              } ${
                                isWeightSelected && selectedFighter?.Fighter !== fighter.Fighter ? 'disabled' : ''
                              }`}
                              onClick={() => handleSelectFighter(weightClass, fighter)}
                              disabled={
                                (isWeightSelected && selectedFighter?.Fighter !== fighter.Fighter) ||
                                (selectedFighters.size >= 5 && !selectedFighters.has(weightClass))
                              }
                            >
                              <div className="fighter-avatar">
                                <img 
                                  src={`${BASE_URL}/avatars/${getAvatarFilename(fighter['Weight class'])}`}
                                  alt={fighter.Fighter}
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    const parent = (e.target as HTMLImageElement).parentElement;
                                    if (parent) {
                                      parent.innerHTML = fighter['Weight class'].includes("Women") ? "👩" : "👤";
                                      parent.style.fontSize = '24px';
                                      parent.style.display = 'flex';
                                      parent.style.alignItems = 'center';
                                      parent.style.justifyContent = 'center';
                                    }
                                  }} 
                                />
                              </div>
                              <div className="fighter-info">
                                <span className="fighter-name">{fighter.Fighter}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              <div className="selection-actions">
                <button 
                  className="discard-button"
                  onClick={() => setSelectedFighters(new Map())}
                >
                  DISCARD ALL
                </button>
                <button 
                  className={`accept-button ${selectedFighters.size === 5 ? 'active' : ''}`}
                  disabled={selectedFighters.size !== 5}
                  onClick={async () => {
                    await saveSelections(selectedFighters);
                    setCurrentView('main');
                  }}
                >
                  ACCEPT CARD
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <nav className={`bottom-nav ${currentView === 'selection' ? 'hidden' : ''}`}>
        <button 
          className={`nav-button ${currentView === 'main' ? 'active' : ''}`}
          onClick={() => setCurrentView('main')}
        >
          <img src={`${BASE_URL}/Home_button.png`} alt="Home" />
        </button>
        <button 
          className={`nav-button ${currentView === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setCurrentView('leaderboard')}
        >
          <img src={`${BASE_URL}/Leadeship_button.png`} alt="Leaderboard" />
        </button>
        <button className="nav-button disabled">
          <img src={`${BASE_URL}/PvP_button.png`} alt="PvP" />
        </button>
        <button className="nav-button disabled">
          <img src={`${BASE_URL}/Shop_button.png`} alt="Shop" />
        </button>
      </nav>
    </div>
  );
}

export default App;