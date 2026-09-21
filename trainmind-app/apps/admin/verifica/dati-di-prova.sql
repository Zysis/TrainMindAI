-- Dati di prova per i controlli. Quattro società scelte per coprire i casi che
-- contano: A completa, B ferma senza atleti, C troppo recente per essere
-- valutata, D di prova e quindi da escludere ovunque.
--
-- Le date NON sono sui confini (B è a 20 giorni, non a 30): un dato appoggiato
-- esattamente sul bordo di una finestra fa fallire il controllo per motivi di
-- millisecondi invece che di logica.

INSERT INTO organizations (id,name,slug,sport,tier,"createdAt","updatedAt","subscriptionTier","subscriptionStatus")
VALUES ('A','Basket Alfa','alfa','basketball','STARTER',now()-interval '60 days',now(),'starter','inactive'),
       ('B','Basket Beta','beta','basketball','PROFESSIONAL',now()-interval '20 days',now(),'professional','inactive'),
       ('C','Basket Gamma','gamma','basketball','ULTRA',now()-interval '3 days',now(),'ultra','inactive'),
       ('D','Pro Demo Basket','demo','basketball','PROFESSIONAL',now()-interval '90 days',now(),'professional','inactive');

-- Dal 20/09/2026 nome e cognome stanno in `user_identities`, e la console li
-- legge da li' con una JOIN. Vedi documentation/PIANO_SEPARAZIONE_IDENTITA.md
INSERT INTO users (id,email,"passwordHash",role,"isActive",locale,"organizationId","createdAt","updatedAt","lastLoginAt")
VALUES ('ua','a@reale.it','x','ADMIN',true,'it','A',now()-interval '60 days',now(),now()-interval '2 days'),
       ('ua2','t@reale.it','x','TRAINER',true,'it','A',now()-interval '59 days',now(),now()-interval '5 days'),
       ('ub','b@reale.it','x','ADMIN',true,'en','B',now()-interval '20 days',now(),now()-interval '15 days'),
       ('uc','c@reale.it','x','ADMIN',true,'es','C',now()-interval '3 days',now(),now()-interval '1 day'),
       ('ud','avispa@pro.com','x','ADMIN',true,'it','D',now()-interval '90 days',now(),now());
INSERT INTO user_identities ("userId","firstName","lastName")
VALUES ('ua','Anna','Rossi'),
       ('ua2','Tino','Verdi'),
       ('ub','Bruno','Bianchi'),
       ('uc','Carla','Neri'),
       ('ud','Demo','Utente');

-- Consensi: TERMS per tutti; MARKETING solo Anna (attivo) e Bruno (revocato).
-- Bruno serve a verificare che una revoca lo faccia sparire dall'elenco contatti.
INSERT INTO consent_records (id,"userId","docType","docVersion","acceptedAt",language)
VALUES ('c1','ua','TERMS','v1',now()-interval '60 days','it'),
       ('c2','ub','TERMS','v1',now()-interval '20 days','en'),
       ('c3','uc','TERMS','v1',now()-interval '3 days','es'),
       ('c4','ud','TERMS','v1',now()-interval '90 days','it'),
       ('c5','ua','MARKETING','2026-01-v1',now()-interval '60 days','it');
INSERT INTO consent_records (id,"userId","docType","docVersion","acceptedAt",language,"revokedAt")
VALUES ('c6','ub','MARKETING','2026-01-v1',now()-interval '20 days','en',now()-interval '5 days');

-- A compie tutti i passi entro sette giorni. B crea una squadra ma non mette
-- mai dentro nessuno: è il caso "societa da richiamare".
INSERT INTO teams (id,name,"organizationId","createdAt","updatedAt")
VALUES ('t1','Prima Squadra','A',now()-interval '59 days',now()),
       ('t2','Under 16','B',now()-interval '19 days',now());
INSERT INTO athletes (id,"birthYear",position,"isActive","organizationId","createdAt","updatedAt")
VALUES ('at1',2000,'PG',true,'A',now()-interval '58 days',now());
INSERT INTO athlete_identities ("athleteId","firstName","lastName","dateOfBirth")
VALUES ('at1','Luca','Mari','2000-01-01');
INSERT INTO training_sessions (id,title,duration,status,"isTemplate","aiModified","detailedByAttendance","organizationId","createdAt","updatedAt")
VALUES ('s1','Allenamento 1',90,'COMPLETED',false,false,false,'A',now()-interval '57 days',now());
INSERT INTO wellness_logs (id,"athleteId",date,"sleepHours","sleepQuality",fatigue,soreness,stress,mood,"mediaUrls","createdAt","updatedAt")
VALUES ('w1','at1',now()-interval '56 days',8,4,2,2,2,4,'{}',now()-interval '56 days',now());
INSERT INTO athlete_invites (id,"athleteId",email,token,status,"invitedById","organizationId","expiresAt","createdAt")
VALUES ('i1','at1','luca@x.it','tok1','ACCEPTED','ua','A',now()+interval '7 days',now()-interval '55 days');

-- Attività tracciata e consumo AI. La riga della demo (0,90 $) serve a
-- verificare che il filtro la tolga davvero dai costi.
INSERT INTO audit_logs (id,"userId","organizationId",action,"resourceType",method,path,"statusCode","createdAt")
VALUES ('l1','ua','A','athlete.read','athlete','GET','/api/v1/athletes',200,now()-interval '2 days'),
       ('l2','ua2','A','wellness.list','wellness_log','GET','/api/v1/wellness',200,now()-interval '1 day'),
       ('l3','ub','B','athlete.read','athlete','GET','/api/v1/athletes',200,now()-interval '15 days'),
       ('l4','ud','D','athlete.read','athlete','GET','/api/v1/athletes',200,now());
INSERT INTO ai_usage_logs (id,"organizationId","userId",operation,endpoint,model,provider,"promptTokens","completionTokens","totalTokens","costUsd","creditsCharged",success,estimated,"createdAt")
VALUES ('g1','A','ua','COACH','/ai/coach','gpt-4o-mini','openai',1000,500,1500,0.00123,0,true,false,now()-interval '3 days'),
       ('g2','D','ud','CHAT','/ai/chat','gpt-4o-mini','openai',900,300,1200,0.90000,0,true,false,now()-interval '1 day');
