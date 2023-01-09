'use strict'

const DatabasePlugin = require('../../dd-trace/src/plugins/database')
const { resolveHostDetails } = require('../../dd-trace/src/util')

class PGPlugin extends DatabasePlugin {
  static get name () { return 'pg' }
  static get operation () { return 'query' }
  static get system () { return 'postgres' }

  start ({ params = {}, query, processId }) {
    const service = getServiceName(this.config, params)
    const originalStatement = query.text

    const destinationHostDetails = resolveHostDetails(params.host)
    this.startSpan('pg.query', {
      service,
      resource: originalStatement,
      type: 'sql',
      kind: 'client',
      meta: {
        'db.type': 'postgres',
        'db.pid': processId,
        'db.name': params.database,
        'db.user': params.user,
        'network.destination.port': params.port,
        ...destinationHostDetails
      }
    })

    query.text = this.injectDbmQuery(query.text)
  }
}

function getServiceName (config, params) {
  if (typeof config.service === 'function') {
    return config.service(params)
  }

  return config.service
}

module.exports = PGPlugin
