/**
 * cn - Utility-Funktion zum Zusammenführen von CSS-Klassen
 *
 * Diese Funktion kombiniert:
 * - clsx: Ermöglicht bedingte Klassen wie { 'active': isActive }
 * - tailwind-merge: Löst Konflikte zwischen Tailwind-Klassen intelligent auf
 *
 * Beispiel für tailwind-merge:
 * cn('p-4', 'p-2') => 'p-2' (nicht 'p-4 p-2')
 *
 * Verwendung:
 * cn('btn', isActive && 'btn-active', className)
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Kombiniert mehrere CSS-Klassenwerte zu einem String
 *
 * @param inputs - Beliebige Anzahl von Klassen, Arrays oder Objekten
 * @returns Zusammengeführter Klassenstring ohne Duplikate/Konflikte
 *
 * @example
 * // Einfache Klassen
 * cn('text-red-500', 'font-bold') // => 'text-red-500 font-bold'
 *
 * @example
 * // Bedingte Klassen
 * cn('btn', isActive && 'btn-active') // => 'btn btn-active' oder 'btn'
 *
 * @example
 * // Konflikte werden aufgelöst
 * cn('p-4', 'p-2') // => 'p-2'
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
