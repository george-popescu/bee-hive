# PM BTL Validation — Design

## Problem

Board-ul generic pentru proiecte cu anexe trebuie validat pe structura reală BTL din ClickUp, unde estimările de livrare și activitatea operațională se află la niveluri diferite. Fără această validare există riscul de a dubla orele, de a trata valori contractuale necunoscute ca zero sau de a masca lipsa deadline-ului, responsabililor și identificatorului anexei. Template-ul 03 este un scenariu de acceptanță pentru board-ul generic din template-ul 02, nu un produs BTL separat.

## Approach

Extindem contractul generic al board-ului de anexe cu indicatori expliciți de calitate a datelor și îl verificăm cu un scenariu BTL construit din modele ClickUp. Estimările se agregă o singură dată la nivelul configurat pentru livrabile, iar orele efective vin din time entries ale taskurilor operaționale; valorile demonstrative din HTML rămân doar referință vizuală. Componenta generică de anexe, livrată de topicul `pm-annex-board`, afișează independent fiecare câmp lipsă și rămâne aceeași pentru BTL, MiM și alte proiecte de tip Deliverables.

Alternativa unui component sau a unei ramuri PHP dedicate BTL a fost respinsă deoarece ar duplica board-ul generic. Hardcodarea numerelor, persoanelor sau deadline-urilor din HTML a fost respinsă deoarece acestea trebuie să provină exclusiv din sincronizarea locală. Blocarea view-ului până la integrarea Sales OS a fost respinsă deoarece Sales OS este exclus din această etapă; datele contractuale indisponibile sunt marcate ca lipsă.

## Acceptance criteria

- [x] Selectarea proiectului BTL de tip Deliverables deschide același board generic de anexe folosit de celelalte proiecte, fără ramuri de UI sau service condiționate de numele BTL.
- [x] Bugetul estimat însumează o singură dată livrabilele de la nivelul configurat, iar orele consumate însumează time entries operaționale fără dublarea estimărilor părinte și copil.
- [x] Identificatorul anexei, deadline-ul contractual, responsabilul și datele de start/due lipsă sunt raportate separat; o valoare necunoscută apare ca `—` sau „Date lipsă”, niciodată ca `0` ori forecast inventat.
- [x] Overview, Livrabile și Timeline reproduc structura template-ului 03 cu nume, estimări, ore, responsabili și date provenite din baza sincronizată.
- [x] Codul de producție nu conține orele, oamenii, livrabilele sau deadline-urile demonstrative din `03-project-board-anexe-btl-exemplu.html`.
- [x] Scenariul BTL este lizibil în light și dark la desktop, tabletă și mobil, fără overflow necontrolat și fără erori JavaScript.

## Out of scope

- Integrarea sau simularea Sales OS.
- Un template, o rută sau o configurație hardcodată exclusiv pentru BTL.
- Modificarea taskurilor, estimărilor, responsabililor sau datelor în ClickUp.
- Implementarea board-ului generic din template-ul 02, care este o dependență obligatorie a acestui topic.
