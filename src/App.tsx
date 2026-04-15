﻿import { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import Pvp from './components/Pvp';
import LeaderboardItem from './components/LeaderboardItem';
import { Fighter, Tournament, SelectedFighter, UserResult } from './types';
import { useTournaments } from './hooks/useTournaments';
import { groupFightersByWeight } from './data/loadFighters';
import { 
  saveUserResults, 
  loadLeaderboard, 
  LeaderboardEntry, 
  loadUserResults,
  loadExistingResults
} from './api/yandexUpload';
import {
  loadUserProfile,
  saveUserProfile,
  loadAllProfiles,
  UserProfile,
  Notification
} from './api/userProfiles';
import * as XLSX from 'xlsx';

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

const LEVEL_THRESHOLDS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 0];
const BASE_URL = import.meta.env.PROD ? '' : '/reactjs-template';

const roundDamage = (damage: number): number => Math.round(damage);

const calculateLevel = (totalExp: number): { level: number; currentExp: number; nextLevelExp: number } => {
  let remainingExp = totalExp;
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length - 1; i++) {
    const expNeeded = LEVEL_THRESHOLDS[i];
    if (remainingExp >= expNeeded) {
      remainingExp -= expNeeded;
      level = i + 2;
    } else break;
  }
  const nextLevelExp = level < 10 ? LEVEL_THRESHOLDS[level - 1] : 0;
  return { level, currentExp: remainingExp, nextLevelExp };
};

function getAvatarFilename(weightClass: string): string {
  const map: Record<string, string> = {
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
  const colors: Record<string, string> = {
    'Flyweight': '#00FFA3',
    'Bantamweight': '#00E0FF',
    'Featherweight': '#0075FF',
    'Lightweight': '#AD00FF',
    'Welterweight': '#FF00D6',
    'Middleweight': '#FFD700',
    'Light Heavyweight': '#FF5C00',
    'Heavyweight': '#FF0000',
    "Women's Strawweight": '#FF6B9D',
    "Women's Flyweight": '#5EEAD4',
    "Women's Bantamweight": '#818CF8',
    "Catch Weight": '#94A3B8'
  };
  return colors[weightClass] || '#666666';
}

function getFighterStyle(fighter: SelectedFighter): string {
  const str = Number(fighter.fighter.Str) || 0;
  const td = Number(fighter.fighter.Td) || 0;
  const sub = Number(fighter.fighter.Sub) || 0;
  const tdSubSum = td + sub;
  if (tdSubSum >= 2 && str < 50) return 'Grappler';
  if (str >= 50 && tdSubSum < 2) return 'Striker';
  if (str >= 50 && tdSubSum >= 2) return 'Universal';
  return 'Simple';
}

function getStyleIconFilename(style: string): string {
  const icons: Record<string, string> = {
    'Grappler': 'Grappler_style_icon.webp',
    'Striker': 'Striker_style_icon.webp',
    'Universal': 'Universal_style_icon.webp',
    'Simple': 'Simple_style_icon.webp'
  };
  return icons[style] || 'Simple_style_icon.webp';
}

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

function App() {
  const { pastTournaments, upcomingTournaments, loading, loadingProgress, loadingStage, error } = useTournaments();
  const [isSavingBet, setIsSavingBet] = useState(false);
  const [isClaimingRefund, setIsClaimingRefund] = useState(false);
  const [selectedFighters, setSelectedFighters] = useState<Map<string, Fighter>>(new Map());
  const [currentView, setCurrentView] = useState<'main' | 'leaderboard' | 'selection' | 'pvp'>('main');
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [loadingUserResults, setLoadingUserResults] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [telegramUser, setTelegramUser] = useState<{ id: string; username: string; photoUrl?: string } | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  
  const [animatedBetAmount, setAnimatedBetAmount] = useState(5);
  const [showBetAmountIncrease, setShowBetAmountIncrease] = useState(false);
  const [allProfiles, setAllProfiles] = useState<Map<string, UserProfile>>(new Map());
  const [tournamentDataCache, setTournamentDataCache] = useState<Map<string, { weightClasses: string[]; results: UserResult[]; fightersData: Fighter[] }>>(new Map());

  const [showRewardsModal, setShowRewardsModal] = useState(false);
  const [pendingRewards, setPendingRewards] = useState<{
    tournamentName: string;
    winners: SelectedFighter[];
    allSelections: SelectedFighter[];
    totalCoins: number;
    totalTickets: number;
    totalExp: number;
  } | null>(null);

  const [selectionData, setSelectionData] = useState<Fighter[] | null>(null);
  const [loadingSelection, setLoadingSelection] = useState(false);
  const [showPastFighters, setShowPastFighters] = useState(false);
  const [selectedPastTournament, setSelectedPastTournament] = useState<string | null>(null);
  const [selectedUpcomingTournament, setSelectedUpcomingTournament] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isAcceptingRewards, setIsAcceptingRewards] = useState(false);
  const [isUpdatingTournaments, setIsUpdatingTournaments] = useState(false);
  const [showCancelledModal, setShowCancelledModal] = useState(false);
  const [cancelledTournament, setCancelledTournament] = useState<Tournament | null>(null);

  // Notifications
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [isClaimingAll, setIsClaimingAll] = useState(false);

  const [showBetModal, setShowBetModal] = useState(false);
  const [selectedBetTournament, setSelectedBetTournament] = useState<Tournament | null>(null);
  const [selectedBetAmount, setSelectedBetAmount] = useState(5);
  const [availableBetAmounts, setAvailableBetAmounts] = useState<number[]>([]);
  const [currentBetAmount, setCurrentBetAmount] = useState<number | null>(null);
  const [showNotEnoughCoins, setShowNotEnoughCoins] = useState(false);

  const [showPvpBetModal, setShowPvpBetModal] = useState(false);
  const [pvpSelectedBetAmount, setPvpSelectedBetAmount] = useState(5);
  const [pvpAvailableBetAmounts, setPvpAvailableBetAmounts] = useState<number[]>([]);
  const [pvpSelectedTournament, setPvpSelectedTournament] = useState<Tournament | null>(null);
  const [isPvpBetConfirming, setIsPvpBetConfirming] = useState(false);
  const pvpRef = useRef<{ engage: (tournament: Tournament, betAmount: number) => Promise<void> } | null>(null);

  const [userData, setUserData] = useState({
    username: 'Player',
    level: 1,
    currentExp: 0,
    totalExp: 0,
    nextLevelExp: 5,
    coins: 100,
    tickets: 0,
    ton: 0,
    expPoints: 1,
    mySelections: { upcoming: [] as SelectedFighter[], past: [] as SelectedFighter[] },
    myUserId: null as string | null,
    hasBet: false
  });

  const hasPastBet = userData.mySelections.past.length > 0;

  const calculateTotalDamage = (selections: SelectedFighter[]): number => {
    const total = selections.reduce((sum: number, sel: SelectedFighter) => sum + (sel.fighter['Total Damage'] || 0), 0);
    return roundDamage(total);
  };

  const calculateAvailableBetAmounts = (userCoins: number): number[] => {
    if (userCoins < 5) return [];
    const maxBet = Math.floor(userCoins / 5) * 5;
    const amounts: number[] = [5];
    const step = (maxBet - 5) / 7;
    for (let i = 1; i <= 7; i++) {
      const value = Math.round(5 + step * i);
      const rounded = Math.floor(value / 5) * 5;
      if (rounded > 5 && rounded < maxBet && !amounts.includes(rounded)) amounts.push(rounded);
    }
    if (maxBet > 5 && !amounts.includes(maxBet)) amounts.push(maxBet);
    amounts.sort((a, b) => a - b);
    return amounts.slice(0, 9);
  };

  const [isLandscape, setIsLandscape] = useState(false);
  useEffect(() => {
    const checkOrientation = () => setIsLandscape(window.innerWidth > window.innerHeight);
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  useEffect(() => {
    const loadAllUserProfiles = async () => {
      const profiles = await loadAllProfiles();
      const profilesMap = new Map();
      profiles.forEach(profile => profilesMap.set(profile.userId, profile));
      setAllProfiles(profilesMap);
    };
    loadAllUserProfiles();
  }, []);

  const updateProfileInCache = useCallback((updatedProfile: UserProfile) => {
    setAllProfiles(prev => {
      const newMap = new Map(prev);
      newMap.set(updatedProfile.userId, updatedProfile);
      return newMap;
    });
  }, []);

  // ----- Notifications functions -----
  const loadNotifications = useCallback(async () => {
    if (!telegramUser) return;
    const profile = await loadUserProfile(telegramUser.id);
    if (profile?.notifications?.length) {
      const sorted = [...profile.notifications].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setNotifications(sorted);
    } else setNotifications([]);
  }, [telegramUser]);

  const updateNotifications = useCallback(async (updated: Notification[]) => {
    if (!telegramUser) return;
    const profile = await loadUserProfile(telegramUser.id);
    if (profile) {
      profile.notifications = updated;
      await saveUserProfile(profile);
      setNotifications(updated);
    }
  }, [telegramUser]);

  const removeNotification = useCallback(async (id: string) => {
    // Оптимистичное удаление из локального состояния
    const updated = notifications.filter(n => n.id !== id);
    setNotifications(updated);
    // Асинхронное сохранение в фоне
    updateNotifications(updated).catch(console.error);
  }, [notifications, updateNotifications]);

  const claimAllNotifications = useCallback(async () => {
    if (isClaimingAll) return;
    setIsClaimingAll(true);
  
    // 1. Оптимистичное обновление UI – очищаем уведомления и обновляем баланс
    let totalCoins = 0, totalTickets = 0, totalExp = 0;
    for (const n of notifications) {
      if (n.type === 'tournament_reward') {
        totalCoins += n.data.coins || 0;
        totalTickets += n.data.tickets || 0;
        totalExp += n.data.experience || 0;
      } else if (n.type === 'bet_cancelled') {
        totalCoins += n.data.refundAmount || 0;
      }
    }
    const newCoins = userData.coins + totalCoins;
    const newTickets = userData.tickets + totalTickets;
    const newTotalExp = userData.totalExp + totalExp;
    const { level, currentExp, nextLevelExp } = calculateLevel(newTotalExp);
    let newExpPoints = userData.expPoints;
    if (level > userData.level) newExpPoints += (level - userData.level);
  
    // Мгновенно обновляем локальное состояние
    setUserData(prev => ({
      ...prev,
      coins: newCoins,
      tickets: newTickets,
      totalExp: newTotalExp,
      level,
      currentExp,
      nextLevelExp,
      expPoints: newExpPoints
    }));
    setNotifications([]); // Уведомления исчезают сразу
  
    // 2. Фоновое сохранение на диск
    try {
      if (telegramUser) {
        const profile = await loadUserProfile(telegramUser.id);
        if (profile) {
          profile.coins = newCoins;
          profile.tickets = newTickets;
          profile.experience = newTotalExp;
          profile.level = level;
          profile.expPoints = newExpPoints;
          profile.notifications = [];
          await saveUserProfile(profile);
          updateProfileInCache(profile);
        }
      }
    } catch (error) {
      console.error('Claim all save failed:', error);
      // Откат при ошибке – возвращаем уведомления и старый баланс
      setNotifications(notifications);
      setUserData(prev => ({
        ...prev,
        coins: prev.coins - totalCoins,
        tickets: prev.tickets - totalTickets,
        totalExp: prev.totalExp - totalExp,
        level: userData.level,
        currentExp: userData.currentExp,
        nextLevelExp: userData.nextLevelExp,
        expPoints: userData.expPoints
      }));
      alert('Failed to claim rewards. Please try again.');
    } finally {
      setIsClaimingAll(false);
    }
  }, [notifications, userData, telegramUser, isClaimingAll, updateProfileInCache]);

  const claimRefund = useCallback(async (notification: Notification) => {
    if (!telegramUser || isClaimingRefund) return;
  
    const refundAmount = notification.data.refundAmount || 0;
    const newCoins = userData.coins + refundAmount;
  
    // 1. Оптимистичное обновление UI – сразу закрываем окно и обновляем баланс
    setUserData(prev => ({ ...prev, coins: newCoins }));
    // Удаляем уведомление из локального списка
    setNotifications(prev => prev.filter(n => n.id !== notification.id));
    setShowChangesModal(false);
    setSelectedNotification(null);
  
    // 2. Запускаем фоновое сохранение
    setIsClaimingRefund(true);
    try {
      const profile = await loadUserProfile(telegramUser.id);
      if (profile) {
        profile.coins = newCoins;
        profile.notifications = profile.notifications?.filter(n => n.id !== notification.id) || [];
        await saveUserProfile(profile);
        updateProfileInCache(profile);
      }
    } catch (error) {
      console.error('Refund save failed:', error);
      // Откат оптимистичных изменений при ошибке
      setUserData(prev => ({ ...prev, coins: prev.coins - refundAmount }));
      setNotifications(prev => [...prev, notification]); // возвращаем уведомление
      alert('Failed to claim refund. Please try again.');
    } finally {
      setIsClaimingRefund(false);
    }
  }, [telegramUser, userData.coins, isClaimingRefund, updateProfileInCache]);

  const handleNotificationClick = (notification: Notification) => {
    setSelectedNotification(notification);
    if (notification.type === 'bet_cancelled') {
      setShowChangesModal(true);
    } else if (notification.type === 'tournament_reward') {
      const winners = notification.data.winners || [];
      const allSelections = notification.data.allSelections || [];
      setPendingRewards({
        tournamentName: notification.tournamentName,
        winners: winners as any,
        allSelections: allSelections as any,
        totalCoins: notification.data.coins || 0,
        totalTickets: notification.data.tickets || 0,
        totalExp: notification.data.experience || 0
      });
      setShowRewardsModal(true);
      // Удаляем уведомление сразу (оптимистично)
      removeNotification(notification.id);
    }
  };

  // ----- Core functions -----
  const loadTournamentData = useCallback(async (tournamentName: string): Promise<{ weightClasses: string[]; results: UserResult[]; fightersData: Fighter[] }> => {
    const cached = tournamentDataCache.get(tournamentName);
    if (cached) return cached;
    const tournament = pastTournaments.find(t => t.name === tournamentName);
    const fightersData: Fighter[] = tournament?.data || [];
    const weightClasses: string[] = tournament?.data ? [...new Set(tournament.data.map((f: Fighter) => f['Weight class']))] : [];
    const results = await loadExistingResults(tournamentName);
    const data = { weightClasses, results, fightersData };
    setTournamentDataCache(prev => new Map(prev).set(tournamentName, data));
    return data;
  }, [pastTournaments, tournamentDataCache]);

  const claimBattleRewards = async (rewards: { coins: number; experience: number }) => {
    if (!telegramUser) return;
    const newCoins = userData.coins + rewards.coins;
    const newTotalExp = userData.totalExp + rewards.experience;
    const { level, currentExp, nextLevelExp } = calculateLevel(newTotalExp);
    let newExpPoints = userData.expPoints;
    if (level > userData.level) newExpPoints += (level - userData.level);
    setUserData(prev => ({ ...prev, coins: newCoins, totalExp: newTotalExp, level, currentExp, nextLevelExp, expPoints: newExpPoints }));
    
    const currentProfile = await loadUserProfile(telegramUser.id);
    const updatedProfile = {
      userId: telegramUser.id,
      username: userData.username,
      photoUrl: telegramUser.photoUrl,
      level,
      experience: newTotalExp,
      expPoints: newExpPoints,
      coins: newCoins,
      tickets: userData.tickets,
      ton: userData.ton,
      lastUpdated: new Date().toISOString(),
      notifications: currentProfile?.notifications
    };
    const saved = await saveUserProfile(updatedProfile);
    if (saved) {
      updateProfileInCache(updatedProfile);
    }
  };

  const acceptRewards = async () => {
    if (!pendingRewards || !telegramUser || isAcceptingRewards) return;
    setIsAcceptingRewards(true);
    setIsUpdatingTournaments(true);
    try {
      const newCoins = userData.coins + pendingRewards.totalCoins;
      const newTickets = userData.tickets + pendingRewards.totalTickets;
      const newTotalExp = userData.totalExp + pendingRewards.totalExp;
      const { level, currentExp, nextLevelExp } = calculateLevel(newTotalExp);
      let newExpPoints = userData.expPoints;
      if (level > userData.level) newExpPoints += (level - userData.level);
      const tournament = pastTournaments.find(t => t.name === pendingRewards.tournamentName);
      const tournamentSelections = pendingRewards.allSelections;
      setUserData(prev => {
        const otherPastSelections = prev.mySelections.past.filter(sel => !tournament?.data?.some(f => f.Fighter === sel.fighter.Fighter));
        return { ...prev, coins: newCoins, tickets: newTickets, totalExp: newTotalExp, level, currentExp, nextLevelExp, expPoints: newExpPoints, mySelections: { ...prev.mySelections, past: [...otherPastSelections, ...tournamentSelections] } };
      });
      setShowRewardsModal(false);
      setPendingRewards(null);
      setShowPastFighters(false);
      if (tournament) {
        const currentProfile = await loadUserProfile(telegramUser.id);
        const updatedProfile = {
          userId: telegramUser.id,
          username: userData.username,
          photoUrl: telegramUser.photoUrl,
          level,
          experience: newTotalExp,
          expPoints: newExpPoints,
          coins: newCoins,
          tickets: newTickets,
          ton: userData.ton,
          lastUpdated: new Date().toISOString(),
          notifications: currentProfile?.notifications
        };
        const saved = await saveUserProfile(updatedProfile);
        if (saved) {
          updateProfileInCache(updatedProfile);
        }
        const currentResult = await loadUserResults(tournament.name, telegramUser.id);
        if (currentResult) {
          const updatedResult: UserResult = { ...currentResult, rewardsAccepted: true, rewards: { coins: pendingRewards.totalCoins, experience: pendingRewards.totalExp } };
          await saveUserResults(tournament.name, updatedResult);
        }
      }
      await refreshUserData();
      setIsUpdatingTournaments(false);
    } catch (error) {
      console.error(error);
      setIsUpdatingTournaments(false);
    } finally { setIsAcceptingRewards(false); }
  };

  const refreshUserData = useCallback(async () => {
    if (!telegramUser) return;
    const pastResults = await Promise.all(pastTournaments.map(t => loadUserResults(t.name, telegramUser.id)));
    const upcomingResults = await Promise.all(upcomingTournaments.map(t => loadUserResults(t.name, telegramUser.id)));
    const allPastSelections: SelectedFighter[] = [];
    pastResults.forEach(r => { if (r?.selections.length) allPastSelections.push(...r.selections); });
    const allUpcomingSelections: SelectedFighter[] = [];
    upcomingResults.forEach(r => { if (r?.selections.length) allUpcomingSelections.push(...r.selections); });
    setUserData(prev => ({ ...prev, mySelections: { upcoming: allUpcomingSelections, past: allPastSelections }, hasBet: allUpcomingSelections.length > 0 }));
  }, [pastTournaments, upcomingTournaments, telegramUser]);

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
      const response = await fetch(downloadUrl, { headers: { 'Authorization': `OAuth ${import.meta.env.VITE_YA_TOKEN}` } });
      if (!response.ok) { setSelectionData(null); setLoadingSelection(false); return; }
      const { href } = await response.json();
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(href)}&t=${Date.now()}`;
      const fileResponse = await fetch(proxyUrl);
      if (!fileResponse.ok) { setSelectionData(null); setLoadingSelection(false); return; }
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
    } catch (error) { console.error(error); setSelectionData(null); } finally { setLoadingSelection(false); }
  };

  useEffect(() => {
    let mounted = true;
    const initTelegram = async () => {
      if (window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.ready();
        const user = tg.initDataUnsafe.user;
        if (user && mounted) {
          const username = user.username || `${user.first_name} ${user.last_name || ''}`.trim();
          const userId = `user_${user.id}`;
          setTelegramUser({ id: userId, username, photoUrl: user.photo_url });
          setLoadingProfile(true);
          const profile = await loadUserProfile(userId);
          if (profile && mounted) {
            const totalExp = profile.experience || 0;
            const { level, currentExp, nextLevelExp } = calculateLevel(totalExp);
            setUserData(prev => ({ ...prev, username: profile.username, level, currentExp, totalExp, nextLevelExp, coins: profile.coins, tickets: profile.tickets || 0, ton: profile.ton || 0, expPoints: profile.expPoints || 1, myUserId: userId }));
            const updatedProfile = {
              userId,
              username: profile.username,
              photoUrl: user.photo_url || profile.photoUrl,
              level,
              experience: totalExp,
              expPoints: profile.expPoints || 1,
              coins: profile.coins,
              tickets: profile.tickets || 0,
              ton: profile.ton || 0,
              lastUpdated: new Date().toISOString(),
              notifications: profile.notifications
            };
            await saveUserProfile(updatedProfile);
            updateProfileInCache(updatedProfile);
          } else if (mounted) {
            const newProfile = { userId, username, photoUrl: user.photo_url, level: 1, experience: 0, expPoints: 1, coins: 100, tickets: 0, ton: 0, lastUpdated: new Date().toISOString(), notifications: [] };
            const saved = await saveUserProfile(newProfile);
            if (saved) {
              setUserData(prev => ({ ...prev, username, coins: 100, tickets: 0, ton: 0, expPoints: 1, myUserId: userId }));
              updateProfileInCache(newProfile);
            }
          }
          if (mounted) { setProfileLoaded(true); setLoadingProfile(false); }
        }
      }
    };
    initTelegram();
    return () => { mounted = false; };
  }, [updateProfileInCache]);

  useEffect(() => {
    let mounted = true;
    const loadUserData = async () => {
      if (!telegramUser || !profileLoaded) return;
      setLoadingUserResults(true);
      const pastResults = await Promise.all(pastTournaments.map(t => loadUserResults(t.name, telegramUser.id)));
      const upcomingResults = await Promise.all(upcomingTournaments.map(t => loadUserResults(t.name, telegramUser.id)));
      const allPastSelections: SelectedFighter[] = [];
      pastResults.forEach(r => { if (r?.selections.length) allPastSelections.push(...r.selections); });
      const allUpcomingSelections: SelectedFighter[] = [];
      upcomingResults.forEach(r => { if (r?.selections.length) allUpcomingSelections.push(...r.selections); });
      if (allUpcomingSelections.length && mounted) setUserData(prev => ({ ...prev, mySelections: { ...prev.mySelections, upcoming: allUpcomingSelections }, hasBet: true }));
      if (allPastSelections.length && mounted) {
        let hasCancelledBet = false;
        let cancelledTournamentData: Tournament | null = null;
        for (let i = 0; i < pastResults.length; i++) {
          const result = pastResults[i];
          const tournament = pastTournaments[i];
          if (result?.cancelled === true) {
            hasCancelledBet = true;
            cancelledTournamentData = tournament;
            continue;
          }
        }
        setUserData(prev => ({ ...prev, mySelections: { ...prev.mySelections, past: allPastSelections } }));
        if (hasCancelledBet && cancelledTournamentData) {
          setCancelledTournament(cancelledTournamentData);
          setShowCancelledModal(true);
        }
      }
      await loadNotifications();
      if (mounted) setLoadingUserResults(false);
    };
    loadUserData();
    return () => { mounted = false; };
  }, [pastTournaments, upcomingTournaments, telegramUser, profileLoaded, loadNotifications]);

  useEffect(() => {
    if (currentView === 'leaderboard' && pastTournaments.length) {
      setLeaderboardLoading(true);
      loadLeaderboard(pastTournaments[0].name).then(data => { setLeaderboardData(data); setLeaderboardLoading(false); }).catch(err => { console.error(err); setLeaderboardLoading(false); });
    }
  }, [currentView, pastTournaments]);

  const openSelectionWithBet = async () => {
    if (!selectedBetTournament || !telegramUser) return;
    setShowBetModal(false);
    setCurrentBetAmount(selectedBetAmount);
    setSelectedTournament(selectedBetTournament);
    setCurrentView('selection');
    setSelectedFighters(new Map());
    loadSelectionData(selectedBetTournament);
  };

  const handleUpcomingTournamentClick = (tournament: Tournament) => {
    const hasBetForThisTournament = userData.mySelections.upcoming.some(sel => tournament.data?.some(f => f.Fighter === sel.fighter.Fighter));
    if (hasBetForThisTournament) setSelectedUpcomingTournament(tournament.name);
    else {
      if (userData.coins < 5) { if (!showNotEnoughCoins) { setShowNotEnoughCoins(true); setTimeout(() => setShowNotEnoughCoins(false), 1000); } return; }
      setSelectedBetTournament(tournament);
      const amounts = calculateAvailableBetAmounts(userData.coins);
      setAvailableBetAmounts(amounts);
      setSelectedBetAmount(amounts[0] || 5);
      setShowBetModal(true);
    }
  };

  const handlePastTournamentClick = (tournament: Tournament) => {
    setSelectedPastTournament(tournament.name);
    setShowPastFighters(true);
  };

  const saveSelections = useCallback(async (selections: Map<string, Fighter>) => {
    // Защита от повторных вызовов во время фонового сохранения
    if (!telegramUser || isSavingBet) return;
  
    const selectionsArray = Array.from(selections.entries()).map(([weightClass, fighter]) => ({ weightClass, fighter }));
    const betAmount = currentBetAmount || 0;
    const tournament = selectedTournament;
  
    // 1. Оптимистичное обновление UI – сразу закрываем окно и обновляем состояние
    setCurrentView('main');
    setSelectedTournament(null);
  
    const newCoins = userData.coins - betAmount;
    setUserData(prev => ({
      ...prev,
      coins: newCoins,
      mySelections: {
        ...prev.mySelections,
        upcoming: [...prev.mySelections.upcoming, ...selectionsArray]
      },
      hasBet: true
    }));
    setCurrentBetAmount(null);
  
    // 2. Запускаем фоновое сохранение
    setIsSavingBet(true);
  
    try {
      // Сохраняем профиль (обновляем монеты)
      const currentProfile = await loadUserProfile(telegramUser.id);
      if (currentProfile) {
        currentProfile.coins = newCoins;
        currentProfile.lastUpdated = new Date().toISOString();
        await saveUserProfile(currentProfile);
        updateProfileInCache(currentProfile);
      }
  
      // Сохраняем результаты ставки
      if (tournament) {
        const userResult: UserResult = {
          userId: telegramUser.id,
          username: telegramUser.username,
          totalDamage: 0,
          timestamp: new Date().toISOString(),
          selections: selectionsArray,
          betAmount
        };
        await saveUserResults(tournament.name, userResult);
      }
    } catch (error) {
      console.error('Background save failed:', error);
      // Откат оптимистичных изменений при ошибке
      setUserData(prev => ({
        ...prev,
        coins: prev.coins + betAmount,
        mySelections: {
          ...prev.mySelections,
          upcoming: prev.mySelections.upcoming.filter(
            sel => !selectionsArray.some(s => s.weightClass === sel.weightClass && s.fighter.Fighter === sel.fighter.Fighter)
          )
        },
        hasBet: prev.mySelections.upcoming.length - selectionsArray.length > 0
      }));
      // Уведомление пользователя об ошибке
      alert('Failed to save your bet. Please try again.');
    } finally {
      setIsSavingBet(false);
    }
  }, [telegramUser, userData, currentBetAmount, selectedTournament, isSavingBet, updateProfileInCache]);

  const handleCloseClick = async () => { if (isClosing) return; setIsClosing(true); setCurrentView('main'); setIsClosing(false); };
  const handleSelectFighter = (weightClass: string, fighter: Fighter) => {
    const newSelection = new Map(selectedFighters);
    if (newSelection.has(weightClass) && newSelection.get(weightClass)?.Fighter === fighter.Fighter) newSelection.delete(weightClass);
    else newSelection.set(weightClass, fighter);
    setSelectedFighters(newSelection);
  };
  const getFighterPairs = (fighters: Fighter[]): Fighter[][] => {
    const pairs: Fighter[][] = [];
    for (let i = 0; i < fighters.length; i += 2) if (i + 1 < fighters.length) pairs.push([fighters[i], fighters[i + 1]]);
    return pairs;
  };
  const formatDate = (dateStr: string): string => {
    try {
      if (!dateStr) return 'Date TBD';
      const months: Record<string, number> = { 'January': 0, 'February': 1, 'March': 2, 'April': 3, 'May': 4, 'June': 5, 'July': 6, 'August': 7, 'September': 8, 'October': 9, 'November': 10, 'December': 11 };
      const parts = dateStr.split(' ');
      if (parts.length >= 3) {
        const month = parts[0];
        const day = parseInt(parts[1].replace(',', ''));
        const year = parseInt(parts[2]);
        if (months[month] !== undefined) return new Date(year, months[month], day).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      }
      return dateStr;
    } catch { return dateStr; }
  };

  const openPvpBetModal = (tournament: Tournament) => {
    const amounts = calculateAvailableBetAmounts(userData.coins);
    setPvpAvailableBetAmounts(amounts);
    setPvpSelectedBetAmount(amounts[0] || 5);
    setAnimatedBetAmount(amounts[0] || 5);
    setPvpSelectedTournament(tournament);
    setShowPvpBetModal(true);
  };
  const updatePvpBalance = async (newCoins: number, newTickets: number) => {
    if (!telegramUser) return;
    setUserData(prev => ({ ...prev, coins: newCoins, tickets: newTickets }));
    const currentProfile = await loadUserProfile(telegramUser.id);
    const updatedProfile = { userId: telegramUser.id, username: userData.username, photoUrl: telegramUser.photoUrl, level: userData.level, experience: userData.totalExp, expPoints: userData.expPoints, coins: newCoins, tickets: newTickets, ton: userData.ton, lastUpdated: new Date().toISOString(), notifications: currentProfile?.notifications };
    await saveUserProfile(updatedProfile);
    updateProfileInCache(updatedProfile);
  };
  const confirmPvpBet = async () => {
    if (!pvpSelectedTournament || !telegramUser || isPvpBetConfirming) return;
    setIsPvpBetConfirming(true);
    setShowPvpBetModal(false);
    if (pvpRef.current) await pvpRef.current.engage(pvpSelectedTournament, pvpSelectedBetAmount);
    setIsPvpBetConfirming(false);
    setPvpSelectedTournament(null);
  };

  if (loading || loadingProfile) return (
    <div className="app">
      <div className="loading-screen">
        <img src={`${BASE_URL}/Logo.webp`} alt="AFTER PARTY FIGHTS" className="loading-logo" />
        <div className="loading-progress-bar"><div className="loading-progress-fill" style={{ width: `${loadingProgress}%` }}></div></div>
        <div className="loading-stage">{loadingStage}</div>
        <div className="loading-text">{loadingProgress}%</div>
      </div>
    </div>
  );
  if (error) return (
    <div className="app">
      <div className="error-screen">
        <div className="error-icon">❌</div>
        <div className="error-text">{error}</div>
        <button className="retry-button" onClick={() => window.location.reload()}>TRY AGAIN</button>
      </div>
    </div>
  );

  return (
    <div className="app">
      {isLandscape && (
        <div className="orientation-overlay">
          <img src={`${BASE_URL}/icons/Rotate_error_icon.webp`} alt="Please rotate your device" className="orientation-icon" />
          <div className="orientation-text">Please rotate your device to portrait mode</div>
        </div>
      )}
      <header className="profile-header">
        <div className="profile-avatar">
          {telegramUser?.photoUrl ? <img src={telegramUser.photoUrl} alt="avatar" /> : <img src={`${BASE_URL}/Home_button.png`} alt="avatar" />}
        </div>
        <div className="profile-info">
          <div className="profile-name">{userData.username}</div>
          <div className="level-bar">
            <div className="level-progress" style={{ width: `${(userData.currentExp / userData.nextLevelExp) * 100}%` }}></div>
            <span className="level-text">Lvl {userData.level} • {userData.currentExp}/{userData.nextLevelExp}</span>
          </div>
          <div className="profile-currencies">
            <div className="currency-item"><img src={`${BASE_URL}/icons/Coin_icon.webp`} alt="Coins" className="currency-icon" /><span className="currency-value">{userData.coins}</span></div>
            <div className="currency-item"><img src={`${BASE_URL}/icons/Ticket_icon.webp`} alt="Tickets" className="currency-icon" /><span className="currency-value">{userData.tickets}</span></div>
            <div className="currency-item"><img src={`${BASE_URL}/icons/Ton_icon.webp`} alt="TON" className="currency-icon" /><span className="currency-value">{userData.ton}</span></div>
          </div>
        </div>
        <div className="profile-notifications">
          <button className={`notifications-button ${notifications.length > 0 ? 'has-notifications' : ''}`} onClick={() => setShowNotificationsModal(true)}>
            <img src={`${BASE_URL}/icons/Notifications_icon.webp`} alt="Notifications" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; const p = (e.target as HTMLImageElement).parentElement; if (p) p.innerHTML = '📬'; }} />
            {notifications.length > 0 && <span className="notification-badge">!</span>}
          </button>
        </div>
      </header>

      <main className="main-content">
        {currentView === 'main' && (
          <div className="tournaments-container">
            {pastTournaments.length > 0 ? (
              <section className="tournament-section past">
                <div className="tournament-header">
                  <h2>{!showPastFighters ? 'ACTIVE TOURNAMENTS' : pastTournaments.find(t => t.name === selectedPastTournament)?.name}</h2>
                  <div className="tournament-meta">
                    <span>{!showPastFighters ? `${pastTournaments.length} event${pastTournaments.length !== 1 ? 's' : ''}` : formatDate(pastTournaments.find(t => t.name === selectedPastTournament)?.date || '')}</span>
                    <span className="tournament-status active">{!showPastFighters ? 'IN GAME' : 'ACTIVE'}</span>
                  </div>
                </div>
                <div className="tournament-content">
                  {loadingUserResults ? <div className="tournament-message">Loading...</div> : hasPastBet ? (
                    <>
                      {!showPastFighters ? (
                        <div className="tournament-cards-grid">
                          {pastTournaments.map(tournament => {
                            const tournamentTotal = calculateTotalDamage(userData.mySelections.past.filter(sel => tournament.data?.some(f => f.Fighter === sel.fighter.Fighter)));
                            const isUpdating = isUpdatingTournaments && pendingRewards?.tournamentName === tournament.name;
                            return (
                              <div key={tournament.name} className="tournament-card-wrapper" style={{ position: 'relative' }}>
                                <div className={`tournament-card ${isUpdating ? 'updating' : ''}`} onClick={() => !isUpdating && handlePastTournamentClick(tournament)} style={{ opacity: isUpdating ? 0.5 : 1, pointerEvents: isUpdating ? 'none' : 'auto' }}>
                                  <div className="tournament-card-damage-box">TOTAL: {tournamentTotal}</div>
                                  <div className="tournament-card-image"><img src={`${BASE_URL}/UFC_cardpack.png`} alt="Tournament pack" /></div>
                                  <div className="tournament-card-name">{tournament.name}</div>
                                </div>
                                {isUpdating && <div className="tournament-updating-overlay"><div className="tournament-updating-spinner"></div></div>}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <>
                          <div className="selected-fighters-grid">
                            {userData.mySelections.past.filter(sel => pastTournaments.find(t => t.name === selectedPastTournament)?.data?.some(f => f.Fighter === sel.fighter.Fighter)).map((sel, idx) => {
                              const isWinner = sel.fighter['W/L'] === 'win';
                              const style = getFighterStyle(sel);
                              const styleIcon = getStyleIconFilename(style);
                              return (
                                <div key={idx} className="selected-fighter-card" data-weight={sel.weightClass} style={{ backgroundColor: getWeightClassColor(sel.weightClass) }}>
                                  <div className="selected-fighter-damage-box">{roundDamage(sel.fighter['Total Damage'])}</div>
                                  <div className="selected-fighter-inner">
                                    <div className="selected-fighter-icon-container"><img src={`${BASE_URL}/icons/${styleIcon}`} alt={style} className="selected-fighter-icon" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; const p = (e.target as HTMLImageElement).parentElement; if (p) { p.innerHTML = style === 'Striker' ? '👊' : style === 'Grappler' ? '🤼' : style === 'Universal' ? '⚡' : '👤'; p.style.fontSize = '20px'; } }} /></div>
                                    <div className="selected-fighter-divider" style={{ color: getWeightClassColor(sel.weightClass) }}></div>
                                    <div className="selected-fighter-name">{sel.fighter.Fighter}</div>
                                  </div>
                                  {isWinner && <span className="winner-crown">👑</span>}
                                </div>
                              );
                            })}
                          </div>
                          <div className="tournament-footer">
                            <div className="footer-total-damage">TOTAL DAMAGE: {calculateTotalDamage(userData.mySelections.past.filter(sel => pastTournaments.find(t => t.name === selectedPastTournament)?.data?.some(f => f.Fighter === sel.fighter.Fighter)))}</div>
                            <button className="footer-close-button" onClick={() => setShowPastFighters(false)}>CLOSE</button>
                          </div>
                        </>
                      )}
                    </>
                  ) : <div className="tournament-message">BETS ARE CLOSED</div>}
                </div>
              </section>
            ) : <TournamentSkeleton />}

            {upcomingTournaments.length > 0 ? (
              <section className="tournament-section upcoming">
                <div className="tournament-header">
                  <h2>{selectedUpcomingTournament ? upcomingTournaments.find(t => t.name === selectedUpcomingTournament)?.name : 'UPCOMING TOURNAMENTS'}</h2>
                  <div className="tournament-meta">
                    <span>{selectedUpcomingTournament ? formatDate(upcomingTournaments.find(t => t.name === selectedUpcomingTournament)?.date || '') : `${upcomingTournaments.length} event${upcomingTournaments.length !== 1 ? 's' : ''}`}</span>
                    <span className="tournament-status upcoming">{selectedUpcomingTournament ? 'UPCOMING' : 'SCHEDULED'}</span>
                  </div>
                </div>
                <div className="tournament-content" style={{ position: 'relative' }}>
                  {loadingUserResults ? <div className="tournament-message">Loading...</div> : selectedUpcomingTournament ? (
                    <>
                      <div className="selected-fighters-grid">
                        {userData.mySelections.upcoming.filter(sel => upcomingTournaments.find(t => t.name === selectedUpcomingTournament)?.data?.some(f => f.Fighter === sel.fighter.Fighter)).map((sel, idx) => {
                          const hasResult = sel.fighter['W/L'] !== null;
                          const style = getFighterStyle(sel);
                          const styleIcon = getStyleIconFilename(style);
                          return (
                            <div key={idx} className="selected-fighter-card" data-weight={sel.weightClass} style={{ backgroundColor: getWeightClassColor(sel.weightClass) }}>
                              <div className="selected-fighter-damage-box">{hasResult ? roundDamage(sel.fighter['Total Damage']) : '?'}</div>
                              <div className="selected-fighter-inner">
                                <div className="selected-fighter-icon-container"><img src={`${BASE_URL}/icons/${styleIcon}`} alt={style} className="selected-fighter-icon" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; const p = (e.target as HTMLImageElement).parentElement; if (p) { p.innerHTML = style === 'Striker' ? '👊' : style === 'Grappler' ? '🤼' : style === 'Universal' ? '⚡' : '👤'; p.style.fontSize = '20px'; } }} /></div>
                                <div className="selected-fighter-divider" style={{ color: getWeightClassColor(sel.weightClass) }}></div>
                                <div className="selected-fighter-name">{sel.fighter.Fighter}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="tournament-footer">
                        <div className="footer-total-damage">TOTAL DAMAGE: {calculateTotalDamage(userData.mySelections.upcoming.filter(sel => upcomingTournaments.find(t => t.name === selectedUpcomingTournament)?.data?.some(f => f.Fighter === sel.fighter.Fighter)))}</div>
                        <button className="footer-close-button" onClick={() => setSelectedUpcomingTournament(null)}>CLOSE</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="tournament-cards-grid">
                        {upcomingTournaments.map(tournament => {
                          const hasBetForThisTournament = userData.mySelections.upcoming.some(sel => tournament.data?.some(f => f.Fighter === sel.fighter.Fighter));
                          const tournamentTotal = hasBetForThisTournament ? calculateTotalDamage(userData.mySelections.upcoming.filter(sel => tournament.data?.some(f => f.Fighter === sel.fighter.Fighter))) : null;
                          return (
                            <div key={tournament.name} className="tournament-card-wrapper">
                              <div className="tournament-card" onClick={() => handleUpcomingTournamentClick(tournament)}>
                                <div className="tournament-card-damage-box">{hasBetForThisTournament ? `TOTAL: ${tournamentTotal}` : 'SELECT'}</div>
                                <div className="tournament-card-image"><img src={`${BASE_URL}/UFC_cardpack.png`} alt="Tournament pack" /></div>
                                <div className="tournament-card-name">{tournament.name}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {showNotEnoughCoins && <div className="upcoming-overlay-text">Not enough coins...</div>}
                    </>
                  )}
                </div>
              </section>
            ) : <TournamentSkeleton />}
          </div>
        )}

        {currentView === 'leaderboard' && (
          <div className="leaderboard-screen">
            <h2 className="leaderboard-header">{pastTournaments.length > 0 ? pastTournaments[0].name : 'LEADERBOARD'}</h2>
            {leaderboardLoading ? <div className="leaderboard-loading">LOADING...</div> : leaderboardData.length > 0 ? (
              <div className="leaderboard-list">{leaderboardData.map(entry => <LeaderboardItem key={entry.userId} entry={entry} currentUserId={telegramUser?.id} currentUserPhoto={telegramUser?.photoUrl} profile={allProfiles.get(entry.userId)} />)}</div>
            ) : <div className="leaderboard-empty">NO RESULTS YET</div>}
          </div>
        )}

        {currentView === 'selection' && selectedTournament && (
          <div className="selection-modal">
            <div className="selection-content">
              <div className="selection-header"><h2>{selectedTournament.name}</h2><button className="close-button" onClick={handleCloseClick} disabled={isClosing}>{isClosing ? 'CLOSING...' : 'CLOSE'}</button></div>
              <div className="selection-progress">SELECTED: {selectedFighters.size} / 5</div>
              {loadingSelection ? <div className="selection-loading">LOADING FIGHTERS...</div> : (
                <div className="fighters-scroll">
                  {selectionData && Object.entries(groupFightersByWeight(selectionData)).map(([weightClass, fighters]) => {
                    const pairs = getFighterPairs(fighters as Fighter[]);
                    const isWeightSelected = selectedFighters.has(weightClass);
                    const selectedFighter = selectedFighters.get(weightClass);
                    return (
                      <div key={weightClass} className="weight-section">
                        <div className="weight-header" data-weight={weightClass} style={{ backgroundColor: getWeightClassColor(weightClass) }}><span>{weightClass}</span>{isWeightSelected && <span className="selected-badge">{selectedFighter?.Fighter}</span>}</div>
                        {pairs.map((pair, idx) => (
                          <div key={idx} className="fight-pair">
                            {pair.map(fighter => (
                              <button key={fighter.Fighter} className={`fighter-card ${selectedFighter?.Fighter === fighter.Fighter ? 'selected' : ''} ${isWeightSelected && selectedFighter?.Fighter !== fighter.Fighter ? 'disabled' : ''}`} onClick={() => handleSelectFighter(weightClass, fighter)} disabled={(isWeightSelected && selectedFighter?.Fighter !== fighter.Fighter) || (selectedFighters.size >= 5 && !selectedFighters.has(weightClass))}>
                                <div className="fighter-avatar"><img src={`${BASE_URL}/avatars/${getAvatarFilename(weightClass)}`} alt={fighter.Fighter} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; const p = (e.target as HTMLImageElement).parentElement; if (p) { p.innerHTML = weightClass.includes("Women") ? "👩" : "👤"; p.style.fontSize = '24px'; } }} /></div>
                                <div className="fighter-info"><span className="fighter-name">{fighter.Fighter}</span></div>
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="selection-actions"><button className="discard-button" onClick={() => setSelectedFighters(new Map())}>DISCARD ALL</button><button className={`accept-button ${selectedFighters.size === 5 ? 'active' : ''}`} disabled={selectedFighters.size !== 5} onClick={async () => { await saveSelections(selectedFighters); }}>ACCEPT CARD</button></div>
            </div>
          </div>
        )}

        {currentView === 'pvp' && <Pvp ref={pvpRef} pastTournaments={pastTournaments} userSelections={userData.mySelections.past} userAvatar={telegramUser?.photoUrl} userId={telegramUser?.id} userName={userData.username} userCoins={userData.coins} userTickets={userData.tickets} allProfiles={allProfiles} onOpenBetModal={openPvpBetModal} onUpdateBalance={updatePvpBalance} onClaimRewards={claimBattleRewards} loadTournamentData={loadTournamentData} />}
      </main>

      {/* Модальные окна уведомлений и наград — порядок изменён: сначала окно уведомлений, затем остальные поверх */}
      {showNotificationsModal && (
  <div className="rewards-modal-overlay">
    <div className="rewards-modal">
      <div className="rewards-header"><h2>NOTIFICATIONS</h2><button className="cancelled-modal-close" onClick={() => setShowNotificationsModal(false)}>✕</button></div>
      <div className="rewards-winners-list">
        {notifications.length === 0 ? (
          <p className="rewards-no-winners">You don't have any notifications</p>
        ) : (
          notifications.map(notif => (
            <div key={notif.id} className="rewards-winner-item notification-item" onClick={() => handleNotificationClick(notif)} style={{ cursor: 'pointer', flexDirection: 'column', alignItems: 'stretch' }}>
              <div className="rewards-winner-info" style={{ marginBottom: '4px' }}>
                <span className="rewards-winner-weight" style={{ color: '#FFFFFF' }}>{notif.tournamentName}</span>
                <span className="rewards-winner-name">RESULTS:</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
  {notif.type === 'tournament_reward' ? (
    <>
      <div className="rewards-summary-item" style={{ gap: '4px' }}>
        <img src={`${BASE_URL}/icons/Coin_icon.webp`} alt="Coins" className="rewards-summary-icon" />
        <span className="rewards-summary-value">{notif.data.coins || 0}</span>
      </div>
      <div className="rewards-summary-item" style={{ gap: '4px' }}>
        <img src={`${BASE_URL}/icons/Ticket_icon.webp`} alt="Tickets" className="rewards-summary-icon" />
        <span className="rewards-summary-value">{notif.data.tickets || 0}</span>
      </div>
      <div className="rewards-summary-item" style={{ gap: '4px' }}>
        <span className="rewards-summary-label">EXP</span>
        <span className="rewards-summary-value">+{notif.data.experience || 0}</span>
      </div>
    </>
  ) : (
    <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
      <div className="rewards-summary-item" style={{ gap: '4px' }}>
        <img src={`${BASE_URL}/icons/Coin_icon.webp`} alt="Coins" className="rewards-summary-icon" />
        <span className="rewards-summary-value">{notif.data.refundAmount || 0}</span>
      </div>
    </div>
  )}
</div>
            </div>
          ))
        )}
      </div>
      <div className="rewards-summary">
        <div className="rewards-summary-item"><img src={`${BASE_URL}/icons/Coin_icon.webp`} alt="Coins" className="rewards-summary-icon" /><span className="rewards-summary-value">{notifications.reduce((s, n) => s + (n.type === 'tournament_reward' ? (n.data.coins || 0) : (n.data.refundAmount || 0)), 0)}</span></div>
        <div className="rewards-summary-item"><img src={`${BASE_URL}/icons/Ticket_icon.webp`} alt="Tickets" className="rewards-summary-icon" /><span className="rewards-summary-value">{notifications.reduce((s, n) => s + (n.type === 'tournament_reward' ? (n.data.tickets || 0) : 0), 0)}</span></div>
        <div className="rewards-summary-item"><span className="rewards-summary-label">EXP</span><span className="rewards-summary-value">+{notifications.reduce((s, n) => s + (n.type === 'tournament_reward' ? (n.data.experience || 0) : 0), 0)}</span></div>
      </div>
      {notifications.length > 0 && (
        <div className="rewards-footer">
          <button className="rewards-claim-button" onClick={claimAllNotifications} disabled={isClaimingAll}>{isClaimingAll ? 'CLAIMING...' : 'CLAIM ALL'}</button>
        </div>
      )}
    </div>
  </div>
)}

      {showRewardsModal && pendingRewards && (
        <div className="rewards-modal-overlay">
          <div className="rewards-modal">
            <div className="rewards-header"><h2>RESULTS</h2></div>
            <div className="rewards-tournament-name"><p>Tournament "{pendingRewards.tournamentName}"</p></div>
            <div className="rewards-winners-list">
              <h3>YOUR BETS:</h3>
              {pendingRewards.allSelections.map((sel, idx) => {
                const isWin = sel.fighter['W/L'] === 'win';
                const isDraw = sel.fighter['W/L'] === 'draw';
                return (
                  <div key={idx} className="rewards-winner-item">
                    <div className="rewards-winner-info"><span className="rewards-winner-weight" style={{ color: getWeightClassColor(sel.weightClass) }}>{sel.weightClass}</span><span className="rewards-winner-name">{sel.fighter.Fighter}</span></div>
                    <span className={`rewards-winner-badge ${isWin ? 'win' : isDraw ? 'draw' : 'lose'}`}>{isWin ? 'WIN' : isDraw ? 'DRAW' : 'LOSE'}</span>
                  </div>
                );
              })}
            </div>
            <div className="rewards-summary">
              <div className="rewards-summary-item"><img src={`${BASE_URL}/icons/Coin_icon.webp`} alt="Coins" className="rewards-summary-icon" /><span className="rewards-summary-value">{pendingRewards.totalCoins}</span></div>
              <div className="rewards-summary-item"><img src={`${BASE_URL}/icons/Ticket_icon.webp`} alt="Tickets" className="rewards-summary-icon" /><span className="rewards-summary-value">{pendingRewards.totalTickets}</span></div>
              <div className="rewards-summary-item"><span className="rewards-summary-label">EXP</span><span className="rewards-summary-value">+{pendingRewards.totalExp}</span></div>
            </div>
            <div className="rewards-footer"><button className="rewards-claim-button" onClick={acceptRewards} disabled={isAcceptingRewards}>{isAcceptingRewards ? 'CLAIMING...' : 'CLAIM REWARDS'}</button></div>
          </div>
        </div>
      )}

      {showCancelledModal && cancelledTournament && (
        <div className="rewards-modal-overlay">
          <div className="rewards-modal">
            <div className="rewards-header"><h2 style={{ color: '#FFD966' }}>BET CANCELLED</h2><button className="cancelled-modal-close" onClick={() => setShowCancelledModal(false)}>✕</button></div>
            <div className="rewards-tournament-name"><p>Tournament "{cancelledTournament.name}"</p></div>
            <div className="cancelled-message"><p>Your bet has been cancelled due to changes in the fight card.</p><p>Your coins have been fully refunded.</p><p>Please make a new bet for this tournament.</p></div>
            <div className="rewards-footer"><button className="rewards-claim-button" onClick={() => { setShowCancelledModal(false); handleUpcomingTournamentClick(cancelledTournament); }}>MAKE A NEW BET</button></div>
          </div>
        </div>
      )}

      {showChangesModal && selectedNotification?.type === 'bet_cancelled' && (
        <div className="rewards-modal-overlay">
          <div className="rewards-modal">
            <div className="rewards-header"><h2>Information about the changes</h2><button className="cancelled-modal-close" onClick={() => setShowChangesModal(false)}>✕</button></div>
            <div className="rewards-winners-list"><h3>CANCELLED FIGHTERS:</h3>{selectedNotification.data.cancelledFighters?.map((fighter, idx) => (
              <div key={idx} className="rewards-winner-item"><div className="rewards-winner-info"><span className="rewards-winner-weight" style={{ color: '#FFFFFF' }}>{fighter.weightClass}</span><span className="rewards-winner-name">{fighter.originalFighter}</span></div><span className="rewards-winner-badge lose">CHANGED</span></div>
            ))}</div>
            <div className="rewards-summary"><div className="rewards-summary-item"><img src={`${BASE_URL}/icons/Coin_icon.webp`} alt="Coins" className="rewards-summary-icon" /><span className="rewards-summary-value">{selectedNotification.data.refundAmount || 0}</span></div></div>
            <div className="rewards-footer"><button className="rewards-claim-button" onClick={() => claimRefund(selectedNotification)} disabled={isClaimingRefund}>
  {isClaimingRefund ? 'PROCESSING...' : 'CLAIM REFUND'}
</button></div>
          </div>
        </div>
      )}

      {showBetModal && selectedBetTournament && (
        <div className="bet-modal-overlay">
          <div className="bet-modal">
            <div className="bet-modal-header"><span className="bet-modal-title">{selectedBetTournament.name}</span><button className="bet-modal-close" onClick={() => setShowBetModal(false)}>CLOSE</button></div>
            <div className="bet-modal-slider-container">
              <div className="bet-slider-wrapper">
                <div className="bet-slider">
                  <div className="bet-slider-fill" style={{ width: availableBetAmounts.length > 1 ? `${((selectedBetAmount - availableBetAmounts[0]) / (availableBetAmounts[availableBetAmounts.length - 1] - availableBetAmounts[0])) * 100}%` : '100%' }}></div>
                  {availableBetAmounts.map(amount => {
                    const minAmount = availableBetAmounts[0];
                    const maxAmount = availableBetAmounts[availableBetAmounts.length - 1];
                    const position = maxAmount > minAmount ? ((amount - minAmount) / (maxAmount - minAmount)) * 100 : 50;
                    const isMin = amount === minAmount;
                    const isMax = amount === maxAmount;
                    return (
                      <div key={amount} className="bet-slider-marker-container" style={{ left: `${position}%` }}>
                        <div className={`bet-slider-marker ${selectedBetAmount === amount ? 'active' : ''}`} onClick={() => { setAnimatedBetAmount(amount); setShowBetAmountIncrease(true); setSelectedBetAmount(amount); setTimeout(() => setShowBetAmountIncrease(false), 500); }}></div>
                        <span className="bet-marker-value">{isMin ? 'MIN' : isMax ? 'MAX' : amount}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="bet-modal-footer"><button className="bet-confirm-button" onClick={openSelectionWithBet}>BET SIZE: <span className={`bet-amount-value ${showBetAmountIncrease ? 'bet-amount-increase' : ''}`}>{animatedBetAmount}</span> <img src={`${BASE_URL}/icons/Coin_icon.webp`} alt="coins" className="bet-coin-icon" /></button></div>
          </div>
        </div>
      )}

      {showPvpBetModal && pvpSelectedTournament && (
        <div className="bet-modal-overlay">
          <div className="bet-modal">
            <div className="bet-modal-header"><span className="bet-modal-title">{pvpSelectedTournament.name}</span><button className="bet-modal-close" onClick={() => setShowPvpBetModal(false)}>CLOSE</button></div>
            <div className="bet-modal-slider-container">
              <div className="bet-slider-wrapper">
                <div className="bet-slider">
                  <div className="bet-slider-fill" style={{ width: pvpAvailableBetAmounts.length > 1 ? `${((pvpSelectedBetAmount - pvpAvailableBetAmounts[0]) / (pvpAvailableBetAmounts[pvpAvailableBetAmounts.length - 1] - pvpAvailableBetAmounts[0])) * 100}%` : '100%' }}></div>
                  {pvpAvailableBetAmounts.map(amount => {
                    const minAmount = pvpAvailableBetAmounts[0];
                    const maxAmount = pvpAvailableBetAmounts[pvpAvailableBetAmounts.length - 1];
                    const position = maxAmount > minAmount ? ((amount - minAmount) / (maxAmount - minAmount)) * 100 : 50;
                    const isMin = amount === minAmount;
                    const isMax = amount === maxAmount;
                    return (
                      <div key={amount} className="bet-slider-marker-container" style={{ left: `${position}%` }}>
                        <div className={`bet-slider-marker ${pvpSelectedBetAmount === amount ? 'active' : ''}`} onClick={() => { setAnimatedBetAmount(amount); setShowBetAmountIncrease(true); setPvpSelectedBetAmount(amount); setTimeout(() => setShowBetAmountIncrease(false), 500); }}></div>
                        <span className="bet-marker-value">{isMin ? 'MIN' : isMax ? 'MAX' : amount}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="bet-modal-footer"><button className="bet-confirm-button" onClick={() => { setShowPvpBetModal(false); confirmPvpBet(); }} disabled={isPvpBetConfirming}>BET SIZE: <span className={`bet-amount-value ${showBetAmountIncrease ? 'bet-amount-increase' : ''}`}>{animatedBetAmount}</span> <img src={`${BASE_URL}/icons/Coin_icon.webp`} alt="coins" className="bet-coin-icon" /> + 1 <img src={`${BASE_URL}/icons/Ticket_icon.webp`} alt="tickets" className="bet-coin-icon" /></button></div>
          </div>
        </div>
      )}

      <nav className={`bottom-nav ${currentView === 'selection' ? 'hidden' : ''}`}>
        <button className={`nav-button ${currentView === 'main' ? 'active' : ''}`} onClick={() => setCurrentView('main')}><img src={`${BASE_URL}/Home_button.png`} alt="Home" /></button>
        <button className={`nav-button ${currentView === 'leaderboard' ? 'active' : ''}`} onClick={() => setCurrentView('leaderboard')}><img src={`${BASE_URL}/Leadeship_button.png`} alt="Leaderboard" /></button>
        <button className={`nav-button ${currentView === 'pvp' ? 'active' : ''}`} onClick={() => setCurrentView('pvp')}><img src={`${BASE_URL}/PvP_button.png`} alt="PvP" /></button>
        <button className="nav-button disabled"><img src={`${BASE_URL}/Shop_button.png`} alt="Shop" /></button>
      </nav>
    </div>
  );
}

export default App;