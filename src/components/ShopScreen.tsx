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

// Тип для конфигурации пака из БД
interface PackConfig {
  id: number;
  item_name: string;
  item_info: string;
  item_price: number;
  item_reload_time: number;
  item_icon?: string;
}

// Тип для информации о паке пользователя
interface PackInfo {
  currentPrice: number;
  reloadSecondsLeft: number;
  isFree?: boolean;
}

// Тип для currency предмета
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
    ticketsAmount?: number;
    itemInfo?: string;
    itemDescription?: string;
  } | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [packInfo, setPackInfo] = useState<Record<string, PackInfo>>({});
  const [localReloadSeconds, setLocalReloadSeconds] = useState<Record<string, number>>({});
  const [allPackConfigs, setAllPackConfigs] = useState<PackConfig[]>([]);
  const [loadingPacks, setLoadingPacks] = useState(true);

  // Currency состояния
  const [currencyItems, setCurrencyItems] = useState<CurrencyItem[]>([]);
  const [loadingCurrency, setLoadingCurrency] = useState(true);
  const [localCurrencyReload, setLocalCurrencyReload] = useState<Record<string, number>>({});
  const [currencyCurrentPrices, setCurrencyCurrentPrices] = useState<Record<string, number>>({});

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

  // Загружаем все конфигурации паков
  useEffect(() => {
    if (authToken) {
      loadAllPackConfigs();
      loadCurrencyItems();
    }
  }, [authToken]);

  // Загружаем информацию для каждого турнира
  useEffect(() => {
    if (authToken && activeTournaments.length > 0) {
      activeTournaments.forEach(tournament => {
        const league = (tournament.league || 'UFC').toUpperCase();
        // Загружаем инфо для платных паков
        loadPackInfo(league, `${league} Card Pack`);
        // Загружаем инфо для бесплатных паков
        loadPackInfo(league, `${league} Card Pack Free`, true);
      });
    }
  }, [authToken, activeTournaments]);

  // Обновляем локальный таймер при загрузке новых данных
  useEffect(() => {
    Object.keys(packInfo).forEach(key => {
      setLocalReloadSeconds(prev => ({
        ...prev,
        [key]: packInfo[key].reloadSecondsLeft
      }));
    });
  }, [packInfo]);

  // Интервал для уменьшения локального таймера (паки)
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

  // Интервал для уменьшения локального таймера (currency)
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
      isFree: false,
      isCurrency: true,
      ticketsAmount: item.tickets_amount,
      itemInfo: item.item_info,
      itemDescription: item.item_description
    });
    setShowPurchaseModal(true);
  };

  const handleCurrencyPurchaseComplete = async (newCoins: number, newTickets: number) => {
    if (onUpdateBalance) {
      await onUpdateBalance(newCoins, newTickets);
    }

    // Обновляем информацию о предмете (цену и таймер)
  if (selectedPack) {
    const itemName = selectedPack.name;
    await loadCurrencyItemInfo(itemName);
  }

    /*setShowPurchaseModal(false);
    setSelectedPack(null);*/
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
      isFree: true
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
      isFree: false
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
        return (
          <div className="shop-empty-state">
            <div className="shop-empty-icon">🎖️</div>
            <div className="shop-empty-text">Fight Pass coming soon!</div>
            <div className="shop-empty-subtext">Premium subscription with exclusive benefits</div>
          </div>
        );
      case 'cardPacks':
        return renderCardPacksTab();
      default:
        return null;
    }
  };

  const renderFreeTab = () => {
    const freePacks = allPackConfigs.filter(p => p.item_price === 0);
    
    if (loadingPacks) {
      return (
        <div className="shop-empty-state" style={{ gap: '16px' }}>
          <div className="arena-loading-spinner" style={{ width: '40px', height: '40px', border: '3px solid #3D3D3B', borderTopColor: '#B20101', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <div className="shop-empty-text" style={{ color: '#FFFFFF', fontSize: 'clamp(14px, 4vw, 18px)' }}>Loading ...</div>
        </div>
      );
    }
    
    if (freePacks.length === 0) {
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
                  {isOnCooldown ? 'RECHARGING' : 'GET'}
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
    
    if (currencyItems.length === 0) {
      return (
        <div className="shop-empty-state">
          <div className="shop-empty-icon">🪙</div>
          <div className="shop-empty-text">Currency packs coming soon!</div>
          <div className="shop-empty-subtext">Buy Coins, Tickets and TON</div>
        </div>
      );
    }
    
    // Разделяем платные и бесплатные
    const paidItems = currencyItems.filter(item => item.item_coins_price > 0);
    const freeItems = currencyItems.filter(item => item.item_coins_price === 0);
    
    return (
      <div className="shop-cardpacks-list">
        {/* Бесплатные предметы */}
        {freeItems.map((item) => {
          const reloadSecondsLeft = localCurrencyReload[item.item_name] || 0;
          const isOnCooldown = reloadSecondsLeft > 0;
          const iconSrc = item.item_icon 
            ? `${BASE_URL}/${item.item_icon}` 
            : `${BASE_URL}/icons/Ticket_icon.webp`;
          
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
                  {isOnCooldown ? 'RECHARGING' : 'GET'}
                </button>
              </div>
            </div>
          );
        })}
        
        {/* Платные предметы */}
        {paidItems.map((item) => {
          const reloadSecondsLeft = localCurrencyReload[item.item_name] || 0;
          const isOnCooldown = reloadSecondsLeft > 0;
          const iconSrc = item.item_icon 
            ? `${BASE_URL}/${item.item_icon}` 
            : `${BASE_URL}/icons/Ticket_icon.webp`;
          
          const currentPrice = currencyCurrentPrices[item.item_name] || item.item_coins_price;
          
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
                  {currentPrice}
                  <img 
                    src={`${BASE_URL}/icons/Coin_icon.webp`} 
                    alt="Coins" 
                    className="shop-cardpack-price-icon"
                  />
                </div>
                <button 
                  className="shop-cardpack-purchase"
                  onClick={() => handleCurrencyPurchase(item)}
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
    
    const paidPacks = allPackConfigs.filter(p => p.item_price > 0);
    
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
          ticketsAmount={selectedPack.ticketsAmount || 0}
          onPurchaseComplete={handlePurchaseComplete}
          onCurrencyPurchaseComplete={handleCurrencyPurchaseComplete}
        />
      )}
    </div>
  );
};

export default ShopScreen;