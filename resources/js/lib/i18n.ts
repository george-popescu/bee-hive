export const supportedLocales = ['en', 'ro'] as const;

export type Locale = (typeof supportedLocales)[number];
export type TranslationReplacements = Record<string, number | string>;

const romanianMessages = {
    'Account settings': 'Setări cont',
    Administration: 'Administrare',
    Configure: 'Configurează',
    'Name, email, and ClickUp identity are read-only. Only internal data is managed here.':
        'Numele, emailul și identitatea ClickUp sunt read-only. Aici gestionezi doar datele interne.',
    'Primary role': 'Rol principal',
    'Monthly capacity (h)': 'Normă lunară (h)',
    'Weekly capacity (h)': 'Capacitate săptămânală (h)',
    'Hourly rate': 'Tarif orar',
    'Active in planning and reports': 'Activ în planificare și rapoarte',
    Save: 'Salvează',
    'The template, visibility, project managers, and board rules are local settings.':
        'Template-ul, vizibilitatea, PM-ii și regulile board-ului sunt configurații locale.',
    'Board template': 'Template board',
    'Deliverables / Fixed': 'Livrabile / Fixed',
    'Active project': 'Proiect activ',
    'Visible board': 'Board vizibil',
    'Project Managers': 'Project Managers',
    'Planning resource pool': 'Pool resurse pentru planificare',
    'Excluded recurring task IDs (one per line)':
        'ID-uri taskuri recurente excluse (unul pe linie)',
    'Save roles': 'Salvează roluri',
    'Save permissions': 'Salvează permisiuni',
    'General settings': 'Setări generale',
    'The active horizon and default values used in calculations.':
        'Orizontul activ și valorile implicite folosite de calcule.',
    'Period start': 'Început perioadă',
    'Period end': 'Sfârșit perioadă',
    'Default monthly capacity': 'Normă lunară implicită',
    'Hours / leave day': 'Ore / zi concediu',
    'Save settings': 'Salvează setările',
    'Operational settings, access, and the log of important changes.':
        'Configurații operaționale, acces și jurnalul schimbărilor importante.',
    Team: 'Echipă',
    Settings: 'Setări',
    Access: 'Acces',
    Audit: 'Audit',
    ':count synchronized people; ClickUp identity cannot be edited here.':
        ':count persoane sincronizate; identitatea ClickUp nu se editează aici.',
    'Weekly capacity': 'Cap. săpt.',
    'no email': 'fără email',
    automatic: 'automat',
    inactive: 'inactiv',
    'Projects and boards': 'Proiecte și board-uri',
    'Project manager mapping and templates are internal; project names remain synchronized.':
        'Maparea PM și template-ul sunt interne; numele proiectului rămâne sincronizat.',
    Template: 'Template',
    visible: 'vizibil',
    hidden: 'ascuns',
    'Users and roles': 'Utilizatori și roluri',
    'Default roles have safe permissions and can be adjusted by an administrator.':
        'Rolurile implicite vin cu permisiuni sigure, dar pot fi ajustate de Admin.',
    'Permissions by role': 'Permisiuni per rol',
    'The Admin role cannot lose the critical capabilities that prevent access lockout.':
        'Rolul Admin nu poate pierde capabilitățile critice care previn blocarea accesului.',
    'Audit log': 'Jurnal audit',
    'Latest :count important changes.':
        'Ultimele :count modificări importante.',
    Time: 'Moment',
    Subject: 'Subiect',
    Change: 'Schimbare',
    'All changes are audited': 'Toate modificările sunt auditate',
    Allocation: 'Alocare',
    'Allocation plan in hours, by team': 'Plan în ore, pe echipă',
    'Already have access?': 'Ai deja acces?',
    'An internal workspace': 'Spațiu intern de lucru',
    Actual: 'Realizat',
    'after leave': 'după concedii',
    'Authentication code': 'Cod de autentificare',
    'Authenticating...': 'Se autentifică...',
    'A new verification link has been sent to your account email address.':
        'Un nou link de verificare a fost trimis la adresa contului.',
    Back: 'Înapoi',
    Breadcrumb: 'Navigare',
    More: 'Mai mult',
    Loading: 'Se încarcă',
    Sidebar: 'Bară laterală',
    'Displays the mobile sidebar.': 'Afișează bara laterală pe mobil.',
    'Toggle sidebar': 'Comută bara laterală',
    'Back to': 'Înapoi la',
    'Board views by role': 'Board-uri pe roluri',
    'BEE CODED HiveOps access is available exclusively to users authorized by the platform administrator.':
        'Accesul la BEE CODED HiveOps este disponibil exclusiv utilizatorilor autorizați de administratorul platformei.',
    Capacity: 'Capacitate',
    'Capacity & Allocation': 'Capacitate și alocare',
    'Capacity, Allocation & Delivery': 'Capacitate, Alocare și Livrare',
    'Capacity, allocation and delivery': 'Capacitate, alocare și livrare',
    'Capacity and monthly variances': 'Capacitate și abateri lunare',
    'Capacity and allocation': 'Capacitate și alocare',
    Available: 'Disponibilă',
    'Choose a secure password for your HiveOps account.':
        'Alege o parolă sigură pentru contul tău HiveOps.',
    'Clear operations, in one place': 'Operațiuni clare, într-un singur loc',
    'ClickUp read-only': 'ClickUp read-only',
    'ClickUp read-only, role-based access and audited changes':
        'ClickUp read-only · acces pe roluri · modificări auditate',
    'ClickUp read-only time entries, audited adjustments, and fast signals for variances and over-allocation.':
        'Pontaje ClickUp read-only, ajustări auditate și semnale rapide pentru abateri și supra-alocare.',
    Close: 'Închide',
    Confirm: 'Confirmă',
    'Confirm access': 'Confirmă accesul',
    'Confirm password': 'Confirmă parola',
    'Confirm with a passkey': 'Confirmă cu passkey',
    'Confirm your access using one of your recovery codes.':
        'Confirmă accesul folosind unul dintre codurile tale de recuperare.',
    'Confirming...': 'Se confirmă...',
    Continue: 'Continuă',
    'Current language: :language': 'Limba curentă: :language',
    'Deliverables, resources and Gantt': 'Resurse, livrabile și Gantt',
    Dashboard: 'Dashboard',
    Repository: 'Repository',
    Documentation: 'Documentație',
    'Navigation menu': 'Meniu de navigare',
    'Email address': 'Adresă de email',
    'Email verification': 'Verificare email',
    English: 'English',
    'Enter the authentication code generated by your authenticator app.':
        'Introdu codul generat de aplicația ta de autentificare.',
    'Enter the email address for your internal account and we will send you a password reset link.':
        'Introdu adresa contului intern și îți trimitem un link de resetare.',
    'Enter your recovery code': 'Introdu codul de recuperare',
    'Every role sees exactly what it needs to decide.':
        'Fiecare vede exact ce are de decis.',
    'Forgot password?': 'Ai uitat parola?',
    'Full name': 'Nume complet',
    'Go to capabilities': 'Vezi capabilitățile',
    'Hide password': 'Ascunde parola',
    'HiveOps connects team planning with real ClickUp activity, without changing source data or maintaining parallel spreadsheets.':
        'HiveOps conectează planificarea echipei cu activitatea reală din ClickUp, fără să schimbe datele sursă și fără foi de calcul paralele.',
    'Hours by project': 'Ore pe proiect',
    'Hours over time': 'Evoluția orelor',
    'Hours over the selected period': 'Evoluția orelor în perioada selectată',
    'Hours grouped by week in :period.': 'Ore grupate pe săptămâni în :period.',
    'Hours grouped by day in :period.': 'Ore grupate pe zile în :period.',
    'Projects and internal activities ordered by consumption.':
        'Proiectele și activitățile interne ordonate după consum.',
    'Who worked': 'Cine a lucrat',
    "Each person's total contribution in the period.":
        'Contribuția totală a fiecărei persoane în perioadă.',
    'Project mix by person': 'Mixul de proiecte per persoană',
    "How each person's hours are split across the selected projects.":
        'Cum se împart orele fiecărei persoane între proiectele selectate.',
    task: 'task',
    tasks: 'taskuri',
    'In hours': 'În ore',
    'Internal application': 'Aplicație internă',
    Language: 'Limbă',
    Home: 'Acasă',
    Live: 'Live',
    'Log in': 'Autentificare',
    'Log out': 'Deconectare',
    'Monthly plan in hours, availability after leave, and clear visibility across teams and projects.':
        'Plan lunar în ore, disponibil după concedii și vizibilitate clară pe echipe și proiecte.',
    'New password': 'Parolă nouă',
    'No parallel reports': 'Fără rapoarte paralele',
    'One flow, multiple roles': 'Un flux, mai multe roluri',
    'Or continue with email': 'Sau continuă cu emailul',
    'Open application': 'Deschide aplicația',
    'Operational overview': 'Privire operațională',
    'Alternatively, you can ': 'Alternativ, poți ',
    Password: 'Parolă',
    Passkeys: 'Passkeys',
    'No passkeys yet': 'Nu există încă passkeys',
    'Add a passkey to sign in without a password':
        'Adaugă un passkey pentru autentificare fără parolă',
    'Manage your passkeys for passwordless sign-in':
        'Gestionează passkeys pentru autentificare fără parolă',
    'Passkeys are not supported in this browser.':
        'Acest browser nu suportă passkeys.',
    'Add passkey': 'Adaugă passkey',
    'Passkey name': 'Nume passkey',
    'e.g., MacBook Pro, iPhone': 'ex. MacBook Pro, iPhone',
    'A name helps you identify this passkey later.':
        'Numele te ajută să identifici acest passkey ulterior.',
    'Registering...': 'Se înregistrează...',
    'Register passkey': 'Înregistrează passkey',
    'Added :time': 'Adăugat :time',
    'Last used :time': 'Folosit ultima dată :time',
    Remove: 'Elimină',
    'Remove passkey': 'Elimină passkey',
    'Are you sure you want to remove the ":name" passkey? You will no longer be able to use it to sign in.':
        'Sigur vrei să elimini passkey-ul „:name”? Nu îl vei mai putea folosi pentru autentificare.',
    'Removing...': 'Se elimină...',
    'Delete account': 'Șterge contul',
    'Delete your account and all of its resources':
        'Șterge contul și toate resursele sale',
    Warning: 'Atenție',
    'Please proceed with caution, this cannot be undone.':
        'Continuă cu atenție; această acțiune nu poate fi anulată.',
    'Are you sure you want to delete your account?':
        'Sigur vrei să îți ștergi contul?',
    'Once your account is deleted, all of its resources and data will also be permanently deleted. Enter your password to confirm.':
        'După ștergerea contului, toate resursele și datele sale vor fi șterse definitiv. Introdu parola pentru confirmare.',
    'Manage your two-factor authentication settings':
        'Gestionează setările autentificării în doi pași',
    'You will be prompted for a secure, random PIN during login, available in the TOTP app on your phone.':
        'La autentificare ți se va cere un cod PIN sigur și aleatoriu, disponibil în aplicația TOTP de pe telefon.',
    'Disable 2FA': 'Dezactivează 2FA',
    'When you enable two-factor authentication, you will be prompted for a secure PIN during login. It is available in the TOTP app on your phone.':
        'După activarea autentificării în doi pași, ți se va cere un PIN sigur la login. Acesta este disponibil în aplicația TOTP de pe telefon.',
    'Continue setup': 'Continuă configurarea',
    'Enable 2FA': 'Activează 2FA',
    'Profile settings': 'Setări profil',
    Profile: 'Profil',
    'Update your name and email address':
        'Actualizează numele și adresa de email',
    Name: 'Nume',
    'Your email address is unverified.':
        'Adresa ta de email nu este verificată.',
    'Click here to re-send the verification email.':
        'Apasă aici pentru a retrimite emailul de verificare.',
    'A new verification link has been sent to your email address.':
        'Un nou link de verificare a fost trimis la adresa ta de email.',
    'Security settings': 'Setări de securitate',
    'Update password': 'Actualizează parola',
    'Ensure your account is using a long, random password to stay secure':
        'Folosește o parolă lungă și aleatorie pentru a-ți păstra contul în siguranță',
    'Current password': 'Parola curentă',
    'Appearance settings': 'Setări de aspect',
    'Update the appearance settings for your account':
        'Actualizează aspectul contului tău',
    'Manage your profile and account settings':
        'Gestionează profilul și setările contului',
    Security: 'Securitate',
    Appearance: 'Aspect',
    Light: 'Luminos',
    Dark: 'Întunecat',
    'Password recovery': 'Recuperare parolă',
    'Password reset': 'Resetare parolă',
    Plan: 'Plan',
    'Plan and actual': 'Plan și realizat',
    'Plan, capacity and execution in one view.':
        'Plan, capacitate și execuție în aceeași imagine.',
    'Planned vs. actual': 'Planificat vs. realizat',
    'PM boards': 'Board-uri PM',
    'PM boards powered by ClickUp': 'Board-uri PM alimentate din ClickUp',
    'by project': 'pe proiect',
    'Project Managers, Team Leads and Management use the same data, presented for their decisions.':
        'Aceleași date, prezentate diferit pentru Management, Team Leads și Project Managers.',
    'Recovery code': 'Cod de recuperare',
    'Remember me': 'Păstrează sesiunea activă',
    'Reset password link': 'Trimite linkul de resetare',
    'Resend verification email': 'Retrimite emailul de verificare',
    'Role-based access': 'Acces pe roluri',
    'Role-based access and a complete audit trail.':
        'Permisiuni explicite și audit complet.',
    Romanian: 'Română',
    'Save password': 'Salvează parola',
    'Set a new password': 'Setează o parolă nouă',
    'Show password': 'Arată parola',
    'Sign in to BEE CODED HiveOps with your internal account.':
        'Autentifică-te cu contul intern pentru a continua în BEE CODED HiveOps.',
    'Sign in to HiveOps for capacity, allocations, utilization, and PM boards powered by ClickUp.':
        'Intră în HiveOps pentru capacitate, alocări, utilizare și board-uri PM alimentate din ClickUp.',
    'Sign in to HiveOps': 'Intră în HiveOps',
    'Sign in with a passkey': 'Autentificare cu passkey',
    'Something went wrong.': 'Ceva nu a funcționat.',
    'Team planning connected to delivery.':
        'Planificarea echipei, conectată la livrare.',
    'Team utilization': 'Utilizare echipă',
    'Team planning': 'Planificare echipă',
    System: 'Sistem',
    'Team Leads': 'Team Leads',
    'The same data, without parallel reports.':
        'Aceleași date, fără rapoarte paralele.',
    'This is a secure area. Confirm your password before continuing.':
        'Aceasta este o zonă securizată. Confirmă parola înainte de a continua.',
    'T&M, deliverables, weekly planning and Gantt in one operational workspace.':
        'T&M, livrabile, planificare săptămânală și Gantt într-un singur spațiu operațional.',
    'Two-factor authentication': 'Autentificare în doi pași',
    '2FA recovery codes': 'Coduri de recuperare 2FA',
    'Recovery codes let you regain access if you lose your 2FA device. Store them in a secure password manager.':
        'Codurile de recuperare îți redau accesul dacă pierzi dispozitivul 2FA. Păstrează-le într-un manager de parole sigur.',
    'Hide recovery codes': 'Ascunde codurile de recuperare',
    'View recovery codes': 'Vezi codurile de recuperare',
    'Regenerate codes': 'Generează coduri noi',
    'Recovery codes': 'Coduri de recuperare',
    'Loading recovery codes': 'Se încarcă codurile de recuperare',
    'Each recovery code can be used once and is removed after use. Generate new codes when you need more.':
        'Fiecare cod de recuperare poate fi folosit o singură dată și este eliminat după utilizare. Generează coduri noi când ai nevoie.',
    'or, enter the code manually': 'sau introdu codul manual',
    'Two-factor authentication enabled':
        'Autentificarea în doi pași este activă',
    'Two-factor authentication is now enabled. Scan the QR code or enter the setup key in your authenticator app.':
        'Autentificarea în doi pași este acum activă. Scanează codul QR sau introdu cheia în aplicația de autentificare.',
    'Verify authentication code': 'Verifică codul de autentificare',
    'Enter the 6-digit code from your authenticator app':
        'Introdu codul de 6 cifre din aplicația de autentificare',
    'Enable two-factor authentication': 'Activează autentificarea în doi pași',
    'To finish enabling two-factor authentication, scan the QR code or enter the setup key in your authenticator app':
        'Pentru a finaliza activarea, scanează codul QR sau introdu cheia în aplicația de autentificare',
    'Use a password instead': 'Sau confirmă folosind parola',
    'use an authentication code': 'folosește un cod de autentificare',
    'use a recovery code': 'folosește un cod de recuperare',
    'View password': 'Arată parola',
    'We know who is available, where we work, and what we deliver.':
        'Știm cine este disponibil, unde lucrăm și ce livrăm.',
    'Weekly planning': 'Planificare săptămânală',
    Workspace: 'Spațiu de lucru',
    'Welcome back': 'Bine ai revenit',
    'Verify email address': 'Verifică adresa de email',
    'To continue, open the link we just sent to your email address.':
        'Pentru a continua, deschide linkul pe care tocmai l-am trimis pe email.',
    'Your password': 'Parola ta',
    ':count days': ':count zile',
    ':filtered of :total people · :months months':
        ':filtered din :total persoane · :months luni',
    'Act.': 'Real.',
    All: 'Toate',
    'All people': 'Toate persoanele',
    'All projects': 'Toate proiectele',
    'All roles': 'Toate rolurile',
    Average: 'Medie',
    'Est.': 'Est.',
    'Estimated values compare the plan against available capacity after leave. Actual values include ClickUp time entries and audited adjustments; “—” means the month has no reporting.':
        'Est. arată planul raportat la capacitatea disponibilă după concediu. Real. include pontajele ClickUp și ajustările auditate; „—” înseamnă că luna nu are raportare.',
    external: 'extern',
    'Internal activities': 'Activități interne',
    'Legend:': 'Legendă:',
    'Monthly capacity and utilization': 'Capacitate și utilizare lunară',
    'Months shown': 'Luni afișate',
    'on leave': 'concediu',
    'over 105% — overloaded': 'peste 105% — supra-încărcat',
    Person: 'Persoană',
    'Person filter': 'Filtru persoană',
    'Project filter': 'Filtru proiect',
    Reset: 'Resetează',
    Role: 'Rol',
    'Role filter': 'Filtru rol',
    'Team utilization — Estimated vs Actual':
        'Utilizare echipă — Estimat vs Realizat',
    'under 90%': 'sub 90%',
    ':count append-only records in the active period':
        ':count înregistrări append-only în perioada activă',
    ':count of :total rows': ':count din :total rânduri',
    ':count people': ':count persoane',
    ':percentage of monthly capacity': ':percentage din norma lunară',
    '1 person': '1 persoană',
    Action: 'Acțiune',
    active: 'activă',
    'Actual adjustment history': 'Istoric ajustări',
    'Actual hours come from ClickUp. Corrections are separate, audited adjustments, while planned hours remain editable for authorized users.':
        'Planul este editabil în ore, realizatul vine din ClickUp, iar corecțiile sunt ajustări separate și auditate.',
    'Add adjustment': 'Adaugă ajustare',
    'Add actual adjustment': 'Adaugă ajustare realizat',
    'Adjustment date': 'Data ajustării',
    'Adjustment reversed': 'Inversată',
    Author: 'Autor',
    Cancel: 'Renunță',
    'Choose a person': 'Alege persoana',
    'Choose a project': 'Alege proiectul',
    'Confirm reversal': 'Confirmă inversarea',
    'Describe the reason for the correction': 'Descrie motivul corecției',
    'Display mode': 'Mod afișare',
    'Enter a positive value to add hours and a negative value to subtract hours.':
        'Valoare pozitivă pentru adăugare, negativă pentru scădere.',
    'e.g. +2.5 or -1': 'ex. +2,5 sau -1',
    'Grand total': 'Total general',
    Hours: 'Ore',
    'Hours to add / subtract': 'Ore de adăugat / scăzut',
    'Hours could not be saved. The previous value was restored.':
        'Orele nu au putut fi salvate. Valoarea anterioară a fost restaurată.',
    Inactive: 'Inactiv',
    internal: 'intern',
    'Internal activity': 'Activitate internă',
    'Internal activity label': 'Etichetă activitate internă',
    'Monthly actual hours': 'Realizat lunar în ore',
    'Monthly plan in hours': 'Plan lunar în ore',
    'Moderate variance': 'Abatere moderată',
    'No capacity configured': 'Fără normă configurată',
    'No data': 'Fără date',
    'No people': 'Nicio persoană',
    'On plan (±10%)': 'În plan (±10%)',
    People: 'Persoane',
    'People filter': 'Filtru persoane',
    'Plan (hours)': 'Plan (ore)',
    'Actual (hours)': 'Realizat (ore)',
    'Plan vs Actual': 'Plan vs Realizat',
    Project: 'Proiect',
    'Project / activity': 'Proiect / activitate',
    Reason: 'Motiv',
    'Record adjustment': 'Înregistrează ajustarea',
    'read-only access': 'acces doar pentru citire',
    'Reason for reversal': 'Motivul inversării',
    reversal: 'inversare',
    reversed: 'inversată',
    Reverse: 'Inversează',
    'Reverse adjustment': 'Inversează ajustarea',
    'Significant variance (>25%)': 'Abatere semnificativă (>25%)',
    Status: 'Status',
    'The adjustment is audited and does not change the source time entries in ClickUp.':
        'Ajustarea este auditată și nu modifică pontajele sursă din ClickUp.',
    'The adjustment could not be reversed.':
        'Ajustarea nu a putut fi inversată.',
    'The adjustment was recorded.': 'Ajustarea a fost înregistrată.',
    'The adjustment was reversed.': 'Ajustarea a fost inversată.',
    'A reversing record of :hours hours will be created. The original history remains unchanged.':
        'Se va crea o înregistrare opusă de :hours ore. Istoricul original rămâne neschimbat.',
    'Total :name': 'Total :name',
    'Unplanned hours': 'Ore neplanificate',
    'Verify the adjustment data and try again.':
        'Verifică datele ajustării și încearcă din nou.',
    'actual hours are read-only': 'realizat doar pentru citire',
    ':count projects': ':count proiecte',
    ':count projects + internal': ':count proiecte + interne',
    ':count selections': ':count selecții',
    ':projects · :hours': ':projects · :hours',
    '1 selection': '1 selecție',
    'Active people': 'Oameni activi',
    'Active resources': 'Resurse active',
    'Active tasks': 'Taskuri active',
    'Active tasks are ordered by status and due date.':
        'Taskuri active ordonate după status și termen.',
    'All PMs': 'Toți PM-ii',
    'All projects · :hours': 'Toate proiectele · :hours',
    'Apply selection': 'Aplică selecția',
    'Available hours': 'Disponibil',
    'Available projects': 'Proiecte disponibile',
    'Capacity is configured per person. Totals come from hours assigned to selected in-progress tasks.':
        'Totalurile vin din orele alocate pe taskurile bifate în „În progres”. Capacitatea este configurabilă per persoană.',
    Contributors: 'Contribuitori',
    'Connection failed. The changes were not saved.':
        'Conexiunea a eșuat. Modificările nu s-au salvat.',
    'Custom selection': 'Selecție personalizată',
    'Deliverables Gantt': 'Gantt livrabile',
    'Due date': 'Termen',
    Edit: 'Editare',
    'Edit mode': 'Mod editare',
    Estimated: 'Estimat',
    'Estimated active tasks': 'Taskuri active estimate',
    'Estimate for worked tasks': 'Estimare taskuri lucrate',
    'In progress and to do': 'În progres și de făcut',
    'Intervals come from ClickUp start/deadline dates; the current week is highlighted.':
        'Intervalele provin din datele start/deadline ClickUp; săptămâna curentă este marcată distinct.',
    'Last synchronization failed:error': 'Ultima sincronizare a eșuat:error',
    'Last synchronization:': 'Ultima sincronizare:',
    Month: 'Lună',
    'Network error': 'Eroare de rețea',
    'No active internal resources.': 'Nu există resurse interne active.',
    'No active tasks.': 'Nu există taskuri active.',
    'No due date': 'fără termen',
    'No estimate': 'Fără estimare',
    'No people with time entries in the selected period.':
        'Nu există persoane cu pontaje în perioada aleasă.',
    'No projects available': 'Niciun proiect disponibil',
    'No time entries in the selected period.':
        'Nu există pontaje în perioada aleasă.',
    'Not yet': 'nu există încă',
    Overrun: 'depășire',
    Owner: 'Owner',
    'Ownership, due date and remaining effort compared with the ClickUp estimate.':
        'Ownership, termen și efort rămas față de estimarea ClickUp.',
    'People with time entries in the selected period.':
        'Persoanele cu pontaje în perioada selectată.',
    Period: 'Perioadă',
    'Period consumption': 'Consum în perioadă',
    'Plan :task': 'Planifică :task',
    'Planning changed in the meantime. Reload and try again.':
        'Planificarea s-a schimbat între timp. Reîncarcă și încearcă din nou.',
    'Planning targets the week starting :date. Configured recurring tasks are hidden here.':
        'Planificarea vizează săptămâna care începe la :date. Taskurile recurente configurate sunt ascunse aici.',
    Presentation: 'Prezentare',
    'Previous period': 'Perioada anterioară',
    'Previous week': 'Săptămâna anterioară',
    Progress: 'Progres',
    'Project delivery status from ClickUp: consumed effort, estimates, progress, and the active team for the selected period.':
        'Situația proiectului din ClickUp: efort consumat, estimări, progres și echipa activă în perioada aleasă.',
    Projects: 'Proiecte',
    'Refresh ClickUp': 'Actualizează ClickUp',
    Remaining: 'Rămas',
    Resource: 'Resursă',
    'Resource planning': 'Planificare resurse',
    'Resource planning — :date': 'Planificare resurse — :date',
    'Save hours': 'Salvează orele',
    Summary: 'Sumar',
    Task: 'Task',
    Tasks: 'Taskuri',
    'Tasks do not have start/deadline dates yet.':
        'Taskurile nu au încă date start/deadline.',
    'The current filter or your permissions do not include any projects visible on the board.':
        'Filtrul curent sau permisiunile tale nu includ proiecte vizibile în board.',
    'The weekly planning could not be saved.':
        'Planificarea nu a putut fi salvată.',
    'The weekly planning was saved.':
        'Planificarea săptămânală a fost salvată.',
    'The hours in :period; progress uses all historical time entries for the task.':
        'Orele din :period; progresul folosește toate pontajele istorice ale taskului.',
    'Top tasks by logged hours.': 'Primele taskuri după orele pontate.',
    Total: 'Total',
    Unassigned: 'Nealocat',
    Upcoming: 'Urmează',
    View: 'Vedere',
    Week: 'Săptămână',
    'Weekly board': 'Board săptămânal',
    'Worked in period': 'Lucrat în perioadă',
    'Worked tasks': 'Taskuri lucrate',
    'Worked hours': 'Ore lucrate',
    'Active team': 'Echipa activă',
    'Next period': 'Perioada următoare',
    ':count folders': ':count foldere',
    ':count records': ':count înregistrări',
    ':count signals': ':count semnale',
    ':elapsed of :total working days': ':elapsed din :total zile lucrătoare',
    ':hours as of the reporting date': ':hours până la data raportării',
    ':percent of capacity': ':percent din capacitate',
    ':value versus plan': ':value față de plan',
    ':count time entries · :hours analyzed in the selected period.':
        ':count pontaje · :hours analizate în perioada selectată.',
    'Actual hours': 'Ore realizate',
    Allocations: 'Alocări',
    'Allocations and audited adjustments':
        'Alocări lunare și ajustări auditate.',
    'Available after the month starts': 'Disponibil după începerea lunii',
    'Capacity, allocations and execution in one place, based on your access.':
        'Capacitate, alocări și execuție într-un singur loc, pe baza accesului tău.',
    'Capacity, planned and actual hours.':
        'Capacitate, planificat și realizat.',
    'Capacity and execution': 'Capacitate vs. execuție',
    'Capacity, planned hours and actual hours over time':
        'Evoluția capacității, orelor planificate și orelor realizate',
    'Clean data': 'Date curate',
    colleague: 'coleg',
    'ClickUp data': 'Date ClickUp',
    'ClickUp data quality': 'Calitatea datelor ClickUp',
    'Current dashboard month': 'Luna dashboardului',
    'Current scope has no people.': 'Nu există persoane în scope-ul curent.',
    Error: 'Eroare',
    'Final month forecast': 'Forecast final de lună',
    'First projects by planned and actual volume in :month.':
        'Primele proiecte după volumul planificat și realizat în :month.',
    'Hello, :name. Here is the big picture.':
        'Bun venit, :name. Iată imaginea de ansamblu.',
    'Impact projects': 'Proiecte cu impact',
    'Incomplete mappings': 'Mapări incomplete',
    'In progress': 'În desfășurare',
    'Last run: :time': 'Ultima rulare: :time',
    'Mapped people': 'Persoane mapate',
    'Mapped projects': 'Proiecte mapate',
    'Monthly capacity': 'Capacitate lunară',
    'Monthly evolution over the active period.':
        'Evoluție lunară în perioada activă.',
    'No alerts': 'Fără alerte',
    "No critical signals in this month's planning.":
        'Nu există semnale critice în planificarea lunii.',
    'No mapping issues found': 'Nu am găsit probleme de mapare',
    'No project activity in the focus month.':
        'Nu există activitate pe proiecte în luna de focus.',
    'No synchronization has run yet.': 'Nu există încă nicio sincronizare.',
    'No data yet for the active period.':
        'Nu există încă date pentru perioada activă.',
    'No previous month is available': 'Nu există o lună anterioară',
    'No next month is available': 'Nu există o lună următoare',
    'Not synchronized': 'Nesincronizat',
    'Operational areas': 'Zone operaționale',
    'Needs attention': 'Necesită atenție',
    'Next month': 'Luna următoare',
    Planned: 'Planificat',
    'Projects, delivery and time entries.': 'Proiecte, livrare și pontaje.',
    'Previous month': 'Luna anterioară',
    'Quick access based on your role and permissions.':
        'Acces rapid în funcție de rol și permisiuni.',
    'Role not set': 'Rol nesetat',
    Synchronized: 'Sincronizat',
    'Team, projects and access.': 'Echipă, proiecte și acces.',
    'Team members requiring attention': 'Echipa care cere atenție',
    'Time entries from :count person': '1 persoană cu pontaje',
    'Time entries from :count people': ':count persoane cu pontaje',
    'To watch': 'De urmărit',
    "Today's utilization": 'Utilizare până la zi',
    'The month has not started yet': 'Luna nu a început încă',
    'All analyzed time entries have an identifiable person and project.':
        'Toate pontajele analizate au persoană și proiect identificabile.',
    'Variances from planned capacity for the focus month.':
        'Abateri față de capacitatea planificată pentru luna de focus.',
    'Capacity: :hours': 'Capacitate: :hours',
    'Clear every selected task for this planning week? Allocated hours will be kept for later reuse.':
        'Ștergi selecția tuturor taskurilor din această săptămână de planificare? Orele alocate rămân salvate pentru reutilizare.',
    'Clear selection': 'Șterge selecția',
    'Connection failed. Please try again.':
        'Conexiunea a eșuat. Încearcă din nou.',
    End: 'Sfârșit',
    Estimate: 'Estimare',
    'Export CSV': 'Exportă CSV',
    'Export PDF': 'Exportă PDF',
    Logged: 'Pontat',
    Module: 'Modul',
    'No tasks selected for next week.':
        'Nu există taskuri selectate pentru săptămâna următoare.',
    'Planned next week': 'Planificat săptămâna următoare',
    'Selected next week': 'Selectate pentru săptămâna următoare',
    'Selected task allocations': 'Alocările taskurilor selectate',
    Start: 'Start',
    'The weekly planning could not be cleared.':
        'Selecția planificării săptămânale nu a putut fi ștearsă.',
    'To do': 'De făcut',
    'Total planned': 'Total planificat',
    ':count planned tasks were cleared.':
        'Selecția a fost ștearsă pentru :count taskuri planificate.',
    available: 'disponibil',
    'planned next week': 'planificate săptămâna următoare',
    'selected tasks': 'taskuri selectate',
    Pending: 'În așteptare',
} as const;

export type TranslationKey = keyof typeof romanianMessages;

export function isLocale(value: unknown): value is Locale {
    return supportedLocales.includes(value as Locale);
}

export function languageTag(locale: Locale): string {
    return locale === 'ro' ? 'ro-RO' : 'en-GB';
}

export function translate(
    locale: Locale,
    key: TranslationKey,
    replacements: TranslationReplacements = {},
): string {
    let message: string = locale === 'ro' ? romanianMessages[key] : key;

    for (const [name, value] of Object.entries(replacements)) {
        message = message.replaceAll(`:${name}`, String(value));
    }

    return message;
}
