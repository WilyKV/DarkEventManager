// Couleurs par type de participant pour une expérience thématique

export const typeColors = {
  zombie: {
    light: {
      primary: "0 70% 50%", // Rouge sang
      primaryForeground: "0 0% 100%",
      accent: "0 60% 96%",
      accentForeground: "0 70% 50%",
      background: "0 10% 98%",
      border: "0 15% 88%",
    },
    dark: {
      primary: "0 75% 55%", // Rouge plus lumineux pour dark mode
      primaryForeground: "0 0% 100%",
      accent: "0 20% 18%",
      accentForeground: "0 75% 55%",
      background: "0 18% 9%",
      border: "0 15% 18%",
    }
  },
  survivant: {
    light: {
      primary: "142 70% 45%", // Vert forêt/survie
      primaryForeground: "0 0% 100%",
      accent: "142 50% 96%",
      accentForeground: "142 70% 45%",
      background: "142 10% 98%",
      border: "142 15% 88%",
    },
    dark: {
      primary: "142 75% 50%", // Vert plus lumineux
      primaryForeground: "0 0% 100%",
      accent: "142 20% 18%",
      accentForeground: "142 75% 50%",
      background: "142 18% 9%",
      border: "142 15% 18%",
    }
  },
  boutique: {
    light: {
      primary: "280 60% 55%", // Violet
      primaryForeground: "0 0% 100%",
      accent: "280 50% 96%",
      accentForeground: "280 60% 55%",
      background: "280 10% 98%",
      border: "280 15% 88%",
    },
    dark: {
      primary: "280 65% 60%",
      primaryForeground: "0 0% 100%",
      accent: "280 20% 18%",
      accentForeground: "280 65% 60%",
      background: "280 18% 9%",
      border: "280 15% 18%",
    }
  },
  repas: {
    light: {
      primary: "45 75% 56%", // Orange/jaune
      primaryForeground: "0 0% 100%",
      accent: "45 60% 96%",
      accentForeground: "45 75% 56%",
      background: "45 10% 98%",
      border: "45 15% 88%",
    },
    dark: {
      primary: "45 80% 58%",
      primaryForeground: "0 0% 100%",
      accent: "45 20% 18%",
      accentForeground: "45 80% 58%",
      background: "45 18% 9%",
      border: "45 15% 18%",
    }
  },
  default: {
    light: {
      primary: "15 65% 52%", // Terracotta par défaut
      primaryForeground: "0 0% 100%",
      accent: "30 12% 93%",
      accentForeground: "30 8% 12%",
      background: "30 15% 98%",
      border: "30 10% 88%",
    },
    dark: {
      primary: "15 68% 55%",
      primaryForeground: "0 0% 100%",
      accent: "20 15% 18%",
      accentForeground: "30 10% 96%",
      background: "20 18% 9%",
      border: "20 15% 18%",
    }
  }
};

export function getTypeColor(type: string) {
  const key = type.toLowerCase() as keyof typeof typeColors;
  return typeColors[key] || typeColors.default;
}
