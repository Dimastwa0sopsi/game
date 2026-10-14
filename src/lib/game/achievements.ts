// Achievements for Update 2.0
export interface Achievement {
  id: string;
  name: string;
  desc: string;
  icon: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first_block", name: "Первый блок", desc: "Сломай свой первый блок", icon: "⛏️" },
  { id: "craft_table", name: "Верстак!", desc: "Скрафти верстак", icon: "🔨" },
  { id: "furnace", name: "Горячо!", desc: "Скрафти печь", icon: "🔥" },
  { id: "copper", name: "Медный век", desc: "Добудь медную руду", icon: "🟠" },
  { id: "amethyst", name: "Фиолетовое сияние", desc: "Найди аметист", icon: "💜" },
  { id: "village", name: "Добро пожаловать!", desc: "Найди деревню", icon: "🏡" },
  { id: "trade", name: "Торговец", desc: "Соверши обмен с жителем", icon: "💰" },
  { id: "kill_mob", name: "Охотник", desc: "Победи моба", icon: "⚔️" },
  { id: "furnace_smelt", name: "Плавильщик", desc: "Переплавь руду в печи", icon: "♨️" },
  { id: "explorer", name: "Исследователь", desc: "Пройди 1000 блоков", icon: "🗺️" },
  { id: "diamonds", name: "Алмазы!", desc: "Добудь алмаз", icon: "💎" },
  { id: "lantern", name: "Да будет свет", desc: "Скрафти фонарь", icon: "🏮" },
];

export type AchievementProgress = Record<string, boolean>;
