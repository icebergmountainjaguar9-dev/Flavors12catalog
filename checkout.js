const addresses = {
  btc: {
    label: 'Bitcoin',
    symbol: 'BTC',
    address: 'bc1qvxukeasjgkz7nzvrvk9a9er7a33rstrdv5u4e5',
    api: 'https://api.blockcypher.com/v1/btc/main/addrs/',
    requiredConfirmations: 1,
  },
  eth: {
    label: 'Ethereum',
    symbol: 'ETH',
    address: '0x43Cd79268989418085d4F5C17137c29BbBd3d1de',
    api: 'https://api.blockcypher.com/v1/eth/main/addrs/',
    requiredConfirmations: 12,
  },
};

const updateStatus = (chain, statusText, detailText, statusType) => {
  const statusEl = document.getElementById(`${chain}-status`);
  const detailEl = document.getElementById(`${chain}-detail`);
  statusEl.textContent = statusText;
  detailEl.innerHTML = detailText;

  statusEl.style.background =
    statusType === 'success'
      ? '#34d399'
      : statusType === 'warning'
      ? '#fbbf24'
      : '#94a3b8';
};

const buildTxLink = (chain, txHash) => {
  if (chain === 'btc') {
    return `https://blockstream.info/tx/${txHash}`;
  }
  if (chain === 'eth') {
    return `https://etherscan.io/tx/${txHash}`;
  }
  return '#';
};

const formatNumber = (value) => new Intl.NumberFormat().format(value);

const parsePayment = (chain, data) => {
  const txRefs = [];
  if (Array.isArray(data.txrefs)) txRefs.push(...data.txrefs);
  if (Array.isArray(data.unconfirmed_txrefs)) txRefs.push(...data.unconfirmed_txrefs);

  if (txRefs.length === 0) {
    return null;
  }

  txRefs.sort((a, b) => {
    const aHeight = a.confirmations === 0 ? -1 : a.block_height || 0;
    const bHeight = b.confirmations === 0 ? -1 : b.block_height || 0;
    return bHeight - aHeight;
  });

  return txRefs[0];
};

const getPaymentInfo = async (chain) => {
  const config = addresses[chain];
  try {
    const response = await fetch(`${config.api}${config.address}`);
    if (!response.ok) {
      throw new Error(`API error ${response.status}`);
    }
    const data = await response.json();
    const payment = parsePayment(chain, data);

    if (!payment) {
      updateStatus(
        chain,
        'No payment detected yet',
        `No transactions were found for ${config.symbol}. Send crypto to the address above and refresh as needed.`,
        'neutral'
      );
      return;
    }

    const confirmations = payment.confirmations || 0;
    const amountUnits = payment.value || payment.amount || 0;
    const amountDisplay = chain === 'btc'
      ? `${amountUnits / 1e8} BTC`
      : `${amountUnits / 1e18} ETH`;
    const txHash = payment.tx_hash || payment.hash || payment.transaction_hash || '';
    const txLink = buildTxLink(chain, txHash);
    const targetConf = config.requiredConfirmations;
    const explorerLink = txHash
      ? `<a href="${txLink}" target="_blank" rel="noreferrer">View transaction</a>`
      : 'Transaction hash unavailable.';

    if (confirmations >= targetConf) {
      updateStatus(
        chain,
        `Confirmed (${confirmations})`,
        `Received ${amountDisplay}. ${explorerLink}`,
        'success'
      );
    } else if (confirmations > 0) {
      updateStatus(
        chain,
        `Pending (${confirmations}/${targetConf})`,
        `Received ${amountDisplay}. ${confirmations} confirmation${confirmations === 1 ? '' : 's'} received. ${explorerLink}`,
        'warning'
      );
    } else {
      updateStatus(
        chain,
        'Broadcast, awaiting confirmations',
        `A transaction has been detected for ${amountDisplay}. ${explorerLink}`,
        'warning'
      );
    }
  } catch (error) {
    updateStatus(
      chain,
      'Unable to load status',
      `Could not fetch ${config.symbol} payment status. ${error.message}`,
      'neutral'
    );
  }
};

const copyAddress = (event) => {
  const target = event.currentTarget.dataset.copyTarget;
  const addressEl = document.getElementById(target);
  if (!addressEl) return;

  navigator.clipboard
    .writeText(addressEl.textContent)
    .then(() => {
      event.currentTarget.textContent = 'Copied!';
      setTimeout(() => {
        event.currentTarget.textContent = target.startsWith('btc')
          ? 'Copy BTC Address'
          : 'Copy ETH Address';
      }, 1200);
    })
    .catch(() => {
      event.currentTarget.textContent = 'Copy failed';
    });
};

const initCryptoCheckout = () => {
  document.querySelectorAll('.copy-button').forEach((button) => {
    button.addEventListener('click', copyAddress);
  });

  const poll = async () => {
    await Promise.all([getPaymentInfo('btc'), getPaymentInfo('eth')]);
  };

  poll();
  setInterval(poll, 20000);
};

window.addEventListener('DOMContentLoaded', initCryptoCheckout);
