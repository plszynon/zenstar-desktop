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

## Jak zaimportować zakładki z innej przeglądarki

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
