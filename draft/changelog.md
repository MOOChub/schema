# MOOChub v4 Changelog

This file records the intent and scope of the v4 profile. The complete,
field-by-field migration instructions are in [migration-guide.md](migration-guide.md).

## v4.0.0 draft

### Transport and resource model

- Replaced the v3 course feed shape with a paginated JSON:API catalog.
- Added explicit catalog resource types for `courses`, `programs`,
  `credentials`, `persons`, `organizations`, and `locations`; As such these
  resources now all require an `id` and a JSON-LD `type` for independent harvesting.
- Added stable JSON:API resource identifiers and separate semantic JSON-LD
  identifiers for independently harvestable resources.
- Added pagination, filtering, stable ordering, individual resource URLs, and
  incremental harvesting guidance.
- Moved the schemas to JSON Schema Draft 2020-12 and split the profile into
  reusable components.
- Pinned reused AMB schemas to the `20231019` release and published a separate
  MOOChub JSON-LD context.

### Course profile

- Added required course `id` and JSON-LD `type`; `url`, `name`, `publisher`,
  `creator`, and `license` remain required.
- name is now a localized string; `description` is now rich text. `abstract` is a new optional localized string for short summaries.
- Replaced the v3 `workload` object with schema.org `timeRequired`.
- Replaced the v3 `access` value with the AMB-compatible
  `isAccessibleForFree` boolean and `conditionsOfAccess` for login,
  enrollment, or other access requirements.
- Added `interactivityType`, `accessMode`, `coursePrerequisites`,
  `prerequisiteCourses`, `learningOutcomeSummary`, `assesses`,
  `aggregateRating`, `funder`, and richer competency/alignment structures.
- Replaced `hollandCode` with entries in
  `educationalAlignment` and clarified subject alignment frameworks.
- Added `isBasedOn`, `hasPart`, and `isPartOf` relationships.
- `license` properties are no longer arrays; a course or media object may have only one license.
- `license.url` is now `license.id`. If no license URL is available, the provider must omit `id` as null is not allowed.
- v3 `startDate`, `endDate`, `expires` are no longer DateTime arrays, but single date-time values. Use `CourseInstance`, `CourseEvent` and `Schedule` resources for multiple describing multiple dates.
- Removed `learningResourceType` from the MOOChub course profile;
- Replaced `Person.url` and `Organization.url` with `sameAs` allowing arrays of URLs for social media, homepages, and other references.
- Migrated `educationalLevel` to a `Concept` object with `inScheme`, `id` and `prefLabel` for better alignment with AMB and schema.org.
- Migrated `educationalAlignment` to an `AlignmentObject` with `alignmentType`, `educationalFramework`, and `targetName` or `targetUrl` for better alignment with AMB and schema.org.
- Migrated `audience` to an `Audience` object with `audienceType`, `suggestedAge` and `description`. New `audience.audienceType` allowed concept ids still match previous `audience`  vocabulary, still using the LRMI `audienceType` vocabulary.

### Course instances, programs, and credentials

- Moved dated offerings, course modes, instructors, application windows,
  dates, events, locations, and instance-specific offers into
  `hasCourseInstance` and `CourseInstance` resources.
- Added educational programs with ordered course parts, program modes,
  completion time, credits, prerequisites, application dates, and credentials.
- Added independently modeled educational credentials,
  credential categories, competency requirements, credential composition, and
  `isAwardedBy` course/program references.
- Added reusable person, organization, location, address, event, schedule,
  offer, concept, competency, alignment, rich-text, and reference schemas.

### Validation and semantics

- URI-valued identifiers and URLs use JSON Schema `uri` validation; course
  URLs, offer urls and media content URLs must use HTTPS.
- Localized strings and rich text are modeled explicitly, with supported
  formats validated by the schema.
- Omitted values and `null` are not interchangeable; providers should omit
  unavailable optional properties rather than inventing values.

See [migration-guide.md](migration-guide.md) for compatibility decisions,
conversion rules, and a verification checklist.
