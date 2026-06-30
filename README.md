# Roda Certa

Aplicativo local em React para motoristas de aplicativo controlarem faturamento, combustível, alimentação, gastos extras e custos proporcionais do veículo.

## Como rodar

Instale as dependências e inicie o servidor local:

```bash
npm install
npm run dev
```

Depois acesse `http://localhost:5173/`.

Os dados ficam salvos localmente no navegador usando IndexedDB, com fallback em localStorage. Para levar os dados para outro computador, use o botão de exportar backup no topo da tela e importe o arquivo JSON na outra máquina.

## Dashboard

A tela inicial mostra indicadores e gráficos automáticos:

- Lucro líquido, faturamento, custos totais, custo por KM e consumo médio.
- Lucro por hora trabalhada e classificação da jornada.
- Meta líquida por ciclo com progresso, valor restante e necessidade diária.
- Estimativa de litros consumidos e custo de combustível por KM rodado.
- Gráfico de lucro e faturamento por dia.
- Gráfico de faturamento por app.
- Gráfico de composição dos custos.
- Gráfico de consumo médio comparado com a meta configurada.
- Indicadores detalhados como média por expediente, faturamento por KM, melhor e pior dia.

## Build

Para gerar a versão final estática:

```bash
npm run build
```

Os arquivos finais serão criados em `dist/`.

## Cálculos principais

- KM rodados: KM final menos KM inicial.
- Horas trabalhadas: diferença entre horário de início e fim do expediente. Se o fim for menor ou igual ao início, o sistema considera que terminou no dia seguinte.
- Combustível: o lucro usa uma estimativa de litros consumidos, calculada por KM rodado dividido pelo consumo esperado. O custo estimado usa o preço médio configurado ou, quando houve abastecimento no dia, o preço real por litro informado no abastecimento.
- Abastecimento: é opcional por expediente. Quando marcado, registra litros e valor pagos, mas o lucro do dia considera apenas o combustível estimado como consumido naquele expediente.
- Lucro por hora: lucro líquido dividido pelas horas trabalhadas.
- Qualidade da jornada: compara lucro por hora com os limites configurados para dia ruim, médio ou bom.
- Meta líquida do ciclo: soma o lucro líquido apenas dentro do ciclo ativo selecionado. Cada ciclo pode ter sua própria data inicial, data final e meta líquida.
- Seguro, limpeza e outros custos mensais: divididos por 30 para calcular a fração diária.
- Manutenção: KM rodados multiplicado pelo custo de manutenção por KM.
- Lucro líquido: faturamento total menos combustível, alimentação, extras, manutenção e custos fixos proporcionais.
