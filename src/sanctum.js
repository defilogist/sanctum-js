import { Connection, Keypair, PublicKey, VersionedTransaction } from '@solana/web3.js'

import lsts from './lsts.json'

export class SanctumClient {

  lstList = lsts.sanctum_lst_list

  constructor(privateKey = null, network = 'devnet') {
    this.initClient()
    if (privateKey) {
      this.initSolanaClient(privateKey, network)
    }
  }

  initClient() {
    this.headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'sanctumjs 0.1.0'
    }
  }

  initSolanaClient(privateKey, network) {
    this.keypair = Keypair.fromSecretKey(Buffer.from(privateKey, 'base64'))
    const url = network.startsWith('http') ? network : `https://api.${network}.solana.com`
    this.solanaClient = new Connection(url)
  }

  async get(path, params = null, extra = false) {
    const host = extra ? 'extra-api.sanctum.so' : 'sanctum-s-api.fly.dev'
    let url = `https://${host}${path}`

    if (params) {
      const queryString = new URLSearchParams(params).toString()
      url += `?${queryString}`
    }

    const response = await fetch(url, { headers: this.headers })
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Invalid API Key')
      }
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  }

  async post(path, data = null) {
    const host = 'sanctum-s-api.fly.dev'
    const url = `https://${host}${path}`

    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Invalid API Key')
      }
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  }

  async runTransaction(transaction) {
    const transactionBuffer = Buffer.from(transaction, 'base64')
    const versionedTransaction = VersionedTransaction.deserialize(transactionBuffer)
    versionedTransaction.sign([this.keypair])
    const signature = await this.solanaClient.sendTransaction(versionedTransaction)
    return signature
  }

  checkErrors(data) {
    if (Object.keys(data.errs).length > 0) {
      throw new Error(JSON.stringify(data.errs))
    }
    return data
  }

  async getInfinityInfos() {
    return await this.get('/v1/infinity/allocation/current', {}, true)
  }

  async getLstApy(lst, epochs = null, latest = true) {
    const params = { lst }
    if (epochs !== null) {
      params.epochs = epochs
    }

    let data
    if (latest) {
      data = await this.get('/v1/apy/latest', params, true)
    } else if (epochs !== null) {
      data = await this.get('/v1/apy/epochs', params, true)
    } else {
      data = await this.get('/v1/apy/inception', params, true)
    }

    data = this.checkErrors(data)
    return Number((data.apys[lst] * 100).toFixed(2))
  }

  async getLstApys() {
    const host = 'extra-api.sanctum.so'
    let url = `https://${host}/v1/apy/latest?`

    this.lstList.forEach(lst => {
      url += `lst=${lst.mint}&`
    })

    const response = await fetch(url, { headers: this.headers })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  }

  async getLstSolValue(lst) {
    const data = await this.get('/v1/lst/sol_value', { lst }, true)
    return this.checkErrors(data).sol_value
  }

  async getLstTvl(lst) {
    const data = await this.get('/v1/lst/tvl', { lst }, true)
    return this.checkErrors(data).tvl
  }

  async getLstInfos(lst) {
    const data = await this.get('/v1/lst/infos', { lst }, true)
    return this.checkErrors(data)
  }

  async getQuote(fromToken, toToken, amount, mode = 'ExactIn', swapSrc = null) {
    if (!['ExactIn', 'ExactOut'].includes(mode)) {
      throw new Error('Invalid mode')
    }
    if (swapSrc && !['Spool', 'Stakedex', 'Jup'].includes(swapSrc)) {
      throw new Error('Invalid swap source')
    }

    const params = {
      input: fromToken,
      outputLstMint: toToken,
      amount: this.toSolami(amount),
      mode
    }
    if (swapSrc) {
      params.swapSrc = swapSrc
    }
    return await this.get('/v1/swap/quote', params)
  }

  // Helper methods
  toSolami(amount) {
    return Math.floor(amount * 1e9).toString()
  }

  fromSolami(amount) {
    return Number(amount) / 1e9
  }
}
