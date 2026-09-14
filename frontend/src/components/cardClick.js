// Wspólna obsługa klikania w całą kartę (sesja / konwersacja), a nie tylko w przycisk "Otwórz".

// Klik w przycisk, link, pole formularza albo element oznaczony data-no-card-click
// obsługuje sam ten element - karta nie powinna wtedy nic otwierać.
const INTERACTIVE_SELECTOR =
  'button, a, input, textarea, select, [role="button"], [data-no-card-click]';

export function isInteractiveTarget(e) {
  const target = e?.target;
  if (!target || typeof target.closest !== 'function') return false;
  return !!target.closest(INTERACTIVE_SELECTOR);
}

// Propsy dla kontenera karty: klik w dowolne "puste" miejsce otwiera,
// ale nie przechwytuje klików w przyciski/linki ani zaznaczania tekstu.
export function cardOpenProps(onOpen) {
  return {
    onClick: (e) => {
      if (isInteractiveTarget(e)) return;
      if (window.getSelection?.()?.toString()) return;
      onOpen(e);
    },
  };
}

export default cardOpenProps;
