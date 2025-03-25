let coinData = [];
let candleData = [];
let currentPrice = 0;
let wallet = {
  cash: 1000,  // Cash in SOL
  coinHolding: 0,
  invested: 0,
  soldValue: 0,
  avgBuyPrice: 0,
};
let buyPercent = 10;
let sellPercent = 10;
let isPaused = false;
let tradingHistory = [];
let candlePeriod = 3; // Reduced from 5 to 3 for faster candles
let ticksInCurrentCandle = 0;
let currentCandle = {
  open: 0,
  high: 0,
  low: Infinity,
  close: 0
};
let positions = []; // Array to track positions for visualization
let simulationTick = 0; // Track total ticks for consistent timing

function generateInitialData() {
  let price = Math.random() * 0.0009 + 0.0001;
  const initialData = [];
  
  // Generate initial candles first to ensure they are complete
  for (let i = 0; i < 20; i++) {
    const candle = {
      time: i,
      open: price,
      high: price,
      low: price,
      close: price
    };
    
    // Generate price movements within each candle
    for (let j = 0; j < candlePeriod; j++) {
      const changePercent = (Math.random() - 0.48) * 3;
      price = price * (1 + changePercent / 100);
      if (price < 0.00001) price = 0.00001;
      
      // Update candle high/low values
      candle.high = Math.max(candle.high, price);
      candle.low = Math.min(candle.low, price);
      
      // Last price in the candle becomes the close
      if (j === candlePeriod - 1) {
        candle.close = price;
      }
      
      // Add to price data array
      initialData.push({ time: i * candlePeriod + j, price: price });
    }
    
    // Add the fully formed candle
    candleData.push(candle);
  }
  
  coinData = initialData;
  currentPrice = price;
  simulationTick = initialData.length;
}

function updatePrice() {
  if (isPaused) return;
  
  // Increment the simulation tick
  simulationTick++;
  
  // Calculate which candle this tick belongs to
  const candleIndex = Math.floor(simulationTick / candlePeriod);
  
  // Generate new price
  let lastPrice = currentPrice;
  const random = Math.random();
  let changePercent;
  
  if (random > 0.995) {
    changePercent = (Math.random() * 10) + 5;
  } else if (random > 0.99) {
    changePercent = -((Math.random() * 10) + 5);
  } else {
    changePercent = (Math.random() - 0.48) * 3;
  }
  
  const newPrice = lastPrice * (1 + changePercent / 100);
  const finalPrice = Math.max(newPrice, 0.00001);
  currentPrice = finalPrice;
  
  // Add to price data array
  coinData.push({ time: simulationTick, price: finalPrice });
  if (coinData.length > 100) coinData.shift();
  
  // Check if we need to start a new candle
  const tickPositionInCandle = simulationTick % candlePeriod;
  
  if (tickPositionInCandle === 0) {
    // Start a new candle
    const newCandle = {
      time: candleIndex,
      open: finalPrice,
      high: finalPrice,
      low: finalPrice,
      close: finalPrice
    };
    
    // Add the new candle
    candleData.push(newCandle);
    
    // Keep only the most recent candles
    if (candleData.length > 30) {
      candleData.shift();
    }
  } else {
    // Update the current candle
    const currentCandle = candleData[candleData.length - 1];
    currentCandle.high = Math.max(currentCandle.high, finalPrice);
    currentCandle.low = Math.min(currentCandle.low, finalPrice);
    currentCandle.close = finalPrice;
  }
  
  renderChart();
  updatePortfolio();
}

function formatPrice(price) {
  if (price < 0.000001) return price.toExponential(6);
  if (price < 0.001) return price.toFixed(8);
  if (price < 1) return price.toFixed(6);
  return price.toFixed(2);
}

function renderChart() {
  // Map candle data to plotly format
  const times = candleData.map(candle => candle.time);
  const opens = candleData.map(candle => candle.open);
  const highs = candleData.map(candle => candle.high);
  const lows = candleData.map(candle => candle.low);
  const closes = candleData.map(candle => candle.close);
  
  // Define color scheme - changed to match dark theme
  const increasing = {line: {color: '#0aff04'}, fillcolor: '#0aff04'};
  const decreasing = {line: {color: '#ff0461'}, fillcolor: '#ff0461'};
  
  // Create candlestick chart
  const chartData = [{
    x: times,
    open: opens,
    high: highs,
    low: lows,
    close: closes,
    type: 'candlestick',
    increasing: increasing,
    decreasing: decreasing,
    name: 'DSIMULATOR/SOL'
  }];
  
  // Add position markers to chart
  if (wallet.avgBuyPrice > 0 && wallet.coinHolding > 0) {
    // Add average position price as a horizontal line
    chartData.push({
      x: times,
      y: Array(times.length).fill(wallet.avgBuyPrice),
      type: 'scatter',
      mode: 'lines',
      line: {
        color: '#00ccff',
        width: 2,
        dash: 'dash'
      },
      name: 'Avg Entry'
    });
  }
  
  // Add trade markers
  if (positions.length > 0) {
    // Get only the last 5 buy and sell positions for cleaner visualization
    const buyPositions = positions.filter(pos => pos.type === 'BUY').slice(-5);
    const sellPositions = positions.filter(pos => pos.type === 'SELL').slice(-5);
    
    if (buyPositions.length > 0) {
      chartData.push({
        x: buyPositions.map(pos => {
          // Find the nearest candle time
          const nearestCandleIndex = Math.floor(pos.time / candlePeriod);
          return nearestCandleIndex;
        }),
        y: buyPositions.map(pos => pos.price),
        type: 'scatter',
        mode: 'markers',
        marker: {
          symbol: 'triangle-up',
          size: 12,
          color: '#0aff04',
        },
        name: 'Buy'
      });
    }
    
    if (sellPositions.length > 0) {
      chartData.push({
        x: sellPositions.map(pos => {
          // Find the nearest candle time
          const nearestCandleIndex = Math.floor(pos.time / candlePeriod);
          return nearestCandleIndex;
        }),
        y: sellPositions.map(pos => pos.price),
        type: 'scatter',
        mode: 'markers',
        marker: {
          symbol: 'triangle-down',
          size: 12,
          color: '#ff0461',
        },
        name: 'Sell'
      });
    }
  }
  
  const layout = {
    title: {
      text: 'DSIMULATOR/SOL Price',
      font: { color: '#fff' }
    },
    paper_bgcolor: '#1a0000',
    plot_bgcolor: '#1a0000',
    xaxis: {
      title: 'Time',
      rangeslider: {
        visible: false
      },
      color: '#fff',
      gridcolor: '#330000'
    },
    yaxis: {
      title: 'Price (SOL)',
      autorange: true,
      color: '#fff',
      gridcolor: '#330000',
      tickformat: '.8f'
    },
    legend: {
      font: { color: '#fff' }
    }
  };
  
  const config = {
    responsive: true
  };
  
  Plotly.newPlot('chart', chartData, layout, config);
}

function updatePortfolio() {
  const pnl = wallet.coinHolding * currentPrice - wallet.invested + wallet.soldValue;
  const pnlPercent = wallet.invested > 0 ? (pnl / wallet.invested) * 100 : 0;
  const remainingValue = wallet.coinHolding * currentPrice;
  const unrealizedPnL = wallet.coinHolding * currentPrice - wallet.invested;
  const unrealizedPnLPercent = wallet.invested > 0 ? (unrealizedPnL / wallet.invested) * 100 : 0;
  const realizedPnL = wallet.soldValue - (wallet.invested > 0 ? wallet.invested : 0);
  
  document.getElementById('portfolio-details').innerHTML = `
    <div>Cash:</div><div>${wallet.cash.toFixed(4)} SOL</div>
    <div>Coins:</div><div>${wallet.coinHolding.toFixed(2)} DSIMULATOR</div>
    <div>Invested:</div><div>${wallet.invested.toFixed(4)} SOL</div>
    <div>Current Value:</div><div>${remainingValue.toFixed(4)} SOL</div>
    <div>Realized P&L:</div><div class="${realizedPnL >= 0 ? 'profit' : 'loss'}">${realizedPnL.toFixed(4)} SOL</div>
    <div>Unrealized P&L:</div><div class="${unrealizedPnL >= 0 ? 'profit' : 'loss'}">${unrealizedPnL.toFixed(4)} SOL (${unrealizedPnLPercent.toFixed(2)}%)</div>
    <div>Total P&L:</div><div class="${pnl >= 0 ? 'profit' : 'loss'}">${pnl.toFixed(4)} SOL (${pnlPercent.toFixed(2)}%)</div>
  `;
}

function handleBuy() {
  const amount = (wallet.cash * buyPercent) / 100;
  if (amount <= 0 || wallet.cash < amount) return;
  const coinsBought = amount / currentPrice;
  const newCoinHolding = wallet.coinHolding + coinsBought;
  const newInvested = wallet.invested + amount;
  const newAvgBuyPrice = newInvested / newCoinHolding;
  wallet = {
    ...wallet,
    cash: wallet.cash - amount,
    coinHolding: newCoinHolding,
    invested: newInvested,
    avgBuyPrice: newAvgBuyPrice
  };
  
  // Record the position for chart visualization
  positions.push({
    type: 'BUY',
    price: currentPrice,
    amount: coinsBought,
    time: simulationTick
  });
  
  tradingHistory.push({
    type: 'BUY',
    amount: coinsBought,
    price: currentPrice,
    value: amount,
    timestamp: new Date().toLocaleTimeString()
  });
  updatePortfolio();
  updateTradeHistory();
  updateButtonLabels();
  renderChart(); // Re-render chart to show the new position
}

function handleSell() {
  const amountToSell = (wallet.coinHolding * sellPercent) / 100;
  if (amountToSell <= 0) return;
  const valueReceived = amountToSell * currentPrice;
  const percentOfHolding = amountToSell / wallet.coinHolding;
  const investmentSold = wallet.invested * percentOfHolding;
  wallet = {
    ...wallet,
    cash: wallet.cash + valueReceived,
    coinHolding: wallet.coinHolding - amountToSell,
    invested: wallet.invested - investmentSold,
    soldValue: wallet.soldValue + valueReceived
  };
  
  // Record the position for chart visualization
  positions.push({
    type: 'SELL',
    price: currentPrice,
    amount: amountToSell,
    time: simulationTick
  });
  
  tradingHistory.push({
    type: 'SELL',
    amount: amountToSell,
    price: currentPrice,
    value: valueReceived,
    timestamp: new Date().toLocaleTimeString()
  });
  updatePortfolio();
  updateTradeHistory();
  updateButtonLabels();
  renderChart(); // Re-render chart to show the new position
}

function updateTradeHistory() {
  const tbody = document.querySelector('#trade-history-table tbody');
  tbody.innerHTML = tradingHistory.slice().reverse().map(trade => {
    const profitClass = trade.type === 'SELL' ? 
      (trade.value > (trade.amount * wallet.avgBuyPrice) ? 'profit' : 'loss') : '';
    
    return `
    <tr>
      <td class="${trade.type.toLowerCase()}">${trade.type}</td>
      <td>${trade.timestamp}</td>
      <td>${trade.amount.toFixed(2)} DSIMULATOR</td>
      <td>${formatPrice(trade.price)} SOL</td>
      <td class="${profitClass}">${trade.value.toFixed(4)} SOL</td>
    </tr>
  `}).join('');
}

function updateButtonLabels() {
  document.getElementById('buy-button').textContent = `Buy (${((wallet.cash * buyPercent) / 100).toFixed(4)} SOL)`;
  document.getElementById('sell-button').textContent = `Sell (${((wallet.coinHolding * sellPercent) / 100).toFixed(2)} DSIMULATOR)`;
}

function resetSimulation() {
  wallet = {
    cash: 1000,
    coinHolding: 0,
    invested: 0,
    soldValue: 0,
    avgBuyPrice: 0,
  };
  
  isPaused = false;
  document.getElementById('pause-button').textContent = 'Pause Simulation';
  
  positions = [];
  tradingHistory = [];
  
  coinData = [];
  candleData = [];
  simulationTick = 0;
  
  generateInitialData();
  updatePortfolio();
  updateTradeHistory();
  updateButtonLabels();
  renderChart();
}

document.getElementById('buy-controls').innerHTML = `
  <label>Buy (% of cash)</label>
  <input type="range" min="1" max="100" value="${buyPercent}" id="buy-slider">
  <span>${buyPercent}%</span>
  <button id="buy-button">Buy (${((wallet.cash * buyPercent) / 100).toFixed(4)} SOL)</button>
`;

document.getElementById('sell-controls').innerHTML = `
  <label>Sell (% of coins)</label>
  <input type="range" min="1" max="100" value="${sellPercent}" id="sell-slider">
  <span>${sellPercent}%</span>
  <button id="sell-button">Sell (${((wallet.coinHolding * sellPercent) / 100).toFixed(2)} DSIMULATOR)</button>
`;

// Add candle period selector and reset button
document.getElementById('trading').insertAdjacentHTML('beforeend', `
  <div class="candle-settings">
    <label>Candle Period</label>
    <select id="candle-period">
      <option value="1">1 tick</option>
      <option value="3" selected>3 ticks</option>
      <option value="5">5 ticks</option>
      <option value="10">10 ticks</option>
    </select>
  </div>
  <button id="reset-button">Reset Simulation</button>
`);

document.getElementById('buy-slider').addEventListener('input', (e) => {
  buyPercent = parseInt(e.target.value);
  document.querySelector('#buy-controls span').textContent = `${buyPercent}%`;
  document.getElementById('buy-button').textContent = `Buy (${((wallet.cash * buyPercent) / 100).toFixed(4)} SOL)`;
});

document.getElementById('sell-slider').addEventListener('input', (e) => {
  sellPercent = parseInt(e.target.value);
  document.querySelector('#sell-controls span').textContent = `${sellPercent}%`;
  document.getElementById('sell-button').textContent = `Sell (${((wallet.coinHolding * sellPercent) / 100).toFixed(2)} DSIMULATOR)`;
});

document.getElementById('candle-period').addEventListener('change', (e) => {
  candlePeriod = parseInt(e.target.value);
  
  // Reset the simulation with the new candle period
  resetSimulation();
});

document.getElementById('buy-button').addEventListener('click', handleBuy);
document.getElementById('sell-button').addEventListener('click', handleSell);
document.getElementById('pause-button').addEventListener('click', () => {
  isPaused = !isPaused;
  document.getElementById('pause-button').textContent = isPaused ? 'Resume Simulation' : 'Pause Simulation';
});
document.getElementById('reset-button').addEventListener('click', resetSimulation);

generateInitialData();
setInterval(updatePrice, 500); // Speed of 500ms for faster updates
renderChart();
updatePortfolio();