// ================================
// AuthFrame
// Ozdobne obramowanie kart ekranów przed grą (login / rejestracja / reset /
// nowe hasło) jest teraz częścią `authPanelSx` (ta sama ramka PNG co na panelach
// w Home: narożniki + belki rasowe). Ten komponent zostaje jako no-op, żeby
// istniejące importy/uzycia <AuthFrame/> nadal działały bez zmian na stronach.
// ================================

export default function AuthFrame() {
  return null;
}
