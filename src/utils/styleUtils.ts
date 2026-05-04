// src/utils/styleUtils.ts – единая утилита для работы со стилями

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
export function getAvatarStyle(style: UserStyle): React.CSSProperties {
  const hasStyle = style === 'striker' || style === 'grappler';
  return {
    background: getStyleGradient(style),
    borderRadius: '10%',
    padding: hasStyle ? '3%' : '0',
    boxShadow: hasStyle ? '0 0 0 0.3vw #000000' : 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  };
}