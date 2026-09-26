# ZenStar (Desktop / Windows)

Wersja przeglądarki ZenStar na Windows, zbudowana na Electronie (ten sam
silnik Chromium co w Chrome/Edge/Discordzie).

## Funkcje
- Karty
- Zakładki + **import zakładek z innej przeglądarki** (Chrome, Firefox, Edge)
- Historia
- Tryb incognito
- Adblock (przełączany w menu)
- Kolor motywu
- Menedżer haseł + import z CSV
- **SSL** — błąd certyfikatu ma teraz opcję "Nie przypominaj ponownie" dla danej strony
- **Pobrane pliki** — lista w menu, otwarcie pliku wymaga potwierdzenia ("Zatwierdź")
- **Ustaw folder pobierania** — możesz wskazać dowolny folder na dysku
- **Sprawdź aktualizacje** — porównuje wersję z najnowszym Release na GitHubie
  (repo `plszynon/zenstar-desktop`) i proponuje aktualizację

## Hasła

ZenStar ma teraz własny, prosty menedżer haseł:
- **Zapisz hasło dla tej strony** — ręcznie zapisuje login/hasło dla aktualnie otwartej strony
- **Hasła** (w menu) — lista zapisanych haseł, przycisk "Wypełnij" wstawia login+hasło
  w formularz logowania na otwartej stronie
- **Importuj hasła (CSV)** — wczytuje plik wyeksportowany z Chrome/Edge

**Jak wyeksportować hasła z Chrome/Edge:**
Ustawienia → Hasła i autouzupełnianie → Menedżer haseł → (⋮) → Eksportuj hasła

**Ważne — bezpieczeństwo:**
Hasła są szyfrowane na dysku (AES-256-GCM), ale klucz szyfrujący jest
przechowywany lokalnie obok danych — nie ma osobnego hasła głównego.
To znaczy, że każdy z dostępem do Twojego konta Windows i tej apki może
je odczytać (podobny model jak w Chrome bez blokady ekranu systemu).
To nie jest sejf klasy korporacyjnej — jeśli chcesz mocniejszej ochrony
(hasło główne blokujące dostęp), to osobna funkcja do dodania.

## Aktualizacje

Funkcja "Sprawdź aktualizacje" porównuje wersję z pola `version` w `package.json`
z najnowszym **Release** opublikowanym na GitHubie (nie ze zwykłym pushem kodu).
Żeby to działało, po każdej nowej wersji musisz:
1. Podbić numer w `package.json` (`"version": "1.1.0"`)
2. Zbudować `.exe` (Actions)
3. Utworzyć Release na GitHubie z tagiem pasującym do wersji (np. `v1.1.0`)
   i załączyć plik `.exe`

## Import zakładek z innej przeglądarki

Najpierw wyeksportuj zakładki ze starej przeglądarki do pliku HTML:

**Chrome / Edge:**
Menu → Zakładki → Menedżer zakładek → (⋮) → Eksportuj zakładki

**Firefox:**
Bibliteka (Ctrl+Shift+O) → Import i kopia zapasowa → Eksportuj zakładki do HTML

Potem w ZenStar: Menu → **"Importuj zakładki z innej przeglądarki"** → wskaż
wyeksportowany plik `.html`. Wszystkie zakładki zostaną dodane.

## Budowa pliku .exe (GitHub Actions)

Tak samo jak przy poprzednich projektach:

1. Wrzuć zawartość tego folderu do nowego repo na GitHubie
2. Zakładka Actions zbuduje plik `.exe` automatycznie (na maszynie z Windows)
3. Pobierz gotowy plik z sekcji Artifacts — to przenośny `.exe`,
   nie wymaga instalacji, wystarczy uruchomić
