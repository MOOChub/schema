const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const schemaRoot = path.resolve(__dirname, '../draft/schemas')
const ambSchemaRoot = path.resolve(__dirname, '../../amb/20231019/schemas')
const outputRoot = path.resolve(__dirname, '../draft/diagrams')
const mermaidCli = path.resolve(
  __dirname,
  '../node_modules/@mermaid-js/mermaid-cli/src/cli.js'
)
const schemas = new Map()

const simpleTypes = {
  properties: {
    '*': { educationalAlignment: 'AlignmentObject' },
  },
  schemas: {
    textObject: 'TextObject',
    suggestedAge: 'SuggestedAge',
    concept: 'Concept',
    educationalLevel: 'EducationalLevel',
  },
}

const views = [
  {
    file: 'course-detail',
    title: 'MOOChub v4: Kurs im Profilmodell',
    root: 'course',
    boundaries: ['educationalOccupationalCredential'],
    leaves: ['programReference', 'location', 'person', 'organization'],
    simpleTypes,
  },
  {
    file: 'program-detail',
    title: 'MOOChub v4: Bildungsprogramm im Profilmodell',
    root: 'program',
    boundaries: ['educationalOccupationalCredential'],
    leaves: [
      'courseReference',
      'programReference',
      'credentialReference',
      'location',
      'person',
      'organization',
    ],
    simpleTypes,
  },
  {
    file: 'credential-detail',
    title: 'MOOChub v4: Bildungsnachweis im Profilmodell',
    root: 'educationalOccupationalCredential',
    leaves: [
      'courseReference',
      'programReference',
      'credentialReference',
      'location',
      'person',
      'organization',
    ],
    simpleTypes,
  },
  {
    file: 'catalog',
    title: 'MOOChub v4: Katalog und Ressourcentypen',
    root: 'api/catalogFeed',
    format: 'flowchart',
    boundaries: ['course', 'program', 'educationalOccupationalCredential'],
    leaves: ['person', 'organization', 'location'],
    simpleTypes,
  },
]

function loadSchema(schemaPath) {
  if (!schemas.has(schemaPath)) {
    schemas.set(schemaPath, JSON.parse(fs.readFileSync(schemaPath, 'utf8')))
  }
  return schemas.get(schemaPath)
}

function isEntitySchema(schemaPath) {
  if (
    !schemaPath.startsWith(`${schemaRoot}${path.sep}`) ||
    !fs.existsSync(schemaPath)
  ) {
    return false
  }
  return collectObjectProperties(loadSchema(schemaPath)).length > 0
}

function schemaEntity(schemaPath) {
  const relativePath = path
    .relative(schemaRoot, schemaPath)
    .replace(/\.json$/, '')
  const name = path.basename(relativePath)
  return {
    id: relativePath.replaceAll('/', '_').replaceAll('-', '_'),
    label: titleType(name),
  }
}

function resolveReference(reference, sourcePath) {
  const referenceWithoutFragment = reference.split('#', 1)[0]
  let targetPath

  if (/^https?:\/\//.test(referenceWithoutFragment)) {
    const urlPath = new URL(referenceWithoutFragment).pathname
    const schemaMarker = `/${path.basename(path.dirname(schemaRoot))}/schemas/`
    const ambSchemaMarker = '/amb/20231019/schemas/'
    const markerIndex = urlPath.indexOf(schemaMarker)
    const ambMarkerIndex = urlPath.indexOf(ambSchemaMarker)
    if (markerIndex !== -1) {
      targetPath = path.resolve(
        schemaRoot,
        urlPath.slice(markerIndex + schemaMarker.length)
      )
    } else if (ambMarkerIndex !== -1) {
      targetPath = path.resolve(
        ambSchemaRoot,
        urlPath.slice(ambMarkerIndex + ambSchemaMarker.length)
      )
    } else {
      return null
    }
  } else {
    targetPath = path.resolve(
      path.dirname(sourcePath),
      referenceWithoutFragment
    )
  }

  return [schemaRoot, ambSchemaRoot].some((root) =>
    targetPath.startsWith(`${root}${path.sep}`)
  )
    ? targetPath
    : null
}

function findEntityTargets(
  schema,
  sourcePath,
  includedEntities,
  visited = new Set(),
  discoverEntities = false
) {
  const targets = new Set()

  if (schema.$ref) {
    const targetPath = resolveReference(schema.$ref, sourcePath)
    if (targetPath && discoverEntities && isEntitySchema(targetPath)) {
      if (!includedEntities || includedEntities.has(targetPath)) {
        targets.add(targetPath)
      }
    } else if (
      targetPath &&
      !visited.has(targetPath) &&
      fs.existsSync(targetPath)
    ) {
      const nextVisited = new Set(visited).add(targetPath)
      for (const target of findEntityTargets(
        loadSchema(targetPath),
        targetPath,
        includedEntities,
        nextVisited,
        discoverEntities
      )) {
        targets.add(target)
      }
    }
  }

  if (schema.items) {
    for (const target of findEntityTargets(
      schema.items,
      sourcePath,
      includedEntities,
      visited,
      discoverEntities
    )) {
      targets.add(target)
    }
  }

  for (const propertySchema of Object.values(schema.properties ?? {})) {
    for (const target of findEntityTargets(
      propertySchema,
      sourcePath,
      includedEntities,
      visited,
      discoverEntities
    )) {
      targets.add(target)
    }
  }

  for (const keyword of ['anyOf', 'oneOf', 'allOf']) {
    for (const alternative of schema[keyword] ?? []) {
      for (const target of findEntityTargets(
        alternative,
        sourcePath,
        includedEntities,
        visited,
        discoverEntities
      )) {
        targets.add(target)
      }
    }
  }

  return targets
}

function simpleTypeFromSchema(view, schema, sourcePath, visited = new Set()) {
  if (schema.$ref) {
    const targetPath = resolveReference(schema.$ref, sourcePath)
    if (!targetPath || !fs.existsSync(targetPath) || visited.has(targetPath)) {
      return null
    }
    const targetName = path
      .relative(schemaRoot, targetPath)
      .replace(/\.json$/, '')
    const simpleType = view.simpleTypes?.schemas?.[targetName]
    if (simpleType) return simpleType
    return simpleTypeFromSchema(
      view,
      loadSchema(targetPath),
      targetPath,
      new Set(visited).add(targetPath)
    )
  }

  if (schema.items) {
    return simpleTypeFromSchema(view, schema.items, sourcePath, visited)
  }

  for (const keyword of ['anyOf', 'oneOf', 'allOf']) {
    const alternatives = schema[keyword] ?? []
    if (alternatives.length === 0) continue
    const types = alternatives.map((alternative) =>
      simpleTypeFromSchema(view, alternative, sourcePath, visited)
    )
    if (types.every((type) => type && type === types[0])) return types[0]
    return null
  }

  return null
}

function simpleTypeFor(view, sourcePath, property, propertySchema) {
  const sourceName = path
    .relative(schemaRoot, sourcePath)
    .replace(/\.json$/, '')
  return (
    view.simpleTypes?.properties?.[sourceName]?.[property] ??
    view.simpleTypes?.properties?.['*']?.[property] ??
    simpleTypeFromSchema(view, propertySchema, sourcePath)
  )
}

function isSimpleSchema(view, schemaPath) {
  const schemaName = path
    .relative(schemaRoot, schemaPath)
    .replace(/\.json$/, '')
  return Boolean(view.simpleTypes?.schemas?.[schemaName])
}

function collectObjectProperties(schema) {
  const properties = []

  if (schema.properties) {
    for (const [name, propertySchema] of Object.entries(schema.properties)) {
      properties.push({ name, schema: propertySchema })
    }
  }

  for (const keyword of ['anyOf', 'oneOf', 'allOf']) {
    for (const alternative of schema[keyword] ?? []) {
      properties.push(...collectObjectProperties(alternative))
    }
  }

  return properties
}

function relationshipShape(schema, sourcePath, visited = new Set()) {
  const ownArray = schema.type === 'array' || Boolean(schema.items)
  const ownMinimum = Math.max(
    schema.minItems ?? 0,
    schema.contains ? schema.minContains ?? 1 : 0
  )

  if (schema.$ref) {
    const targetPath = resolveReference(schema.$ref, sourcePath)
    if (targetPath && !visited.has(targetPath) && fs.existsSync(targetPath)) {
      const targetShape = relationshipShape(
        loadSchema(targetPath),
        targetPath,
        new Set(visited).add(targetPath)
      )
      return {
        isArray: ownArray || targetShape.isArray,
        minItems: Math.max(ownMinimum, targetShape.minItems),
      }
    }
  }

  const allOfShapes = (schema.allOf ?? []).map((alternative) =>
    relationshipShape(alternative, sourcePath, visited)
  )
  const unionShapes = ['anyOf', 'oneOf'].flatMap((keyword) =>
    (schema[keyword] ?? []).map((alternative) =>
      relationshipShape(alternative, sourcePath, visited)
    )
  )
  const allOfIsArray = allOfShapes.some((shape) => shape.isArray)
  const unionIsArray = unionShapes.some((shape) => shape.isArray)
  const isArray = ownArray || allOfIsArray || unionIsArray

  if (isArray) {
    const allOfMinimum = allOfIsArray
      ? Math.max(0, ...allOfShapes.map((shape) => shape.minItems))
      : 0
    const unionMinimum = unionIsArray
      ? Math.min(
          ...unionShapes
            .filter((shape) => shape.isArray)
            .map((shape) => shape.minItems)
        )
      : 0
    return {
      isArray: true,
      minItems: Math.max(ownMinimum, allOfMinimum, unionMinimum),
    }
  }

  return { isArray: false, minItems: ownMinimum }
}

function multiplicity(propertySchema, sourcePath, isRequired, targetCount) {
  const shape = relationshipShape(propertySchema, sourcePath)
  if (!shape.isArray) return isRequired && targetCount === 1 ? '1' : '0..1'
  if (targetCount > 1) return '0..*'
  if (isRequired && shape.minItems > 0) return `${shape.minItems}..*`
  if (!isRequired && shape.minItems > 1) return `0 or ${shape.minItems}..*`
  return '0..*'
}

function titleType(title) {
  return title
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join('')
}

function attributeType(schema, sourcePath, visited = new Set()) {
  if (schema.$ref) {
    const targetPath = resolveReference(schema.$ref, sourcePath)
    if (targetPath && fs.existsSync(targetPath)) {
      const targetSchema = loadSchema(targetPath)
      if (visited.has(targetPath)) return titleType(targetSchema.title ?? '')
      if (targetSchema.type === 'array' || targetSchema.items) {
        return attributeType(
          targetSchema.items ?? targetSchema,
          targetPath,
          new Set(visited).add(targetPath)
        )
      }
      if (targetSchema.type && targetSchema.type !== 'object') {
        return attributeType(targetSchema, targetPath, visited)
      }
      if (targetSchema.title) return titleType(targetSchema.title)
      return attributeType(
        targetSchema,
        targetPath,
        new Set(visited).add(targetPath)
      )
    }

    const referenceName = path.basename(schema.$ref.split('#', 1)[0], '.json')
    return titleType(referenceName)
  }

  if (schema.type === 'array' || schema.items) {
    return schema.items
      ? attributeType(schema.items, sourcePath, visited)
      : titleType(schema.title ?? 'Value')
  }

  if (Array.isArray(schema.type)) {
    const types = schema.type.filter((type) => type !== 'null')
    if (types.length === 1) return attributeType({ type: types[0] }, sourcePath)
  }

  for (const keyword of ['anyOf', 'oneOf', 'allOf']) {
    const types = [
      ...new Set(
        (schema[keyword] ?? [])
          .filter((alternative) => alternative.type !== 'null')
          .map((alternative) => attributeType(alternative, sourcePath, visited))
      ),
    ]
    if (types.length === 1) return types[0]
    if (types.length > 1) return types.join('Or')
  }

  if (schema.format === 'date-time') return 'DateTime'
  if (schema.format === 'duration') return 'Duration'
  if (schema.format === 'uri') return 'URI'

  return (
    {
      string: 'String',
      integer: 'Integer',
      number: 'Number',
      boolean: 'Boolean',
      object: 'Object',
    }[schema.type] ?? titleType(schema.title ?? 'Value')
  )
}

function attributeMultiplicity(propertySchema, sourcePath, isRequired) {
  const shape = relationshipShape(propertySchema, sourcePath)
  if (!shape.isArray) return isRequired ? '1' : '0..1'
  if (isRequired && shape.minItems > 0) return `${shape.minItems}..*`
  if (!isRequired && shape.minItems > 1) return `0 or ${shape.minItems}..*`
  return '0..*'
}

function requiredProperties(schema) {
  const required = new Set(schema.required ?? [])
  for (const alternative of schema.allOf ?? []) {
    for (const property of requiredProperties(alternative))
      required.add(property)
  }
  return required
}

function escapeLabel(label) {
  return label.replaceAll('"', '\\"')
}

function createDiagram(view) {
  const rootPath = path.resolve(schemaRoot, `${view.root}.json`)
  const boundaries = new Set(
    (view.boundaries ?? []).map((file) =>
      path.resolve(schemaRoot, `${file}.json`)
    )
  )
  const leaves = new Set(
    (view.leaves ?? []).map((file) => path.resolve(schemaRoot, `${file}.json`))
  )
  const includedEntities = new Set([rootPath])
  const relationshipSources = []
  const pending = [rootPath]
  while (pending.length > 0) {
    const sourcePath = pending.shift()
    if (relationshipSources.includes(sourcePath)) continue
    relationshipSources.push(sourcePath)
    const schema = loadSchema(sourcePath)
    for (const {
      name: property,
      schema: propertySchema,
    } of collectObjectProperties(schema)) {
      if (
        property === '@context' ||
        simpleTypeFor(view, sourcePath, property, propertySchema)
      ) {
        continue
      }
      const targets = findEntityTargets(
        propertySchema,
        sourcePath,
        null,
        new Set(),
        true
      )
      for (const targetPath of targets) {
        if (isSimpleSchema(view, targetPath)) continue
        includedEntities.add(targetPath)
        if (!boundaries.has(targetPath) && !leaves.has(targetPath)) {
          pending.push(targetPath)
        }
      }
    }
  }
  const hasAttributes = view.format !== 'flowchart'
  const lines = hasAttributes
    ? [
        '---',
        'config:',
        '  layout: dagre',
        '  class:',
        '    hideEmptyMembersBox: true',
        '---',
        'classDiagram',
        '  direction TB',
      ]
    : ['flowchart LR']
  const emittedEdges = new Set()

  lines.push(`  %% ${view.title}`)
  for (const schemaPath of includedEntities) {
    const entity = schemaEntity(schemaPath)
    const schema = loadSchema(schemaPath)
    const propertySchemas = new Map(
      collectObjectProperties(schema).map(({ name, schema }) => [name, schema])
    )
    const properties = boundaries.has(schemaPath)
      ? []
      : [...propertySchemas.keys()]
    if (hasAttributes) {
      lines.push(`  class ${entity.id}["${escapeLabel(entity.label)}"] {`)
      for (const property of properties) {
        const propertySchema = propertySchemas.get(property)
        const type =
          simpleTypeFor(view, schemaPath, property, propertySchema) ??
          attributeType(propertySchema, schemaPath)
        const range = attributeMultiplicity(
          propertySchema,
          schemaPath,
          requiredProperties(schema).has(property)
        )
        lines.push(`    +${property}: ${type} [${range}]`)
      }
      lines.push('  }')
    } else {
      lines.push(`  ${entity.id}["${escapeLabel(entity.label)}"]`)
    }
  }

  for (const sourcePath of relationshipSources) {
    const schema = loadSchema(sourcePath)
    const sourceEntity = schemaEntity(sourcePath)
    const required = requiredProperties(schema)

    for (const {
      name: property,
      schema: propertySchema,
    } of collectObjectProperties(schema)) {
      if (simpleTypeFor(view, sourcePath, property, propertySchema)) continue
      const targets = [
        ...findEntityTargets(
          propertySchema,
          sourcePath,
          includedEntities,
          new Set(),
          true
        ),
      ].filter((targetPath) => !isSimpleSchema(view, targetPath))
      for (const targetPath of targets) {
        if (targetPath === sourcePath) continue
        const targetEntity = schemaEntity(targetPath)
        const edgeKey = `${sourceEntity.id}:${property}:${targetEntity.id}`
        if (emittedEdges.has(edgeKey)) continue
        emittedEdges.add(edgeKey)
        const range = multiplicity(
          propertySchema,
          sourcePath,
          required.has(property),
          targets.length
        )
        if (hasAttributes) {
          lines.push(
            `  ${sourceEntity.id} --> "${range}" ${
              targetEntity.id
            } : ${escapeLabel(property)}`
          )
        } else {
          lines.push(
            `  ${sourceEntity.id} -->|"${escapeLabel(property)} (${range})"| ${
              targetEntity.id
            }`
          )
        }
      }
    }
  }

  return `${lines.join('\n')}\n`
}

fs.mkdirSync(outputRoot, { recursive: true })
for (const view of views) {
  const content = createDiagram(view)
  const sourcePath = path.join(outputRoot, `${view.file}.mmd`)
  const svgPath = path.join(outputRoot, `${view.file}.svg`)
  fs.writeFileSync(sourcePath, content)
  execFileSync(
    process.execPath,
    [mermaidCli, '-i', sourcePath, '-o', svgPath],
    {
      stdio: 'inherit',
    }
  )
  console.log(`Generated draft/diagrams/${view.file}.svg`)
}
