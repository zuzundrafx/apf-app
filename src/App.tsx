﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import { useState, useEffect } from 'react';
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
  
  for (let i = 0; i < LEVEL_THRESHOLDS.length - 1; i++) {
    const expNeeded = LEVEL_THRESHOLDS[i];
    
    if (remainingExp >= expNeeded) {
      remainingExp -= expNeeded;
      level = i + 2;
    } else {
      break;
    }
  }
  
  const nextLevelExp = level < 10 ? LEVEL_THRESHOLDS[level - 1] : 0;
  
  return { 
    level, 
    currentExp: remainingExp,
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

  // Состояния для окна наград
  const [showRewardsModal, setShowRewardsModal] = useState(false);
  const [pendingRewards, setPendingRewards] = useState<{
    tournamentName: string;
    winners: SelectedFighter[];
    totalCoins: number;
    totalExp: number;
  } | null>(null);

  const [userData, setUserData] = useState({
    username: 'Player',
    level: 1,
    currentExp: 0,
    totalExp: 0,
    nextLevelExp: 5,
    coins: 100,
    mySelections: {
      upcoming: [] as SelectedFighter[],
      past: [] as SelectedFighter[]
    },
    myUserId: null as string | null,
    hasBet: false
  });

  console.log('🏁 Начальное состояние userData:', {
    coins: 100,
    username: 'Player',
    level: 1,
    currentExp: 0,
    totalExp: 0
  });

  const hasUpcomingBet = userData.mySelections.upcoming.length > 0;
  const hasPastBet = userData.mySelections.past.length > 0;

  const calculateTotalDamage = (selections: SelectedFighter[]): number => {
    const total = selections.reduce((sum, sel) => sum + (sel.fighter['Total Damage'] || 0), 0);
    return roundDamage(total);
  };

  // Функция принятия наград
  const acceptRewards = async () => {
    if (!pendingRewards || !telegramUser || !pastTournament) return;
    
    // 1. Начисляем монеты и опыт
    const newCoins = userData.coins + pendingRewards.totalCoins;
    const newTotalExp = userData.totalExp + pendingRewards.totalExp;
    const { level, currentExp, nextLevelExp } = calculateLevel(newTotalExp);
    
    // 2. Обновляем профиль пользователя
    await saveUserProfile({
      userId: telegramUser.id,
      username: userData.username,
      level,
      experience: newTotalExp,
      coins: newCoins,
      lastUpdated: new Date().toISOString()
    });
    
    // 3. Обновляем запись в результатах турнира
    const currentResult = await loadUserResults(pastTournament.name, telegramUser.id);
    if (currentResult) {
      const updatedResult: UserResult = {
        ...currentResult,
        rewardsAccepted: true,
        rewards: {
          coins: pendingRewards.totalCoins,
          experience: pendingRewards.totalExp
        }
      };
      await saveUserResults(pastTournament.name, updatedResult);
    }
    
    // 4. Загружаем обновленные результаты для отображения
    const updatedPastSelections = await loadUserResults(pastTournament.name, telegramUser.id)
      .then(r => r?.selections || []);
    
    // 5. Обновляем UI
    setUserData(prev => ({
      ...prev,
      coins: newCoins,
      totalExp: newTotalExp,
      level,
      currentExp,
      nextLevelExp,
      mySelections: {
        ...prev.mySelections,
        past: updatedPastSelections
      }
    }));
    
    // 6. Закрываем окно
    setShowRewardsModal(false);
    setPendingRewards(null);
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
            const totalExp = profile.experience || 0;
            const { level, currentExp, nextLevelExp } = calculateLevel(totalExp);
            
            console.log('✅ Профиль загружен:', profile);
            
            setUserData(prev => ({
              ...prev,
              username: profile.username,
              level,
              currentExp,
              totalExp,
              nextLevelExp,
              coins: profile.coins,
              myUserId: userId
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
                coins: 100,
                myUserId: userId
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
            
            setUserData(prev => ({
              ...prev,
              username: profile.username,
              level,
              currentExp,
              totalExp,
              nextLevelExp,
              coins: profile.coins,
              myUserId: 'user_123'
            }));
            
          } else if (isMounted) {
            console.log('🆕 Создаем новый тестовый профиль');
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
      totalExp: userData.totalExp
    });
  }, [userData]);

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
      const data = XLSX.utils.sheet_to_json(sheet) as any[];
      
      const fighters: Fighter[] = data.map((item: any) => ({
        Fight_ID: item['Fight_ID'] || 0,
        Fighter: item['Fighter'] || '',
        'W/L': item['W/L'] || null,
        'Kd': item['Kd'] || 0,
        'Str': item['Str'] || 0,
        'Td': item['Td'] || 0,
        'Sub': item['Sub'] || 0,
        'Head': item['Head'] || 0,
        'Body': item['Body'] || 0,
        'Leg': item['Leg'] || 0,
        'Weight class': item['Weight class'] || '',
        'Weight Coefficient': item['Weight Coefficient'] || 1,
        'Method': item['Method'] || '',
        'Round': item['Round'] || 0,
        'Time': item['Time'] || '',
        'Total Damage': item['Total Damage'] || 0
      }));
      
      return fighters;
    } catch (error) {
      console.error('Ошибка скачивания файла:', error);
      return null;
    }
  };

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
        
        return todayStr < tournamentStr;
      }
    }
    
    return false;
  };

  const hasTournamentStarted = (): boolean => {
    if (!upcomingTournament?.data) return false;
    
    return upcomingTournament.data.some(fighter => {
      return fighter['W/L'] === 'win' || fighter['W/L'] === 'lose';
    });
  };

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
        
        console.log(`📊 Статистика результатов: ${fightersWithResults}/${data.length} бойцов с результатами`);
        
        upcomingTournament.data = data;
        
        if (userData.mySelections.upcoming.length > 0) {
          const fightersMap = new Map();
          data.forEach(fighter => {
            fightersMap.set(fighter.Fighter, fighter);
          });
          
          const updatedSelections = userData.mySelections.upcoming.map(sel => {
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
            mySelections: {
              ...prev.mySelections,
              upcoming: updatedSelections
            }
          }));
        }
      }
    } catch (error) {
      console.error('Ошибка при загрузке данных:', error);
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  useEffect(() => {
    if (upcomingTournament) {
      loadFreshTournamentData();
    }
  }, [upcomingTournament?.name]);

  useEffect(() => {
    if (!upcomingTournament) return;
    
    const interval = setInterval(() => {
      loadFreshTournamentData();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [upcomingTournament?.name]);

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
      
      // Загружаем для будущего турнира
      if (upcomingTournament && isMounted) {
        console.log('📥 Загружаем результаты для будущего турнира:', upcomingTournament.name);
        const upcomingResult = await loadUserResults(upcomingTournament.name, telegramUser.id);
        
        if (upcomingResult && upcomingResult.selections.length > 0 && isMounted) {
          console.log('✅ Найдены мои выборы для будущего турнира');
          
          setUserData(prev => ({
            ...prev,
            mySelections: {
              ...prev.mySelections,
              upcoming: upcomingResult.selections
            },
            hasBet: true
          }));
          
          const selectionsMap = new Map<string, Fighter>();
          upcomingResult.selections.forEach((sel: SelectedFighter) => {
            selectionsMap.set(sel.weightClass, sel.fighter);
          });
          setSelectedFighters(selectionsMap);
        }
      }
      
      // Загружаем для прошедшего турнира
      if (pastTournament && isMounted) {
        console.log('📥 Загружаем результаты для прошедшего турнира:', pastTournament.name);
        const pastResult = await loadUserResults(pastTournament.name, telegramUser.id);
        
        if (pastResult && pastResult.selections.length > 0 && isMounted) {
          
          // Проверяем, были ли уже приняты награды
          if (!pastResult.rewardsAccepted) {
            
            // Подсчитываем награды
            const winners = pastResult.selections.filter(sel => 
              sel.fighter['W/L'] === 'win'
            );
            
            const totalCoins = winners.length * 50;
            const totalExp = winners.length * 5;
            
            // Показываем окно с наградами
            setPendingRewards({
              tournamentName: pastTournament.name,
              winners: winners,
              totalCoins,
              totalExp
            });
            setShowRewardsModal(true);
            
            // Не показываем карточки бойцов, пока не приняты награды
            setUserData(prev => ({
              ...prev,
              mySelections: {
                ...prev.mySelections,
                past: []
              }
            }));
            
          } else {
            // Награды уже приняты - показываем карточки
            console.log('✅ Найдены мои выборы для прошедшего турнира (награды получены)');
            setUserData(prev => ({
              ...prev,
              mySelections: {
                ...prev.mySelections,
                past: pastResult.selections
              }
            }));
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
          mySelections: {
            ...prev.mySelections,
            upcoming: selectionsArray
          },
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
          <div className="loading-text">⏳ Loading...</div>
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
                    <div className="tournament-message">Loading...</div>
                  ) : hasPastBet ? (
                    <>
                      <div className="selected-fighters-grid">
                        {userData.mySelections.past.map((selection, index) => {
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
                        <span>Total Damage: {calculateTotalDamage(userData.mySelections.past)}</span>
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
                    <div className="tournament-message">Checking information...</div>
                  ) : hasUpcomingBet ? (
                    <>
                      <div className="selected-fighters-grid">
                        {userData.mySelections.upcoming.map((selection, index) => {
                          const weightClass = selection.fighter['Weight class'];
                          const hasResult = selection.fighter['W/L'] !== null;
                          
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
                        <span>Total Damage: {calculateTotalDamage(userData.mySelections.upcoming)}</span>
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
              <div className="leaderboard-loading">Loading the rating...</div>
            ) : leaderboardData.length > 0 ? (
              <div className="leaderboard-list">
                {leaderboardData.map((entry) => (
                  <div key={entry.userId} className="leaderboard-item">
                    <span className="leaderboard-rank">{entry.rank}</span>
                    <div className="leaderboard-user-info">
                      <div className="leaderboard-avatar">
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
                  const typedFighters = fighters as Fighter[];
                  const pairs = getFighterPairs(typedFighters);
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

      {/* Модальное окно с наградами - ОБНОВЛЕННАЯ ВЕРСИЯ */}
{showRewardsModal && pendingRewards && (
  <div className="rewards-modal">
    <div className="rewards-content">
      <h2>🏆 CONGRATULATIONS! 🏆</h2>
      <p>Tournament "{pendingRewards.tournamentName}" completed</p>
      
      {pendingRewards.winners.length > 0 ? (
        <>
          <div className="winners-list">
            <h3>WINNERS IN YOUR BET:</h3>
            {pendingRewards.winners.map((sel, idx) => (
              <div key={idx} className="winner-item">
                <span className="winner-name">{sel.fighter.Fighter}</span>
                <span className="winner-badge">👑</span>
              </div>
            ))}
          </div>
          
          <div className="rewards-summary">
            <div className="reward-item">
              <span className="reward-label">COINS:</span>
              <span className="reward-value">+{pendingRewards.totalCoins} 🪙</span>
            </div>
            <div className="reward-item">
              <span className="reward-label">EXP:</span>
              <span className="reward-value">+{pendingRewards.totalExp} ✨</span>
            </div>
          </div>
        </>
      ) : (
        <p className="no-winners">Unfortunately, none of your fighters won 😢</p>
      )}
      
      <button className="accept-button" onClick={acceptRewards}>
        ACCEPT
      </button>
    </div>
  </div>
)}

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