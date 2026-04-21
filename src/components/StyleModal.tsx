// src/components/StyleModal.tsx – финальная версия с правильными размерами
import React, { useState } from 'react';

interface StyleModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStyle: 'striker' | 'grappler' | null;
  onSaveStyle: (style: 'striker' | 'grappler') => Promise<void>;
}

const StyleModal: React.FC<StyleModalProps> = ({ isOpen, onClose, currentStyle, onSaveStyle }) => {
  const [selectedStyle, setSelectedStyle] = useState<'striker' | 'grappler' | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const BASE_URL = import.meta.env.PROD ? '' : '/reactjs-template';

  if (!isOpen) return null;

  const isStyleSelected = currentStyle !== null;
  const displayStyle = isStyleSelected ? currentStyle : selectedStyle;

  const handleStyleSelect = (style: 'striker' | 'grappler') => {
    setSelectedStyle(style);
    setIsConfirming(true);
  };

  const handleChangeStyle = () => {
    setSelectedStyle(null);
    setIsConfirming(false);
  };

  const handleAccept = async () => {
    if (!displayStyle || isSaving) return;
    setIsSaving(true);
    try {
      await onSaveStyle(displayStyle);
      onClose();
    } catch (error) {
      console.error('Failed to save style:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getTitle = () => {
    if (isStyleSelected) {
      return currentStyle === 'striker' ? 'STRIKER SKILLS' : 'GRAPPLER SKILLS';
    }
    return 'CHOOSE YOUR STYLE';
  };

  return (
    <div className="rewards-modal-overlay" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div 
        className="rewards-modal no-summary" 
        style={{ 
          height: '40vh',                // фиксированная высота в vh
          minHeight: '40vh',
          display: 'flex', 
          flexDirection: 'column',
          margin: '0',
          padding: '0'
        }}
      >
        <div className="rewards-header">
          <h2>{getTitle()}</h2>
          <button className="cancelled-modal-close" onClick={onClose}>✕</button>
        </div>

        <div 
          className="rewards-winners-list" 
          style={{ 
            flex: 1,                      // занимает всё доступное пространство
            display: 'flex', 
            flexDirection: 'row', 
            justifyContent: 'center', 
            alignItems: 'center',
            gap: '0%',
            height: '90%',
            width: '85%',      // компенсация внешних отступов из CSS
            padding: '0',
            maxHeight: 'none',            // убираем ограничение 65%
            overflow: 'visible'
          }}
        >
          {/* Striker */}
          {(!isConfirming || selectedStyle === 'striker' || currentStyle === 'striker') && (
            <div 
              style={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center',
                boxShadow: '0 0 0 0.8vw #f0bf21',
                borderRadius: '20%',
                aspectRatio: '1 / 1',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                gap: '5%',
                transform: (isConfirming && selectedStyle === 'striker') || currentStyle === 'striker' ? 'scale(1.2)' : 'scale(1)',
                transition: 'transform 0.3s ease'
              }}
            >
              <img 
                src={`${BASE_URL}/icons/Striker_style_icon.webp`}
                alt="Striker"
                style={{ 
                  width: '70%',
                  cursor: !isStyleSelected && !isConfirming ? 'pointer' : 'default',
                  borderRadius: '20%',
                  
                }}
                onClick={() => !isStyleSelected && !isConfirming && handleStyleSelect('striker')}
              />
              {(isConfirming && selectedStyle === 'striker') || currentStyle === 'striker' ? (
                <span style={{ 
                  color: '#FFFFFF', 
                  marginTop: 'clamp(8px, 2vh, 16px)', 
                  fontSize: 'clamp(14px, 4vw, 18px)', 
                  fontWeight: 600 
                }}>STRIKER</span>
              ) : null}
            </div>
          )}

          {/* Grappler */}
          {(!isConfirming || selectedStyle === 'grappler' || currentStyle === 'grappler') && (
            <div 
              style={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center',
                boxShadow: '0 0 0 0.8vw #f0bf21',
                borderRadius: '20%',
                aspectRatio: '1 / 1',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                gap: '5%',
                transform: (isConfirming && selectedStyle === 'grappler') || currentStyle === 'grappler' ? 'scale(1.2)' : 'scale(1)',
                transition: 'transform 0.3s ease'
              }}
            >
              <img 
                src={`${BASE_URL}/icons/Grappler_style_icon.webp`}
                alt="Grappler"
                style={{ 
                  width: '70%',
                  cursor: !isStyleSelected && !isConfirming ? 'pointer' : 'default',
                  borderRadius: '20%'
                }}
                onClick={() => !isStyleSelected && !isConfirming && handleStyleSelect('grappler')}
              />
              {(isConfirming && selectedStyle === 'grappler') || currentStyle === 'grappler' ? (
                <span style={{ 
                  color: '#FFFFFF', 
                  marginTop: 'clamp(8px, 2vh, 16px)', 
                  fontSize: 'clamp(14px, 4vw, 18px)', 
                  fontWeight: 600 
                }}>GRAPPLER</span>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Кнопки — за пределами модального окна */}
      {isConfirming && !isStyleSelected && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '5%', 
          marginTop: '2vh',
          width: '85%'
        }}>
          <button 
            className="rewards-claim-button"
            style={{ width: '40%' }}
            onClick={handleChangeStyle}
          >
            Change Style
          </button>
          <button 
            className="rewards-claim-button"
            style={{ width: '40%' }}
            onClick={handleAccept}
            disabled={isSaving}
          >
            {isSaving ? 'SAVING...' : 'Accept'}
          </button>
        </div>
      )}
    </div>
  );
};

export default StyleModal;