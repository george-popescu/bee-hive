# Team Planning Monthly — Design

## Problem

Monthly view conține deja capacitate, alocări și ore realizate, dar prezintă prea multă informație simultan și nu urmează modelul simplificat din `05-team-planning-monthly.html`. Utilizatorul trebuie să vadă rapid tendința Alocat vs Realizat, să selecteze o singură celulă pentru detalii și să adauge lunile progresiv fără încărcarea inițială a întregului orizont.

## Approach

Folosim payload-ul lunar existent din Team Planning și îl prezentăm într-o componentă dedicată. Matricea pornește cu trei luni de la luna activă, fiecare celulă arată dominant procentul alocat din capacitatea disponibilă și o singură bară, iar markerul de realizat apare numai când există raportare. Selectarea celulei actualizează cardul de detalii cu persoană, lună, capacitate, alocat, realizat și variație; controlul `+ Add month` adaugă câte o lună și permite eliminarea doar a ultimei luni adăugate.

Alternativa de a păstra modurile separate Plan/Actual/Comparison în fiecare celulă a fost respinsă deoarece încalcă cerința unei informații dominante. Încărcarea tuturor lunilor din prima a fost respinsă deoarece aglomerează view-ul și contrazice controlul progresiv din template.

## Acceptance criteria

- [ ] Monthly view pornește cu trei luni consecutive de la luna activă și nu afișează inițial restul orizontului disponibil.
- [ ] Fiecare celulă afișează dominant procentul `alocat / capacitate disponibilă`, o stare distinctă pentru supra-alocare și markerul Realizat numai când există date reale.
- [ ] Selectarea unei celule actualizează un singur card de detalii cu persoana, luna, capacitatea, alocatul, realizatul și variația față de plan; o valoare Realizat necunoscută apare ca `—`.
- [ ] `+ Add month` adaugă exact o lună disponibilă, iar eliminarea ultimei luni adăugate nu coboară sub cele trei luni inițiale.
- [ ] Filtrul de rol păstrează o selecție validă și nu înlocuiește lipsa datelor cu zero.
- [ ] Matricea și cardul selectat sunt lizibile în light și dark la desktop, tabletă și mobil, cu scroll controlat pentru coloanele lunare.

## Out of scope

- Editarea alocărilor în cadrul acestui topic; editorul aparține topicului `allocation-editor`.
- Forecast-uri inventate pentru lunile fără ore realizate.
- Integrarea Sales OS.
- Înlocuirea datelor reale cu persoanele și orele demonstrative din HTML.
