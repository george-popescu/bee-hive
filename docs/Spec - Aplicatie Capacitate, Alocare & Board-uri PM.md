# Spec de proiect — Aplicație internă BEE CODED: Capacitate, Alocare & Board-uri PM

> Document pentru programator. Scop: construirea unei aplicații web noi (frontend + backend + bază de date), sincronizată cu ClickUp, cu **3 view-uri pe roluri**:
> 1. **Management** — Utilizare echipă (Est. vs Real.), overview la nivel de firmă. Acoperirea costului rămâne pentru o fază ulterioară, după clarificarea formulei.
> 2. **PM** — board-uri săptămânale per proiect, trase din ClickUp (un template configurabil: T&M sau livrabile/Gantt).
> 3. **Team Lead** — alocarea oamenilor pe proiecte (Plan în ore + Plan vs Realizat).
>
> Există deja **trei prototipuri HTML** care documentează comportamentul vizual dorit și oferă date pentru regresie:
> - `Capacity Board.html` + `capacity_data.json` — alocare + utilizare (view-urile Management și Team Lead).
> - `MiM_Board_PM_Iunie.html` — board PM stil **T&M** (săptămână/lună).
> - `La_Depozit_Board_PM_Saptamanal.html` — board PM stil **săptămânal cu Gantt** (livrabile).
>
> Sarcina nu e să portezi fișierele HTML, ci să construiești o aplicație reală: persistență în DB, API, sincronizare ClickUp și mai mulți utilizatori cu roluri. **Specificația scrisă este sursa regulilor de business**; prototipurile rămân referințe vizuale și seturi de date pentru regresie.

---

## 1. Context și obiectiv

BEE CODED planifică lunar câte ore ar trebui să lucreze fiecare persoană pe fiecare proiect (**planul**, în ore/lună), iar apoi compară cu orele efectiv raportate în time reporting (**realizatul**). Din aceste două seturi de date rezultă:

- cât e încărcată fiecare persoană față de norma ei lunară (**utilizare**);
- cât de bine se potrivește planul cu realitatea, pe fiecare pereche persoană × proiect (**plan vs realizat**).

Orizontul de planificare curent este **Mai 2026 → Dec 2026** (8 luni), dar numărul de luni trebuie să fie configurabil, nu hardcodat.

Obiectivul acestui modul (subsetul cerut acum din tot boardul):

1. Editarea planului de alocare (ore/lună per persoană × proiect).
2. Vizualizarea realizatului sincronizat din ClickUp și, pentru utilizatorii autorizați, introducerea de ajustări separate și auditate.
3. Vizualizarea **Plan vs Realizat** în paralel, cu semnalizare pe culori a abaterilor.
4. Vizualizarea **Utilizare echipă** (Est. vs Real. ca % din capacitatea disponibilă după concediu), cu semnalizare pe culori a supra/sub-încărcării.

Ce **nu** intră în prima versiune (doar de ținut cont la modelul de date): acoperirea costului până la clarificarea formulei, pipeline-ul comercial, P&L, marje și overhead-uri detaliate. Modelul de date le include ca referință unde este necesar.

---

## 1.5 Arhitectura pe 3 view-uri (pe roluri)

Aplicația e organizată în trei zone, fiecare pentru un rol, cu permisiuni diferite. Datele sunt partajate (aceeași bază de proiecte/persoane/ore); diferă doar ce vede și ce editează fiecare rol.

| View | Rol principal | Ce face | Sursa datelor | Detaliu în |
|---|---|---|---|---|
| **1. Management** | Management / owner | Overview: **Utilizare echipă** (Est. vs Real. ca % din capacitatea disponibilă). Cine e supra/sub-încărcat, la nivel de firmă, pe orizontul de luni. | Alocări (plan) + ore ClickUp + ajustări + concedii | §5 (tab Utilizare) + §4 |
| **2. PM** | Project Manager | Board **săptămânal per proiect**: ce s-a lucrat (plan vs realizat pe task), ce urmează, cine a lucrat, iar pentru proiecte cu livrabile — Gantt pe module. Un board per proiect. | ClickUp (taskuri, ore logate, estimări, status, deadline) | §6 (nou) |
| **3. Team Lead** | Team Lead | **Alocarea oamenilor** pe proiecte pe lună (Plan în ore ↔ % normă) și comparația **Plan vs Realizat**. Decide cine, cât, pe ce proiect. | Alocări (manual) + ore ClickUp | §5 (tab-urile Plan, Realizat, Plan vs Realizat) |

Note:
- View-urile **Management** și **Team Lead** lucrează la **granularitate lunară** (planificare de capacitate). View-ul **PM** lucrează la **granularitate săptămânală și pe task** (execuție).
- Legătura între ele: orele din ClickUp (nivel task, la PM) se agregă la nivel de persoană × proiect × lună și alimentează „Realizat" în Team Lead și „Real." în Management.
- Un utilizator poate avea mai multe roluri; view-urile sunt tab-uri de nivel superior, filtrate de permisiuni.
- Rolurile implicite sunt **Admin**, **Management**, **Team Lead** și **PM**, implementate cu `spatie/laravel-permission`. Permisiunile sunt configurabile de Admin și sunt cele care decid efectiv ce poate vedea sau edita un utilizator.
- **Admin** are implicit acces complet și poate administra rolurile și permisiunile.
- **Management** are implicit vizualizare globală și poate crea ajustări auditate pentru realizat.
- **Team Lead** poate edita implicit planul echipei sale și vede realizatul read-only.
- **PM** vede implicit proiectele alocate, poate edita planificarea săptămânală salvată în aplicație și vede realizatul read-only.
- Aceste valori implicite pot fi schimbate ulterior de Admin prin administrarea permisiunilor.

---

## 2. Glosar

| Termen | Sens |
|---|---|
| **Normă (fteHoursMonth)** | Orele standard pe lună ale unei persoane (ex. 138h). Poate diferi de la persoană la persoană. |
| **Plan / Alocare** | Ore planificate pe o persoană × proiect × lună. Se introduc în ore, se afișează și ca % din normă. |
| **Realizat (actual hours)** | Ore efectiv raportate în time reporting pe persoană × proiect × lună. |
| **Est. (estimat)** | Încărcarea planificată a persoanei într-o lună = suma orelor alocate, exprimată ca % din capacitatea disponibilă. |
| **Real.** | Încărcarea realizată = ore ClickUp plus ajustări, raportate la capacitatea disponibilă. |
| **Utilizare** | % din capacitatea disponibilă după concediu (fie estimat, fie realizat). |
| **Activitate internă** | Muncă în afara proiectelor din pipeline (ex. „[BEE CODED] Non-Project Tasks", „BriefCore"). Intră în utilizare, dar nu în costul proiectelor. |
| **Extern** | Persoană care apare în time reporting dar nu e în lista de echipă (colaborator ocazional). |
| **Concediu / TimeOff** | Zile de absență (odihnă, medical, neplătit) trase din ClickUp; reduc capacitatea disponibilă a lunii. |
| **Capacitate disponibilă** | Norma lunară minus orele de concediu din acea lună — baza reală față de care se măsoară utilizarea. |

---

## 3. Model de date

Structura de mai jos reflectă `capacity_data.json` din prototip. Trebuie normalizată într-o schemă de bază de date relațională (sau echivalent). Cheile de lună au forma `"YYYY-MM"` (ex. `"2026-05"`).

### 3.1 Entități

**Settings (configurare globală)**
- `months`: listă ordonată de luni active, ex. `["2026-05", ..., "2026-12"]`.
- `weeksPerMonth`: map `lună → nr. săptămâni` (folosit la conversii/afișări; ex. Mai=5, Iun=4).
- `defaultFteHoursMonth`: normă implicită pentru persoane noi (ex. `138`).
- `hoursPerLeaveDay`: ore echivalente pentru o zi de concediu (ex. `8`) — folosit la conversia zile → ore (§4.4).

**Person (persoană)**
- `name` (unic, folosit ca identificator de business — atenție la diacritice)
- `role`: unul din `{Architect, BA, PM, TTL, FE Dev, BE Dev, QA, UX/UI, Ai Engineer}` sau gol
- `hourlyRate`: tarif orar (pentru cost — nu e folosit în acest modul, dar există)
- `fteHoursMonth`: norma lunară a persoanei
- `monthlyCost`: map `lună → cost` (referință; nu e cerut în UI-ul acestui modul)

**Project (proiect)**
- `id` (ex. `"p4"`), `company`, `client`, `name`, `folder`
- `certainty`: probabilitate comercială 0–100 (referință)
- `type`, `revenue` (map `lună → venit`; referință)
- Etichetă afișată în UI: `client + " – " + name` (ex. „Dialectica – Mentenanta").

**Allocation (alocare / plan)** — o linie per persoană × proiect × rol
- `person` (→ Person.name)
- `projectId` (→ Project.id)
- `role`
- `hours`: map `lună → ore planificate`. **Aceasta este valoarea canonică stocată pentru plan.**
- Procentul de plan afișat se calculează ca `hours ÷ Person.fteHoursMonth`; nu este sursa de persistență a planului. Procentul de utilizare se calculează separat, față de capacitatea disponibilă după concediu (§4.2 și §4.4).

**ActualHours (realizat / time reporting)** — o linie per persoană × proiect
- `person`
- `projectId` (poate fi `null` pentru activități interne / proiecte din afara pipeline-ului)
- `project`: etichetă text (folosită când `projectId` e null, ex. „[BEE CODED] Non-Project Tasks")
- `hours`: map `lună → ore lucrate`
- Sursa este sincronizarea ClickUp; valorile importate nu sunt suprascrise prin editări manuale.

**ActualAdjustment (ajustare realizat)** — o corecție separată, auditabilă
- `person`, `projectId` sau etichetă internă, `month`
- `hoursDelta`: număr de ore pozitiv sau negativ adăugat peste realizatul sincronizat
- `reason`: motiv obligatoriu
- `createdBy`, `createdAt` și, dacă se permite modificarea, istoricul autorului și momentului fiecărei schimbări
- `realTotal` afișat = ore ClickUp sincronizate + suma ajustărilor aplicabile

**TimeOff (concediu / absență)** — o linie per persoană × perioadă
- `person`
- `type`: tip absență (ex. concediu odihnă, medical, neplătit) — util pentru raportare/culori
- `start`, `end`: interval calendaristic (date), SAU `hours`/`days` per lună dacă sursa dă direct agregat
- Derivat: `oreConcediu(persoană, lună)` = orele de absență care cad în luna respectivă (vezi §4.4).
- Sursa: **ClickUp** (vezi §9.2b). Se pot completa/corecta și manual în app.

**Task (task ClickUp — pentru View PM)** — nivel de execuție, sub proiect
- `clickupId` (pentru link `https://app.clickup.com/t/{id}`), `name`
- `projectId` (→ proiectul/folderul din care face parte)
- `status` (ex. to do, in progress, qa, ready for release, done — din ClickUp)
- `assignees`: listă de persoane
- `estimate`: ore estimate (câmpul „Time estimate" din ClickUp)
- `deadline` / `dueDate`
- `timeLogged`: ore logate, cu detaliu **per persoană și per săptămână** (din time entries) — se agregă pentru board și, la nivel lună, alimentează `ActualHours`
- pentru Gantt: `module`/`section`, `start`, `end`, `progress` (%)
- Sursa: **ClickUp** (§9.2), read-only în aplicație în scope-ul curent.

**WeeklyPlanning (planificare săptămânală PM)** — date deținute de aplicație
- `projectId`, `weekStart`, `taskClickupId`, `person`, `plannedHours`, `selected`
- Se salvează în baza de date a aplicației și nu face write-back în ClickUp în scope-ul curent.
- Păstrează autorul și momentele creării/modificării pentru audit operațional.

**(Referință, nu se editează în acest modul):** `contracts`, `mustRoles`, `overheads`. De păstrat în schemă pentru compatibilitate, dar fără UI aici. (Notă: `contracts.vacation` conține doar tipul politicii de concediu — „Not paid" / „Included in rate" / nr. zile contractuale — NU zilele efectiv luate; zilele efective vin din ClickUp.)

**Câmpuri noi pe Project** (setate în zona de Setări §10, nu din ClickUp):
- `contractType` = `TM` | `deliverables` — determină ce secțiuni afișează board-ul PM (§6.5).
- `pm` = listă de persoane (PM-ii alocați proiectului) — determină filtrarea din selectorul de PM (§6.0).
- `boardVisible` = bool — dacă proiectul apare ca tab în view-ul PM.

### 3.2 Reguli de integritate
- Planul se introduce și se persistă canonic în **ore**. Procentele sunt calculate la citire pentru afișare; schimbarea normei sau a concediului nu modifică retroactiv orele planificate.
- O persoană poate avea mai multe alocări pe același proiect (roluri diferite) — se însumează per lună.
- `actualHours` cu `projectId = null` = activitate internă; intră în utilizare, dar nu se atribuie unui proiect.
- Persoanele din `actualHours` care nu există în `people` = **externi**; se afișează separat, fără normă.
- Time entries și agregatele sincronizate din ClickUp rămân nemodificate. Orice corecție manuală se salvează ca `ActualAdjustment`, cu motiv, autor și audit.

---

## 4. Reguli de calcul (critic — definite de această specificație)

### 4.1 Conversii de bază
- `oreAlocate(alocare, lună) = alocare.hours[lună]`
- `planTotal(persoană, proiect, lună) = Σ oreAlocate` peste toate alocările acelei perechi
- `realClickUpTotal(persoană, proiect, lună) = Σ actualHours.hours[lună]` peste toate liniile sincronizate ale acelei perechi
- `realTotal(persoană, proiect, lună) = realClickUpTotal + Σ ActualAdjustment.hoursDelta`

### 4.2 Utilizare (view „Utilizare echipă")
Pentru fiecare persoană × lună:
- `oreEst = Σ allocation.hours[lună]` peste alocările persoanei
- `oreReal = Σ realTotal` ale persoanei, toate liniile inclusiv interne
- `Est% = oreEst ÷ capacitateDisponibilă × 100`
- `Real% = oreReal ÷ capacitateDisponibilă × 100`
- Media pe orizont: `Est_medie = medie(Est% pe toate lunile)`; `Real_medie = medie(Real% doar peste lunile care au time reporting sau ajustări)`.
- Dacă o lună **nu are** deloc time reporting și nici ajustări → se afișează `—` la Real. (nu `0%`).
- Dacă `capacitateDisponibilă = 0` (concediu toată luna), utilizarea nu se calculează și se afișează „concediu".

**Praguri de culoare pentru utilizare (badge):**
| Interval | Stare | Culoare |
|---|---|---|
| `> 105%` | supra-încărcat | roșu |
| `90% – 105%` | la limită | galben/portocaliu (warn) |
| `0% < u < 90%` | sub-încărcat | verde |
| `= 0%` | fără încărcare | gri (muted) |

La coloana de medie, `> 105%` se marchează roșu.

### 4.4 Concediu și capacitate disponibilă
- Conversie zile → ore: `oreConcediu = zile × settings.hoursPerLeaveDay` (zi standard configurabilă, ex. 8h). Dacă sursa dă interval `start–end`, se numără **zilele lucrătoare** din interval care cad în fiecare lună.
- `capacitateDisponibilă(persoană, lună) = fteHoursMonth − oreConcediu(persoană, lună)` (minim 0).
- **Efect asupra utilizării (Est./Real.):** denominatorul devine capacitatea disponibilă, nu norma brută. Astfel, cine e planificat 100% dar are și o săptămână de concediu apare **supra-încărcat** (semnal corect):
  - `Est% = oreEst ÷ capacitateDisponibilă × 100`
  - `Real% = oreReal ÷ capacitateDisponibilă × 100`
  - dacă `capacitateDisponibilă = 0` (concediu toată luna) → utilizarea nu se calculează, se afișează „concediu".
- Concediul se afișează separat ca indicator (ore/zile) pe lună, ca să fie vizibil de ce a scăzut capacitatea.

### 4.3 Abatere plan vs realizat (view „Plan vs Realizat")
Pentru fiecare pereche persoană × proiect × lună, cu `p = plan (ore)` și `r = realizat (ore)`:
- Dacă `p > 0`:
  - `|r - p| / p ≤ 0.10` → **verde** (realizat în ±10% din plan)
  - `r > p × 1.25` sau `r < p × 0.75` → **roșu** (abatere peste ±25%)
  - altfel → neutru (fără culoare)
- Dacă `p = 0` (fără plan) și `r > 0` → **roșu** (ore neplanificate)
- Dacă `p = 0` și `r = 0` → celulă goală (`·`)

Aceleași praguri se aplică și la sub-totalul per persoană (verde/roșu în funcție de realizat total vs plan total pe lună).

---

## 5. View-urile Team Lead & Management — pas cu pas

Aceste tab-uri acoperă **View 3 (Team Lead)** — pașii 1–3 (alocare la nivel lunar) — și **View 1 (Management)** — pasul 4 (utilizare). Tab-urile 1–3 sunt trei moduri ale aceluiași tabel de alocare (comutator segmentat: „📋 Plan (ore)" · „✅ Realizat (ore)" · „⇄ Plan vs Realizat"). Tab-ul 4 (Utilizare) e separat și e ecranul principal al managementului.

### Pas 1 — Tab „Plan (ore)" (editare plan) · rol: Team Lead
- Tabel: linii = persoană × proiect; coloane = câte una pe lună (din `settings.months`).
- Fiecare celulă e un **input numeric în ore** (step 0.25, min 0), iar valoarea în ore se persistă direct.
- Tooltip pe celulă: echivalentul calculat în % din norma lunară; utilizarea față de capacitatea disponibilă se afișează separat în view-ul Management.
- Header de coloane: eticheta lunii (ex. „Mai '26").
- **Rând de filtre** sub header: filtru pe persoană, pe proiect, pe rol. Afișează „X din Y rânduri" + buton „Resetează filtrele".
- Sub-total per persoană + total general pe fiecare lună.
- Text ajutător (hint) sub titlu care explică unitatea (ore) și conversia.

### Pas 2 — Tab „Realizat (ore)" (vizualizare și ajustări după permisiune)
- Același format ca planul, dar valorile de bază sunt **ore lucrate** sincronizate din ClickUp și sunt read-only.
- Utilizatorii cu permisiunea de ajustare pot adăuga o corecție pozitivă sau negativă, cu motiv obligatoriu. Ajustarea se salvează separat, cu autor și audit; nu modifică datele ClickUp.
- Implicit, Admin și Management au această permisiune, iar Team Lead și PM au acces read-only.
- Sub-totalul fiecărei persoane arată **realizat / plan** per lună, colorat cu regula de la §4.3 (verde ±10%, roșu >±25% sau ore neplanificate).

### Pas 3 — Tab „Plan vs Realizat — în paralel (ore)" (ecranul din primul screenshot)
- Pentru fiecare lună, **două sub-coloane**: „Plan" și „Real.".
- „Plan" = **doar citire** (vine din alocări).
- „Real." = total calculat din orele ClickUp și ajustările existente. Este read-only pentru utilizatorii fără permisiunea de ajustare.
- Pentru utilizatorii autorizați, acțiunea „Adaugă ajustare" cere diferența în ore și motivul; creează un `ActualAdjustment`, fără upsert în `actualHours`.
- Culoare pe valoarea „Real." conform §4.3 (text verde/roșu).
- Dacă luna nu are deloc time reporting, nu are ajustări și `r = 0` → se afișează `—`.
- **Adaugă pereche**: disponibil utilizatorilor cu permisiunea de ajustare, sus-dreapta, cu două dropdown-uri (persoană + proiect) și buton „＋ Adaugă pereche". Permite crearea unei ajustări pentru o pereche fără ore logate. Opțiunea „(intern / alt proiect)" cere o etichetă liberă (ex. „[BEE CODED] Non-Project Tasks") și creează ajustarea cu `projectId = null`.
- Perechile care sunt activități interne / în afara pipeline-ului se marchează cu un badge „≠" (nu există în pipeline).
- Persoanele externe (nu sunt în echipă) primesc badge „extern".
- Sub-total per persoană (Plan total / Real. total pe lună) + total general.
- Rând de filtre: persoană / proiect / rol.
- Sortare implicită: alfabetic după persoană, apoi după proiect (cu suport diacritice RO — `localeCompare(..., 'ro')`).

### Pas 4 — Tab „Utilizare echipă — Estimat vs Realizat" (ecranul din al doilea/al treilea screenshot) · rol: Management
- **Selector „Luni afișate"** în dreptul titlului (ex. 3 / 6 / Toate): controlează câte luni din orizont se afișează în tabel (de la luna curentă înainte). Implicit 6. Restrânge lățimea tabelului fără a schimba datele.
- Linii = persoane (toate cele cu normă > 0, cost pe vreo lună, sau vreo alocare).
- Pentru fiecare lună, **două sub-coloane**: „Est." și „Real.".
  - „Est." = badge cu `Est%` + text mic cu `oreEst` (ex. „60% 83h").
  - „Real." = badge cu `Real%` + text mic cu `oreReal`, sau `—` dacă luna nu are time reporting.
- Coloană finală „Medie" (Est. medie / Real. medie).
- **Concediu**: pe fiecare lună se afișează un mic indicator cu orele/zilele de concediu ale persoanei (ex. „🌴 3z" sau „24h") și, dacă e cazul, „concediu" în locul procentului când capacitatea disponibilă = 0. Utilizarea (Est./Real.) se raportează la capacitatea disponibilă conform §4.4.
- Culorile badge-urilor conform §4.2 (sub 90% verde, 90–105% galben, peste 105% roșu, 0 gri).
- **Externi**: listați la final, marcați „extern", fără normă/Est., doar cu ore realizate.
- Rând de filtre: persoană / rol / **proiect** (filtrul pe proiect arată doar persoanele cu alocări sau ore pe acel proiect).
- Legendă vizibilă deasupra tabelului: „sub 90%" (verde), „90–105%" (galben), „peste 105% – supra-încărcat" (roșu).
- Text ajutător care explică ce înseamnă Est. și Real.

---

## 6. View PM — Board săptămânal per proiect (sincronizat cu ClickUp)

**Referință vizuală:** `MiM_Board_PM_Iunie.html` (stil T&M) și `La_Depozit_Board_PM_Saptamanal.html` (stil livrabile/Gantt). Aceleași date ClickUp, un singur template configurabil (vezi §6.5).

### 6.0 Structură: un tab per proiect + selector de PM
- **Board-urile vin din proiectele ClickUp**: fiecare proiect (folder/list din ClickUp) generează automat **un tab de board** în view-ul PM. Lista de tab-uri = proiectele active din ClickUp; nu se creează manual.
- Sub titlul „📋 PM — Board...", o **bară de tab-uri orizontală**, câte un tab pentru fiecare proiect (ex. „Osiris – La Depozit", „Iancu Guda – MiM", …), cu o mică etichetă de tip (T&M / livrabile). Tab-ul selectat deschide board-ul acelui proiect.
- **Selector de PM în dreptul titlului** (dropdown, colț dreapta-sus): „Toți PM" + lista de PM. Selectând un PM, se **filtrează tab-urile** la proiectele **alocate acelui PM** (vezi §10 „Setări"). Astfel fiecare PM își vede rapid doar proiectele lui.
- Asocierea proiect → PM se face în zona de **Setări** (§10), nu se deduce automat.

### 6.1 Antet și navigare (comun)
- Titlu: „📦 {Nume proiect} — board PM" + un badge cu **tipul de contract** al proiectului („Time & Materials" / „Livrabile / Fixed").
- Comutator **perioadă**: „Săptămână" / „Lună" (stil MiM). La stilul săptămânal (La Depozit) perioada e fixă pe săptămâna curentă.
- Navigare înainte/înapoi între săptămâni/luni (◀ ▶) cu etichetă de interval (ex. „29 iun – 5 iul 2026").
- Comutator **mod**: „👁 Prezentare" (read-only, pentru ședințe cu clientul) / „✎ Editare".
- Modul Editare afectează planificarea săptămânală deținută de aplicație; câmpurile sincronizate din ClickUp rămân read-only.
- Buton **🔄 Refresh ClickUp** + text „ultima sincronizare" (snapshot/dată).
- **Săptămâna** = luni–duminică. Datele se agregă pe săptămâni; luna = suma săptămânilor din lună.

### 6.2 Bara de status (KPI rapide)
Pastile cu: `⏱ ore lucrate` (în perioadă), `📁 nr. proiecte`, `👥 nr. oameni activi`, `🗒 nr. taskuri planificate`. La nivel de proiect: `ore planificate`, `ore realizate`, `taskuri lucrate`, `taskuri planificate`.

### 6.3 Secțiuni ale board-ului (per proiect)
Board-ul are secțiuni sub formă de tab-uri/panouri. Setul complet (nu toate apar la orice tip de proiect — vezi §6.5):

1. **① Săptămâna anterioară / Ce am făcut** — tabel cu taskurile lucrate în perioadă:
   - Coloane: `Status` (badge colorat), `Task` (link ↗ către ClickUp), `Cine` (persoane + ore per persoană), `Ore planificate` (estimarea), `Ore realizate` (logat), `Progres total` (% = logat ÷ estimare).
   - Regulă culoare: dacă realizat > 110% din plan/estimare → **roșu** (depășire); progres >100% → roșu, altfel neutru/verde.
   - Total pe secțiune (plan vs realizat).
   - Orele estimate și realizate venite din ClickUp sunt read-only în scope-ul curent.

2. **② În progres (WIP) / Ce urmează** — taskurile active + de făcut:
   - Coloane: `Plan` (checkbox „lucrez săptămâna viitoare"), `Task` (link ClickUp), `Owner`, `Logat`, `Rămas` (estimare − logat), `Deadline`, `Progres` (% badge).
   - Grupare: active (grp 0) sus, „to do" (grp 1) la coadă.
   - `Rămas` negativ = peste estimare → semnalizat roșu.
   - Bifând un task pentru săptămâna viitoare, sub el se pot **aloca ore pe resursă** (vezi secțiunea 3).

3. **③ Planificare resurse** — încărcarea plănuită pentru săptămâna viitoare:
   - Pentru fiecare task bifat în „În progres", aloci ore pe persoană (`resursă: ore`).
   - Se afișează un **pool de resurse** cu capacitatea săptămânală a fiecăruia (din `resInfo`: nume, rol, ore/săptămână) și cât e deja alocat → cine mai are loc.
   - Total pe task și total pe resursă.
   - Selecțiile și orele alocate se persistă în `WeeklyPlanning`, în baza de date a aplicației.

4. **📅 Gantt (doar proiecte cu livrabile)** — grilă module × săptămâni:
   - Rânduri grupate pe **module/secțiuni** (ex. „CRM – Unified inbox"), fiecare task cu `owner`, `estimare`, `progres`, `status`, `start`, `end`, etichetă (T1, T2…).
   - Celule colorate pe săptămâni după status: `în progres` (albastru), `done` (verde), `pending` (portocaliu), `to do` (gri).
   - Marcaj vizual pe **săptămâna curentă** (linie roșie verticală).

5. **Rezumat** — KPI + bare „ore lucrate pe proiect" și „cine a făcut" (agregat), ca prima pagină a board-ului (stil MiM „Rezumat").

### 6.4 Sursa datelor și editare (ClickUp)
- Totul se trage din **ClickUp**, la nivel de **task**: nume, `id` (pentru link `https://app.clickup.com/t/{id}`), status, asignați, **ore logate** (time tracking), **ore estimate** (câmpul „Ore estimate"/„Time estimate"), deadline/due date, iar pentru Gantt: start/end și modulul (din nume/listă/tag).
- Agregarea pe săptămână se face după data time entry-ului; pe task se însumează orele per persoană.
- Datele sincronizate din ClickUp sunt **read-only**. Planificarea săptămânii viitoare este o suprapunere internă, salvată în aplicație și asociată taskurilor prin ID-ul ClickUp.
- Write-back-ul în ClickUp este în afara scope-ului curent și poate fi evaluat într-o fază ulterioară.
- Aceste ore logate (task-level) sunt **aceeași sursă** care, agregată la persoană × proiect × lună, alimentează „Realizat" din View-urile Team Lead și Management (§9.2).

### 6.5 Template configurabil (T&M vs Livrabile)
Un singur board, cu secțiuni activate după **tipul proiectului** (câmp pe proiect, sincronizat din ClickUp sau setat manual):
- **T&M** (ex. MiM): perioadă Săptămână/Lună, secțiunile „Ce am făcut", „Ce urmează", „Cine a făcut", „Rezumat". **Fără** Gantt. Accent pe ore lucrate.
- **Livrabile / Fixed** (ex. La Depozit): perioadă săptămânală, secțiunile „Săptămâna anterioară", „În progres", „Planificare resurse", „Gantt". Accent pe estimare vs consumat, deadline, progres pe livrabile.
- Configurarea per proiect: ce secțiuni sunt vizibile + eticheta de tip contract. Restul logicii (surse ClickUp, culori, linkuri) e comun.

---

## 7. Direcție vizuală (din screenshot-uri)

Aspectul general: tabele curate, dense, „spreadsheet-like", pe fundal alb, cu accente discrete de culoare doar pe indicatori.

- **Layout**: fiecare tab are un titlu (`h2`), un paragraf-hint gri sub titlu cu explicații, apoi un panou alb cu tabelul. Colțuri ușor rotunjite, linii de separare subțiri (`--line`, gri deschis).
- **Header de tabel pe două rânduri**: rândul 1 = luna (colspan 2, centrat, cu bordură stânga care separă lunile); rândul 2 = sub-coloanele („Plan"/„Real." sau „Est."/„Real.").
- **Antet/prima coloană sticky** (persoană, proiect/indicator) ca să rămână vizibile la scroll orizontal pe multe luni — recomandat.
- **Badge-uri de utilizare**: pastile rotunjite cu procent, colorate:
  - verde (`b-good`) = sub 90%
  - galben/portocaliu (`b-warn`) = 90–105%
  - roșu (`b-bad`) = peste 105%
  - gri (`b-mut`) = 0% / neutru / „extern" / „≠"
  - lângă badge, orele în text mic gri (11px), ex. „83h".
- **Valori plan vs realizat**: planul și totalul realizat sunt afișate ca valori; realizatul devine **verde** (în plan) sau **roșu** (abatere/neplanificat) după regula §4.3. Pentru utilizatorii autorizați există o acțiune separată de ajustare, nu editare inline a orelor ClickUp. `·` = fără valoare, `—` = fără time reporting pe luna respectivă.
- **Rândul de filtre**: fundal ușor diferit, dropdown-uri native, contor „X din Y" și buton de reset.
- **Sub-totaluri**: rând cu fundal gri foarte deschis (`#f8f9fb`), text „TOTAL {Persoană}".
- **Comutator de mod** (segmented control) pentru tab-urile 1–3: „📋 Plan (ore)" · „✅ Realizat (ore)" · „⇄ Plan vs Realizat".
- **Diacritice**: UI complet în română, cu diacritice corecte (ă, â, î, ș, ț). Sortări cu `localeCompare('ro')`.

Paleta de referință (din prototip): fundal alb, text închis, `--line` gri deschis, verde = ok/sub-încărcat, galben = la limită, roșu = supra-încărcat/abatere, gri = neutru. Se poate rafina, dar semnificația culorilor trebuie păstrată identică.

**Board PM (View 2)** are un stil ceva mai „card/dashboard" (vezi `MiM_...html` și `La_Depozit_...html`):
- KPI-uri sus în „carduri" gri cu cifră mare + etichetă; pastile de status colorate (⏱/📁/👥/🗒).
- Bare orizontale pentru „ore pe proiect" / „cine a făcut".
- Badge-uri de status task: done/qa/ready (verde), in progress/active (albastru), to do/blocked/backlog (gri).
- Butonul „🔄 Refresh ClickUp" în **mov ClickUp** (`#7b68ee`); taskurile sunt linkuri cu săgeată „↗".
- Gantt: celule colorate pe săptămâni (albastru = în progres, verde = done, portocaliu = pending, gri = to do), linie roșie pe săptămâna curentă.
- Modul „Prezentare" ascunde controalele planificării interne (aspect curat pentru ședințe cu clientul); „Editare" le afișează. Datele sincronizate din ClickUp rămân read-only în ambele moduri.

---

## 8. Backend & API

Aplicația folosește **PostgreSQL** în dezvoltarea locală, staging și producție. **SQLite** este permis exclusiv pentru testele automate. Cerințe minime de API (REST sau echivalent):

- `GET /settings`, `PUT /settings` — luni active, norme implicite, weeksPerMonth.
- `GET /people`, `POST/PUT/DELETE /people/:id` — echipă, roluri, normă.
- `GET /projects`, `POST/PUT/DELETE /projects/:id`.
- `GET /allocations`, `PUT /allocations` — upsert pe (persoană, proiect, rol, lună); valoarea canonică primită și stocată este în **ore**.
- `GET /actual-hours` — citește orele sincronizate din ClickUp și totalurile care includ ajustările; datele ClickUp nu au endpoint de editare manuală.
- `POST /actual-adjustments`, `PUT/DELETE /actual-adjustments/:id` — creează sau administrează ajustări separate, numai cu permisiunea necesară; motivul și auditul sunt obligatorii. Suport pentru `projectId = null` (intern).
- `GET /weekly-planning`, `PUT /weekly-planning` — citește și persistă selecțiile și orele planificării săptămânale PM în aplicație.
- Endpoint-uri de agregare pentru view-uri (opțional; calculul se poate face și pe frontend, dar recomandat pe backend pentru consistență):
  - utilizare per persoană × lună (Est%, Real%, ore) — View Management;
  - plan vs realizat per persoană × proiect × lună — View Team Lead;
  - **board PM per proiect**: taskuri (status, asignați, ore logate, estimare, deadline, module) agregate pe săptămână/lună — View PM (§6).
- `GET /projects/:id/board?period=week|month&anchor=YYYY-MM-DD` — datele board-ului PM pentru un proiect și o perioadă.
- **Integrare ClickUp** (§9):
  - `POST /sync/clickup` — declanșează sincronizarea (membri → persoane, foldere/liste → proiecte, time entries → actualHours + taskuri board PM, listă concedii → timeOff). Idempotent.
  - job programat pentru sync automat (nightly / la câteva ore) + `GET /sync/status` cu timestamp „ultima sincronizare".
  - integrarea este read-only; write-back-ul în ClickUp nu intră în scope-ul curent.
  - stocare securizată a credențialelor ClickUp (token/OAuth), nu în cod.
- `GET /time-off`, `PUT /time-off` — concedii (corectare manuală peste ce vine din sync).

**Reguli de scriere importante:**
- Orele din `actualHours` sunt scrise numai de sincronizarea ClickUp. Corecțiile utilizatorilor creează `ActualAdjustment` și nu suprascriu sursa.
- Fiecare ajustare are motiv, autor și istoric auditabil. Implicit, Admin și Management pot crea ajustări; Team Lead și PM au acces read-only la realizat.
- Planificarea săptămânală PM se persistă imediat în baza de date a aplicației.

**Nefuncționale:**
- Autentificare + roluri și permisiuni cu `spatie/laravel-permission`. Rolurile implicite sunt Admin, Management, Team Lead și PM; Admin poate gestiona permisiunile din aplicație.
- Autorizarea se verifică pe permisiuni, nu doar pe numele rolului.
- Istoric/audit obligatoriu pentru ajustările realizatului și modificările importante.
- Diacritice / UTF-8 peste tot (DB, API, UI).
- Performanță: tabele de ~20 persoane × ~35 proiecte × 8+ luni; trebuie să fie fluide (sticky headers, fără reflow greoi).

---

## 9. Sursa datelor (de unde vin datele)

Datele au **surse diferite** în funcție de tip. Acesta e un punct central al proiectului.

### 9.1 Persoane și proiecte — din ClickUp (sincronizare)
- **Persoanele** se sincronizează din **membrii workspace-ului ClickUp** (nume, eventual rol dacă e mapabil). Norma (`fteHoursMonth`) și tariful nu există în ClickUp → se completează/editează în app (implicit `settings.defaultFteHoursMonth`).
- **Proiectele** se sincronizează din **structura ClickUp** (folder/list). În prototip, gruparea proiectelor reale se face după **folderul ClickUp** — mai multe rânduri care împart același folder = un singur proiect real. Aplicația nouă trebuie să preia această logică: `Project.folder` = folderul ClickUp, iar `client`/`name` derivate din ierarhia ClickUp (Space/Folder/List).
- Sincronizarea trebuie să fie **idempotentă** (re-rularea nu duplică) și să nu șteargă alocările manuale când un proiect/persoană dispare din ClickUp (marchează ca inactiv, nu delete).

### 9.2 Realizatul (orele lucrate) — din ClickUp (API, automat)
- Orele realizate se trag automat din **time tracking-ul ClickUp** (time entries).
- Maparea: fiecare time entry are `user`, `task` → `list`/`folder`, `duration`, `start`. Se agregă la nivel de **persoană × proiect (folder) × lună** (`YYYY-MM` după data entry-ului) și se scriu în `actualHours.hours[lună]`.
- Orele pe task-uri care **nu** aparțin unui folder de proiect din pipeline (ex. task-uri interne, „Non-Project", „BriefCore") → `actualHours` cu `projectId = null` și etichetă text (activitate internă). Intră în utilizare, nu în costul proiectelor.
- Persoanele care au time entries dar nu sunt membri sincronizați = **externi** (afișați separat, fără normă).
- **Cadență de sync**: recomandat un job periodic (ex. la câteva ore / nightly) + buton „Sincronizează acum". De păstrat un timestamp „ultima sincronizare".
- ClickUp rămâne sursa de adevăr pentru orele pontate. Ajustările manuale sunt înregistrări separate, însumate la afișare, și nu sunt suprascrise de sincronizare.
- Crearea ajustărilor depinde de permisiune: implicit Admin și Management pot crea ajustări, iar Team Lead și PM văd realizatul read-only.

### 9.2b Concediile — din ClickUp (API, automat)
- Zilele de concediu/absență se trag din ClickUp și populează entitatea `TimeOff` (§3.1).
- **Sursa confirmată:** workspace `The BeeCoded Workspace` (`4591583`) → Space `HR Shared` (`8720055`) → lista folderless `Holidays (PTO)` (`67721810`).
- Fiecare task reprezintă o cerere/perioadă de concediu. Persoana vine din `assignees`, iar intervalul din `start_date` și `due_date`. Dacă există mai mulți asignați, se creează câte un `TimeOff` pentru fiecare persoană.
- Statusurile listei sunt `requires approval`, `on leave`, `approved` și `complete`. Doar `approved`, `on leave` și `complete` reduc capacitatea; `requires approval` rămâne vizibil, dar nu reduce capacitatea până la aprobare.
- Câmpul numeric `Vacation period` poate fi păstrat pentru control, însă numărul de zile lucrătoare se derivează canonic din `start_date`–`due_date`. Tipul implicit este `PTO` până când este identificat un tag sau câmp separat pentru odihnă / medical / neplătit.
- Intervalele se sparg pe luni și se numără **zilele lucrătoare** din fiecare lună (§4.4).
- Se sincronizează în același job cu restul (§9.2) și respectă aceeași cadență + buton „Sincronizează acum".

### 9.3 Planul (alocările) — manual în app
- Planul de alocare (`allocations.hours`) se introduce și se editează **manual** în aplicație (tab-ul „Plan (ore)"). Orele sunt valoarea canonică; procentul este calculat. Planul nu are sursă externă — este o decizie de planificare.
- Norma persoanei se editează manual.

### 9.4 Import inițial (one-off)
Pentru bootstrap, datele existente vin din `Capacity alocation - pana in Dec 2026.xlsx` și `capacity_data.json`:
- **Sheet „Alocări"**: `Client | Proiect | Persoană | Rol | <ore pe fiecare lună>` → alocări stocate direct în ore.
- **Sheet „Pe persoană"**: `Persoană | Normă (h/lună) | <ore pe lună>` = totaluri de control pentru validarea importului.
- `capacity_data.json` conține deja structura completă → cel mai simplu punct de plecare.

Livrează un script de import care populează DB-ul din JSON, apoi se comută pe sync-ul ClickUp pentru persoane/proiecte/realizat. Validează că totalurile per persoană/lună coincid cu sheet-ul „Pe persoană".

> **Conector ClickUp**: există deja un ClickUp conectat în mediul de lucru (time tracking + ierarhie de foldere). Dev-ul are nevoie de un token/OAuth ClickUp cu drepturi de citire pe workspace, membri, task-uri și time entries. Endpoint-uri ClickUp utile: workspace hierarchy, workspace members, time entries (filtrate pe interval), tasks/lists/folders.

---

## 10. Setări (administrare)

Zonă separată de configurare, accesibilă pe baza permisiunilor. Valorile implicite oferă acces Admin și, pentru configurările operaționale, Management. Conține:

### 10.1 Proiecte ↔ board & PM
- Lista de proiecte vine din **ClickUp** (§9.1). Pentru fiecare proiect se configurează:
  - **PM alocat** — cine e Project Manager-ul proiectului (una sau mai multe persoane). Acesta determină ce vede fiecare PM în selectorul din §6.0. Câmp nou: `Project.pm` (listă de persoane).
  - **Tip contract / template board** — `TM` sau `deliverables` (§6.5), care decide ce secțiuni afișează board-ul (cu/ fără Gantt).
  - Vizibilitatea board-ului (activ/ascuns), eticheta afișată, gruparea pe folder ClickUp.
- Maparea PM → proiecte se face **manual aici** (nu se deduce din alocări). Un PM poate avea mai multe proiecte; un proiect poate avea mai mulți PM.

### 10.2 Echipă
- Norma lunară (`fteHoursMonth`) și tariful per persoană (nu vin din ClickUp).
- Rolul principal al persoanei.

### 10.3 General
- Orizontul de luni (`settings.months`), `defaultFteHoursMonth`, `hoursPerLeaveDay`, `weeksPerMonth`.
- Configurarea sincronizării ClickUp: ID-uri de workspace/space, **lista de concedii** (§9.2b), cadența de sync, credențiale.
- Utilizatori, roluri și permisiuni prin `spatie/laravel-permission`.
- Roluri implicite: Admin, Management, Team Lead și PM. Administrarea permisiunilor este disponibilă implicit numai rolului Admin.

---

## 11. Livrabile și etape sugerate

1. **Schemă DB PostgreSQL + import** — modelul din §3, script de import din JSON, validare cu Excel; SQLite rămâne exclusiv pentru teste.
2. **API CRUD** — people, projects, allocations în ore, actualHours read-only, ajustări auditate, planificare săptămânală, timeOff și settings (§8).
3. **Integrare ClickUp** — sync membri → persoane, foldere/liste → proiecte, time entries → actualHours + taskuri board, listă concedii → timeOff; job programat + sync manual (§9).
4. **View Team Lead** — tab-urile Plan (ore), Realizat (ore), Plan vs Realizat: plan canonic în ore, procente calculate, filtre, totaluri, culori abatere (§5 pașii 1–3).
5. **View Management** — tab Utilizare echipă: Est/Real ca % din capacitatea disponibilă (normă − concediu), indicator concediu, badge-uri colorate, externi, filtre (§5 pas 4, §4).
6. **View PM — board per proiect** — secțiuni Ce am făcut / Ce urmează / Cine a făcut / Rezumat, linkuri ClickUp, moduri Prezentare/Editare, perioadă săptămână/lună (§6, stil MiM).
7. **View PM — extensie livrabile** — secțiunile În progres (WIP), Planificare resurse salvată în aplicație și Gantt pe module; template configurabil T&M vs livrabile (§6.3–§6.5, stil La Depozit).
8. **Auth + permisiuni** — integrare `spatie/laravel-permission`, rolurile implicite Admin / Management / Team Lead / PM și administrarea permisiunilor de către Admin.
9. **Zona de Setări** — proiecte ↔ PM + tip board, echipă (normă/tarif/rol), general (luni, sync ClickUp, utilizatori/roluri/permisiuni) (§10).
10. **Verificare**: calculele respectă această specificație, iar prototipurile HTML sunt folosite pentru regresie vizuală și validarea seturilor de date compatibile.

**Fază ulterioară, în afara scope-ului curent:** write-back ClickUp; acoperirea costului după clarificarea formulei și a sursei datelor.

---

## 12. Criterii de acceptare

- Pentru un set de date de regresie, valorile Est%/Real%/ore respectă formulele din această specificație, inclusiv raportarea la capacitatea disponibilă după concediu; prototipul `Capacity Board.html` este referință vizuală și de date, nu sursa regulilor.
- Board-ul PM reproduce, pentru un proiect, aceleași ore/taskuri/procente ca prototipurile MiM și La Depozit pentru aceeași perioadă.
- Rolurile implicite Admin, Management, Team Lead și PM văd și editează doar ce le permit capabilitățile configurate; Admin poate administra permisiunile.
- În view-ul PM apare **câte un tab per proiect** (din ClickUp), iar selectorul de PM filtrează tab-urile la proiectele alocate acelui PM (configurate în Setări).
- Selectorul „Luni afișate" din Management schimbă numărul de luni vizibile (3 / 6 / Toate).
- O ajustare „Real." creată de un utilizator autorizat persistă separat, cu motiv, autor și audit, și se reflectă imediat în „Utilizare echipă" fără a modifica orele ClickUp.
- Planificarea săptămânală PM persistă în aplicație și este disponibilă utilizatorilor autorizați după reîncărcare.
- Taskurile din board-ul PM au link funcțional către ClickUp (`/t/{id}`).
- Filtrele funcționează și afișează contorul „X din Y".
- Diacriticele se afișează și se sortează corect (RO).
- Orizontul de luni e configurabil (nu hardcodat pe Mai–Dec 2026).
