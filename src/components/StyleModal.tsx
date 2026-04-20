// src/components/StyleModal.tsx – адаптивная версия
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
    <div className="rewards-modal-overlay">
      <div className="rewards-modal" style={{ height: '30%' }}>
        <div className="rewards-header">
          <h2>{getTitle()}</h2>
          <button className="cancelled-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="rewards-winners-list" style={{ 
          height: '90%',
          display: 'flex', 
          flexDirection: 'row', 
          justifyContent: 'center', 
          alignItems: 'center',
          gap: isConfirming || isStyleSelected ? '0' : '5%',
          flex: 1
        }}>
          {/* Striker */}
          {(!isConfirming || selectedStyle === 'striker' || currentStyle === 'striker') && (
            <div 
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                transform: (isConfirming && selectedStyle === 'striker') || currentStyle === 'striker' ? 'scale(1.2)' : 'scale(1)',
                transition: 'transform 0.3s ease'
              }}
            >
              <img 
                src={`${BASE_URL}/icons/Striker_style_icon.webp`}
                alt="Striker"
                style={{ 
                  width: 'clamp(80px, 25vw, 140px)', 
                  height: 'clamp(80px, 25vw, 140px)', 
                  cursor: !isStyleSelected && !isConfirming ? 'pointer' : 'default' 
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
                transform: (isConfirming && selectedStyle === 'grappler') || currentStyle === 'grappler' ? 'scale(1.2)' : 'scale(1)',
                transition: 'transform 0.3s ease'
              }}
            >
              <img 
                src={`${BASE_URL}/icons/Grappler_style_icon.webp`}
                alt="Grappler"
                style={{ 
                  width: 'clamp(80px, 25vw, 140px)', 
                  height: 'clamp(80px, 25vw, 140px)', 
                  cursor: !isStyleSelected && !isConfirming ? 'pointer' : 'default' 
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

        {/* Кнопки для подтверждения выбора (только при выборе нового стиля) */}
        {isConfirming && !isStyleSelected && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '5%', 
            padding: 'clamp(16px, 3vh, 24px) clamp(12px, 3vw, 20px)',
            marginBottom: 'clamp(16px, 3vh, 24px)'
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
    </div>
  );
};

export default StyleModal;