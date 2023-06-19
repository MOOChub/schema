# MOOChub API Versioning

Due to changing requirements, the API may have to change from time to time.
Because external API clients cannot be rolled out as easily as a web version, managing these changes in a safe way is very important.
(More importantly, we cannot force all MOOChub participants to switch their code instantly.)

Thus, special care needs to be taken so that:

- changes to the API are backwards-compatible, or
- if there is no way to keep changes backwards-compatible, the old and new versions of the API should be run side-by-side for a while.

To benefit from this approach, API clients should always send along the version they were built against when requesting data from or sending data to the API.
This allows the API to respond with the correct version of the requested endpoint, and - if applicable - notify the client of the upcoming expiry of this version.

## Version Negotiation

When requesting data from an API endpoint, e.g. `bridges/moochub/courses`, the API will by default respond with the newest version of that endpoint:

~~~http
GET /bridges/moochub/courses HTTP/1.1

HTTP/1.1 200 OK
Content-Type: application/vnd.api+json; moochub-version=3.8
~~~

As explained above, clients should always send the number of the last major API version they support.
They can use the `Accept` header to specify the corresponding content type:

~~~http
GET /bridges/moochub/courses HTTP/1.1
Accept: application/vnd.api+json; moochub-version=2

HTTP/1.1 200 OK
Content-Type: application/vnd.api+json; moochub-version=2.1
~~~

Deprecated versions can be recognized based on the presence of the `Sunset` header:

~~~http
GET /bridges/moochub/courses HTTP/1.1
Accept: application/vnd.api+json; moochub-version=1

HTTP/1.1 200 OK
Content-Type: application/vnd.api+json; moochub-version=1.12
Sunset: Tue, 15 Aug 2017 00:00:00 GMT
~~~

This date signals the last day of support for the given API version.
It will be communicated within the MOOChub well in advance so that updates can be released in time.
The date should then be used by clients to monitor upcoming version changes.

## Client Implementation Guide

### For server-side code

1. When communicating with the API, send an appropriate `Accept` header that contains the API version the client was built against.
2. Check API responses for the presence of the `Sunset` header.
3. If the header is present, log the value and notify a developer.
4. The developer should verify how API changes in the latest non-deprecated version affect the client code.
   If applicable, breaking API changes should be taken care of.
5. Finally, use the latest version of the API by updating the `moochub-version` parameter that is part of the `Accept` header.
