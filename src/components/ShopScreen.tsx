// src/components/ShopScreen.tsx
import React, { useState } from 'react';

interface ShopScreenProps {
  // В будущем добавим нужные пропсы
}

const ShopScreen: React.FC<ShopScreenProps> = () => {
  const [activeTab, setActiveTab] = useState<'free' | 'currency' | 'fightPass' | 'cardPacks'>('free');

  // Рекламные сообщения (будут меняться)
  const promotions = [
    "🎁 FREE daily reward! Claim now!",
    "🔥 Limited offer: 50% bonus on Currency packs!",
    "💎 Fight Pass: Get exclusive rewards!",
    "🃏 New Card Packs available!"
  ];

  const [currentPromotionIndex, setCurrentPromotionIndex] = useState(0);

  // Для демонстрации можно добавить ротацию рекламы (опционально)
  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPromotionIndex((prev) => (prev + 1) % promotions.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

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
        return (
          <div className="shop-empty-state">
            <div className="shop-empty-icon">🃏</div>
            <div className="shop-empty-text">Card Packs coming soon!</div>
            <div className="shop-empty-subtext">Purchase fighter cards and boost your collection</div>
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
    </div>
  );
};

export default ShopScreen;