-- =====================================================================
-- VFN Hub — seed v7 (03/10/2026): coordenadas exatas, nomes dos estádios
-- e tipo de relvado (surface_type) das 27 equipas.
--
-- Correr no Supabase SQL Editor DEPOIS da secção "ATUALIZAÇÃO 03/10/2026 (v7)"
-- do schema.sql (que cria a coluna surface_type). Pode ser corrido várias vezes.
--
-- Nota: em teams o id já é o ID Zerozero (texto), por isso os updates usam
-- "where id = '<zerozero>'" (não existem as colunas zeroz_id nem short_name).
-- O VFN é encontrado pelo nome. Estes valores substituem as coordenadas
-- aproximadas da v6; depois podem ser ajustados na ficha da equipa (admin).
-- =====================================================================

-- ACD Vila Franca das Naves
update public.teams set stadium = 'Estádio do Picoto', stadium_lat = 40.72775674543088, stadium_lng = -7.263851375829965, surface_type = 'sintetica'
where name ilike '%vila franca das naves%';

-- AD Estação (16534) — só tem efeito se a equipa existir em teams
update public.teams set stadium = 'AD Estação', stadium_lat = 40.27873565596429, stadium_lng = -7.492592042604056, surface_type = 'sintetica' where id = '16534';

-- AD São Romão (8062)
update public.teams set stadium_lat = 40.4039710780703, stadium_lng = -7.718085364069243, surface_type = 'sintetica' where id = '8062';

-- Aguiar da Beira (3546)
update public.teams set stadium_lat = 40.81328872671574, stadium_lng = -7.533863324381012, surface_type = 'sintetica' where id = '3546';

-- Casal Cinza (11085)
update public.teams set stadium_lat = 40.54459629984038, stadium_lng = -7.169785625747845, surface_type = 'sintetica' where id = '11085';

-- CCR Vila Verde (338084)
update public.teams set stadium_lat = 40.45843618780508, stadium_lng = -7.780967036985622, surface_type = 'desconhecido' where id = '338084';

-- CD Gouveia (4344)
update public.teams set stadium_lat = 40.48610662985688, stadium_lng = -7.594021706671384, surface_type = 'relva_natural' where id = '4344';

-- Fornos de Algodres (3583)
update public.teams set stadium_lat = 40.62355462950386, stadium_lng = -7.543411956590184, surface_type = 'relva_natural' where id = '3583';

-- Freixo de Numão (11082)
update public.teams set stadium_lat = 41.060095475281834, stadium_lng = -7.219745264015369, surface_type = 'terra_batida' where id = '11082';

-- GD Foz Côa (6846)
update public.teams set stadium = 'Estádio Municipal São Sebastião dos Craques', stadium_lat = 41.094689489566036, stadium_lng = -7.186674569643134, surface_type = 'sintetica' where id = '6846';

-- Ginásio Figueirense (5668)
update public.teams set stadium_lat = 40.902445913849085, stadium_lng = -6.960102996727503, surface_type = 'relva_natural' where id = '5668';

-- Gonçalense (8063)
update public.teams set stadium = 'Campo da Cascalheira', stadium_lat = 40.41356091688201, stadium_lng = -7.343496783347236, surface_type = 'terra_batida' where id = '8063';

-- Manteigas (6837)
update public.teams set stadium = 'Estádio Municipal Eng.º Barjona de Freitas', stadium_lat = 40.40208734493109, stadium_lng = -7.548068366906284, surface_type = 'sintetica' where id = '6837';

-- Mileu Guarda (6306)
update public.teams set stadium = 'Campo de Jogos do Zambito', stadium_lat = 40.54395605970353, stadium_lng = -7.28223701391399, surface_type = 'sintetica' where id = '6306';

-- Os Vilanovenses (10485)
update public.teams set stadium = 'Estádio D. Aurélia de Moura', stadium_lat = 40.50642260551889, stadium_lng = -7.702648029328651, surface_type = 'sintetica' where id = '10485';

-- Paços da Serra (11073)
update public.teams set stadium = 'Campo Valentim Dias', stadium_lat = 40.45665327408921, stadium_lng = -7.636848610874382, surface_type = 'terra_batida' where id = '11073';

-- Palmares FC (391027) — sem relvado indicado; ATENÇÃO: estas coordenadas ficam a ~300 m
-- do estádio de Manteigas (40.4021, -7.5481). Confirmar se jogam no mesmo campo.
update public.teams set stadium_lat = 40.40252626645687, stadium_lng = -7.544375645245268 where id = '391027';

-- Pinhelenses (6843)
update public.teams set stadium = 'Estádio Municipal Carreira do Tiro', stadium_lat = 40.77624173724519, stadium_lng = -7.056305132644589, surface_type = 'sintetica' where id = '6843';

-- SC Celoricense (11074)
update public.teams set stadium = 'Estádio Municipal de Celorico da Beira', stadium_lat = 40.63248448721901, stadium_lng = -7.405315323266389, surface_type = 'relva_natural' where id = '11074';

-- SC Sabugal (6836)
update public.teams set stadium = 'Estádio Municipal do Sabugal', stadium_lat = 40.357385553650225, stadium_lng = -7.076832064301169, surface_type = 'relva_natural' where id = '6836';

-- Seia FC (16479)
update public.teams set stadium = 'Estádio Municipal de Seia', stadium_lat = 40.4153371218408, stadium_lng = -7.700846990597192, surface_type = 'desconhecido' where id = '16479';

-- Sp. Mêda (6841)
update public.teams set stadium = 'Estádio Dr. Augusto César de Carvalho', stadium_lat = 40.96703014899761, stadium_lng = -7.25988906469296, surface_type = 'sintetica' where id = '6841';

-- Trancoso (6839)
update public.teams set stadium = 'Estádio Municipal Dr. Fernando Lopes', stadium_lat = 40.78204990148157, stadium_lng = -7.356858412912375, surface_type = 'sintetica' where id = '6839';

-- UD Belmonte (12268)
update public.teams set stadium = 'Estádio Municipal de Belmonte', stadium_lat = 40.355565006076716, stadium_lng = -7.344191435341216, surface_type = 'sintetica' where id = '12268';

-- UFC Arcozelo (6840)
update public.teams set stadium = 'Campo de Jogos Santo Cristo', stadium_lat = 40.536088991893386, stadium_lng = -7.634706139062437, surface_type = 'desconhecido' where id = '6840';

-- Vila Cortez (6845)
update public.teams set stadium = 'Estádio 3 de Maio', stadium_lat = 40.60314299192389, stadium_lng = -7.302745878257569, surface_type = 'sintetica' where id = '6845';

-- Vilar Formoso (6838)
update public.teams set stadium = 'Campo José Júlio Balcão', stadium_lat = 40.60438253030508, stadium_lng = -6.8206117832547335, surface_type = 'sintetica' where id = '6838';

-- Verificação: equipas que ficaram sem coordenadas ou sem relvado
select id, name, stadium, stadium_lat, stadium_lng, surface_type
from public.teams
where stadium_lat is null or surface_type is null
order by name;
