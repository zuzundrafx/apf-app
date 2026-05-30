// src/components/PurchaseModal.tsx
import React, { useState } from 'react';

const BASE_URL = import.meta.env.PROD ? '' : '/reactjs-template';

interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchase: () => Promise<void>;
  itemName: string;
  itemIcon: string;
  tournamentName: string;
  league: string;
  price: number;
  userCoins: number;
}

const PurchaseModal: React.FC<PurchaseModalProps> = ({
  isOpen,
  onClose,
  onPurchase,
  itemName,
  itemIcon,
  tournamentName,
  league,
  price,
  userCoins
}) => {
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [showPricePulse, setShowPricePulse] = useState(false);

  if (!isOpen) return null;

  const formatTournamentName = (name: string): string => {
    if (!name) return 'Active Tournament';
    let result = name.replace(/^UFC\s*/i, '');
    result = result.replace(/^PFL\s*/i, '');
    result = result.replace(/^ONE\s*/i, '');
    result = result.replace(/_/g, ' ');
    return result;
  };

  const handlePurchaseClick = async () => {
    if (userCoins < price) {
      setShowPricePulse(true);
      setTimeout(() => setShowPricePulse(false), 500);
      return;
    }
    
    setIsPurchasing(true);
    try {
      await onPurchase();
      onClose();
    } catch (error) {
      console.error('Purchase failed:', error);
    } finally {
      setIsPurchasing(false);
    }
  };

  const getLeagueGradient = (leagueName: string): string => {
    const leagueUpper = leagueName.toUpperCase();
    if (leagueUpper === 'UFC') return 'linear-gradient(180deg, #B20101 0%, #8C1519 100%)';
    if (leagueUpper === 'PFL') return 'linear-gradient(180deg, #0550B2 0%, #0A3A7A 100%)';
    if (leagueUpper === 'ONE') return 'linear-gradient(180deg, #D4AF37 0%, #8B7300 100%)';
    return 'linear-gradient(180deg, #5b5b5b 0%, #302f30 100%)';
  };

  const leagueGradient = getLeagueGradient(league);
  const formattedTournamentName = formatTournamentName(tournamentName);

  return (
    <div className="rewards-modal-overlay">
      <div 
        className="rewards-modal no-summary" 
        style={{ 
          height: 'auto',
          minHeight: '45%',
          maxHeight: '70%',
          display: 'flex', 
          flexDirection: 'column',
          margin: 'auto auto',
          padding: '0',
          position: 'relative',
          width: '85%'
        }}
      >
        {/* Иконка в заголовке */}
        <div className="rewards-header" style={{ top: '-12%', zIndex: 100 }}>
          <div style={{
            width: '25vw',
            maxWidth: '80px',
            aspectRatio: '1/1',
            background: leagueGradient,
            borderRadius: '10%',
            padding: '2%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 0 0.3vw #000000',
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -100%)',
          }}>
            <div style={{
              width: '100%',
              height: '100%',
              background: '#091422',
              borderRadius: '10%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}>
              <img 
                src={itemIcon} 
                alt={itemName}
                style={{ width: '95%', height: '95%', objectFit: 'contain' }}
              />
            </div>
          </div>
          <button 
            className="cancelled-modal-close" 
            style={{ top: '130%', zIndex: 101, cursor: 'pointer' }} 
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div 
          className="rewards-winners-list" 
          style={{ 
            flex: 'none',
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'top',
            width: '85%',
            margin: 'auto',
            marginTop: '6%',
            gap: '4%',
            maxHeight: '77%',
            minHeight: '77%',
            overflow: 'hidden',
          }}
        >
          {/* Название предмета */}
          <div style={{
            width: '100%',
            color: '#FFD966',
            fontSize: 'clamp(14px, 4vw, 18px)',
            fontWeight: 700,
            textAlign: 'center',
            textTransform: 'uppercase',
            textShadow: '0 0 5px rgba(255, 217, 102, 0.5)',
            flexShrink: 0,
          }}>
            {itemName}
          </div>

          {/* Название турнира */}
          <div style={{
            width: '100%',
            padding: '3% 4%',
            background: '#313130',
            borderRadius: '8px',
            flexShrink: 0,
          }}>
            <div style={{ color: '#FFFFFF', fontSize: 'clamp(10px, 3vw, 12px)', textAlign: 'center', lineHeight: 1.4 }}>
              {formattedTournamentName}
            </div>
          </div>

          {/* Описание */}
          <div style={{
            width: '100%',
            padding: '3% 4%',
            background: '#313130',
            borderRadius: '8px',
            flexShrink: 0,
          }}>
            <div style={{ color: '#FFFFFF', fontSize: 'clamp(10px, 3vw, 12px)', textAlign: 'center', lineHeight: 1.4 }}>
              Get 5 random fighter cards for the active {league.toUpperCase()} tournament with this pack!
            </div>
          </div>

          {/* Цена */}
          <div style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '3% 4%',
            flexShrink: 0,
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              color: userCoins >= price ? '#FFFFFF' : '#FF6B6B'
            }}>
              <span 
                id="purchase-price"
                style={{
                  display: 'inline-block',
                  transition: 'transform 0.3s ease',
                  transform: showPricePulse ? 'scale(1.3)' : 'scale(1)',
                  fontSize: 'clamp(16px, 4vw, 20px)',
                  fontWeight: 700,
                  color: '#FFD966'
                }}
              >
                {price}
              </span>
              <img 
                src={`${BASE_URL}/icons/Coin_icon.webp`} 
                alt="Coins" 
                style={{ width: 'auto', height: 'clamp(16px, 4vw, 20px)', objectFit: 'contain' }}
              />
            </div>
          </div>
        </div>

        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          marginTop: '2vh',
          marginBottom: '4vh',
          width: '100%'
        }}>
          <button 
            className="rewards-claim-button"
            style={{ 
              width: '60%', 
              height: '6vh',
              opacity: userCoins >= price ? 1 : 0.7,
              cursor: userCoins >= price ? 'pointer' : 'not-allowed'
            }}
            onClick={handlePurchaseClick}
            disabled={isPurchasing}
          >
            {isPurchasing ? 'PURCHASING...' : 'PURCHASE'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PurchaseModal;