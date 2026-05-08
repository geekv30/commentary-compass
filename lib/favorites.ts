export const FAVORITES = ['Harsha Bhogle', 'R Ashwin', 'Jatin Sapru'];

export function isFavorite(name: string): boolean {
  const lower = name.toLowerCase();
  return FAVORITES.some((fav) => {
    const favLower = fav.toLowerCase();
    if (lower.includes(favLower)) return true;
    const firstName = favLower.split(' ')[0];
    return firstName.length > 2 && lower.includes(firstName);
  });
}
