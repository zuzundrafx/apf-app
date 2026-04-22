// src/components/StyleViewModal.tsx – окно просмотра выбранного стиля
import React from 'react';

interface StyleViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  style: 'striker' | 'grappler';
}

const StyleViewModal: React.FC<StyleViewModalProps> = ({ isOpen, onClose, style }) => {
  const BASE_URL = import.meta.env.PROD ? '' : '/reactjs-template';

  if (!isOpen) return null;

  const isStriker = style === 'striker';
  const title = isStriker ? 'STRIKER SKILLS' : 'GRAPPLER SKILLS';
  const gradientColors = isStriker 
    ? 'linear-gradient(180deg, #FF0000 0%, #8C1519 100%)'
    : 'linear-gradient(180deg, #FF9933 0%, #663300 100%)';
  const iconPath = isStriker 
    ? `${BASE_URL}/icons/Striker_style_icon.webp`
    : `${BASE_URL}/icons/Grappler_style_icon.webp`;

  return (
    <div className="rewards-modal-overlay" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div 
        className="rewards-modal no-summary" 
        style={{ 
          height: '90%',
          display: 'flex', 
          flexDirection: 'column',
          margin: '0',
          padding: '0'
        }}
      >
        <div className="rewards-header" style={{ top: '-4%' }}>
          <h2>{title}</h2>
          <button className="cancelled-modal-close" style={{ top: '120%' }} onClick={onClose}>✕</button>
        </div>

        <div 
          className="rewards-winners-list" 
          style={{ 
            flex: 'none',
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: '4%',
            height: '85%',
            width: '85%',
            padding: '4% 0',
            maxHeight: 'none',
            overflow: 'visible',
            margin: 'auto auto',
          }}
        >
          {/* Иконка стиля */}
          <div 
            style={{ 
              background: gradientColors,
              borderRadius: '20%',
              padding: '8%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 0 0.3vw #000000',
              width: '30%',
              aspectRatio: '1 / 1',
              marginBottom: '4%'
            }}
          >
            <div 
              style={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 0 0.6vw #000000',
                borderRadius: '20%',
                aspectRatio: '1 / 1',
                backgroundColor: '#141416',
                width: '100%',
                height: '100%'
              }}
            >
              <img 
                src={iconPath}
                alt={style}
                style={{ width: '70%' }}
              />
            </div>
          </div>

          {/* Заглушка для способностей */}
          <div style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2vh',
            marginTop: '4%'
          }}>
            <div style={{
              color: '#FFD966',
              fontSize: 'clamp(1.6vh, 4vw, 2.4vh)',
              fontWeight: 600,
              textAlign: 'center',
              textTransform: 'uppercase',
              letterSpacing: '0.1em'
            }}>
              Coming Soon
            </div>
            <div style={{
              color: '#FFFFFF',
              fontSize: 'clamp(1.2vh, 3vw, 1.8vh)',
              textAlign: 'center',
              opacity: 0.7,
              padding: '0 10%'
            }}>
              Abilities and skill tree for {style} style will be available in the next update.
            </div>
          </div>

          {/* Декоративные элементы (место под будущие способности) */}
          <div style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5vh',
            marginTop: '6%',
            opacity: 0.3
          }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{
                width: '100%',
                height: '6vh',
                background: '#313130',
                borderRadius: '1vw',
                border: '0.15vh solid #4A4A48',
                display: 'flex',
                alignItems: 'center',
                padding: '0 4%'
              }}>
                <div style={{
                  width: '4vh',
                  height: '4vh',
                  background: '#3D3D3B',
                  borderRadius: '0.8vw',
                  marginRight: '4%'
                }} />
                <div style={{
                  flex: 1,
                  height: '2vh',
                  background: '#3D3D3B',
                  borderRadius: '0.4vw'
                }} />
                <div style={{
                  width: '6vh',
                  height: '3vh',
                  background: '#3D3D3B',
                  borderRadius: '0.4vw'
                }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Кнопка закрытия */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        marginTop: '2vh',
        width: '85%',
        minHeight: '6vh'
      }}>
        <button 
          className="rewards-claim-button"
          style={{ width: '40%', height: '6vh' }}
          onClick={onClose}
        >
          CLOSE
        </button>
      </div>
    </div>
  );
};

export default StyleViewModal;