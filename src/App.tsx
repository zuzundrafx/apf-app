﻿import { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import Pvp from './components/Pvp';
import LeaderboardItem from './components/LeaderboardItem';
import { Fighter, Tournament, SelectedFighter } from './types';
import { groupFightersByWeight } from './data/loadFighters';
import { useBackendTournaments } from './hooks/useBackendTournaments';

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
        BackButton: { isVisible: boolean; show: () => void; hide: () => void; onClick: (callback: () => void) => void; };
        MainButton: { text: string; color: string; textColor: string; isVisible: boolean; isActive: boolean; show: () => void; hide: () => void; enable: () => void; disable: () => void; onClick: (callback: () => void) => void; };
      };
    };
  }
}

const LEVEL_THRESHOLDS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 0];
const BASE_URL = import.meta.env.PROD ? '' : '/reactjs-template';
const API_BASE = import.meta.env.PROD ? 'https://apf-app-backend.onrender.com' : 'http://localhost:3001';

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
    'Flyweight': '#00FFA3', 'Bantamweight': '#00E0FF', 'Featherweight': '#0075FF', 'Lightweight': '#AD00FF',
    'Welterweight': '#FF00D6', 'Middleweight': '#FFD700', 'Light Heavyweight': '#FF5C00', 'Heavyweight': '#FF0000',
    "Women's Strawweight": '#FF6B9D', "Women's Flyweight": '#5EEAD4', "Women's Bantamweight": '#818CF8', "Catch Weight": '#94A3B8'
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
    'Grappler': 'Grappler_style_icon.webp', 'Striker': 'Striker_style_icon.webp',
    'Universal': 'Universal_style_icon.webp', 'Simple': 'Simple_style_icon.webp'
  };
  return icons[style] || 'Simple_style_icon.webp';
}

const TournamentSkeleton = () => (
  <section className="tournament-section skeleton">
    <div className="tournament-header skeleton-header"><div className="skeleton-title"></div><div className="skeleton-meta"></div></div>
    <div className="tournament-content"><div className="skeleton-message"></div></div>
  </section>
);

function App() {
  // Бэкенд-хук для турниров
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [telegramUser, setTelegramUser] = useState<{ id: string; username: string; photoUrl?: string } | null>(null);
  const { pastTournaments, upcomingTournaments, loading, error, loadFighters } = useBackendTournaments(authToken, telegramUser?.id || null);

  const [isSavingBet, setIsSavingBet] = useState(false);
  const [isClaimingRefund, setIsClaimingRefund] = useState(false);
  const [selectedFighters, setSelectedFighters] = useState<Map<string, Fighter>>(new Map());
  const [currentView, setCurrentView] = useState<'main' | 'leaderboard' | 'selection' | 'pvp'>('main');
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [loadingUserResults, setLoadingUserResults] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);
  
  const [animatedBetAmount, setAnimatedBetAmount] = useState(5);
  const [showBetAmountIncrease, setShowBetAmountIncrease] = useState(false);
  const [allProfiles, setAllProfiles] = useState<Map<string, any>>(new Map());
  const [tournamentDataCache, setTournamentDataCache] = useState<Map<string, any>>(new Map());

  const [showRewardsModal, setShowRewardsModal] = useState(false);
  const [pendingRewards, setPendingRewards] = useState<any>(null);
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
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<any>(null);
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
  const pvpRef = useRef<any>(null);

  const [userData, setUserData] = useState({
    username: 'Player', level: 1, currentExp: 0, totalExp: 0, nextLevelExp: 5,
    coins: 100, tickets: 0, ton: 0, expPoints: 1,
    mySelections: { upcoming: [] as SelectedFighter[], past: [] as SelectedFighter[] },
    myUserId: null as string | null, hasBet: false
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

  // ----- Функции для работы с бэкендом -----
  const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }
    return response.json();
  };

  const authenticate = async (tg: any, user: any) => {
    try {
      const data = await apiRequest('/api/auth/telegram', {
        method: 'POST',
        body: JSON.stringify({ initData: tg.initData, user })
      });
      setAuthToken(data.token);
      localStorage.setItem('authToken', data.token);
      setUserData(prev => ({
        ...prev,
        username: data.user.username,
        level: data.user.level,
        totalExp: data.user.experience,
        currentExp: data.user.experience % 5,
        nextLevelExp: 5,
        coins: data.user.coins,
        tickets: data.user.tickets,
        myUserId: data.user.id
      }));
      return true;
    } catch (err) {
      console.error('Auth error', err);
      return false;
    }
  };

  const saveSelectionsBackend = useCallback(async (selections: Map<string, Fighter>) => {
    if (!telegramUser || isSavingBet) return;
    const selectionsArray = Array.from(selections.entries()).map(([weightClass, fighter]) => ({
      weightClass,
      fighter: {
        Fighter: fighter.Fighter,
        TotalDamage: fighter['Total Damage'] || 0,
        W_L: fighter['W/L'],
      }
    }));
    const betAmount = currentBetAmount || 5;
    const tournamentId = selectedTournament?.id;
    if (!tournamentId) return;
    setIsSavingBet(true);
    try {
      await apiRequest('/api/bets', {
        method: 'POST',
        body: JSON.stringify({ userId: telegramUser.id, tournamentId, betAmount, selections: selectionsArray })
      });
      setUserData(prev => ({ ...prev, coins: prev.coins - betAmount }));
      setCurrentView('main');
      setSelectedTournament(null);
      setSelectedFighters(new Map());
      setShowBetModal(false);
      setCurrentBetAmount(null);
    } catch (error: any) {
      console.error(error);
      alert(error.message);
    } finally {
      setIsSavingBet(false);
    }
  }, [telegramUser, selectedTournament, currentBetAmount, isSavingBet, authToken]);

  const loadSelectionDataBackend = async (tournament: Tournament) => {
    if (!tournament.id) return;
    setLoadingSelection(true);
    try {
      const fighters = await loadFighters(tournament.id);
      setSelectionData(fighters);
      tournament.data = fighters;
    } catch (error) {
      console.error(error);
      setSelectionData(null);
    } finally {
      setLoadingSelection(false);
    }
  };

  // Инициализация Telegram и авторизация
  useEffect(() => {
    const initTelegram = async () => {
      if (window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.ready();
        const user = tg.initDataUnsafe.user;
        if (user) {
          const userId = `user_${user.id}`;
          const username = user.username || `${user.first_name} ${user.last_name || ''}`.trim();
          setTelegramUser({ id: userId, username, photoUrl: user.photo_url });
          setLoadingProfile(true);
          const success = await authenticate(tg, { id: user.id, first_name: user.first_name, last_name: user.last_name, username: user.username, photo_url: user.photo_url });
          if (!success) {
            console.warn('Auth failed, but continuing');
          }
          setLoadingProfile(false);
          setProfileLoaded(true);
        } else {
          // Тестовый пользователь для локальной разработки
          setTelegramUser({ id: 'test_user', username: 'tester', photoUrl: '' });
          setUserData(prev => ({ ...prev, username: 'tester', coins: 100, tickets: 0, myUserId: 'test_user' }));
          setLoadingProfile(false);
          setProfileLoaded(true);
        }
      } else {
        setTelegramUser({ id: 'test_user', username: 'tester', photoUrl: '' });
        setUserData(prev => ({ ...prev, username: 'tester', coins: 100, tickets: 0, myUserId: 'test_user' }));
        setLoadingProfile(false);
        setProfileLoaded(true);
      }
    };
    initTelegram();
  }, []);

  // ----- ОСТАЛЬНЫЕ ФУНКЦИИ (заглушки для уведомлений и PvP, пока не реализованы) -----
  const loadNotifications = useCallback(async () => {}, []);
  const updateNotifications = useCallback(async (updated: any[]) => {}, []);
  const removeNotification = useCallback(async (id: string) => {}, []);
  const claimAllNotifications = useCallback(async () => {}, []);
  const claimRefund = useCallback(async (notification: any) => {}, []);
  const handleNotificationClick = (notification: any) => {};
  const acceptRewards = async () => {};
  const claimBattleRewards = async (rewards: any) => {};
  const updatePvpBalance = async (coins: number, tickets: number) => {};
  const refreshUserData = async () => {};
  const loadTournamentData = async (name: string) => ({ weightClasses: [], results: [], fightersData: [] });
  const openPvpBetModal = (tournament: Tournament) => {};
  const confirmPvpBet = async () => {};

  const openSelectionWithBet = async () => {
    if (!selectedBetTournament || !telegramUser) return;
    setShowBetModal(false);
    setCurrentBetAmount(selectedBetAmount);
    setSelectedTournament(selectedBetTournament);
    setCurrentView('selection');
    setSelectedFighters(new Map());
    loadSelectionDataBackend(selectedBetTournament);
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

  const formatDate = (dateStr: string): string => dateStr;

  const handleCloseClick = async () => { if (isClosing) return; setIsClosing(true); setCurrentView('main'); setIsClosing(false); };

  if (loading || loadingProfile) return (
    <div className="app">
      <div className="loading-screen">
        <img src={`${BASE_URL}/Logo.webp`} alt="AFTER PARTY FIGHTS" className="loading-logo" />
        <div className="loading-progress-bar"><div className="loading-progress-fill" style={{ width: `50%` }}></div></div>
        <div className="loading-stage">Loading...</div>
        <div className="loading-text">Please wait</div>
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
              <div className="selection-actions"><button className="discard-button" onClick={() => setSelectedFighters(new Map())}>DISCARD ALL</button><button className={`accept-button ${selectedFighters.size === 5 ? 'active' : ''}`} disabled={selectedFighters.size !== 5} onClick={async () => { await saveSelectionsBackend(selectedFighters); }}>ACCEPT CARD</button></div>
            </div>
          </div>
        )}

        {currentView === 'pvp' && <Pvp ref={pvpRef} pastTournaments={pastTournaments} userSelections={userData.mySelections.past} userAvatar={telegramUser?.photoUrl} userId={telegramUser?.id} userName={userData.username} userCoins={userData.coins} userTickets={userData.tickets} allProfiles={allProfiles} onOpenBetModal={openPvpBetModal} onUpdateBalance={updatePvpBalance} onClaimRewards={claimBattleRewards} loadTournamentData={loadTournamentData} />}
      </main>

      {/* Модальные окна (ставки, уведомления, награды) – без изменений */}
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

      {showNotificationsModal && (
        <div className="rewards-modal-overlay">
          <div className="rewards-modal">
            <div className="rewards-header"><h2>NOTIFICATIONS</h2><button className="cancelled-modal-close" onClick={() => setShowNotificationsModal(false)}>✕</button></div>
            <div className="rewards-winners-list">
              {notifications.length === 0 ? <p className="rewards-no-winners">You don't have any notifications</p> : notifications.map(notif => (
                <div key={notif.id} className="rewards-winner-item notification-item" onClick={() => handleNotificationClick(notif)} style={{ cursor: 'pointer', flexDirection: 'column', alignItems: 'stretch' }}>
                  <div className="rewards-winner-info" style={{ marginBottom: '4px' }}><span className="rewards-winner-weight" style={{ color: '#FFFFFF' }}>{notif.tournamentName}</span><span className="rewards-winner-name">RESULTS:</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    {notif.type === 'tournament_reward' ? (
                      <>
                        <div className="rewards-summary-item" style={{ gap: '4px' }}><img src={`${BASE_URL}/icons/Coin_icon.webp`} alt="Coins" className="rewards-summary-icon" /><span className="rewards-summary-value">{notif.data.coins || 0}</span></div>
                        <div className="rewards-summary-item" style={{ gap: '4px' }}><img src={`${BASE_URL}/icons/Ticket_icon.webp`} alt="Tickets" className="rewards-summary-icon" /><span className="rewards-summary-value">{notif.data.tickets || 0}</span></div>
                        <div className="rewards-summary-item" style={{ gap: '4px' }}><span className="rewards-summary-label">EXP</span><span className="rewards-summary-value">+{notif.data.experience || 0}</span></div>
                      </>
                    ) : (
                      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                        <div className="rewards-summary-item" style={{ gap: '4px' }}><img src={`${BASE_URL}/icons/Coin_icon.webp`} alt="Coins" className="rewards-summary-icon" /><span className="rewards-summary-value">{notif.data.refundAmount || 0}</span></div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="rewards-summary">
              <div className="rewards-summary-item"><img src={`${BASE_URL}/icons/Coin_icon.webp`} alt="Coins" className="rewards-summary-icon" /><span className="rewards-summary-value">{notifications.reduce((s, n) => s + (n.type === 'tournament_reward' ? (n.data.coins || 0) : (n.data.refundAmount || 0)), 0)}</span></div>
              <div className="rewards-summary-item"><img src={`${BASE_URL}/icons/Ticket_icon.webp`} alt="Tickets" className="rewards-summary-icon" /><span className="rewards-summary-value">{notifications.reduce((s, n) => s + (n.type === 'tournament_reward' ? (n.data.tickets || 0) : 0), 0)}</span></div>
              <div className="rewards-summary-item"><span className="rewards-summary-label">EXP</span><span className="rewards-summary-value">+{notifications.reduce((s, n) => s + (n.type === 'tournament_reward' ? (n.data.experience || 0) : 0), 0)}</span></div>
            </div>
            {notifications.length > 0 && (
              <div className="rewards-footer"><button className="rewards-claim-button" onClick={claimAllNotifications} disabled={isClaimingAll}>{isClaimingAll ? 'CLAIMING...' : 'CLAIM ALL'}</button></div>
            )}
          </div>
        </div>
      )}

      {showRewardsModal && pendingRewards && (
        <div className="rewards-modal-overlay">
          <div className="rewards-modal">
            <div className="rewards-header"><h2>RESULTS</h2></div>
            <div className="rewards-tournament-name"><p>Tournament "{pendingRewards.tournamentName}"</p></div>
            <div className="rewards-winners-list"><h3>YOUR BETS:</h3>{pendingRewards.allSelections.map((sel: any, idx: number) => (
              <div key={idx} className="rewards-winner-item"><div className="rewards-winner-info"><span className="rewards-winner-weight" style={{ color: getWeightClassColor(sel.weightClass) }}>{sel.weightClass}</span><span className="rewards-winner-name">{sel.fighter.Fighter}</span></div><span className={`rewards-winner-badge ${sel.fighter['W/L'] === 'win' ? 'win' : sel.fighter['W/L'] === 'draw' ? 'draw' : 'lose'}`}>{sel.fighter['W/L'] === 'win' ? 'WIN' : sel.fighter['W/L'] === 'draw' ? 'DRAW' : 'LOSE'}</span></div>
            ))}</div>
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
            <div className="rewards-winners-list"><h3>CANCELLED FIGHTERS:</h3>{selectedNotification.data.cancelledFighters?.map((fighter: any, idx: number) => (
              <div key={idx} className="rewards-winner-item"><div className="rewards-winner-info"><span className="rewards-winner-weight" style={{ color: '#FFFFFF' }}>{fighter.weightClass}</span><span className="rewards-winner-name">{fighter.originalFighter}</span></div><span className="rewards-winner-badge lose">CHANGED</span></div>
            ))}</div>
            <div className="rewards-summary"><div className="rewards-summary-item"><img src={`${BASE_URL}/icons/Coin_icon.webp`} alt="Coins" className="rewards-summary-icon" /><span className="rewards-summary-value">{selectedNotification.data.refundAmount || 0}</span></div></div>
            <div className="rewards-footer"><button className="rewards-claim-button" onClick={() => claimRefund(selectedNotification)} disabled={isClaimingRefund}>{isClaimingRefund ? 'PROCESSING...' : 'CLAIM REFUND'}</button></div>
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