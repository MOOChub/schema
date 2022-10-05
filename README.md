# MOOChub Schema

This repository contains specification files for data exchange between MOOC providers participating in the [MOOChub](https://moochub.org). Based on previous work regarding [MOOC standards](https://github.com/openHPI/mooc-standards), the JSON format specified enables a seamless exchange of course information, instructors, and the institutes offering a course. Minimal information is required per course to ease onboarding for new partners while allowing customizability to fit individual needs.

## Specification

The MOOChub API specification consists of two major parts: (1) A JSON format and (2) an API versioning concept.

1. JSON format

   The JSON format specified in this repository is based on the [JSON:API](https://jsonapi.org) schema and uses their proposed pagination approach. In a valid response, only a few attributes must be present, most can be omitted or can be `null`. As we see a semantical difference between an omitted and a `null` value, we kindly ask you to provide as much information as possible.

2. API versioning concept

   Upon request of the API, the server and client might negotiate the most suitable version of the API using HTTP headers. Please refer to the [dedicated versioning specification](moochub-versioning.md) for more details.

## Releases

The [latest finalized version](https://github.com/moochub/schema/releases/latest) of the schema is released in this repository and tagged appropriately. All MOOChub compliant software is requested to implement the versioning as outlined in the [dedicated API versioning specification](moochub-versioning.md). We follow a [semantic versioning](https://semver.org) approach for all releases to ease consuming schema-compliant APIs.

## Contributions

The schema is mainly driven by the [MOOChub organization and their partners](https://moochub.org/partners/). Therefore, it is designed to provide a consistent and uniform mechanism to transport required information between the partners. We will evolve the schema based on requirements introduced by partners and consumers. Additional contributions to the schema are welcome and will be considered for an upcoming release. Please create an issue or a pull request to start contributing!

## Contact

If you have further questions or would like to get listed in the [MOOChub](https://moochub.org) using an endpoint following this schema, please drop us a mail at office@moochub.org.
