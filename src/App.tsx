﻿﻿﻿import { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import Pvp from './components/Pvp';
import LeaderboardItem from './components/LeaderboardItem';
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
  saveUserProfile,
  loadAllProfiles,
  UserProfile
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

// Пороговые значения для уровней (10 уровней)
const LEVEL_THRESHOLDS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 0];

const BASE_URL = import.meta.env.PROD ? '' : '/reactjs-template';

// Функция для округления урона
const roundDamage = (damage: number): number => Math.round(damage);

// Функция для расчета уровня
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
  return { level, currentExp: remainingExp, nextLevelExp };
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

// Компонент скелетона для загрузки
const TournamentSkeleton = () => (
  <section className="tournament-section skeleton">
    <div className="tournament-header skeleton-header">
      <div className="skeleton-title"></div>
      <div className="skeleton-meta"></div>
    </div>
    <div className="tournament-content">
      <div className="skeleton-message"></div>
    </div>
  </section>
);

// Функция для проверки, можно ли делать ставки на турнир
const canPlaceBet = (tournament: Tournament | null, userCoins: number): boolean => {
  if (!tournament) return false;
  
  // 1. Проверяем монеты
  if (userCoins < 100) return false;
  
  // 2. Получаем дату турнира
  const tournamentDate = new Date(tournament.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // 3. Проверяем, есть ли статистика у бойцов
  const hasStats = tournament.data?.some(fighter => {
    const totalDamage = Number(fighter['Total Damage']) || 0;
    const str = Number(fighter['Str']) || 0;
    const hasWinLoss = fighter['W/L'] !== null && fighter['W/L'] !== undefined;
    
    return hasWinLoss || totalDamage > 0 || str > 0;
  }) ?? false;
  
  // 4. Проверяем, прошла ли дата турнира
  const isDatePassed = tournamentDate < today;
  
  // 5. Логика: можно ставить если (дата не прошла) ИЛИ (нет статистики)
  return !(isDatePassed && hasStats);
};

function App() {
  const { pastTournaments, upcomingTournaments, loading, loadingProgress, loadingStage, error } = useTournaments();
  
  const [selectedFighters, setSelectedFighters] = useState<Map<string, Fighter>>(new Map());
  const [currentView, setCurrentView] = useState<'main' | 'leaderboard' | 'selection' | 'pvp'>('main');
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [loadingUserResults, setLoadingUserResults] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [telegramUser, setTelegramUser] = useState<{
    id: string;
    username: string;
    photoUrl?: string;
  } | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  
  // Кэш всех профилей для рейтинга
  const [allProfiles, setAllProfiles] = useState<Map<string, UserProfile>>(new Map());
  // Флаг, что профили уже загружены
  const profilesLoadedRef = useRef(false);

  // Состояния для окна наград
  const [showRewardsModal, setShowRewardsModal] = useState(false);
  const [pendingRewards, setPendingRewards] = useState<{
    tournamentName: string;
    winners: SelectedFighter[];
    totalCoins: number;
    totalExp: number;
  } | null>(null);

  // Состояние для данных окна выбора
  const [selectionData, setSelectionData] = useState<Fighter[] | null>(null);
  const [loadingSelection, setLoadingSelection] = useState(false);

  // Состояния для переключения между карточкой турнира и карточками бойцов
  const [showPastFighters, setShowPastFighters] = useState(false);
  const [selectedPastTournament, setSelectedPastTournament] = useState<string | null>(null);
  const [selectedUpcomingTournament, setSelectedUpcomingTournament] = useState<string | null>(null);
  
  // Состояние для блокировки кнопок (чтобы не начислялись монеты много раз)
  const [isClosing, setIsClosing] = useState(false);
  const [isAcceptingRewards, setIsAcceptingRewards] = useState(false);
  
  // Состояние для защиты от множественных нажатий при открытии окна выбора
  const [isOpeningSelection, setIsOpeningSelection] = useState(false);

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

  const hasPastBet = userData.mySelections.past.length > 0;

  const calculateTotalDamage = (selections: SelectedFighter[]): number => {
    const total = selections.reduce((sum, sel) => sum + (sel.fighter['Total Damage'] || 0), 0);
    return roundDamage(total);
  };

  // Загружаем все профили ТОЛЬКО ОДИН РАЗ при старте
  useEffect(() => {
    const loadAllUserProfiles = async () => {
      if (profilesLoadedRef.current) return;
      
      console.log('📥 Загружаем все профили для рейтинга (один раз)...');
      const profiles = await loadAllProfiles();
      const profilesMap = new Map();
      profiles.forEach(profile => {
        profilesMap.set(profile.userId, profile);
      });
      setAllProfiles(profilesMap);
      profilesLoadedRef.current = true;
      console.log(`✅ Загружено ${profiles.length} профилей`);
    };
    
    loadAllUserProfiles();
  }, []); // Пустой массив зависимостей - выполнится только один раз

  // Функция для обновления одного профиля в кэше (без перезагрузки всех)
  const updateProfileInCache = useCallback((updatedProfile: UserProfile) => {
    setAllProfiles(prev => {
      const newMap = new Map(prev);
      newMap.set(updatedProfile.userId, updatedProfile);
      return newMap;
    });
  }, []);

// ОПТИМИЗИРОВАННАЯ функция принятия наград
const acceptRewards = async () => {
  if (!pendingRewards || !telegramUser || isAcceptingRewards) return;
  
  setIsAcceptingRewards(true);
  
  try {
    // 1. Расчет новых значений
    const newCoins = userData.coins + pendingRewards.totalCoins;
    const newTotalExp = userData.totalExp + pendingRewards.totalExp;
    const { level, currentExp, nextLevelExp } = calculateLevel(newTotalExp);
    
    // 2. Находим турнир
    const tournament = pastTournaments.find(t => t.name === pendingRewards.tournamentName);
    
    // 3. Получаем текущие selections для этого турнира
    const tournamentSelections = pendingRewards.winners;
    
    // 4. МГНОВЕННО обновляем UI
    setUserData(prev => {
      const otherPastSelections = prev.mySelections.past.filter(
        (sel: SelectedFighter) => !tournament?.data?.some((f: Fighter) => f.Fighter === sel.fighter.Fighter)
      );
      
      return {
        ...prev,
        coins: newCoins,
        totalExp: newTotalExp,
        level,
        currentExp,
        nextLevelExp,
        mySelections: {
          ...prev.mySelections,
          past: [...otherPastSelections, ...tournamentSelections]
        }
      };
    });
    
    // 5. Закрываем модалку
    setShowRewardsModal(false);
    setPendingRewards(null);
    setShowPastFighters(false);
    
    // 6. Параллельное выполнение запросов (фоном)
    if (tournament) {
      Promise.all([
        saveUserProfile({
          userId: telegramUser.id,
          username: userData.username,
          photoUrl: telegramUser.photoUrl,
          level,
          experience: newTotalExp,
          coins: newCoins,
          lastUpdated: new Date().toISOString()
        }).then((savedProfile) => {
          // Обновляем только этот профиль в кэше
          if (savedProfile) {
            updateProfileInCache({
              userId: telegramUser.id,
              username: userData.username,
              photoUrl: telegramUser.photoUrl,
              level,
              experience: newTotalExp,
              coins: newCoins,
              lastUpdated: new Date().toISOString()
            });
          }
        }),
        
        (async () => {
          const currentResult = await loadUserResults(tournament.name, telegramUser.id);
          if (currentResult) {
            const updatedResult: UserResult = {
              ...currentResult,
              rewardsAccepted: true,
              rewards: {
                coins: pendingRewards.totalCoins,
                experience: pendingRewards.totalExp
              }
            };
            await saveUserResults(tournament.name, updatedResult);
          }
        })()
      ]).catch(error => {
        console.error('Фоновое сохранение ошибки:', error);
      });
    }
    
  } catch (error) {
    console.error('Ошибка при получении наград:', error);
  } finally {
    setIsAcceptingRewards(false);
  }
};

  // Функция загрузки данных для окна выбора
  const loadSelectionData = async (tournament: Tournament) => {
    if (!tournament) return;
    
    setLoadingSelection(true);
    
    if (tournament.data) {
      setSelectionData(tournament.data);
      setLoadingSelection(false);
      return;
    }
    
    const prefix = tournament.status === 'upcoming' ? 'UPCOMING_' : '';
    const cleanName = tournament.name.replace(/[^a-zA-Z0-9]/g, '_').replace(/\s+/g, '_');
    const filename = `${prefix}${cleanName}.xlsx`;
    
    try {
      const downloadUrl = `https://cloud-api.yandex.net/v1/disk/resources/download?path=app:/${filename}`;
      const response = await fetch(downloadUrl, {
        headers: { 'Authorization': `OAuth ${import.meta.env.VITE_YA_TOKEN}` }
      });
      
      if (!response.ok) {
        setSelectionData(null);
        setLoadingSelection(false);
        return;
      }
      
      const { href } = await response.json();
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(href)}&t=${Date.now()}`;
      const fileResponse = await fetch(proxyUrl);
      
      if (!fileResponse.ok) {
        setSelectionData(null);
        setLoadingSelection(false);
        return;
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
      
      setSelectionData(fighters);
      tournament.data = fighters;
    } catch (error) {
      console.error('Ошибка загрузки данных для выбора:', error);
      setSelectionData(null);
    } finally {
      setLoadingSelection(false);
    }
  };

  // Инициализация Telegram WebApp
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
        
        // Сначала устанавливаем базовые данные из Telegram
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
          
          // ВАЖНО: обновляем telegramUser с photoUrl из профиля (если в профиле есть фото, а в Telegram нет)
          setTelegramUser(prev => ({
            ...prev!,
            photoUrl: profile.photoUrl || prev?.photoUrl
          }));
          
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
          
          // Обновляем профиль с актуальной аватаркой из Telegram
          const updatedProfile = {
            userId: userId,
            username: profile.username,
            photoUrl: user.photo_url || profile.photoUrl,
            level: level,
            experience: totalExp,
            coins: profile.coins,
            lastUpdated: new Date().toISOString()
          };
          
          await saveUserProfile(updatedProfile);
          
          // Обновляем кэш
          updateProfileInCache(updatedProfile);
          
        } else if (isMounted) {
          const newProfile = {
            userId: userId,
            username: username,
            photoUrl: user.photo_url,
            level: 1,
            experience: 0,
            coins: 100,
            lastUpdated: new Date().toISOString()
          };
          
          const saved = await saveUserProfile(newProfile);
          
          if (saved) {
            setUserData(prev => ({
              ...prev,
              username: username,
              coins: 100,
              myUserId: userId
            }));
            
            // Добавляем новый профиль в кэш
            updateProfileInCache(newProfile);
          }
        }
        
        if (isMounted) {
          setProfileLoaded(true);
          setLoadingProfile(false);
        }
      }
    } else {
      // Тестовый режим
      // ... существующий код ...
    }
  };
  
  initTelegram();
  
  return () => { isMounted = false; };
}, [updateProfileInCache]);

  // Загружаем результаты пользователя
  useEffect(() => {
    let isMounted = true;
    
    const loadUserData = async () => {
      if (!telegramUser || !profileLoaded) return;
      
      setLoadingUserResults(true);
      setShowPastFighters(false);
      setSelectedPastTournament(null);
      setSelectedUpcomingTournament(null);
      
      const pastResults = await Promise.all(
        pastTournaments.map((tournament: Tournament) => loadUserResults(tournament.name, telegramUser.id))
      );
      
      const upcomingResults = await Promise.all(
        upcomingTournaments.map((tournament: Tournament) => loadUserResults(tournament.name, telegramUser.id))
      );
      
      const allPastSelections: SelectedFighter[] = [];
      pastResults.forEach((result: UserResult | null) => {
        if (result && result.selections.length > 0) {
          allPastSelections.push(...result.selections);
        }
      });
      
      const allUpcomingSelections: SelectedFighter[] = [];
      upcomingResults.forEach((result: UserResult | null) => {
        if (result && result.selections.length > 0) {
          allUpcomingSelections.push(...result.selections);
        }
      });
      
      if (allUpcomingSelections.length > 0 && isMounted) {
        setUserData(prev => ({
          ...prev,
          mySelections: { ...prev.mySelections, upcoming: allUpcomingSelections },
          hasBet: true
        }));
      }
      
      if (allPastSelections.length > 0 && isMounted) {
        let hasPendingRewards = false;
        for (let i = 0; i < pastResults.length; i++) {
          const result = pastResults[i];
          if (result && !result.rewardsAccepted && result.selections.length > 0) {
            const winners = result.selections.filter(sel => sel.fighter['W/L'] === 'win');
            if (winners.length > 0) {
              const totalCoins = winners.length * 50;
              const totalExp = winners.length * 5;
              
              setPendingRewards({
                tournamentName: pastTournaments[i].name,
                winners: result.selections,
                totalCoins,
                totalExp
              });
              setShowRewardsModal(true);
              hasPendingRewards = true;
              break;
            }
          }
        }
        
        if (!hasPendingRewards) {
          setUserData(prev => ({
            ...prev,
            mySelections: { ...prev.mySelections, past: allPastSelections }
          }));
        }
      }
      
      if (isMounted) setLoadingUserResults(false);
    };
    
    loadUserData();
    
    return () => { isMounted = false; };
  }, [pastTournaments, upcomingTournaments, telegramUser, profileLoaded]);

  // Загружаем рейтинг
  useEffect(() => {
    if (currentView === 'leaderboard' && pastTournaments.length > 0) {
      setLeaderboardLoading(true);
      const latestPast = pastTournaments[0];
      loadLeaderboard(latestPast.name)
        .then(data => {
          setLeaderboardData(data);
          setLeaderboardLoading(false);
        })
        .catch(err => {
          console.error('Ошибка загрузки рейтинга:', err);
          setLeaderboardLoading(false);
        });
    }
  }, [currentView, pastTournaments]);

  const refundCoins = async () => {
    if (!telegramUser) return;
    
    const newCoins = userData.coins + 100;
    
    setUserData(prev => ({ ...prev, coins: newCoins }));
    
    const updatedProfile = {
      userId: telegramUser.id,
      username: userData.username,
      photoUrl: telegramUser.photoUrl,
      level: userData.level,
      experience: userData.totalExp,
      coins: newCoins,
      lastUpdated: new Date().toISOString()
    };
    
    await saveUserProfile(updatedProfile);
    
    // Обновляем только этот профиль в кэше
    updateProfileInCache(updatedProfile);
  };

  const openSelectionModal = async (tournament: Tournament) => {
    if (!telegramUser || isOpeningSelection) return;
    
    setIsOpeningSelection(true);
    
    try {
      if (!canPlaceBet(tournament, userData.coins)) {
        console.log('Cannot place bet');
        setIsOpeningSelection(false);
        return;
      }
      
      const newCoins = userData.coins - 100;
      
      setUserData(prev => ({ ...prev, coins: newCoins }));
      
      const updatedProfile = {
        userId: telegramUser.id,
        username: userData.username,
        photoUrl: telegramUser.photoUrl,
        level: userData.level,
        experience: userData.totalExp,
        coins: newCoins,
        lastUpdated: new Date().toISOString()
      };
      
      await saveUserProfile(updatedProfile);
      
      // Обновляем только этот профиль в кэше
      updateProfileInCache(updatedProfile);
      
      setSelectedTournament(tournament);
      setCurrentView('selection');
      setSelectedFighters(new Map());
      
      loadSelectionData(tournament);
      
    } catch (error) {
      console.error('Error opening selection:', error);
    } finally {
      setTimeout(() => {
        setIsOpeningSelection(false);
      }, 500);
    }
  };

  const handleCloseClick = async () => {
    if (isClosing) return;
    
    setIsClosing(true);
    await refundCoins();
    setCurrentView('main');
    setIsClosing(false);
  };

  const handlePastTournamentClick = (tournament: Tournament) => {
    setSelectedPastTournament(tournament.name);
    setShowPastFighters(true);
  };

  const handleUpcomingTournamentClick = (tournament: Tournament) => {
    if (isOpeningSelection) return;
    
    const hasBetForThisTournament = userData.mySelections.upcoming.some(
      (sel: SelectedFighter) => tournament.data?.some((f: Fighter) => f.Fighter === sel.fighter.Fighter)
    );
    
    if (hasBetForThisTournament) {
      setSelectedUpcomingTournament(tournament.name);
    } else {
      openSelectionModal(tournament);
    }
  };

  const saveSelections = async (selections: Map<string, Fighter>) => {
    if (!telegramUser) return;
    
    const selectionsArray = Array.from(selections.entries()).map(([weightClass, fighter]) => ({
      weightClass,
      fighter
    }));
    
    const userResult: UserResult = {
      userId: telegramUser.id,
      username: telegramUser.username,
      totalDamage: 0,
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
            upcoming: [...prev.mySelections.upcoming, ...selectionsArray] 
          },
          hasBet: true
        }));
        setCurrentView('main');
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
      if (i + 1 < fighters.length) pairs.push([fighters[i], fighters[i + 1]]);
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
          <img src={`${BASE_URL}/Logo.webp`} alt="AFTER PARTY FIGHTS" className="loading-logo" />
          <div className="loading-progress-bar">
            <div className="loading-progress-fill" style={{ width: `${loadingProgress}%` }}></div>
          </div>
          <div className="loading-stage">{loadingStage}</div>
          <div className="loading-text">{loadingProgress}%</div>
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
            TRY AGAIN
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
              style={{ width: `${(userData.currentExp / userData.nextLevelExp) * 100}%` }}
            ></div>
            <span className="level-text">
              Lvl {userData.level} • {userData.currentExp}/{userData.nextLevelExp}
            </span>
          </div>
          <div className="profile-coins">🪙 {userData.coins}</div>
        </div>
      </header>

      <main className="main-content">
        {currentView === 'main' && (
          <div className="tournaments-container">
            {pastTournaments.length > 0 ? (
              <section className="tournament-section past">
                <div className="tournament-header">
                  <h2>
                    {!showPastFighters ? 'ACTIVE TOURNAMENTS' : 
                      pastTournaments.find((t: Tournament) => t.name === selectedPastTournament)?.name}
                  </h2>
                  <div className="tournament-meta">
                    <span>
                      {!showPastFighters 
                        ? `${pastTournaments.length} event${pastTournaments.length !== 1 ? 's' : ''}`
                        : formatDate(pastTournaments.find((t: Tournament) => t.name === selectedPastTournament)?.date || '')}
                    </span>
                    <span className="tournament-status active">
                      {!showPastFighters ? 'IN GAME' : 'ACTIVE'}
                    </span>
                  </div>
                </div>
                
                <div className="tournament-content">
                  {loadingUserResults ? (
                    <div className="tournament-message">Loading...</div>
                  ) : hasPastBet ? (
                    <>
                      {!showPastFighters ? (
                        <div className="tournament-cards-grid">
                          {pastTournaments.map((tournament: Tournament) => {
                            const tournamentTotal = calculateTotalDamage(
                              userData.mySelections.past.filter(
                                (sel: SelectedFighter) => tournament.data?.some((f: Fighter) => f.Fighter === sel.fighter.Fighter)
                              )
                            );
                            
                            return (
                              <div key={tournament.name} className="tournament-card-wrapper">
                                <div 
                                  className="tournament-card" 
                                  onClick={() => handlePastTournamentClick(tournament)}
                                >
                                  <div className="tournament-card-damage-box">
                                    TOTAL: {tournamentTotal}
                                  </div>
                                  <div className="tournament-card-image">
                                    <img src={`${BASE_URL}/UFC_cardpack.png`} alt="Tournament pack" />
                                  </div>
                                  <div className="tournament-card-name">{tournament.name}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <>
                          <div className="selected-fighters-grid">
                            {userData.mySelections.past
                              .filter((sel: SelectedFighter) => {
                                const tournament = pastTournaments.find((t: Tournament) => t.name === selectedPastTournament);
                                return tournament?.data?.some((f: Fighter) => f.Fighter === sel.fighter.Fighter);
                              })
                              .map((sel: SelectedFighter, idx: number) => {
                                const isWinner = sel.fighter['W/L'] === 'win';
                                return (
                                  <div key={idx} className="selected-fighter-card" 
                                       style={{ backgroundColor: getWeightClassColor(sel.weightClass) }}>
                                    <div className="selected-fighter-damage-box">
                                      {roundDamage(sel.fighter['Total Damage'])}
                                    </div>
                                    <div className="selected-fighter-avatar-square">
                                      <img src={`${BASE_URL}/avatars/${getAvatarFilename(sel.weightClass)}`} 
                                           alt={sel.fighter.Fighter}
                                           onError={(e) => {
                                             (e.target as HTMLImageElement).style.display = 'none';
                                             const parent = (e.target as HTMLImageElement).parentElement;
                                             if (parent) parent.innerHTML = sel.weightClass.includes("Women") ? "👩" : "👤";
                                           }} />
                                    </div>
                                    <span className="selected-fighter-name">{sel.fighter.Fighter}</span>
                                    {isWinner && <span className="winner-crown">👑</span>}
                                  </div>
                                );
                              })}
                          </div>
                          
                          <div className="tournament-footer">
                            <div className="footer-total-damage">
                              TOTAL DAMAGE: {calculateTotalDamage(
                                userData.mySelections.past.filter((sel: SelectedFighter) => {
                                  const tournament = pastTournaments.find((t: Tournament) => t.name === selectedPastTournament);
                                  return tournament?.data?.some((f: Fighter) => f.Fighter === sel.fighter.Fighter);
                                })
                              )}
                            </div>
                            <button 
                              className="footer-close-button"
                              onClick={() => setShowPastFighters(false)}
                            >
                              CLOSE
                            </button>
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="tournament-message">BETS ARE CLOSED</div>
                  )}
                </div>
              </section>
            ) : (
              <TournamentSkeleton />
            )}

            {upcomingTournaments.length > 0 ? (
              <section className="tournament-section upcoming">
                <div className="tournament-header">
                  <h2>
                    {selectedUpcomingTournament 
                      ? upcomingTournaments.find((t: Tournament) => t.name === selectedUpcomingTournament)?.name 
                      : 'UPCOMING TOURNAMENTS'}
                  </h2>
                  <div className="tournament-meta">
                    <span>
                      {selectedUpcomingTournament 
                        ? formatDate(upcomingTournaments.find((t: Tournament) => t.name === selectedUpcomingTournament)?.date || '')
                        : `${upcomingTournaments.length} event${upcomingTournaments.length !== 1 ? 's' : ''}`}
                    </span>
                    <span className="tournament-status upcoming">
                      {selectedUpcomingTournament ? 'UPCOMING' : 'SCHEDULED'}
                    </span>
                  </div>
                </div>
                
                <div className="tournament-content">
                  {loadingUserResults ? (
                    <div className="tournament-message">Loading...</div>
                  ) : selectedUpcomingTournament ? (
                    <>
                      <div className="selected-fighters-grid">
                        {userData.mySelections.upcoming
                          .filter((sel: SelectedFighter) => {
                            const tournament = upcomingTournaments.find((t: Tournament) => t.name === selectedUpcomingTournament);
                            return tournament?.data?.some((f: Fighter) => f.Fighter === sel.fighter.Fighter);
                          })
                          .map((sel: SelectedFighter, idx: number) => {
                            const hasResult = sel.fighter['W/L'] !== null;
                            return (
                              <div key={idx} className="selected-fighter-card"
                                   style={{ backgroundColor: getWeightClassColor(sel.weightClass) }}>
                                <div className="selected-fighter-damage-box">
                                  {hasResult ? roundDamage(sel.fighter['Total Damage']) : '?'}
                                </div>
                                <div className="selected-fighter-avatar-square">
                                  <img src={`${BASE_URL}/avatars/${getAvatarFilename(sel.weightClass)}`}
                                       alt={sel.fighter.Fighter}
                                       onError={(e) => {
                                         (e.target as HTMLImageElement).style.display = 'none';
                                         const parent = (e.target as HTMLImageElement).parentElement;
                                         if (parent) parent.innerHTML = sel.weightClass.includes("Women") ? "👩" : "👤";
                                       }} />
                                </div>
                                <span className="selected-fighter-name">{sel.fighter.Fighter}</span>
                              </div>
                            );
                          })}
                      </div>
                      
                      <div className="tournament-footer">
                        <div className="footer-total-damage">
                          TOTAL DAMAGE: {calculateTotalDamage(
                            userData.mySelections.upcoming.filter((sel: SelectedFighter) => {
                              const tournament = upcomingTournaments.find((t: Tournament) => t.name === selectedUpcomingTournament);
                              return tournament?.data?.some((f: Fighter) => f.Fighter === sel.fighter.Fighter);
                            })
                          )}
                        </div>
                        <button 
                          className="footer-close-button"
                          onClick={() => setSelectedUpcomingTournament(null)}
                        >
                          CLOSE
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="tournament-cards-grid">
                      {upcomingTournaments.map((tournament: Tournament) => {
                        const hasBetForThisTournament = userData.mySelections.upcoming.some(
                          (sel: SelectedFighter) => tournament.data?.some((f: Fighter) => f.Fighter === sel.fighter.Fighter)
                        );
                        
                        const tournamentTotal = hasBetForThisTournament 
                          ? calculateTotalDamage(
                              userData.mySelections.upcoming.filter(
                                (sel: SelectedFighter) => tournament.data?.some((f: Fighter) => f.Fighter === sel.fighter.Fighter)
                              )
                            )
                          : null;
                        
                        const isLoading = isOpeningSelection;
                        
                        return (
                          <div key={tournament.name} className="tournament-card-wrapper">
                            <div 
                              className="tournament-card" 
                              onClick={() => handleUpcomingTournamentClick(tournament)}
                              style={{ 
                                opacity: isLoading ? 0.7 : 1, 
                                pointerEvents: isLoading ? 'none' : 'auto' 
                              }}
                            >
                              <div className="tournament-card-damage-box">
                                {isLoading && !hasBetForThisTournament 
                                  ? 'LOADING...' 
                                  : (hasBetForThisTournament ? `TOTAL: ${tournamentTotal}` : 'SELECT')}
                              </div>
                              <div className="tournament-card-image">
                                <img src={`${BASE_URL}/UFC_cardpack.png`} alt="Tournament pack" />
                              </div>
                              <div className="tournament-card-name">{tournament.name}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            ) : (
              <TournamentSkeleton />
            )}
          </div>
        )}

        {currentView === 'leaderboard' && (
          <div className="leaderboard-screen">
            <h2 className="leaderboard-header">
              {pastTournaments.length > 0 ? pastTournaments[0].name : 'LEADERBOARD'}
            </h2>
            {leaderboardLoading ? (
              <div className="leaderboard-loading">LOADING...</div>
            ) : leaderboardData.length > 0 ? (
              <div className="leaderboard-list">
                {leaderboardData.map((entry: LeaderboardEntry) => (
                  <LeaderboardItem
                    key={entry.userId}
                    entry={entry}
                    currentUserId={telegramUser?.id}
                    currentUserPhoto={telegramUser?.photoUrl}
                    profile={allProfiles.get(entry.userId)}
                  />
                ))}
              </div>
            ) : (
              <div className="leaderboard-empty">NO RESULTS YET</div>
            )}
          </div>
        )}

        {currentView === 'selection' && selectedTournament && (
          <div className="selection-modal">
            <div className="selection-content">
              <div className="selection-header">
                <h2>{selectedTournament.name}</h2>
                <button 
                  className="close-button" 
                  onClick={handleCloseClick}
                  disabled={isClosing}
                >
                  {isClosing ? 'CLOSING...' : 'CLOSE'}
                </button>
              </div>
              
              <div className="selection-progress">
                SELECTED: {selectedFighters.size} / 5
              </div>

              {loadingSelection ? (
                <div className="selection-loading">LOADING FIGHTERS...</div>
              ) : (
                <div className="fighters-scroll">
                  {selectionData && Object.entries(groupFightersByWeight(selectionData)).map(([weightClass, fighters]) => {
                    const pairs = getFighterPairs(fighters as Fighter[]);
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
                                } ${isWeightSelected && selectedFighter?.Fighter !== fighter.Fighter ? 'disabled' : ''}`}
                                onClick={() => handleSelectFighter(weightClass, fighter)}
                                disabled={
                                  (isWeightSelected && selectedFighter?.Fighter !== fighter.Fighter) ||
                                  (selectedFighters.size >= 5 && !selectedFighters.has(weightClass))
                                }>
                                <div className="fighter-avatar">
                                  <img src={`${BASE_URL}/avatars/${getAvatarFilename(weightClass)}`}
                                       alt={fighter.Fighter}
                                       onError={(e) => {
                                         (e.target as HTMLImageElement).style.display = 'none';
                                         const parent = (e.target as HTMLImageElement).parentElement;
                                         if (parent) {
                                           parent.innerHTML = weightClass.includes("Women") ? "👩" : "👤";
                                           parent.style.fontSize = '24px';
                                         }
                                       }} />
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
              )}

              <div className="selection-actions">
                <button className="discard-button" onClick={() => setSelectedFighters(new Map())}>
                  DISCARD ALL
                </button>
                <button 
                  className={`accept-button ${selectedFighters.size === 5 ? 'active' : ''}`}
                  disabled={selectedFighters.size !== 5}
                  onClick={async () => {
                    await saveSelections(selectedFighters);
                  }}>
                  ACCEPT CARD
                </button>
              </div>
            </div>
          </div>
        )}

        {currentView === 'pvp' && (
          <Pvp
            pastTournaments={pastTournaments}
            userSelections={userData.mySelections.past}
          />
        )}

      </main>

      {showRewardsModal && pendingRewards && (
        <div className="rewards-modal">
          <div className="rewards-content">
            <h2>🏆 CONGRATULATIONS! 🏆</h2>
            <p>Tournament "{pendingRewards.tournamentName}" completed</p>
            
            {pendingRewards.winners.length > 0 ? (
              <>
                <div className="winners-list">
                  <h3>WINNERS IN YOUR BET:</h3>
                  {pendingRewards.winners.map((sel: SelectedFighter, idx: number) => (
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
            
            <button 
              className="accept-button" 
              onClick={acceptRewards}
              disabled={isAcceptingRewards}
            >
              {isAcceptingRewards ? 'ACCEPTING...' : 'ACCEPT'}
            </button>
          </div>
        </div>
      )}

      <nav className={`bottom-nav ${currentView === 'selection' ? 'hidden' : ''}`}>
        <button className={`nav-button ${currentView === 'main' ? 'active' : ''}`} onClick={() => setCurrentView('main')}>
          <img src={`${BASE_URL}/Home_button.png`} alt="Home" />
        </button>
        <button className={`nav-button ${currentView === 'leaderboard' ? 'active' : ''}`} onClick={() => setCurrentView('leaderboard')}>
          <img src={`${BASE_URL}/Leadeship_button.png`} alt="Leaderboard" />
        </button>
        <button 
          className={`nav-button ${currentView === 'pvp' ? 'active' : ''}`} 
          onClick={() => setCurrentView('pvp')}
        >
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