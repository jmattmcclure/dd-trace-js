const { getBodyTags } = require('../../src/payload-tagging/tagger')
const { Filter } = require('../../src/payload-tagging/filter')

const globFilter = new Filter('*')
const defaultOpts = { filter: globFilter, maxDepth: 10, prefix: 'http.payload' }

function optsWithFilter (filter) {
  return { ...defaultOpts, filter }
}

describe('Filtering', () => {
  const input = JSON.stringify({ foo: { bar: 1, quux: 2 }, bar: 3 })
  const ctype = 'application/json'
  it('should take everything with glob filter', () => {
    const tags = getBodyTags(input, ctype, defaultOpts)
    expect(tags).to.deep.equal({
      'http.payload.foo.bar': '1',
      'http.payload.foo.quux': '2',
      'http.payload.bar': '3'
    })
  })

  it('should exclude paths when excluding', () => {
    const filter = new Filter('*,-foo.bar,-foo.quux')
    const tags = getBodyTags(input, ctype, optsWithFilter(filter))
    expect(tags).to.deep.equal({
      'http.payload.bar': '3'
    })
  })

  it('should only provide included paths when including', () => {
    const filter = new Filter('foo.bar,foo.quux')
    const tags = getBodyTags(input, ctype, optsWithFilter(filter))
    expect(tags).to.deep.equal({
      'http.payload.foo.bar': '1',
      'http.payload.foo.quux': '2'
    })
  })

  it('should remove an entire section if given a partial path', () => {
    const filter = new Filter('*,-foo')
    const tags = getBodyTags(input, ctype, optsWithFilter(filter))
    expect(tags).to.deep.equal({
      'http.payload.bar': '3'
    })
  })

  it('should include an entire section if given a partial path', () => {
    const filter = new Filter('foo')
    const tags = getBodyTags(input, ctype, optsWithFilter(filter))
    expect(tags).to.deep.equal({
      'http.payload.foo.bar': '1',
      'http.payload.foo.quux': '2'
    })
  })

  it('should remove specific excludes from an include path', () => {
    const filter = new Filter('foo,-foo.bar')
    const tags = getBodyTags(input, ctype, optsWithFilter(filter))
    expect(tags).to.deep.equal({
      'http.payload.foo.quux': '2'
    })
  })

  it('should not add specific includes from an exclude path', () => {
    const filter = new Filter('*,-foo,foo.bar')
    const tags = getBodyTags(input, ctype, optsWithFilter(filter))
    expect(tags).to.deep.equal({ 'http.payload.bar': '3' })
  })
})
