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
  } | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [packInfo, setPackInfo] = useState<Record<string, { currentPrice: number; reloadSecondsLeft: number }>>({});

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

  // Загружаем информацию для каждого турнира
  useEffect(() => {
    if (authToken && activeTournaments.length > 0) {
      activeTournaments.forEach(tournament => {
        const league = (tournament.league || 'UFC').toUpperCase();
        loadPackInfo(league);
      });
    }
  }, [authToken, activeTournaments]);

  const loadPackInfo = async (league: string) => {
    if (!authToken) return;
    try {
      const response = await fetch(`${API_BASE}/api/shop/card-pack/${league}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPackInfo(prev => ({
          ...prev,
          [league]: {
            currentPrice: data.currentPrice,
            reloadSecondsLeft: data.reloadSecondsLeft
          }
        }));
      }
    } catch (err) {
      console.error('Failed to load pack info:', err);
    }
  };

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

  const getLeagueIcon = (league: string): string => {
    const leagueUpper = (league || 'UFC').toUpperCase();
    if (leagueUpper === 'UFC') return `${BASE_URL}/UFC_cardpack.png`;
    if (leagueUpper === 'PFL') return `${BASE_URL}/PFL_cardpack.png`;
    if (leagueUpper === 'ONE') return `${BASE_URL}/ONE_cardpack.png`;
    return `${BASE_URL}/UFC_cardpack.png`;
  };

  const getLeagueName = (league: string): string => {
    const leagueUpper = (league || 'UFC').toUpperCase();
    if (leagueUpper === 'UFC') return 'UFC';
    if (leagueUpper === 'PFL') return 'PFL';
    if (leagueUpper === 'ONE') return 'ONE';
    return 'UFC';
  };

  const handlePurchaseClick = (tournament: Tournament) => {
    const league = tournament.league || 'UFC';
    const leagueName = getLeagueName(league);
    const iconSrc = getLeagueIcon(league);
    const info = packInfo[league.toUpperCase()];
    
    setSelectedPack({
      tournament,
      league: leagueName,
      price: info?.currentPrice || 1000,
      name: `${leagueName} Card Pack`,
      icon: iconSrc
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
    // Обновляем информацию для этой лиги после покупки
    if (selectedPack) {
      await loadPackInfo(selectedPack.league.toUpperCase());
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'free':
        return (
          <div className="shop-empty-state">
            <div className="shop-empty-icon">🎁</div>
            <div className="shop-empty-text">FREE rewards will appear here soon!</div>
            <div className="shop-empty-subtext">Check back daily for bonuses</div>
          </div>
        );
      case 'currency':
        return (
          <div className="shop-empty-state">
            <div className="shop-empty-icon">🪙</div>
            <div className="shop-empty-text">Currency packs coming soon!</div>
            <div className="shop-empty-subtext">Buy Coins, Tickets and TON</div>
          </div>
        );
      case 'fightPass':
        return (
          <div className="shop-empty-state">
            <div className="shop-empty-icon">🎖️</div>
            <div className="shop-empty-text">Fight Pass coming soon!</div>
            <div className="shop-empty-subtext">Premium subscription with exclusive benefits</div>
          </div>
        );
      case 'cardPacks':
        if (activeTournaments.length === 0) {
          return (
            <div className="shop-empty-state">
              <div className="shop-empty-icon">🃏</div>
              <div className="shop-empty-text">No active tournaments</div>
              <div className="shop-empty-subtext">Card packs will appear when tournaments are available</div>
            </div>
          );
        }
        
        return (
          <div className="shop-cardpacks-list">
            {activeTournaments.map((tournament) => {
              const league = tournament.league || 'UFC';
              const leagueUpper = league.toUpperCase();
              const iconSrc = getLeagueIcon(league);
              const leagueName = getLeagueName(league);
              const info = packInfo[leagueUpper];
              const currentPrice = info?.currentPrice || 1000;
              const reloadSeconds = info?.reloadSecondsLeft || 0;
              
              return (
                <div key={tournament.id} className="shop-cardpack-item">
                  {/* 1-й столбец: иконка лиги */}
                  <div className="shop-cardpack-icon">
                    <img 
                      src={iconSrc} 
                      alt={`${leagueName} Card Pack`} 
                      className="shop-cardpack-icon-img"
                    />
                  </div>
                  
                  {/* 2-й столбец: информация */}
                  <div className="shop-cardpack-info">
                    <div className="shop-cardpack-title">{leagueName} Card Pack</div>
                    <div className="shop-cardpack-tournament">
                      {formatTournamentName(tournament.name)}
                    </div>
                    {reloadSeconds > 0 && (
                      <div className="shop-cardpack-timer" style={{ color: '#888888', fontSize: 'clamp(8px, 2vw, 10px)' }}>
                        Reload time: {formatReloadTime(reloadSeconds)}
                      </div>
                    )}
                  </div>
                  
                  {/* 3-й столбец: цена и кнопка */}
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
      default:
        return null;
    }
  };

  return (
    <div className="shop-screen">
      {/* Верхняя шапка с рекламой */}
      <div className="shop-header">
        <div className="shop-promotion">
          <span className="shop-promotion-text">{promotions[currentPromotionIndex]}</span>
        </div>
      </div>

      {/* Кнопки закладок */}
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

      {/* Контент закладки */}
      <div className="shop-content">
        {renderTabContent()}
      </div>

      {/* Модальное окно покупки */}
      {selectedPack && (
        <PurchaseModal
          isOpen={showPurchaseModal}
          onClose={() => {
            setShowPurchaseModal(false);
            setSelectedPack(null);
          }}
          itemName={selectedPack.name}
          itemIcon={selectedPack.icon}
          tournamentName={selectedPack.tournament.name}
          league={selectedPack.league}
          price={selectedPack.price}
          userCoins={userCoins}
          authToken={authToken}
          onPurchaseComplete={handlePurchaseComplete}
        />
      )}
    </div>
  );
};

export default ShopScreen;