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

  // Анимация пульсации для кнопки при нехватке монет
  const buttonStyle = {
    width: '60%',
    height: '6vh',
    opacity: userCoins >= price ? 1 : 0.7,
    cursor: userCoins >= price ? 'pointer' : 'not-allowed',
    transform: showPricePulse ? 'scale(1.05)' : 'scale(1)',
    transition: 'transform 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  };

  return (
    <div className="rewards-modal-overlay">
      <div 
        className="rewards-modal no-summary" 
        style={{ 
          height: 'auto',
          minHeight: '35%',
          maxHeight: '70%',
          display: 'flex', 
          flexDirection: 'column',
          margin: 'auto auto',
          padding: '0',
          position: 'relative',
          width: '95%'
        }}
      >
        <div className="rewards-header" style={{ top: '-8%', zIndex: 100 }}>
          <button 
            className="cancelled-modal-close" 
            style={{ top: '100%', zIndex: 101, cursor: 'pointer' }} 
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
            justifyContent: 'center',
            width: '95%',
            margin: 'auto',
            marginTop: '4%',
            gap: '4%',
            maxHeight: '85%',
            minHeight: '85%',
            overflow: 'hidden',
          }}
        >
          {/* Блок: иконка + название (горизонтально) */}
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 'clamp(12px, 4vw, 20px)',
            width: '100%',
            flexShrink: 0,
          }}>
            {/* Иконка предмета (слева) */}
            <div style={{
              width: '20vw',
              maxWidth: '80px',
              aspectRatio: '1/1',
              borderRadius: '10%',
              /*padding: '2%',*/
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <div style={{
                width: '100%',
                height: '100%',
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

            {/* Блок с названием предмета и турнира (справа) */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'clamp(4px, 1vh, 8px)',
              flex: 1,
              minWidth: 0,
            }}>
              {/* Название предмета */}
              <div style={{
                color: '#FFD966',
                fontSize: 'clamp(14px, 4vw, 18px)',
                fontWeight: 700,
                textTransform: 'uppercase',
                textShadow: '0 0 5px rgba(255, 217, 102, 0.5)',
                lineHeight: 1.3,
              }}>
                {itemName}
              </div>

              {/* Название турнира */}
              <div style={{
                color: '#888888',
                fontSize: 'clamp(11px, 3vw, 14px)',
                fontWeight: 400,
                lineHeight: 1.3,
              }}>
                {formattedTournamentName}
              </div>
            </div>
          </div>

          {/* Описание */}
          <div style={{
            width: '100%',
            padding: '3% 4%',
            background: '#313130',
            borderRadius: '8px',
            flexShrink: 0,
            marginTop: 'clamp(8px, 2vh, 16px)',
          }}>
            <div style={{ color: '#FFFFFF', fontSize: 'clamp(10px, 3vw, 12px)', textAlign: 'center', lineHeight: 1.4 }}>
              Get 5 random fighter cards for the active {league.toUpperCase()} tournament with this pack!
            </div>
          </div>
        </div>

        <div style={{ 
  display: 'flex', 
  justifyContent: 'center', 
  marginTop: '2vh',
  marginBottom: '2vh',
  width: '100%'
}}>
  <button 
    className="rewards-claim-button"
    style={buttonStyle}
    onClick={handlePurchaseClick}
    disabled={isPurchasing}
  >
    {isPurchasing ? (
      'PURCHASING...'
    ) : (
      <>
        CONFIRM PAYMENT: 
        <span style={{ 
          fontWeight: 700, 
          fontSize: 'clamp(16px, 4vw, 20px)',
          marginLeft: '4px',
        color: '#FFD966'
        }}>
          {price}
        </span>
        <img 
          src={`${BASE_URL}/icons/Coin_icon.webp`} 
          alt="Coins" 
          style={{ width: 'auto', height: 'clamp(14px, 3.5vw, 18px)', objectFit: 'contain', marginLeft: '2px' }}
        />
      </>
    )}
  </button>
</div>
      </div>
    </div>
  );
};

export default PurchaseModal;