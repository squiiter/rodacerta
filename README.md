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
- Combustível: usa o valor informado no expediente. Se o valor ficar vazio, estima pelo preço médio e consumo esperado configurados.
- Seguro, limpeza e outros custos mensais: divididos por 30 para calcular a fração diária.
- Manutenção: KM rodados multiplicado pelo custo de manutenção por KM.
- Lucro líquido: faturamento total menos combustível, alimentação, extras, manutenção e custos fixos proporcionais.
