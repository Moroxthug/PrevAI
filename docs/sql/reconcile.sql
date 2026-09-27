-- Riconciliazione dati prima/dopo la migrazione v1 → v2 (RUNBOOKS §5.3).
-- Sola lettura. Copre le 24 tabelle v1: conteggi + checksum delle tabelle con dati.
-- Uso: psql "<session URL>" -At -f docs/sql/reconcile.sql > reconcile-<before|after>.txt ; diff dei due file.
-- quotes.iva_percentuale cambia rappresentazione (22.00 → 22.000): normalizzata con ::numeric(10,2).

select 'count auth_account', count(*) from auth_account
union all select 'count auth_session', count(*) from auth_session
union all select 'count auth_user', count(*) from auth_user
union all select 'count auth_verification', count(*) from auth_verification
union all select 'count business_profiles', count(*) from business_profiles
union all select 'count collaborators', count(*) from collaborators
union all select 'count conversations', count(*) from conversations
union all select 'count email_events', count(*) from email_events
union all select 'count extra_costs', count(*) from extra_costs
union all select 'count incentives_catalog', count(*) from incentives_catalog
union all select 'count messages', count(*) from messages
union all select 'count price_catalog_items', count(*) from price_catalog_items
union all select 'count price_intelligence', count(*) from price_intelligence
union all select 'count project_assignments', count(*) from project_assignments
union all select 'count project_tasks', count(*) from project_tasks
union all select 'count projects', count(*) from projects
union all select 'count quote_attachments', count(*) from quote_attachments
union all select 'count quotes', count(*) from quotes
union all select 'count settings', count(*) from settings
union all select 'count suppliers', count(*) from suppliers
union all select 'count uploaded_documents', count(*) from uploaded_documents
union all select 'count whatsapp_connections', count(*) from whatsapp_connections
union all select 'count whatsapp_otp', count(*) from whatsapp_otp
union all select 'count whatsapp_sessions', count(*) from whatsapp_sessions;

select 'md5 quotes', md5(string_agg(
  id::text || subtotale || (iva_percentuale::numeric(10,2)) || iva_valore || totale || status
  || coalesce(numero_preventivo_data, '') || coalesce(items::text, '') || coalesce(capitoli::text, '') || coalesce(client_data::text, ''),
  ',' order by id)) from quotes;

select 'md5 auth_user', md5(string_agg(id || coalesce(name, '') || email || email_verified::text || created_at::text, ',' order by id)) from auth_user;

select 'md5 business_profiles', md5(string_agg(
  user_id || coalesce(company_name, '') || coalesce(vat_number, '') || coalesce(subscription_plan, '') || coalesce(subscription_status, '') || coalesce(stripe_customer_id, ''),
  ',' order by user_id)) from business_profiles;

select 'md5 incentives_catalog', md5(string_agg(
  id::text || level || coalesce(codice, '') || titolo || coalesce(regione, '') || coalesce(comune, '') || categoria_intervento || tipo_agevolazione || percentuale_massima::text || stato,
  ',' order by id)) from incentives_catalog;

select 'md5 conversations', md5(string_agg(id::text || coalesce(title, '') || status || created_at::text, ',' order by id)) from conversations;
select 'md5 messages', md5(string_agg(id::text || conversation_id::text || role || content, ',' order by id)) from messages;
