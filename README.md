# TodoFlow

En lite mer avancerad todo-app i HTML/CSS/JavaScript med en liten backend för delad data.

Funktioner:
- Lägg till, redigera och ta bort uppgifter
- Prioriteter (låg, medel, hög)
- Deadlines och kategorier
- Sök, filtrera och rensa klara uppgifter
- Dark mode
- Delar tasks via backend när appen körs på Vercel

Backend och deployment:
- Den appen använder en serverless endpoint i [api/tasks.js](./api/tasks.js)
- För att få riktigt delade listor mellan olika användare rekommenderas Vercel + Supabase
- Sätt variablerna `SUPABASE_URL` och `SUPABASE_ANON_KEY` i Vercel project settings
- Om variabler saknas faller appen tillbaka till localStorage och lokal fil-lagring

Det fungerar bäst att publicera repo:t på Vercel. One.com kan hosta frontend, men kör normalt inte Node/API-funktioner automatiskt.
