// src/utils/styleUtils.ts – единая утилита для работы со стилями
import React from 'react';  // ← ДОБАВИТЬ

export type FighterStyle = 'striker' | 'grappler' | 'universal' | 'simple';
export type UserStyle = 'striker' | 'grappler' | null | undefined;

// Градиенты для стилей
export const STYLE_GRADIENTS: Record<string, string> = {
  striker: 'linear-gradient(180deg, #FF0000 0%, #8C1519 100%)',
  grappler: 'linear-gradient(180deg, #FF9933 0%, #663300 100%)',
  default: '#3D3D3B',
};

// Получить градиент по стилю
export function getStyleGradient(style: UserStyle): string {
  if (!style) return STYLE_GRADIENTS.default;
  return STYLE_GRADIENTS[style] || STYLE_GRADIENTS.default;
}

// Стили для аватарки
export function getAvatarWrapperStyle(style: UserStyle | undefined): React.CSSProperties {
  const hasStyle = style === 'striker' || style === 'grappler';
  return {
    background: hasStyle ? STYLE_GRADIENTS[style!] : 'transparent',
    borderRadius: '10%',
    padding: hasStyle ? '0.6vw' : '0',
    boxShadow: hasStyle ? '0 0 0 0.3vw #000000' : 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}

// Внутренняя аватарка (без обводки)
export function getAvatarInnerStyle(): React.CSSProperties {
  return {
    width: '100%',
    height: '100%',
    borderRadius: '8%',
    objectFit: 'cover',
  };
}