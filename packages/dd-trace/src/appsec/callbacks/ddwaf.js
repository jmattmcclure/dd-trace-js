'use strict'

const log = require('../../log')
const Addresses = require('../addresses')
const Gateway = require('../../gateway/engine')
const Reporter = require('../reporter')

let warned = false

const validAddressSet = new Set(Object.values(Addresses))

const DEFAULT_MAX_BUDGET = 5e3 // µs

// TODO: put reusable code in a base class
class WAFCallback {
  static loadDDWAF (rules) {
    try {
      // dirty require because this can throw at require time
      const { DDWAF } = require('@datadog/native-appsec')

      return new DDWAF(rules)
    } catch (err) {
      if (!warned) {
        log.warning('AppSec could not load native package. In-app WAF features will not be available.')
        warned = true
      }

      throw err
    }
  }

  constructor (rules) {
    this.ddwaf = WAFCallback.loadDDWAF(rules)
    this.wafContextCache = new WeakMap()

    // closures are faster than binds wtf
    const self = this
    const method = (params, store) => {
      self.action(params, store)
    }

    // will be its own class with more info later i guess
    const callback = { method }

    this.subscriptions = []
    const subscriptionGroups = new Set()

    for (const rule of rules.events) {
      for (const condition of rule.conditions) {
        let addresses = condition.parameters.inputs.map((address) => address.split(':', 2)[0])

        if (!addresses.every((address) => validAddressSet.has(address))) {
          log.warn(`Skipping invalid rule ${rule.id}`)
          break
        }

        addresses = Array.from(new Set(addresses))

        const hash = addresses.sort().join(',')

        if (subscriptionGroups.has(hash)) continue

        subscriptionGroups.add(hash)
        const subscription = Gateway.manager.addSubscription({ addresses, callback })
        this.subscriptions.push(subscription)
      }
    }
  }

  action (params, store) {
    const key = store.get('context')

    let wafContext
    if (this.wafContextCache.has(key)) {
      wafContext = this.wafContextCache.get(key)
    } else {
      wafContext = this.ddwaf.createContext()
      this.wafContextCache.set(key, wafContext)
    }

    try {
      const result = wafContext.run(params, DEFAULT_MAX_BUDGET)

      return this.applyResult(result)
    } catch (err) {
      log.warn('Error while running the AppSec WAF')
    }
  }

  applyResult (result) {
    if (result.action) {
    }

    // result.perfData
    // result.perfTotalRuntime
  }

  clear () {
    this.libAppSec.dispose()

    this.wafContextCache = new WeakMap()

    Gateway.manager.clear()
  }
}

module.exports = WAFCallback
