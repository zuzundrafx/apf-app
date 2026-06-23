// src/components/ShopScreen.tsx
import React, { useState, useEffect } from 'react';
import { Tournament } from '../types';
import PurchaseModal from './PurchaseModal';

const BASE_URL = import.meta.env.PROD ? '' : '/reactjs-template';
const API_BASE = import.meta.env.PROD ? 'https://apf-app-backend.onrender.com' : 'http://localhost:3001';

interface ShopScreenProps {
  activeTournaments: Tournament[];
  userCoins?: number;
  userTickets?: number;
  userStyle?: 'striker' | 'grappler' | null;
  onUpdateBalance?: (coins: number, tickets: number) => Promise<void>;
  onRefreshBets?: () => Promise<void>;
  authToken?: string;
}

interface PackConfig {
  id: number;
  item_name: string;
  item_info: string;
  item_price: number;
  item_reload_time: number;
  item_icon?: string;
}

interface PackInfo {
  currentPrice: number;
  reloadSecondsLeft: number;
  isFree?: boolean;
}

interface CurrencyItem {
  id: number;
  item_name: string;
  item_info: string;
  item_description: string;
  item_coins_price: number;
  item_fiat_price: number;
  item_reload_time: number;
  item_icon: string;
  tickets_amount: number;
  coins_amount: number;
}

interface FightPassItem {
  id: number;
  item_name: string;
  item_info: string;
  item_description: string;
  item_coins_price: number;
  item_fiat_price: number;
  item_reload_time: number;
  item_icon: string;
  exp_multiplier: number;
  duration_days: number;
  sort_order: number;
}

interface FightPassStatus {
  hasActivePass: boolean;
  timeLeftSeconds: number;
  expiresAt?: string;
}

const ShopScreen: React.FC<ShopScreenProps> = ({ 
  activeTournaments, 
  userCoins = 0,
  userTickets = 0,
  onUpdateBalance,
  onRefreshBets,
  authToken
}) => {
  const [activeTab, setActiveTab] = useState<'free' | 'currency' | 'fightPass' | 'cardPacks'>('free');
  const [selectedPack, setSelectedPack] = useState<{
    tournament: Tournament;
    league: string;
    price: number;
    name: string;
    icon: string;
    isFree: boolean;
    isCurrency?: boolean;
    isFightPass?: boolean;
    isFiatOnly?: boolean;
    ticketsAmount?: number;
    coinsAmount?: number;
    expMultiplier?: number;
    durationDays?: number;
    itemInfo?: string;
    itemDescription?: string;
  } | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [packInfo, setPackInfo] = useState<Record<string, PackInfo>>({});
  const [localReloadSeconds, setLocalReloadSeconds] = useState<Record<string, number>>({});
  const [allPackConfigs, setAllPackConfigs] = useState<PackConfig[]>([]);
  const [loadingPacks, setLoadingPacks] = useState(true);

  const [currencyItems, setCurrencyItems] = useState<CurrencyItem[]>([]);
  const [loadingCurrency, setLoadingCurrency] = useState(true);
  const [localCurrencyReload, setLocalCurrencyReload] = useState<Record<string, number>>({});
  const [currencyCurrentPrices, setCurrencyCurrentPrices] = useState<Record<string, number>>({});

  // ===== FIGHT PASS состояния =====
  const [fightPassItems, setFightPassItems] = useState<FightPassItem[]>([]);
  const [loadingFightPass, setLoadingFightPass] = useState(true);
  const [fightPassReload, setFightPassReload] = useState<Record<string, number>>({});
  const [fightPassPrices, setFightPassPrices] = useState<Record<string, number>>({});
  const [fightPassStatus, setFightPassStatus] = useState<Record<string, FightPassStatus>>({});
  const [fightPassLoaded, setFightPassLoaded] = useState(false);

  const promotions = [
    "🎁 FREE daily reward! Claim now!",
    "🔥 Limited offer: 50% bonus on Currency packs!",
    "💎 Fight Pass: Get exclusive rewards!",
    "🃏 New Card Packs available!"
  ];

  const [currentPromotionIndex, setCurrentPromotionIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPromotionIndex((prev) => (prev + 1) % promotions.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Загружаем CARD PACKS и CURRENCY при монтировании
  useEffect(() => {
    if (authToken) {
      loadAllPackConfigs();
      loadCurrencyItems();
    }
  }, [authToken]);

  // Загружаем FIGHT PASS только при переходе на вкладку
  useEffect(() => {
    if (authToken && activeTab === 'fightPass' && !fightPassLoaded) {
      loadFightPassItems();
    }
  }, [authToken, activeTab, fightPassLoaded]);

  useEffect(() => {
    if (authToken && activeTournaments.length > 0) {
      activeTournaments.forEach(tournament => {
        const league = (tournament.league || 'UFC').toUpperCase();
        loadPackInfo(league, `${league} Card Pack`);
        loadPackInfo(league, `${league} Card Pack Free`, true);
      });
    }
  }, [authToken, activeTournaments]);

  useEffect(() => {
    Object.keys(packInfo).forEach(key => {
      setLocalReloadSeconds(prev => ({
        ...prev,
        [key]: packInfo[key].reloadSecondsLeft
      }));
    });
  }, [packInfo]);

  // Таймер для CARD PACKS
  useEffect(() => {
    const interval = setInterval(() => {
      setLocalReloadSeconds(prev => {
        const updated = { ...prev };
        let hasChanges = false;
        Object.keys(updated).forEach(key => {
          if (updated[key] > 0) {
            updated[key] = updated[key] - 1;
            hasChanges = true;
          }
        });
        return hasChanges ? updated : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Таймер для CURRENCY
  useEffect(() => {
    const interval = setInterval(() => {
      setLocalCurrencyReload(prev => {
        const updated = { ...prev };
        let hasChanges = false;
        Object.keys(updated).forEach(key => {
          if (updated[key] > 0) {
            updated[key] = updated[key] - 1;
            hasChanges = true;
          }
        });
        return hasChanges ? updated : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Таймер для FIGHT PASS
  useEffect(() => {
    const interval = setInterval(() => {
      setFightPassReload(prev => {
        const updated = { ...prev };
        let hasChanges = false;
        Object.keys(updated).forEach(key => {
          if (updated[key] > 0) {
            updated[key] = updated[key] - 1;
            hasChanges = true;
          }
        });
        return hasChanges ? updated : prev;
      });

      setFightPassStatus(prev => {
        const updated = { ...prev };
        let hasChanges = false;
        Object.keys(updated).forEach(key => {
          if (updated[key].hasActivePass && updated[key].timeLeftSeconds > 0) {
            updated[key].timeLeftSeconds = updated[key].timeLeftSeconds - 1;
            hasChanges = true;
          }
        });
        return hasChanges ? updated : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadAllPackConfigs = async () => {
    if (!authToken) return;
    try {
      const response = await fetch(`${API_BASE}/api/shop/packs`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAllPackConfigs(data);
        setLoadingPacks(false);
      } else {
        setAllPackConfigs([
          { 
            id: 1, 
            item_name: 'UFC Card Pack', 
            item_info: 'Get 5 random fighter cards for the active UFC tournament with this pack!', 
            item_price: 1000, 
            item_reload_time: 60,
            item_icon: 'icons/UFC_cardpack.webp'
          },
          { 
            id: 4, 
            item_name: 'UFC Card Pack Free', 
            item_info: 'Get Free 5 random fighter cards for the active UFC tournament with this pack!', 
            item_price: 0, 
            item_reload_time: 1440,
            item_icon: 'icons/UFC_cardpack.webp'
          }
        ]);
        setLoadingPacks(false);
      }
    } catch (err) {
      console.error('Failed to load pack configs:', err);
      setLoadingPacks(false);
    }
  };

  const loadPackInfo = async (league: string, itemName: string, isFree: boolean = false) => {
    if (!authToken) return;
    try {
      const endpoint = isFree ? '/api/shop/free-pack-info' : `/api/shop/card-pack/${league}`;
      const body = isFree ? JSON.stringify({ league, itemName }) : undefined;
      
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: isFree ? 'POST' : 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: body
      });
      
      if (response.ok) {
        const data = await response.json();
        const key = isFree ? `${league}_free` : league;
        setPackInfo(prev => ({
          ...prev,
          [key]: {
            currentPrice: data.currentPrice || 0,
            reloadSecondsLeft: data.reloadSecondsLeft || 0,
            isFree: isFree
          }
        }));
      }
    } catch (err) {
      console.error(`Failed to load ${isFree ? 'free' : 'pack'} info:`, err);
    }
  };

  // ========== CURRENCY ==========

  const loadCurrencyItems = async () => {
    if (!authToken) return;
    setLoadingCurrency(true);
    try {
      const response = await fetch(`${API_BASE}/api/shop/currency`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCurrencyItems(data);
        data.forEach((item: CurrencyItem) => {
          loadCurrencyItemInfo(item.item_name);
        });
      } else {
        console.error('Failed to load currency items:', response.status);
      }
    } catch (err) {
      console.error('Failed to load currency items:', err);
    } finally {
      setLoadingCurrency(false);
    }
  };

  const loadCurrencyItemInfo = async (itemName: string) => {
    if (!authToken) return;
    try {
      const response = await fetch(`${API_BASE}/api/shop/currency-info`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ itemName })
      });
      
      if (response.ok) {
        const data = await response.json();
        setLocalCurrencyReload(prev => ({
          ...prev,
          [itemName]: data.reloadSecondsLeft || 0
        }));
        setCurrencyCurrentPrices(prev => ({
          ...prev,
          [itemName]: data.currentPrice || data.itemCoinsPrice
        }));
      }
    } catch (err) {
      console.error(`Failed to load currency info for ${itemName}:`, err);
    }
  };

  const handleCurrencyPurchase = (item: CurrencyItem) => {
    const iconSrc = item.item_icon 
      ? `${BASE_URL}/${item.item_icon}` 
      : `${BASE_URL}/icons/Ticket_icon.webp`;
    
    const currentPrice = currencyCurrentPrices[item.item_name] || item.item_coins_price;
    
    setSelectedPack({
      tournament: activeTournaments[0] || { id: '0', name: 'Currency', league: 'Currency', date: '', status: 'completed', filename: '', data: null, url: '' },
      league: 'Currency',
      price: currentPrice,
      name: item.item_name,
      icon: iconSrc,
      isFree: item.item_coins_price === 0 && item.item_fiat_price === 0,
      isCurrency: true,
      ticketsAmount: item.tickets_amount,
      coinsAmount: item.coins_amount,
      itemInfo: item.item_info,
      itemDescription: item.item_description
    });
    setShowPurchaseModal(true);
  };

  const handleCurrencyPurchaseComplete = async (newCoins: number, newTickets: number) => {
    if (onUpdateBalance) {
      await onUpdateBalance(newCoins, newTickets);
    }

    if (selectedPack) {
      const itemName = selectedPack.name;
      await loadCurrencyItemInfo(itemName);
    }
  };

  // ========== FIGHT PASS ==========

  const loadFightPassItems = async () => {
    if (!authToken) return;
    setLoadingFightPass(true);
    try {
      const response = await fetch(`${API_BASE}/api/shop/fight-pass`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setFightPassItems(data);
        // Загружаем информацию о каждом предмете
        for (const item of data) {
          await loadFightPassItemInfo(item.item_name);
        }
        setFightPassLoaded(true);
      }
    } catch (err) {
      console.error('Failed to load fight pass items:', err);
    } finally {
      setLoadingFightPass(false);
    }
  };

  const loadFightPassItemInfo = async (itemName: string) => {
    if (!authToken) return;
    try {
      const response = await fetch(`${API_BASE}/api/shop/fight-pass-info`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ itemName })
      });
      
      if (response.ok) {
        const data = await response.json();
        setFightPassReload(prev => ({
          ...prev,
          [itemName]: data.reloadSecondsLeft || 0
        }));
        setFightPassPrices(prev => ({
          ...prev,
          [itemName]: data.currentPrice || data.itemCoinsPrice
        }));
        setFightPassStatus(prev => ({
          ...prev,
          [itemName]: {
            hasActivePass: data.hasActivePass || false,
            timeLeftSeconds: data.timeLeftSeconds || 0,
            expiresAt: data.expiresAt
          }
        }));
      }
    } catch (err) {
      console.error(`Failed to load fight pass info for ${itemName}:`, err);
    }
  };

  const handleFightPassPurchase = (item: FightPassItem) => {
  const iconSrc = item.item_icon 
    ? `${BASE_URL}/${item.item_icon}` 
    : `${BASE_URL}/icons/fight_pass_icon.webp`;
  
  const currentPrice = fightPassPrices[item.item_name] || item.item_coins_price;
  const isFree = item.item_coins_price === 0 && item.item_fiat_price === 0;
  const isFiatOnly = item.item_fiat_price > 0 && item.item_coins_price === 0;
  
  setSelectedPack({
    tournament: { 
      id: 'fight_pass',
      name: item.item_name,
      league: 'Fight Pass',
      date: new Date().toISOString(),
      status: 'active',
      filename: '',
      data: null,
      url: ''
    },
    league: 'Fight Pass',
    price: currentPrice,
    name: item.item_name,
    icon: iconSrc,
    isFree: isFree,
    isCurrency: false,
    isFightPass: true,
    isFiatOnly: isFiatOnly,
    ticketsAmount: 0,
    coinsAmount: 0,
    expMultiplier: item.exp_multiplier,
    durationDays: item.duration_days,
    itemInfo: item.item_info,
    itemDescription: item.item_description
  });
  setShowPurchaseModal(true);
};

  const handleFightPassPurchaseComplete = async (newCoins: number) => {
    if (onUpdateBalance) {
      await onUpdateBalance(newCoins, userTickets);
    }

    if (selectedPack) {
      const itemName = selectedPack.name;
      await loadFightPassItemInfo(itemName);
    }
  };

  // ========== ОБЩИЕ ФУНКЦИИ ==========

  const formatReloadTime = (seconds: number): string => {
    if (seconds <= 0) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTournamentName = (name: string): string => {
    if (!name) return 'Active Tournament';
    let result = name.replace(/^UFC\s*/i, '');
    result = result.replace(/^PFL\s*/i, '');
    result = result.replace(/^ONE\s*/i, '');
    result = result.replace(/_/g, ' ');
    return result;
  };

  const getLeagueIcon = (league: string, packConfig?: PackConfig): string => {
    if (packConfig?.item_icon) {
      return `${BASE_URL}/${packConfig.item_icon}`;
    }
    
    const leagueUpper = (league || 'UFC').toUpperCase();
    if (leagueUpper === 'UFC') return `${BASE_URL}/icons/UFC_cardpack.webp`;
    if (leagueUpper === 'PFL') return `${BASE_URL}/icons/PFL_cardpack.webp`;
    if (leagueUpper === 'ONE') return `${BASE_URL}/icons/ONE_cardpack.webp`;
    return `${BASE_URL}/icons/UFC_cardpack.webp`;
  };

  const getLeagueName = (league: string): string => {
    const leagueUpper = (league || 'UFC').toUpperCase();
    if (leagueUpper === 'UFC') return 'UFC';
    if (leagueUpper === 'PFL') return 'PFL';
    if (leagueUpper === 'ONE') return 'ONE';
    return 'UFC';
  };

  const handleFreePackClick = async (tournament: Tournament) => {
    const league = tournament.league || 'UFC';
    const leagueName = getLeagueName(league);
    const packConfig = allPackConfigs.find(p => p.item_name === `${leagueName} Card Pack Free`);
    const iconSrc = getLeagueIcon(league, packConfig);
    
    setSelectedPack({
      tournament,
      league: leagueName,
      price: 0,
      name: `${leagueName} Card Pack Free`,
      icon: iconSrc,
      isFree: true,
      isCurrency: false,
      itemDescription: packConfig?.item_info || ''
    });
    setShowPurchaseModal(true);
  };

  const handlePurchaseClick = (tournament: Tournament) => {
    const league = tournament.league || 'UFC';
    const leagueName = getLeagueName(league);
    const packConfig = allPackConfigs.find(p => p.item_name === `${leagueName} Card Pack`);
    const iconSrc = getLeagueIcon(league, packConfig);
    const info = packInfo[league.toUpperCase()];
    
    setSelectedPack({
      tournament,
      league: leagueName,
      price: info?.currentPrice || 1000,
      name: `${leagueName} Card Pack`,
      icon: iconSrc,
      isFree: false,
      isCurrency: false,
      itemDescription: packConfig?.item_info || ''
    });
    setShowPurchaseModal(true);
  };

  const handlePurchaseComplete = async (newCoins: number) => {
    if (onUpdateBalance) {
      await onUpdateBalance(newCoins, userTickets);
    }
    if (onRefreshBets) {
      await onRefreshBets();
    }
    if (selectedPack) {
      const league = selectedPack.league.toUpperCase();
      if (selectedPack.isFree) {
        await loadPackInfo(league, `${league} Card Pack Free`, true);
      } else {
        await loadPackInfo(league, `${league} Card Pack`);
      }
    }
  };

  // ========== РЕНДЕР ВКЛАДОК ==========

  const renderTabContent = () => {
    switch (activeTab) {
      case 'free':
        return renderFreeTab();
      case 'currency':
        return renderCurrencyTab();
      case 'fightPass':
        return renderFightPassTab();
      case 'cardPacks':
        return renderCardPacksTab();
      default:
        return null;
    }
  };

  const renderFreeTab = () => {
    const freePacks = allPackConfigs.filter(p => p.item_price === 0);
    const freeCurrencyItems = currencyItems.filter(item => item.item_coins_price === 0 && item.item_fiat_price === 0);
    
    if (loadingPacks || loadingCurrency) {
      return (
        <div className="shop-empty-state" style={{ gap: '16px' }}>
          <div className="arena-loading-spinner" style={{ width: '40px', height: '40px', border: '3px solid #3D3D3B', borderTopColor: '#B20101', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <div className="shop-empty-text" style={{ color: '#FFFFFF', fontSize: 'clamp(14px, 4vw, 18px)' }}>Loading ...</div>
        </div>
      );
    }
    
    if (freePacks.length === 0 && freeCurrencyItems.length === 0) {
      return (
        <div className="shop-empty-state">
          <div className="shop-empty-icon">🎁</div>
          <div className="shop-empty-text">FREE rewards will appear here soon!</div>
          <div className="shop-empty-subtext">Check back daily for bonuses</div>
        </div>
      );
    }
    
    return (
      <div className="shop-cardpacks-list">
        {freePacks.map((packConfig) => {
          const leagueName = packConfig.item_name.replace(' Card Pack Free', '').toUpperCase();
          const tournament = activeTournaments.find(t => (t.league || 'UFC').toUpperCase() === leagueName);
          
          if (!tournament) return null;
          
          const iconSrc = getLeagueIcon(leagueName, packConfig);
          const key = `${leagueName}_free`;
          const reloadSecondsLeft = localReloadSeconds[key] || 0;
          const isOnCooldown = reloadSecondsLeft > 0;
          
          return (
            <div key={packConfig.id} className="shop-cardpack-item">
              <div className="shop-cardpack-icon">
                <img 
                  src={iconSrc} 
                  alt={`${leagueName} Free Pack`} 
                  className="shop-cardpack-icon-img"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `${BASE_URL}/icons/UFC_cardpack.webp`;
                  }}
                />
              </div>
              
              <div className="shop-cardpack-info">
                <div className="shop-cardpack-title" style={{ color: '#4CAF50' }}>
                  🎁 {leagueName} Free Pack
                </div>
                <div className="shop-cardpack-tournament">
                  {formatTournamentName(tournament.name)}
                </div>
                {isOnCooldown && (
                  <div className="shop-cardpack-timer" style={{ color: '#FF6B6B', fontSize: 'clamp(8px, 2vw, 10px)' }}>
                    ⏳ Recharge: {formatReloadTime(reloadSecondsLeft)}
                  </div>
                )}
              </div>
              
              <div className="shop-cardpack-action">
                <div className="shop-cardpack-price" style={{ color: '#4CAF50' }}>
                  FREE
                </div>
                <button 
                  className={`shop-cardpack-purchase ${isOnCooldown ? 'disabled' : ''}`}
                  style={{
                    opacity: isOnCooldown ? 0.5 : 1,
                    cursor: isOnCooldown ? 'not-allowed' : 'pointer',
                    background: isOnCooldown ? '#666D74' : 'linear-gradient(180deg, #5b5b5b 0%, #302f30 100%)'
                  }}
                  onClick={() => !isOnCooldown && handleFreePackClick(tournament)}
                  disabled={isOnCooldown}
                >
                  {isOnCooldown ? 'RECHARGING' : 'CLAIM'}
                </button>
              </div>
            </div>
          );
        })}
        
        {freeCurrencyItems.map((item) => {
          const reloadSecondsLeft = localCurrencyReload[item.item_name] || 0;
          const isOnCooldown = reloadSecondsLeft > 0;
          const iconSrc = item.item_icon 
            ? `${BASE_URL}/${item.item_icon}` 
            : `${BASE_URL}/icons/Ticket_icon.webp`;
          
          return (
            <div key={`currency-${item.id}`} className="shop-cardpack-item">
              <div className="shop-cardpack-icon">
                <img 
                  src={iconSrc} 
                  alt={item.item_name} 
                  className="shop-cardpack-icon-img"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `${BASE_URL}/icons/Ticket_icon.webp`;
                  }}
                />
              </div>
              
              <div className="shop-cardpack-info">
                <div className="shop-cardpack-title" style={{ color: '#4CAF50' }}>
                  🎁 {item.item_name}
                </div>
                <div className="shop-cardpack-tournament">
                  {item.item_info}
                </div>
                {isOnCooldown && (
                  <div className="shop-cardpack-timer" style={{ color: '#FF6B6B', fontSize: 'clamp(8px, 2vw, 10px)' }}>
                    ⏳ Recharge: {formatReloadTime(reloadSecondsLeft)}
                  </div>
                )}
              </div>
              
              <div className="shop-cardpack-action">
                <div className="shop-cardpack-price" style={{ color: '#4CAF50' }}>
                  FREE
                </div>
                <button 
                  className={`shop-cardpack-purchase ${isOnCooldown ? 'disabled' : ''}`}
                  style={{
                    opacity: isOnCooldown ? 0.5 : 1,
                    cursor: isOnCooldown ? 'not-allowed' : 'pointer',
                    background: isOnCooldown ? '#666D74' : 'linear-gradient(180deg, #5b5b5b 0%, #302f30 100%)'
                  }}
                  onClick={() => !isOnCooldown && handleCurrencyPurchase(item)}
                  disabled={isOnCooldown}
                >
                  {isOnCooldown ? 'RECHARGING' : 'CLAIM'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderCurrencyTab = () => {
    if (loadingCurrency) {
      return (
        <div className="shop-empty-state" style={{ gap: '16px' }}>
          <div className="arena-loading-spinner" style={{ width: '40px', height: '40px', border: '3px solid #3D3D3B', borderTopColor: '#B20101', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <div className="shop-empty-text" style={{ color: '#FFFFFF', fontSize: 'clamp(14px, 4vw, 18px)' }}>Loading ...</div>
        </div>
      );
    }
    
    const paidItems = currencyItems.filter(item => item.item_coins_price > 0 || item.item_fiat_price > 0);
    
    if (paidItems.length === 0) {
      return (
        <div className="shop-empty-state">
          <div className="shop-empty-icon">🪙</div>
          <div className="shop-empty-text">Currency packs coming soon!</div>
          <div className="shop-empty-subtext">Buy Coins, Tickets and TON</div>
        </div>
      );
    }
    
    return (
      <div className="shop-cardpacks-list">
        {paidItems.map((item) => {
          const reloadSecondsLeft = localCurrencyReload[item.item_name] || 0;
          const isOnCooldown = reloadSecondsLeft > 0;
          const iconSrc = item.item_icon 
            ? `${BASE_URL}/${item.item_icon}` 
            : `${BASE_URL}/icons/Ticket_icon.webp`;
          
          const currentPrice = currencyCurrentPrices[item.item_name] || item.item_coins_price;
          const isFiat = item.item_fiat_price > 0;
          const isDisabled = isFiat;
          
          return (
            <div key={item.id} className="shop-cardpack-item">
              <div className="shop-cardpack-icon">
                <img 
                  src={iconSrc} 
                  alt={item.item_name} 
                  className="shop-cardpack-icon-img"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `${BASE_URL}/icons/Ticket_icon.webp`;
                  }}
                />
              </div>
              
              <div className="shop-cardpack-info">
                <div className="shop-cardpack-title">{item.item_name}</div>
                <div className="shop-cardpack-tournament">
                  {item.item_info}
                </div>
                {isOnCooldown && (
                  <div className="shop-cardpack-timer" style={{ color: '#FF6B6B', fontSize: 'clamp(8px, 2vw, 10px)' }}>
                    ⏳ Recharge: {formatReloadTime(reloadSecondsLeft)}
                  </div>
                )}
              </div>
              
              <div className="shop-cardpack-action">
                <div className="shop-cardpack-price">
                  {isFiat ? (
                    <>
                      {item.item_fiat_price} RUB
                    </>
                  ) : (
                    <>
                      {currentPrice}
                      <img 
                        src={`${BASE_URL}/icons/Coin_icon.webp`} 
                        alt="Coins" 
                        className="shop-cardpack-price-icon"
                      />
                    </>
                  )}
                </div>
                <button 
                  className={`shop-cardpack-purchase ${isDisabled ? 'disabled' : ''}`}
                  style={{
                    opacity: isDisabled ? 0.5 : 1,
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    background: isDisabled ? '#666D74' : 'linear-gradient(180deg, #5b5b5b 0%, #302f30 100%)'
                  }}
                  onClick={() => !isDisabled && handleCurrencyPurchase(item)}
                  disabled={isDisabled}
                >
                  {isDisabled ? 'SOON' : 'PURCHASE'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderFightPassTab = () => {
    if (loadingFightPass) {
      return (
        <div className="shop-empty-state" style={{ gap: '16px' }}>
          <div className="arena-loading-spinner" style={{ width: '40px', height: '40px', border: '3px solid #3D3D3B', borderTopColor: '#B20101', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <div className="shop-empty-text" style={{ color: '#FFFFFF', fontSize: 'clamp(14px, 4vw, 18px)' }}>Loading ...</div>
        </div>
      );
    }

    if (fightPassItems.length === 0) {
      return (
        <div className="shop-empty-state">
          <div className="shop-empty-icon">🎖️</div>
          <div className="shop-empty-text">Fight Pass coming soon!</div>
          <div className="shop-empty-subtext">Premium subscription with exclusive benefits</div>
        </div>
      );
    }

    const formatTimeLeft = (seconds: number): string => {
      if (seconds <= 0) return 'Expired';
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      
      if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
      }
      return `${minutes}m ${secs}s`;
    };

    return (
      <div className="shop-cardpacks-list">
        {fightPassItems.map((item) => {
          const reloadSecondsLeft = fightPassReload[item.item_name] || 0;
          const status = fightPassStatus[item.item_name];
          const hasActivePass = status?.hasActivePass || false;
          const timeLeftSeconds = status?.timeLeftSeconds || 0;
          const isOnCooldown = reloadSecondsLeft > 0;
          const iconSrc = item.item_icon 
            ? `${BASE_URL}/${item.item_icon}` 
            : `${BASE_URL}/icons/fight_pass_icon.webp`;
          const currentPrice = fightPassPrices[item.item_name] || item.item_coins_price;
          const isFiatOnly = item.item_fiat_price > 0 && item.item_coins_price === 0;
          const isFree = item.item_coins_price === 0 && item.item_fiat_price === 0;
          
          const isDisabled = hasActivePass || isOnCooldown || isFiatOnly;
          
          let buttonText = 'PURCHASE';
          if (hasActivePass) {
            buttonText = `ACTIVE (${formatTimeLeft(timeLeftSeconds)})`;
          } else if (isOnCooldown) {
            buttonText = 'RECHARGING';
          } else if (isFiatOnly) {
            buttonText = 'SOON';
          } else if (isFree) {
            buttonText = 'CLAIM';
          }
          
          return (
            <div key={item.id} className="shop-cardpack-item">
              <div className="shop-cardpack-icon">
                <img 
                  src={iconSrc} 
                  alt={item.item_name} 
                  className="shop-cardpack-icon-img"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `${BASE_URL}/icons/fight_pass_icon.webp`;
                  }}
                />
              </div>
              
              <div className="shop-cardpack-info">
                <div className="shop-cardpack-title" style={{ color: hasActivePass ? '#4CAF50' : '#ffffff' }}>
  {item.item_name}
</div>
                <div className="shop-cardpack-tournament">
                  {item.item_info}
                </div>
                {hasActivePass && (
                  <div style={{ color: '#4CAF50', fontSize: 'clamp(8px, 2vw, 10px)' }}>
                    🔥 {formatTimeLeft(timeLeftSeconds)} remaining
                  </div>
                )}
                {isOnCooldown && !hasActivePass && (
                  <div style={{ color: '#FF6B6B', fontSize: 'clamp(8px, 2vw, 10px)' }}>
                    ⏳ Recharge: {formatReloadTime(reloadSecondsLeft)}
                  </div>
                )}
                {isFiatOnly && !hasActivePass && (
                  <div style={{ color: '#FF6B6B', fontSize: 'clamp(8px, 2vw, 10px)' }}>
                    💳 Coming soon
                  </div>
                )}
              </div>
              
              <div className="shop-cardpack-action">
                <div className="shop-cardpack-price">
                  {isFree ? 'FREE' : isFiatOnly ? `${item.item_fiat_price} RUB` : (
                    <>
                      {currentPrice}
                      <img 
                        src={`${BASE_URL}/icons/Coin_icon.webp`} 
                        alt="Coins" 
                        className="shop-cardpack-price-icon"
                      />
                    </>
                  )}
                </div>
                <button 
                  className={`shop-cardpack-purchase ${isDisabled ? 'disabled' : ''}`}
                  style={{
                    opacity: isDisabled ? 0.5 : 1,
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    background: hasActivePass ? '#4CAF50' : (isDisabled ? '#666D74' : 'linear-gradient(180deg, #5b5b5b 0%, #302f30 100%)')
                  }}
                  onClick={() => !isDisabled && handleFightPassPurchase(item)}
                  disabled={isDisabled}
                >
                  {buttonText}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderCardPacksTab = () => {
    if (activeTournaments.length === 0) {
      return (
        <div className="shop-empty-state">
          <div className="shop-empty-icon">🃏</div>
          <div className="shop-empty-text">No active tournaments</div>
          <div className="shop-empty-subtext">Card packs will appear when tournaments are available</div>
        </div>
      );
    }
    
    if (loadingPacks) {
      return (
        <div className="shop-empty-state" style={{ gap: '16px' }}>
          <div className="arena-loading-spinner" style={{ width: '40px', height: '40px', border: '3px solid #3D3D3B', borderTopColor: '#B20101', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <div className="shop-empty-text" style={{ color: '#FFFFFF', fontSize: 'clamp(14px, 4vw, 18px)' }}>Loading ...</div>
        </div>
      );
    }
    
    return (
      <div className="shop-cardpacks-list">
        {activeTournaments.map((tournament) => {
          const league = tournament.league || 'UFC';
          const leagueUpper = league.toUpperCase();
          
          const packConfig = allPackConfigs.find(p => p.item_name === `${leagueUpper} Card Pack`);
          if (!packConfig) return null;
          
          const iconSrc = getLeagueIcon(league, packConfig);
          const leagueName = getLeagueName(league);
          const info = packInfo[leagueUpper];
          const currentPrice = info?.currentPrice || 1000;
          const reloadSecondsLeft = localReloadSeconds[leagueUpper] || 0;
          
          return (
            <div key={tournament.id} className="shop-cardpack-item">
              <div className="shop-cardpack-icon">
                <img 
                  src={iconSrc} 
                  alt={`${leagueName} Card Pack`} 
                  className="shop-cardpack-icon-img"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `${BASE_URL}/icons/UFC_cardpack.webp`;
                  }}
                />
              </div>
              
              <div className="shop-cardpack-info">
                <div className="shop-cardpack-title">{leagueName} Card Pack</div>
                <div className="shop-cardpack-tournament">
                  {formatTournamentName(tournament.name)}
                </div>
                {reloadSecondsLeft > 0 && (
                  <div className="shop-cardpack-timer" style={{ color: '#FF6B6B', fontSize: 'clamp(8px, 2vw, 10px)' }}>
                    ⏳ Recharge: {formatReloadTime(reloadSecondsLeft)}
                  </div>
                )}
              </div>
              
              <div className="shop-cardpack-action">
                <div className="shop-cardpack-price">
                  {currentPrice}
                  <img 
                    src={`${BASE_URL}/icons/Coin_icon.webp`} 
                    alt="Coins" 
                    className="shop-cardpack-price-icon"
                  />
                </div>
                <button 
                  className="shop-cardpack-purchase"
                  onClick={() => handlePurchaseClick(tournament)}
                >
                  PURCHASE
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="shop-screen">
      <div className="shop-header">
        <div className="shop-promotion">
          <span className="shop-promotion-text">{promotions[currentPromotionIndex]}</span>
        </div>
      </div>

      <div className="shop-tabs">
        <button 
          className={`shop-tab-btn ${activeTab === 'free' ? 'active' : 'inactive'}`}
          onClick={() => setActiveTab('free')}
        >
          FREE
        </button>
        <button 
          className={`shop-tab-btn ${activeTab === 'currency' ? 'active' : 'inactive'}`}
          onClick={() => setActiveTab('currency')}
        >
          CURRENCY
        </button>
        <button 
          className={`shop-tab-btn ${activeTab === 'fightPass' ? 'active' : 'inactive'}`}
          onClick={() => setActiveTab('fightPass')}
        >
          FIGHT PASS
        </button>
        <button 
          className={`shop-tab-btn ${activeTab === 'cardPacks' ? 'active' : 'inactive'}`}
          onClick={() => setActiveTab('cardPacks')}
        >
          CARD PACKS
        </button>
      </div>

      <div className="shop-content">
        {renderTabContent()}
      </div>

      {selectedPack && (
        <PurchaseModal
          isOpen={showPurchaseModal}
          onClose={() => {
            setShowPurchaseModal(false);
            setSelectedPack(null);
          }}
          itemName={selectedPack.name}
          itemIcon={selectedPack.icon}
          itemInfo={selectedPack.itemInfo}
          itemDescription={selectedPack.itemDescription}
          tournamentName={selectedPack.tournament.name}
          league={selectedPack.league}
          price={selectedPack.price}
          userCoins={userCoins}
          authToken={authToken}
          isFree={selectedPack.isFree}
          isCurrency={selectedPack.isCurrency || false}
          isFightPass={selectedPack.isFightPass || false}
          isFiatOnly={selectedPack.isFiatOnly || false}
          ticketsAmount={selectedPack.ticketsAmount || 0}
          coinsAmount={selectedPack.coinsAmount || 0}
          expMultiplier={selectedPack.expMultiplier || 1.0}
          durationDays={selectedPack.durationDays || 1}
          onPurchaseComplete={handlePurchaseComplete}
          onCurrencyPurchaseComplete={handleCurrencyPurchaseComplete}
          onFightPassPurchaseComplete={handleFightPassPurchaseComplete}
        />
      )}
    </div>
  );
};

export default ShopScreen;