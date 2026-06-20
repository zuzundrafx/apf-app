// src/components/PurchaseModal.tsx
import React, { useState, useEffect } from 'react';
import { getWeightClassColor } from '../utils/weightUtils';
import { getFighterStyleFromSelected, getStyleIconFilename } from '../utils/fighterUtils';

const BASE_URL = import.meta.env.PROD ? '' : '/reactjs-template';
const API_BASE = import.meta.env.PROD ? 'https://apf-app-backend.onrender.com' : 'http://localhost:3001';

interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemName: string;
  itemIcon: string;
  tournamentName: string;
  league: string;
  price: number;
  userCoins: number;
  authToken?: string;
  isFree?: boolean;
  onPurchaseComplete?: (newCoins: number) => void;
}

const PurchaseModal: React.FC<PurchaseModalProps> = ({
  isOpen,
  onClose,
  itemName,
  itemIcon,
  tournamentName,
  league,
  price,
  userCoins,
  authToken,
  isFree = false,
  onPurchaseComplete
}) => {
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [showPricePulse, setShowPricePulse] = useState(false);
  const [purchaseState, setPurchaseState] = useState<'idle' | 'loading' | 'success'>('idle');
  const [purchasedCards, setPurchasedCards] = useState<any[]>([]);
  const [currentPrice, setCurrentPrice] = useState(price);
  const [showCompleteMessage, setShowCompleteMessage] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Добавляем keyframes для анимации в head, если их нет
  useEffect(() => {
    if (!document.querySelector('#purchase-modal-animations')) {
      const style = document.createElement('style');
      style.id = 'purchase-modal-animations';
      style.textContent = `
        @keyframes purchaseCompletePop {
          0% {
            transform: translateX(-50%) scale(0.3);
            opacity: 0;
          }
          40% {
            transform: translateX(-50%) scale(1.15);
            opacity: 1;
          }
          70% {
            transform: translateX(-50%) scale(0.95);
            opacity: 1;
          }
          100% {
            transform: translateX(-50%) scale(1);
            opacity: 1;
          }
        }

        @keyframes purchaseCompleteFlash {
          0% {
            box-shadow: 0 0 0 0 rgba(255, 217, 102, 0);
          }
          20% {
            box-shadow: 0 0 80px 40px rgba(255, 217, 102, 0.6), 0 0 200px 80px rgba(255, 217, 102, 0.3);
          }
          50% {
            box-shadow: 0 0 60px 30px rgba(255, 217, 102, 0.4), 0 0 150px 60px rgba(255, 217, 102, 0.2);
          }
          80% {
            box-shadow: 0 0 30px 15px rgba(255, 217, 102, 0.2), 0 0 80px 30px rgba(255, 217, 102, 0.1);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(255, 217, 102, 0);
          }
        }

        @keyframes purchaseCompleteGlow {
          0% {
            text-shadow: 0 0 0 rgba(255, 217, 102, 0);
          }
          20% {
            text-shadow: 0 0 40px rgba(255, 217, 102, 0.8), 0 0 80px rgba(255, 217, 102, 0.4);
          }
          50% {
            text-shadow: 0 0 30px rgba(255, 217, 102, 0.6), 0 0 60px rgba(255, 217, 102, 0.3);
          }
          80% {
            text-shadow: 0 0 20px rgba(255, 217, 102, 0.4), 0 0 40px rgba(255, 217, 102, 0.2);
          }
          100% {
            text-shadow: 0 0 10px rgba(255, 217, 102, 0.2);
          }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

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
    // Если бесплатно — не проверяем монеты
    if (!isFree && userCoins < currentPrice) {
      setShowPricePulse(true);
      setTimeout(() => setShowPricePulse(false), 500);
      return;
    }
    
    setIsPurchasing(true);
    setPurchaseState('loading');
    
    try {
      let response;
      
      if (isFree) {
        // Бесплатный пак
        response = await fetch(`${API_BASE}/api/shop/claim-free-card-pack`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            league: league,
            itemName: itemName
          })
        });
      } else {
        // Платный пак
        response = await fetch(`${API_BASE}/api/shop/purchase-card-pack`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            league: league,
            itemName: itemName,
            price: currentPrice
          })
        });
      }
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Purchase failed');
      }
      
      const data = await response.json();
      setPurchasedCards(data.selections);
      setPurchaseState('success');
      setShowCompleteMessage(true);
      setIsAnimating(true);
      
      setTimeout(() => setIsAnimating(false), 1000);
      
      if (onPurchaseComplete) {
        onPurchaseComplete(data.newCoins || 0);
      }
    } catch (error: any) {
      console.error('Purchase failed:', error);
      alert(error.message);
      setPurchaseState('idle');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleGotIt = () => {
    setPurchaseState('idle');
    setPurchasedCards([]);
    setShowCompleteMessage(false);
    setIsAnimating(false);
    onClose();
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
  const leagueUpper = league.toUpperCase();

  const buttonStyle = {
    width: '60%',
    height: '6vh',
    opacity: isFree ? 1 : (userCoins >= currentPrice ? 1 : 0.7),
    cursor: isFree ? 'pointer' : (userCoins >= currentPrice ? 'pointer' : 'not-allowed'),
    transform: showPricePulse ? 'scale(1.05)' : 'scale(1)',
    transition: 'transform 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  };

  // ============================================================
  // СОСТОЯНИЕ УСПЕШНОЙ ПОКУПКИ — БЕЗ КРЕСТИКА
  // ============================================================
  if (purchaseState === 'success') {
    return (
      <div className="rewards-modal-overlay">
        {/* НАДПИСЬ PURCHASE COMPLETE! — С АНИМАЦИЕЙ */}
        {showCompleteMessage && (
          <div style={{
            position: 'absolute',
            top: '20%',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            color: '#FFD966',
            fontSize: 'clamp(18px, 5vw, 28px)',
            fontWeight: 700,
            padding: 'clamp(10px, 2vh, 16px) clamp(20px, 5vw, 32px)',
            borderRadius: 'clamp(10px, 2vw, 16px)',
            whiteSpace: 'nowrap',
            zIndex: 200,
            textTransform: 'uppercase',
            letterSpacing: '2px',
            border: '2px solid #FFD966',
            animation: isAnimating 
              ? 'purchaseCompletePop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, purchaseCompleteFlash 0.8s ease-out forwards, purchaseCompleteGlow 1s ease-out forwards'
              : 'purchaseCompleteGlow 2s ease-in-out infinite',
            boxShadow: isAnimating 
              ? '0 0 80px 40px rgba(255, 217, 102, 0.6), 0 0 200px 80px rgba(255, 217, 102, 0.3)'
              : '0 0 20px rgba(255, 217, 102, 0.15)',
            pointerEvents: 'none',
            transition: 'box-shadow 0.3s ease',
          }}>
            {isFree ? 'PACK CLAIMED!' : 'PURCHASE COMPLETE!'}
          </div>
        )}

        <div 
          className="rewards-modal no-summary" 
          style={{ 
            height: 'auto',
            minHeight: '35%',
            maxHeight: '65%',
            display: 'flex', 
            flexDirection: 'column',
            margin: 'auto auto',
            padding: '0',
            position: 'relative',
            width: '95%',
          }}
        >
          {/* КРЕСТИК УБРАН — ТОЛЬКО ЗАГОЛОВОК (пустой) */}
          <div className="rewards-header" style={{ top: '-8%', zIndex: 100, height: '0', minHeight: '0' }}>
            {/* Пустой заголовок — крестика нет */}
          </div>

          <div 
            className="rewards-winners-list" 
            style={{ 
              flex: 'none',
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              width: '97%',
              margin: 'auto',
              marginTop: '3%',
              gap: '2%',
              maxHeight: '87%',
              minHeight: '87%',
              overflow: 'hidden',
              padding: 0,
            }}
          >
            {/* НАЗВАНИЕ ТУРНИРА — РОВНО ПО ЦЕНТРУ МЕЖДУ ВЕРХНЕЙ ГРАНИЦЕЙ И GRID */}
            <div style={{
              textAlign: 'center',
              color: '#FFD966',
              fontSize: 'clamp(14px, 4vw, 18px)',
              fontWeight: 600,
              textTransform: 'uppercase',
              padding: 'clamp(4px, 1vh, 8px) 0',
              flexShrink: 0,
              width: '100%',
              borderBottom: '1px solid rgba(255, 217, 102, 0.2)',
            }}>
              {leagueUpper}: {formattedTournamentName}
            </div>

            {/* Grid из 5 карт */}
            <div className="selected-fighters-grid" style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(5, 1fr)', 
              gap: 'clamp(4px, 1vw, 8px)',
              width: '100%',
              padding: '0 clamp(2px, 1vh, 4px)',
              margin: 'clamp(4px, 2vh, 12px) 0',
              flex: 1,
              minHeight: 0,
            }}>
              {purchasedCards.map((sel: any, idx: number) => {
                const style = getFighterStyleFromSelected(sel.fighter);
                const styleIcon = getStyleIconFilename(style);
                const damageValue = sel.fighter['Total Damage'] || 0;
                
                return (
                  <div 
                    key={idx} 
                    className="selected-fighter-card" 
                    data-weight={sel.weightClass} 
                    style={{ 
                      backgroundColor: getWeightClassColor(sel.weightClass),
                    }}
                  >
                    <div className="selected-fighter-damage-box">{damageValue}</div>
                    <div className="selected-fighter-inner">
                      <div className="selected-fighter-icon-container">
                        <img 
                          src={`${BASE_URL}/icons/${styleIcon}`} 
                          alt={style} 
                          className="selected-fighter-icon" 
                          onError={(e) => { 
                            (e.target as HTMLImageElement).style.display = 'none'; 
                            const p = (e.target as HTMLImageElement).parentElement; 
                            if (p) { 
                              p.innerHTML = style === 'Striker' ? '👊' : style === 'Grappler' ? '🤼' : style === 'Universal' ? '⚡' : '👤'; 
                              p.style.fontSize = 'clamp(16px, 4vw, 20px)'; 
                            } 
                          }} 
                        />
                      </div>
                      <div className="selected-fighter-divider" style={{ color: getWeightClassColor(sel.weightClass) }}></div>
                      <div className="selected-fighter-name">{sel.fighter.Fighter}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* КНОПКА GOT IT! — ОСТАЁТСЯ */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            marginTop: '2vh',
            marginBottom: '2vh',
            width: '100%',
            flexShrink: 0,
          }}>
            <button 
              className="rewards-claim-button"
              style={{ width: '60%', height: '6vh' }}
              onClick={handleGotIt}
            >
              Got It!
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // СОСТОЯНИЕ ОЖИДАНИЯ — С КРЕСТИКОМ (закрыть можно)
  // ============================================================
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
                color: isFree ? '#4CAF50' : '#FFD966',
                fontSize: 'clamp(14px, 4vw, 18px)',
                fontWeight: 700,
                textTransform: 'uppercase',
                textShadow: isFree ? '0 0 5px rgba(76, 175, 80, 0.5)' : '0 0 5px rgba(255, 217, 102, 0.5)',
                lineHeight: 1.3,
              }}>
                {isFree ? '🎁 ' : ''}{itemName}
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
              {isFree 
                ? `Get 5 random fighter cards for the active ${leagueUpper} tournament with this FREE pack! (24h cooldown)`
                : `Get 5 random fighter cards for the active ${leagueUpper} tournament with this pack!`
              }
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
              'PROCESSING...'
            ) : isFree ? (
              <>
                GET FREE PACK
              </>
            ) : (
              <>
                CONFIRM PAYMENT: 
                <span style={{ 
                  fontWeight: 700, 
                  fontSize: 'clamp(16px, 4vw, 20px)',
                  marginLeft: '4px',
                  color: '#FFD966'
                }}>
                  {currentPrice}
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