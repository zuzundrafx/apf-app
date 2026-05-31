// src/components/ShopScreen.tsx
import React, { useState } from 'react';
import { Tournament } from '../types';
import PurchaseModal from './PurchaseModal';

const BASE_URL = import.meta.env.PROD ? '' : '/reactjs-template';

interface ShopScreenProps {
  activeTournaments: Tournament[];
  userCoins?: number;
  userTickets?: number;
  userStyle?: 'striker' | 'grappler' | null;
  onUpdateBalance?: (coins: number, tickets: number) => Promise<void>;
  authToken?: string;
}

const ShopScreen: React.FC<ShopScreenProps> = ({ 
  activeTournaments, 
  userCoins = 0,
  userTickets = 0,
  onUpdateBalance,
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

  const promotions = [
    "🎁 FREE daily reward! Claim now!",
    "🔥 Limited offer: 50% bonus on Currency packs!",
    "💎 Fight Pass: Get exclusive rewards!",
    "🃏 New Card Packs available!"
  ];

  const [currentPromotionIndex, setCurrentPromotionIndex] = useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPromotionIndex((prev) => (prev + 1) % promotions.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

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
    
    setSelectedPack({
      tournament,
      league: leagueName,
      price: 1000,
      name: `${leagueName} Card Pack`,
      icon: iconSrc
    });
    setShowPurchaseModal(true);
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
              const iconSrc = getLeagueIcon(league);
              const leagueName = getLeagueName(league);
              
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
                  </div>
                  
                  {/* 3-й столбец: цена и кнопка */}
                  <div className="shop-cardpack-action">
                    <div className="shop-cardpack-price">
                      1000
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
          onPurchaseComplete={(newCoins) => {
            if (onUpdateBalance) {
              onUpdateBalance(newCoins, userTickets);
            }
          }}
        />
      )}
    </div>
  );
};

export default ShopScreen;