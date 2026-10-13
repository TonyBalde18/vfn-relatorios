# Auditoria (V1.0)

Scripts usados na revisão V1.0, para repetir antes de cada versão. Correm com Node (≥ 22) e o Microsoft Edge instalado. Não gravam nada no Supabase.

## Páginas no browser — `driver.js`

Abre as 4 páginas em Edge headless, em todas as vistas, nos temas claro e escuro, a 375/768/1280 px. Recolhe:
- erros de consola e pedidos falhados;
- elementos que saem do ecrã (overflow horizontal);
- texto com contraste baixo;
- os pedidos ao Supabase de cada página.

```bash
node tools/auditoria/driver.js . /tmp/auditoria/todas.json            # tudo (demora ~15 min por página)
TEMAS=escuro LARGURAS=375 node tools/auditoria/driver.js . /tmp/rapido.json   # verificação rápida
node tools/auditoria/driver.js . /tmp/auditoria/public.json public     # só uma página
node tools/auditoria/resumo.js /tmp/auditoria/todas.json              # resumo agrupado
```

As páginas com login usam o `fake-supabase.js` no lugar da biblioteca do CDN:
- a sessão é simulada, com o papel de cada cenário (admin, treinador ou jogador);
- as leituras vão à base de dados real com a chave anon;
- as tabelas protegidas são trocadas pelas views públicas ou vêm vazias;
- as gravações não fazem nada.

Por isso, as vistas que dependem de relatórios, presenças ou multas só são testadas com os estados vazios.

## Código — análise estática

```bash
node tools/auditoria/mortas.js .    # funções declaradas que ninguém chama
node tools/auditoria/funcoes.js .   # nomes repetidos entre ficheiros, corpos iguais e funções com mais de 50 linhas
node tools/auditoria/globais.js .   # globais partilhados entre app.js, admin.js e modo-jogo.js
```
