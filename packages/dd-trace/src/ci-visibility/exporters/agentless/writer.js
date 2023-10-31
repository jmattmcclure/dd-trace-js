'use strict'
const request = require('../../../exporters/common/request')
const { safeJSONStringify } = require('../../../exporters/common/util')
const log = require('../../../log')

const { AgentlessCiVisibilityEncoder } = require('../../../encode/agentless-ci-visibility')
const BaseWriter = require('../../../exporters/common/writer')
const { incrementMetric, distributionMetric } = require('../../../ci-visibility/telemetry')

class Writer extends BaseWriter {
  constructor ({ url, tags, evpProxyPrefix = '' }) {
    super(...arguments)
    const { 'runtime-id': runtimeId, env, service } = tags
    this._url = url
    this._encoder = new AgentlessCiVisibilityEncoder(this, { runtimeId, env, service })
    this._evpProxyPrefix = evpProxyPrefix
  }

  _sendPayload (data, _, done) {
    const options = {
      path: '/api/v2/citestcycle',
      method: 'POST',
      headers: {
        'dd-api-key': process.env.DATADOG_API_KEY || process.env.DD_API_KEY,
        'Content-Type': 'application/msgpack'
      },
      timeout: 15000,
      url: this._url
    }

    if (this._evpProxyPrefix) {
      options.path = `${this._evpProxyPrefix}/api/v2/citestcycle`
      delete options.headers['dd-api-key']
      options.headers['X-Datadog-EVP-Subdomain'] = 'citestcycle-intake'
    }

    log.debug(() => `Request to the intake: ${safeJSONStringify(options)}`)

    const startTime = Date.now()

    incrementMetric('endpoint_payload.requests', { endpoint: 'test_cycle' })
    distributionMetric('endpoint_payload.bytes', { endpoint: 'test_cycle' }, data.length)
    request(data, options, (err, res) => {
      const duration = Date.now() - startTime
      distributionMetric('endpoint_payload.requests_ms', { endpoint: 'test_cycle' }, duration)
      if (err) {
        // **TODO** EXTRACT TYPE OF ERROR IF WE CAN
        incrementMetric('endpoint_payload.requests_errors', { endpoint: 'test_cycle', errorType: 'timeout' })
        log.error(err)
        done()
        return
      }
      log.debug(`Response from the intake: ${res}`)
      done()
    })
  }
}

module.exports = Writer
